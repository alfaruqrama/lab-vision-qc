import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-session-token',
};

// ─── Nilai domain yang diizinkan (whitelist) ────────────────────────────────
// Nilai dari client tidak dipercaya begitu saja; apa pun di luar daftar ini
// akan di-null-kan sebelum disimpan.

const BLOOD_PRODUCTS = ['PRC', 'WB', 'TC', 'FFP', 'PRC_LEUKOREDUCED'] as const;
const BLOOD_TYPES_RH = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
const BLOOD_ORIGINS = ['GRESIK', 'SURABAYA'] as const;

function pickEnum<T extends readonly string[]>(
  value: unknown,
  allowed: T,
): T[number] | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T[number])
    : null;
}

/**
 * Nama file aman untuk Google Drive.
 * Hanya menyisakan huruf/angka/tanda hubung — sisanya jadi underscore,
 * lalu dipadatkan agar tidak ada deretan underscore.
 */
function sanitizeForFileName(value: string, maxLength = 40): string {
  return value
    .trim()
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_')
    .slice(0, maxLength);
}

/** '2026-09-26' → '20260926'. Tahan input tak valid. */
function toCompactDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) return new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${match[1]}${match[2]}${match[3]}`;
}

/** Terima hanya ISO date (YYYY-MM-DD); selain itu null. */
function parseRequestDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  const parsed = new Date(`${y}-${m}-${d}T00:00:00Z`);
  // Tolak tanggal yang tidak ada, mis. 2026-02-31
  if (Number.isNaN(parsed.getTime()) || parsed.getUTCDate() !== Number(d)) return null;
  return `${y}-${m}-${d}`;
}

// ─── Google Drive API Helpers ───────────────────────────────────────────────

/**
 * Baca respons sebagai teks dulu, baru coba parse JSON.
 *
 * Google (dan gateway lain) kadang menjawab dengan teks biasa seperti
 * "Malformed multipart body." — bukan JSON. Memanggil .json() langsung akan
 * melempar error parse yang menutupi pesan asli, sehingga sulit didiagnosis.
 */
async function readJsonResponse(
  res: Response,
  context: string,
): Promise<{ data: Record<string, unknown> | null; raw: string; wasJson: boolean }> {
  const raw = await res.text();

  try {
    const parsed = JSON.parse(raw);
    return { data: parsed, raw, wasJson: true };
  } catch {
    console.error(`[Transfusi] ${context}: respons bukan JSON`, {
      status: res.status,
      contentType: res.headers.get('content-type'),
      body: raw.slice(0, 500),
    });
    return { data: null, raw, wasJson: false };
  }
}

/** Rangkai pesan error yang memuat pesan asli dari server. */
function describeFailure(context: string, status: number, raw: string): string {
  const detail = raw.slice(0, 300).trim() || '(respons kosong)';
  return `${context} (HTTP ${status}): ${detail}`;
}

function requireSecret(name: string): string {
  const value = Deno.env.get(name)?.trim() ?? '';
  if (!value) {
    throw new Error(
      `${name} belum di-set. Jalankan: bash scripts/setup-drive-secrets.sh`,
    );
  }
  return value;
}

/**
 * Tukar refresh token OAuth akun Gmail pemilik folder jadi access token.
 *
 * Bukan service account: file yang diunggah jadi milik akun Gmail, kuota
 * My Drive-nya yang terpakai. Service account tidak punya kuota (HTTP 403).
 *
 * Scope: `drive` (bukan `drive.file`). `drive.file` hanya melihat berkas yang
 * dibuat/dibuka lewat app ini — folder "Berkas Transfusi" yang sudah ada di
 * Drive user tidak terlihat, files.get/files.list ke folder itu 404.
 * Personal-use (<100 user dikenal) tidak wajib verifikasi Google.
 */
async function getAccessToken(): Promise<string> {
  const clientId = requireSecret('GOOGLE_OAUTH_CLIENT_ID');
  const clientSecret = requireSecret('GOOGLE_OAUTH_CLIENT_SECRET');
  const refreshToken = requireSecret('GOOGLE_OAUTH_REFRESH_TOKEN');

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  const { data: tokenData, raw: tokenRaw } = await readJsonResponse(
    tokenRes,
    'getAccessToken',
  );

  if (!tokenRes.ok || !tokenData?.access_token) {
    const err = typeof tokenData?.error === 'string' ? tokenData.error : '';
    const desc =
      typeof tokenData?.error_description === 'string'
        ? tokenData.error_description
        : tokenRaw;
    if (err === 'invalid_grant') {
      throw new Error(
        'Refresh token Google tidak valid atau sudah dicabut (invalid_grant). ' +
          'Jalankan ulang scripts/mint-gdrive-oauth.sh (app harus In production), ' +
          'lalu pasang secret. Detail: ' +
          desc.slice(0, 200),
      );
    }
    throw new Error(
      describeFailure('Gagal mengambil access token Google', tokenRes.status, tokenRaw),
    );
  }

  return tokenData.access_token as string;
}

/**
 * ID folder root di My Drive akun Gmail yang diotorisasi.
 * Folder milik akun itu sendiri — tidak perlu di-share ke service account.
 */
function getRootFolderId(): string {
  return requireSecret('GDRIVE_TRANSFUSI_FOLDER_ID');
}

/**
 * Pastikan folder root ada dan terlihat oleh akun Gmail yang diotorisasi.
 * Gagal lebih awal dengan pesan jelas, daripada error samar saat upload.
 */
async function assertFolderAccessible(
  accessToken: string,
  folderId: string,
): Promise<{ id: string; name: string }> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=id,name,mimeType,trashed&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  const { data, raw } = await readJsonResponse(res, 'assertFolderAccessible');

  if (!res.ok || !data) {
    throw new Error(
      `Folder Drive tidak bisa diakses. Pastikan GDRIVE_TRANSFUSI_FOLDER_ID benar dan akun Gmail yang diotorisasi punya akses ke folder itu. ${describeFailure('Google Drive', res.status, raw)}`,
    );
  }
  if (data.mimeType !== 'application/vnd.google-apps.folder') {
    throw new Error(`ID yang diberikan bukan folder Drive: ${folderId}`);
  }
  if (data.trashed) {
    throw new Error(`Folder Drive berada di Trash: ${folderId}`);
  }

  return { id: data.id as string, name: data.name as string };
}

async function findOrCreateFolder(
  accessToken: string,
  folderName: string,
  parentFolderId: string,
): Promise<string> {
  // Cari folder yang sudah ada di dalam parent
  const query = `name='${folderName.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false and '${parentFolderId}' in parents`;

  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&pageSize=1&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  const { data: searchData, raw: searchRaw } = await readJsonResponse(
    searchRes,
    'findOrCreateFolder(search)',
  );

  if (!searchRes.ok) {
    throw new Error(describeFailure('Gagal mencari folder di Drive', searchRes.status, searchRaw));
  }

  const found = (searchData?.files as { id: string }[] | undefined) ?? [];
  if (found.length > 0) {
    return found[0].id;
  }

  // Buat folder baru di dalam parent
  const createRes = await fetch(
    'https://www.googleapis.com/drive/v3/files?fields=id&supportsAllDrives=true',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId],
      }),
    },
  );

  const { data: createData, raw: createRaw } = await readJsonResponse(
    createRes,
    'findOrCreateFolder(create)',
  );

  if (!createRes.ok || !createData?.id) {
    throw new Error(
      `Gagal membuat folder "${folderName}". ${describeFailure('Google Drive', createRes.status, createRaw)}`,
    );
  }

  return createData.id as string;
}

