/**
 * Penulisan arsip dokumen transfusi ke Google Sheet.
 *
 * Memakai Google Sheets REST API v4 langsung (bukan Apps Script), konsisten
 * dengan cara modul Transfusi mengakses Drive. Butuh scope
 * `https://www.googleapis.com/auth/spreadsheets` pada refresh token — lihat
 * scripts/mint-gdrive-oauth.sh.
 *
 * Sifatnya best-effort: kegagalan menulis ke Sheet TIDAK boleh menggagalkan
 * unggahan PDF, karena berkas rekam medis di Drive adalah sumber utama.
 */

/** Nama tab (sheet) tujuan di dalam spreadsheet. */
export const SHEET_TAB_NAME = 'Arsip Transfusi';

/**
 * Urutan kolom arsip. Satu-satunya sumber kebenaran posisi kolom — jangan
 * menaruh urutan kolom di tempat lain agar tidak bergeser diam-diam.
 */
export const SHEET_HEADERS = [
  'Waktu Input',
  'Nama Pasien',
  'No. Rekam Medis',
  'Tanggal Permintaan',
  'Produk Darah',
  'Jumlah Kantong',
  'Golongan Darah / Rh',
  'Nomor Kantong',
  'Asal Kantong',
  'Inform Concern',
  'Surat Permintaan Darah',
  'Form Reaksi Transfusi',
  'Catatan',
  'Petugas Input',
  'Status PDF',
  'Link Drive',
] as const;

export type SheetRow = string[];

/** Nilai kolom yang sudah dinormalisasi dari handler. */
export interface SheetRowInput {
  createdAt: string;
  patientName: string;
  medicalRecordNumber: string;
  requestDate: string;
  bloodProductLabel: string;
  bagCount: number;
  bloodTypeRh: string;
  bagNumber: string;
  originLabel: string;
  informConcern: boolean;
  suratPermintaan: boolean;
  formReaksi: boolean;
  notes: string;
  petugas: string;
  statusPdf: string;
  driveUrl: string;
}

/** Susun array nilai sesuai urutan SHEET_HEADERS. */
export function buildRow(input: SheetRowInput): SheetRow {
  return [
    input.createdAt,
    input.patientName,
    input.medicalRecordNumber,
    input.requestDate,
    input.bloodProductLabel,
    String(input.bagCount),
    input.bloodTypeRh,
    input.bagNumber,
    input.originLabel,
    input.informConcern ? '✓' : '—',
    input.suratPermintaan ? '✓' : '—',
    input.formReaksi ? '✓' : '—',
    input.notes,
    input.petugas,
    input.statusPdf,
    input.driveUrl,
  ];
}

// ─── Google Sheets API ──────────────────────────────────────────────────────

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

function rangeFor(tab: string, a1: string): string {
  // Nama tab yang memuat spasi harus dikutip dengan apostrof.
  return `${`'${tab.replace(/'/g, "''")}'`}!${a1}`;
}

async function readJson(res: Response): Promise<{ data: Record<string, unknown> | null; raw: string }> {
  const raw = await res.text();
  try {
    return { data: JSON.parse(raw), raw };
  } catch {
    return { data: null, raw };
  }
}

/** Terjemahkan error Google Sheets jadi pesan yang bisa ditindaklanjuti. */
function describeSheetsError(status: number, data: Record<string, unknown> | null, raw: string): string {
  const errObj = (data?.error ?? null) as { message?: string; status?: string } | null;
  const message = errObj?.message ?? raw.slice(0, 300);

  if (status === 403 && /insufficient|scope/i.test(message)) {
    return (
      'Token Google belum punya izin Google Sheets (scope `spreadsheets`). ' +
      'Jalankan ulang scripts/mint-gdrive-oauth.sh lalu pasang secret. ' +
      `Detail: ${message}`
    );
  }
  if (status === 404) {
    return `Spreadsheet tidak ditemukan. Periksa GTRANSFUSI_SHEET_ID. Detail: ${message}`;
  }
  if (status === 400 && /range|parse/i.test(message)) {
    return `Range atau nama tab tidak valid (cek nama tab "${SHEET_TAB_NAME}"). Detail: ${message}`;
  }
  return `Google Sheets menolak permintaan (HTTP ${status}): ${message}`;
}

/**
 * Pastikan baris header ada di baris pertama tab. Bila masih kosong, tulis
 * header. Bila sudah ada, tidak melakukan apa-apa.
 *
 * @returns jumlah baris yang ada saat ini (0 = baru dibuat)
 */
async function ensureHeader(accessToken: string, spreadsheetId: string): Promise<number> {
  const range = rangeFor(SHEET_TAB_NAME, 'A1:Z1');
  const getRes = await fetch(
    `${SHEETS_API}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  const { data, raw } = await readJson(getRes);
  if (!getRes.ok) {
    throw new Error(describeSheetsError(getRes.status, data, raw));
  }

  const values = (data?.values ?? []) as string[][];
  const firstRow = values[0] ?? [];
  const hasHeader = firstRow.length > 0 && String(firstRow[0]).trim() !== '';

  if (hasHeader) return firstRow.length;

  // Tab kosong — tulis header.
  const updateRange = rangeFor(SHEET_TAB_NAME, `A1:${columnLetter(SHEET_HEADERS.length)}1`);
  const putRes = await fetch(
    `${SHEETS_API}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(updateRange)}?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [SHEET_HEADERS] }),
    },
  );

  const { data: putData, raw: putRaw } = await readJson(putRes);
  if (!putRes.ok) {
    throw new Error(describeSheetsError(putRes.status, putData, putRaw));
  }

  return 0;
}

/**
 * Tambahkan satu baris arsip ke Google Sheet. Membuat header bila belum ada.
 *
 * @throws Error dengan pesan berbahasa Indonesia bila gagal.
 */
export async function appendTransfusiRow(
  accessToken: string,
  spreadsheetId: string,
  row: SheetRow,
): Promise<void> {
  await ensureHeader(accessToken, spreadsheetId);

  const appendRange = rangeFor(SHEET_TAB_NAME, 'A1');
  const res = await fetch(
    `${SHEETS_API}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(appendRange)}:append` +
      `?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [row] }),
    },
  );

  const { data, raw } = await readJson(res);
  if (!res.ok) {
    throw new Error(describeSheetsError(res.status, data, raw));
  }
}

/** 1 → 'A', 26 → 'Z', 27 → 'AA'. */
export function columnLetter(index: number): string {
  let n = index;
  let letters = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}
