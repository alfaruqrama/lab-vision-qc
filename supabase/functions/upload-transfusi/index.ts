import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-session-token',
};

// ─── Google Drive API Helpers ───────────────────────────────────────────────

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

function getServiceAccountKey(): ServiceAccountKey {
  const raw = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY not set');
  return JSON.parse(raw);
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getAccessToken(sa: ServiceAccountKey): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/drive.file',
    aud: sa.token_uri || 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  // Import RSA private key from PEM PKCS#8
  const keyData = pemToArrayBuffer(sa.private_key);
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const encoder = new TextEncoder();
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signatureInput = `${headerB64}.${payloadB64}`;
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(signatureInput),
  );
  const sigB64 = base64UrlEncode(String.fromCharCode(...new Uint8Array(sig)));
  const jwt = `${headerB64}.${payloadB64}.${sigB64}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(`Failed to get access token: ${JSON.stringify(tokenData)}`);
  }

  return tokenData.access_token;
}

async function findOrCreateFolder(
  accessToken: string,
  folderName: string,
  parentFolderId?: string,
): Promise<string> {
  // Search for existing folder
  let query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  if (parentFolderId) {
    query += ` and '${parentFolderId}' in parents`;
  }

  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&pageSize=1`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  const searchData = await searchRes.json();
  if (searchData.files?.length > 0) {
    return searchData.files[0].id;
  }

  // Create folder
  const metadata: Record<string, string> = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentFolderId) metadata.parents = [parentFolderId];

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });

  const createData = await createRes.json();
  if (!createRes.ok) {
    throw new Error(`Failed to create folder: ${JSON.stringify(createData)}`);
  }

  return createData.id;
}

async function uploadPdfToDrive(
  accessToken: string,
  base64Pdf: string,
  fileName: string,
  folderId: string,
): Promise<{ fileId: string; webViewLink: string }> {
  // Decode base64 to binary
  const binary = Uint8Array.from(atob(base64Pdf), (c) => c.charCodeAt(0));

  const boundary = '-------transfusi_upload_boundary';
  const metadata = JSON.stringify({
    name: fileName,
    mimeType: 'application/pdf',
    parents: [folderId],
  });

  const body = new Uint8Array([
    ...new TextEncoder().encode(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
      `--${boundary}\r\nContent-Type: application/pdf\r\nContent-Transfer-Encoding: base64\r\n\r\n`,
    ),
    ...binary,
    ...new TextEncoder().encode(`\r\n--${boundary}--\r\n`),
  ]);

  const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
      'Content-Length': String(body.length),
    },
    body,
  });

  const uploadData = await uploadRes.json();
  if (!uploadRes.ok) {
    throw new Error(`Failed to upload PDF: ${JSON.stringify(uploadData)}`);
  }

  return { fileId: uploadData.id, webViewLink: uploadData.webViewLink };
}

// ─── Main Handler ───────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { pdfBase64, patientName, medicalRecordNumber, notes, sessionToken } = body;

    if (!sessionToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing sessionToken' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!pdfBase64) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required field: pdfBase64' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Validate session ────────────────────────────────────────────────
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

    const { data: sessions, error: sessionError } = await supabaseClient
      .from('sessions')
      .select('token, user_id, expires_at')
      .eq('token', sessionToken)
      .limit(1);

    if (sessionError || !sessions || sessions.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const session = sessions[0];
    if (new Date(session.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ success: false, error: 'Session expired' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: profiles, error: profileError } = await supabaseClient
      .from('profiles')
      .select('id, username, nama, role, is_active')
      .eq('id', session.user_id)
      .limit(1);

    if (profileError || !profiles || profiles.length === 0 || !profiles[0].is_active) {
      return new Response(
        JSON.stringify({ success: false, error: 'User account is inactive' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const profile = profiles[0];
    console.log('[Transfusi] User authenticated:', profile.username);

    // ── Upload to Google Drive ──────────────────────────────────────────
    const sa = getServiceAccountKey();
    const accessToken = await getAccessToken(sa);

    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');

    // Build folder path: Transfusi > YYYY > MM
    const rootFolderId = await findOrCreateFolder(accessToken, 'Transfusi');
    const yearFolderId = await findOrCreateFolder(accessToken, year, rootFolderId);
    const monthFolderId = await findOrCreateFolder(accessToken, month, yearFolderId);

    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const patientLabel = patientName ? patientName.replace(/\s+/g, '_').slice(0, 30) : 'Pasien';
    const fileName = `Transfusi_${patientLabel}_${timestamp}.pdf`;

    const { fileId, webViewLink } = await uploadPdfToDrive(accessToken, pdfBase64, fileName, monthFolderId);

    console.log('[Transfusi] PDF uploaded to Drive:', fileId);

    // ── Insert to database ──────────────────────────────────────────────
    const requestDate = now.toISOString().split('T')[0];
    const { data: inserted, error: insertError } = await supabaseClient
      .from('transfusion_documents')
      .insert({
        patient_name: patientName || null,
        medical_record_number: medicalRecordNumber || null,
        request_date: requestDate,
        notes: notes || null,
        drive_file_id: fileId,
        drive_url: webViewLink,
        uploaded_by: profile.id,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[Transfusi] Insert error:', insertError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to save document record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        drive_file_id: fileId,
        drive_url: webViewLink,
        document_id: inserted.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (error) {
    console.error('[Transfusi] Unexpected error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