async function uploadPdfToDrive(
  accessToken: string,
  base64Pdf: string,
  fileName: string,
  folderId: string,
): Promise<{ fileId: string; webViewLink: string }> {
  // base64 → byte mentah
  const binary = Uint8Array.from(atob(base64Pdf), (c) => c.charCodeAt(0));

  const boundary = '-------transfusi_upload_boundary';
  const metadata = JSON.stringify({
    name: fileName,
    mimeType: 'application/pdf',
    parents: [folderId],
  });

  // Bagian biner DIKIRIM MENTAH, jadi part-nya tidak boleh mengaku base64.
  //
  // Versi sebelumnya menulis `Content-Transfer-Encoding: base64` padahal isinya
  // byte PDF mentah. Google mencoba meng-base64-decode isi itu, gagal, lalu
  // menjawab teks biasa "Malformed multipart body." — yang kemudian memicu
  // error parse JSON yang membingungkan di sisi klien.
  const body = new Uint8Array([
    ...new TextEncoder().encode(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
      `--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`,
    ),
    ...binary,
    ...new TextEncoder().encode(`\r\n--${boundary}--\r\n`),
  ]);

  // Content-Length sengaja TIDAK di-set manual — runtime fetch sudah
  // menghitungnya dari Uint8Array. Menyetelnya sendiri berisiko membuat
  // body terpotong dan multipart-nya jadi tidak valid.
  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink&supportsAllDrives=true',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );

  const { data: uploadData, raw: uploadRaw } = await readJsonResponse(
    uploadRes,
    'uploadPdfToDrive',
  );

  if (!uploadRes.ok || !uploadData?.id) {
    throw new Error(
      `Gagal mengunggah PDF ke Drive. ${describeFailure('Google Drive', uploadRes.status, uploadRaw)}`,
    );
  }

  return {
    fileId: uploadData.id as string,
    webViewLink: uploadData.webViewLink as string,
  };
}

