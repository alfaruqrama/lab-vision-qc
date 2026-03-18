import type { LotConfig, QCRecord } from './types';

// 1. Masukkan masing-masing URL Web App Google Apps Script di sini
const URL_KUNJUNGAN = 'https://script.google.com/macros/s/AKfycbw3obd6r4nhhXJDNu-anTwnYeG8Bzy7DQR5oWf4kyqm-Fpgzxj1CJNNEEeI-8LPKf0saQ/exec'; // URL GS Kunjungan
const URL_QC = '';        // URL GS QC
const URL_SUHU = '';      // URL GS Suhu

// Cek apakah minimal aplikasi sudah punya URL QC untuk keluar dari Demo Mode
export function isConnected(): boolean {
  return URL_QC.length > 0; 
}

// 2. Modifikasi fungsi get agar menerima baseUrl target
async function get(baseUrl: string, action: string, params: Record<string, string> = {}): Promise<any> {
  if (!baseUrl) throw new Error('Demo mode atau URL belum disetting');
  
  const url = new URL(baseUrl);
  url.searchParams.set('action', action);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// 3. Modifikasi fungsi post agar menerima baseUrl target
async function post(baseUrl: string, action: string, data: any): Promise<any> {
  if (!baseUrl) throw new Error('Demo mode atau URL belum disetting');
  
  const res = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, data }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ==========================================
// FUNGSI UNTUK QC (Read & Write)
// ==========================================
export async function fetchAllRecords(): Promise<QCRecord[]> {
  return get(URL_QC, 'getAll');
}

export async function fetchRecordsByMonth(month: string): Promise<QCRecord[]> {
  return get(URL_QC, 'getByMonth', { month });
}

export async function fetchConfig(): Promise<LotConfig> {
  return get(URL_QC, 'getKonfig');
}

export async function saveRecord(record: QCRecord): Promise<any> {
  return post(URL_QC, 'save', record);
}

export async function saveConfig(config: LotConfig): Promise<any> {
  return post(URL_QC, 'saveKonfig', config);
}

export async function readStruk(image: string, mediaType: string, alat: string): Promise<any> {
  return post(URL_QC, 'readStruk', { image, mediaType, alat });
}

// ==========================================
// FUNGSI UNTUK SUHU (Read & Write)
// ==========================================
// Contoh jika ada fungsi untuk mengambil dan menyimpan suhu
export async function fetchSuhuRecords(): Promise<any> {
  return get(URL_SUHU, 'getSuhu');
}

export async function saveSuhuRecord(data: any): Promise<any> {
  return post(URL_SUHU, 'saveSuhu', data);
}

// ==========================================
// FUNGSI UNTUK KUNJUNGAN (Hanya Read)
// ==========================================

// 1. Mengambil ringkasan bulan aktif beserta data per bulannya
// (Sesuai dengan action: 'getSummary' di kode.gs)
export async function fetchKunjunganSummary(): Promise<any> {
  return get(URL_KUNJUNGAN, 'getSummary');
}

// 2. Mengambil seluruh data kunjungan
// (Sesuai dengan action: 'allData' di kode.gs)
export async function fetchAllKunjunganData(): Promise<any> {
  return get(URL_KUNJUNGAN, 'allData');
}

// 3. Mengambil data kumulatif kunjungan & omzet
// (Sesuai dengan action: 'getKumulatif' di kode.gs)
export async function fetchKunjunganKumulatif(): Promise<any> {
  return get(URL_KUNJUNGAN, 'getKumulatif');
}

// 4. Mengecek apakah server GS Kunjungan sedang aktif/merespons
// (Sesuai dengan action: 'ping' di kode.gs)
export async function pingKunjungan(): Promise<any> {
  return get(URL_KUNJUNGAN, 'ping');
}
