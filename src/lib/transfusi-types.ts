
export interface TransfusiDocument {
  id: string;
  patient_name: string | null;
  medical_record_number: string | null;
  request_date: string;
  notes: string | null;
  drive_file_id: string | null;
  drive_url: string | null;
  uploaded_by: string | null;
  created_at: string;
  // ─── Metadata bank darah (migration 009) ───
  blood_product: BloodProduct | null;
  bag_count: number | null;
  blood_type_rh: BloodTypeRh | null;
  bag_number: string | null;
  inform_concern: boolean | null;
  surat_permintaan: boolean | null;
  form_reaksi: boolean | null;
  origin: BloodOrigin | null;
}

// ─── Konstanta domain bank darah ────────────────────────────────────────────

export type BloodProduct = 'PRC' | 'WB' | 'TC' | 'FFP' | 'PRC_LEUKOREDUCED';
export type BloodTypeRh = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
export type BloodOrigin = 'GRESIK' | 'SURABAYA';

export const BLOOD_PRODUCTS: { value: BloodProduct; label: string }[] = [
  { value: 'PRC', label: 'PRC (Packed Red Cells)' },
  { value: 'WB', label: 'WB (Whole Blood)' },
  { value: 'TC', label: 'TC (Thrombocyte Concentrate)' },
  { value: 'FFP', label: 'FFP (Fresh Frozen Plasma)' },
  { value: 'PRC_LEUKOREDUCED', label: 'PRC Leukoreduced' },
];

export const BLOOD_TYPES_RH: BloodTypeRh[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export const BLOOD_ORIGINS: { value: BloodOrigin; label: string }[] = [
  { value: 'GRESIK', label: 'Gresik' },
  { value: 'SURABAYA', label: 'Surabaya' },
];

/** Label pendek untuk kartu/badge — hasil: "PRC", "WB", "PRC Leukoreduced" */
export function bloodProductLabel(value: string | null): string {
  if (!value) return '—';
  return BLOOD_PRODUCTS.find((p) => p.value === value)?.label.split(' (')[0] ?? value;
}

// ─── Batas ukuran payload ───────────────────────────────────────────────────
//
// Body request melewati gateway Supabase sebelum sampai ke Edge Function.
// Kalau terlalu besar, gateway menolak dengan respons teks biasa (bukan JSON)
// dan pesannya tidak informatif. Angka ini dipakai bersama oleh generator PDF
// (untuk mengecilkan diri otomatis) dan lapisan API (untuk memeriksa sebelum
// mengirim).

/** Target maksimum base64 PDF yang dikirim ke Edge Function. */
export const MAX_PAYLOAD_BYTES = 4 * 1024 * 1024;

/** Target yang lebih ketat saat membangun PDF, agar ada ruang aman. */
export const PDF_TARGET_BYTES = 3 * 1024 * 1024;

/** Format byte jadi teks yang enak dibaca. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Payload upload ─────────────────────────────────────────────────────────

export interface UploadTransfusiMetadata {
  patientName: string;
  medicalRecordNumber: string;
  bloodProduct: BloodProduct;
  bagCount: number;
  bloodTypeRh: BloodTypeRh;
  bagNumber: string;
  origin: BloodOrigin;
  requestDate?: string;
  informConcern?: boolean;
  suratPermintaan?: boolean;
  formReaksi?: boolean;
  petugas?: string;
  notes?: string;
}

export interface UploadTransfusiRequest extends UploadTransfusiMetadata {
  pdfBase64: string;
  sessionToken: string;
}

export interface UploadTransfusiResponse {
  success: boolean;
  drive_file_id?: string;
  drive_url?: string;
  document_id?: string;
  file_name?: string;
  error?: string;
}

export interface TransfusiFilters {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  bloodProduct?: BloodProduct;
}