// ─── Main Handler ───────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      pdfBase64,
      sessionToken,
      patientName,
      medicalRecordNumber,
      notes,
      bagNumber,
      bloodProduct,
      bagCount,
      bloodTypeRh,
      origin,
      requestDate,
      informConcern,
      suratPermintaan,
      formReaksi,
    } = body;

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

    // ── Identitas pasien wajib ──────────────────────────────────────────
    // Berkas rekam medis tanpa identitas tidak bisa ditelusuri kembali.
    const trimmedName = typeof patientName === 'string' ? patientName.trim() : '';
    const trimmedRm = typeof medicalRecordNumber === 'string' ? medicalRecordNumber.trim() : '';

    if (!trimmedName && !trimmedRm) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Nama pasien dan No. RM wajib diisi agar berkas bisa ditelusuri',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    if (!trimmedName) {
      return new Response(
        JSON.stringify({ success: false, error: 'Nama pasien wajib diisi' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    if (!trimmedRm) {
      return new Response(
        JSON.stringify({ success: false, error: 'No. RM wajib diisi' }),
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
    const accessToken = await getAccessToken();

    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');

    // Folder root = My Drive akun Gmail yang diotorisasi (secret folder ID).
    // Subfolder tahun/bulan dibuat di dalamnya, kuota Gmail yang terpakai.
    const rootFolderId = getRootFolderId();
    await assertFolderAccessible(accessToken, rootFolderId);

    const yearFolderId = await findOrCreateFolder(accessToken, year, rootFolderId);
    const monthFolderId = await findOrCreateFolder(accessToken, month, yearFolderId);

    // ── Normalisasi payload ─────────────────────────────────────────────
    const validProduct = pickEnum(bloodProduct, BLOOD_PRODUCTS);
    const validBloodType = pickEnum(bloodTypeRh, BLOOD_TYPES_RH);
    const validOrigin = pickEnum(origin, BLOOD_ORIGINS);
    const parsedBagCount = Math.min(
      99,
      Math.max(1, Number.parseInt(String(bagCount ?? '1'), 10) || 1),
    );
    const trimmedBagNumber = typeof bagNumber === 'string' ? bagNumber.trim().slice(0, 200) : '';

    // Tanggal permintaan dihormati; fallback ke hari ini bila tidak dikirim.
    const effectiveDate = parseRequestDate(requestDate) ?? now.toISOString().split('T')[0];

    // ── Nama file: Nama_RM_YYYYMMDD_Produk.pdf ──────────────────────────
    const patientLabel = sanitizeForFileName(trimmedName, 30) || 'Pasien';
    const rmLabel = sanitizeForFileName(trimmedRm, 20) || 'NoRM';
    const dateLabel = toCompactDate(effectiveDate);
    const productLabel = validProduct ? `_${validProduct}` : '';
    const fileName = `Transfusi_${patientLabel}_${rmLabel}_${dateLabel}${productLabel}.pdf`;

    const { fileId, webViewLink } = await uploadPdfToDrive(
      accessToken,
      pdfBase64,
      fileName,
      monthFolderId,
    );

    console.log('[Transfusi] PDF uploaded to Drive:', fileId);

    // ── Insert to database ──────────────────────────────────────────────
    const { data: inserted, error: insertError } = await supabaseClient
      .from('transfusion_documents')
      .insert({
        patient_name: trimmedName,
        medical_record_number: trimmedRm,
        request_date: effectiveDate,
        notes: typeof notes === 'string' && notes.trim() ? notes.trim() : null,
        drive_file_id: fileId,
        drive_url: webViewLink,
        uploaded_by: profile.id,
        blood_product: validProduct,
        bag_count: parsedBagCount,
        blood_type_rh: validBloodType,
        bag_number: trimmedBagNumber || null,
        inform_concern: informConcern !== false,
        surat_permintaan: suratPermintaan !== false,
        form_reaksi: formReaksi !== false,
        origin: validOrigin,
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
        file_name: fileName,
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
