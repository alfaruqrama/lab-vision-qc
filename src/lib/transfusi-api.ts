import { getStoredAuth } from './auth-api';
import { createSupabaseClient } from './supabase';
import { isConnected } from './api';
import type {
  TransfusiDocument,
  TransfusiFilters,
  UploadTransfusiMetadata,
  UploadTransfusiResponse,
} from './transfusi-types';
import { MAX_PAYLOAD_BYTES, formatBytes } from './transfusi-types';

// ─── Cache offline (localStorage) ───────────────────────────────────────────
//
// CATATAN PRIVASI: cache ini menyimpan nama & nomor RM pasien di browser.
// Hanya dipakai saat Supabase tidak terkonfigurasi (mode offline/demo) —
// pada mode terhubung, React Query yang menangani cache dan data pasien
// TIDAK ditulis ke localStorage.

const LOCAL_STORAGE_KEY = 'lab_transfusi_documents';

function loadLocalDocuments(): TransfusiDocument[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalDocuments(docs: TransfusiDocument[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(docs.slice(0, 500)));
  } catch {
    // Kuota penuh / localStorage diblokir — cache offline bersifat opsional
  }
}

// ─── Read ───────────────────────────────────────────────────────────────────

export async function fetchDocuments(filters?: TransfusiFilters): Promise<TransfusiDocument[]> {
  if (!isConnected()) {
    return filterLocal(loadLocalDocuments(), filters);
  }

  const auth = getStoredAuth();
  if (!auth) return [];

  const client = createSupabaseClient(auth.token);

  let query = client
    .from('transfusion_documents')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters?.search) {
    const q = `%${filters.search}%`;
    query = query.or(
      `patient_name.ilike.${q},medical_record_number.ilike.${q},bag_number.ilike.${q}`,
    );
  }
  if (filters?.dateFrom) query = query.gte('request_date', filters.dateFrom);
  if (filters?.dateTo) query = query.lte('request_date', filters.dateTo);
  if (filters?.bloodProduct) query = query.eq('blood_product', filters.bloodProduct);

  const { data, error } = await query;
  if (error) {
    console.error('Fetch transfusi documents error:', error);
    return [];
  }
  return (data || []) as TransfusiDocument[];
}

function filterLocal(docs: TransfusiDocument[], filters?: TransfusiFilters): TransfusiDocument[] {
  let result = docs;

  if (filters?.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (d) =>
        (d.patient_name || '').toLowerCase().includes(q) ||
        (d.medical_record_number || '').toLowerCase().includes(q) ||
        (d.bag_number || '').toLowerCase().includes(q),
    );
  }
  if (filters?.dateFrom) result = result.filter((d) => d.request_date >= filters.dateFrom!);
  if (filters?.dateTo) result = result.filter((d) => d.request_date <= filters.dateTo!);
  if (filters?.bloodProduct) result = result.filter((d) => d.blood_product === filters.bloodProduct);

  return result.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export async function fetchDocumentById(id: string): Promise<TransfusiDocument | null> {
  if (!isConnected()) {
    return loadLocalDocuments().find((d) => d.id === id) || null;
  }
  const auth = getStoredAuth();
  if (!auth) return null;
  const client = createSupabaseClient(auth.token);
  const { data, error } = await client
    .from('transfusion_documents')
    .select('*')
    .eq('id', id)
    .single();
  if (error) {
    console.error('Fetch transfusi document error:', error);
    return null;
  }
  return data as TransfusiDocument;
}

// ─── Upload ─────────────────────────────────────────────────────────────────

export async function uploadToDrive(
  pdfBase64: string,
  metadata: UploadTransfusiMetadata,
): Promise<UploadTransfusiResponse> {
  const auth = getStoredAuth();
  if (!auth) throw new Error('Sesi login habis, silakan login ulang');

  const functionUrl =
    import.meta.env.VITE_EDGE_FUNCTION_URL ||
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-transfusi`;

  if (!functionUrl || functionUrl.startsWith('undefined')) {
    throw new Error('VITE_SUPABASE_URL atau VITE_EDGE_FUNCTION_URL belum dikonfigurasi');
  }

  // base64 hanya berisi karakter ASCII, jadi panjang string ≈ ukuran byte
  const payloadBytes = pdfBase64.length;
  console.log(
    `[Transfusi] Mengirim PDF: ${formatBytes(payloadBytes)} (base64), batas ${formatBytes(MAX_PAYLOAD_BYTES)}`,
  );

  if (payloadBytes > MAX_PAYLOAD_BYTES) {
    throw new Error(
      `PDF terlalu besar (${formatBytes(payloadBytes)} dari batas ${formatBytes(MAX_PAYLOAD_BYTES)}). ` +
        `Coba kurangi jumlah halaman foto.`,
    );
  }

  const res = await fetch(functionUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pdfBase64,
      sessionToken: auth.token,
      ...metadata,
    }),
  });

  // Baca sebagai teks dulu, baru coba parse.
  //
  // Kalau gateway platform yang menolak (mis. payload melebihi batas), body-nya
  // teks biasa seperti "Malformed ...". Memanggil res.json() langsung akan
  // melempar error parse dan menutupi pesan asli server.
  const rawBody = await res.text();

  let result: UploadTransfusiResponse;
  try {
    result = JSON.parse(rawBody);
  } catch {
    const snippet = rawBody.slice(0, 300).trim();
    console.error('[Transfusi] Respons bukan JSON:', {
      status: res.status,
      contentType: res.headers.get('content-type'),
      sentBytes: payloadBytes,
      body: snippet,
    });
    throw new Error(
      `Server menolak permintaan (HTTP ${res.status}, terkirim ${formatBytes(payloadBytes)}): ` +
        `${snippet || 'respons kosong'}`,
    );
  }

  if (!res.ok || !result.success) {
    throw new Error(result.error || `HTTP ${res.status}`);
  }

  // Cache offline hanya saat Supabase tidak terkonfigurasi — pada mode
  // terhubung, data pasien tidak ditulis ke localStorage.
  if (!isConnected() && result.document_id) {
    const now = new Date().toISOString();
    const docs = loadLocalDocuments();
    docs.unshift({
      id: result.document_id,
      patient_name: metadata.patientName,
      medical_record_number: metadata.medicalRecordNumber,
      request_date: metadata.requestDate || now.split('T')[0],
      notes: metadata.notes || null,
      drive_file_id: result.drive_file_id || null,
      drive_url: result.drive_url || null,
      uploaded_by: auth.id || null,
      created_at: now,
      blood_product: metadata.bloodProduct,
      bag_count: metadata.bagCount,
      blood_type_rh: metadata.bloodTypeRh,
      bag_number: metadata.bagNumber,
      inform_concern: metadata.informConcern ?? true,
      surat_permintaan: metadata.suratPermintaan ?? true,
      form_reaksi: metadata.formReaksi ?? true,
      origin: metadata.origin,
    });
    saveLocalDocuments(docs);
  }

  return result;
}

// ─── Delete ─────────────────────────────────────────────────────────────────

export async function deleteDocument(id: string): Promise<void> {
  if (!isConnected()) {
    saveLocalDocuments(loadLocalDocuments().filter((d) => d.id !== id));
    return;
  }
  const auth = getStoredAuth();
  if (!auth) throw new Error('Sesi login habis, silakan login ulang');
  const client = createSupabaseClient(auth.token);
  const { error } = await client.from('transfusion_documents').delete().eq('id', id);
  if (error) {
    console.error('Delete transfusi document error:', error);
    throw new Error(error.message);
  }
}
