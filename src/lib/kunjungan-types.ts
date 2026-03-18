// Kunjungan dashboard data types and helpers
export interface OmzetRow {
  d: number;
  petrokimia: number;
  perusahaan: number;
  bri: number;
  asuransi: number;
  prokMurni: number;
  prokBpjs: number;
  bpjsKes: number;
  bpjsTK: number;
  umum: number;
  total: number;
  target: number;
  pct: number;
}

export interface KunjunganRow {
  d: number;
  rjTotal: number;
  riTotal: number;
  igdTotal: number;
  mcuTotal: number;
  total: number;
  target: number;
  pct: number;
}

export interface McuRow {
  d: number;
  omzet: number;
}

export interface KunjunganData {
  omzet: Record<string, OmzetRow[]>;
  kunjungan: Record<string, KunjunganRow[]>;
  mcu: Record<string, McuRow[]>;
}

export const BULAN_ORDER = [
  'JANUARI','FEBRUARI','MARET','APRIL','MEI','JUNI',
  'JULI','AGUSTUS','SEPTEMBER','OKTOBER','NOVEMBER','DESEMBER'
];

export const BULAN_MAP: Record<string, string> = {
  JAN:'JANUARI', FEB:'FEBRUARI', MAR:'MARET', APR:'APRIL',
  MEI:'MEI', JUN:'JUNI', JUL:'JULI', AGS:'AGUSTUS',
  SEP:'SEPTEMBER', OKT:'OKTOBER', NOV:'NOVEMBER', DES:'DESEMBER',
};

export function normalizeMonthKeys<T>(obj: Record<string, T>): Record<string, T> {
  const result: Record<string, T> = {};
  for (const [k, v] of Object.entries(obj)) {
    result[BULAN_MAP[k.toUpperCase()] || k.toUpperCase()] = v;
  }
  return result;
}

export function sortMonths(months: string[]): string[] {
  return [...months].sort((a, b) => BULAN_ORDER.indexOf(a) - BULAN_ORDER.indexOf(b));
}

export function fmtRp(v: number): string {
  if (!v) return 'Rp 0';
  const jt = v / 1e6;
  if (jt >= 1000) return 'Rp ' + jt.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' jt';
  return 'Rp ' + jt.toFixed(1) + ' jt';
}

export function fmtRpFull(v: number): string {
  return 'Rp ' + Math.round(v).toLocaleString('id-ID');
}

export function badgeClass(pct: number): string {
  if (pct >= 150) return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300';
  if (pct >= 100) return 'bg-success/10 text-success border-success/20';
  if (pct >= 80) return 'bg-warning/10 text-warning border-warning/20';
  return 'bg-destructive/10 text-destructive border-destructive/20';
}

export const PAYERS = [
  { k: 'petrokimia', l: 'PT Petrokimia', c: '#dc2626' },
  { k: 'perusahaan', l: 'Perusahaan', c: '#2563eb' },
  { k: 'bri', l: 'BRI (PG)', c: '#f59e0b' },
  { k: 'asuransi', l: 'Asuransi', c: '#7c3aed' },
  { k: 'prokMurni', l: 'Prok. Murni', c: '#0891b2' },
  { k: 'prokBpjs', l: 'Prok. BPJS', c: '#059669' },
  { k: 'bpjsKes', l: 'BPJS Kes', c: '#0d9488' },
  { k: 'bpjsTK', l: 'BPJS TK', c: '#ea580c' },
  { k: 'umum', l: 'Umum', c: '#4f46e5' },
] as const;
