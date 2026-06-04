// B3 (Bahan Berbahaya dan Beracun) — domain types & constants

// ─── Enums ───

export type B3Kategori =
  | 'Reagen'
  | 'Disinfektan'
  | 'Pelarut'
  | 'Limbah Medis'
  | 'Gas Medis'
  | 'Lainnya';

export type HazardClass =
  | 'Mudah Terbakar'
  | 'Beracun'
  | 'Korosif'
  | 'Reaktif'
  | 'Iritan';

export type StorageLocation =
  | 'Lemari Asam'
  | 'Rak Reagen'
  | 'Lemari B3'
  | 'Gudang B3'
  | 'Kulkas Reagen'
  | 'Freezer'
  | 'Lainnya';

export type WasteType = 'Cair' | 'Padat' | 'Gas';

export type DisposalMethod =
  | 'Insinerasi'
  | 'Autoklaf'
  | 'Pihak Ketiga'
  | 'Belum Dibuang';

export type MovementType = 'masuk' | 'keluar';

// ─── Data types ───

export interface B3Material {
  id: string;
  kode: string;
  nama: string;
  kategori: B3Kategori;
  hazard_class: string;           // comma-separated from sheets, e.g. "Beracun, Korosif"
  storage_location: string;
  satuan: string;
  low_stock_threshold: number;
  is_active: boolean;
  created_at: string;
  // Computed by join
  current_stock?: number;
}

export interface B3Stock {
  id: string;
  material_id: string;
  batch_lot: string;
  initial_qty: number;
  current_qty: number;
  satuan: string;
  expiry_date: string;
  received_date: string;
  supplier: string;
  created_at: string;
  // Joined
  material_nama?: string;
  material_kode?: string;
}

export interface B3Pemakaian {
  id: string;
  material_id: string;
  stock_id: string;
  qty: number;
  satuan: string;
  tujuan: string;
  tanggal: string;
  jam: string;
  analis: string;
  catatan: string;
  created_at: string;
  // Joined
  material_nama?: string;
  material_kode?: string;
  batch_lot?: string;
}

export interface B3Limbah {
  id: string;
  material_id: string;
  waste_type: WasteType;
  qty: number;
  satuan: string;
  sumber: string;
  tanggal_generasi: string;
  disposal_method: string;
  manifest_no: string;
  tps_location: string;
  catatan: string;
  created_at: string;
  // Joined
  material_nama?: string;
  material_kode?: string;
}

export interface B3Dashboard {
  total_materials: number;
  low_stock_count: number;
  expiring_soon_count: number;
  expired_count: number;
  waste_month_total: number;
  waste_pending_count: number;
  recent_usage: B3Pemakaian[];
  recent_waste: B3Limbah[];
}

// ─── Constants ───

export const B3_KATEGORI: B3Kategori[] = [
  'Reagen',
  'Disinfektan',
  'Pelarut',
  'Limbah Medis',
  'Gas Medis',
  'Lainnya',
];

export const HAZARD_CLASSES: HazardClass[] = [
  'Mudah Terbakar',
  'Beracun',
  'Korosif',
  'Reaktif',
  'Iritan',
];

export const STORAGE_LOCATIONS: StorageLocation[] = [
  'Lemari Asam',
  'Rak Reagen',
  'Lemari B3',
  'Gudang B3',
  'Kulkas Reagen',
  'Freezer',
  'Lainnya',
];

export const SATUAN_LIST = ['mL', 'L', 'g', 'kg', 'tablet', 'buah', 'lembar'] as const;

export const WASTE_TYPES: WasteType[] = ['Cair', 'Padat', 'Gas'];

export const DISPOSAL_METHODS: DisposalMethod[] = [
  'Insinerasi',
  'Autoklaf',
  'Pihak Ketiga',
  'Belum Dibuang',
];

export const TUJUAN_LIST = [
  'Pemeriksaan PT',
  'Pemeriksaan APTT',
  'Pemeriksaan INR',
  'Pemeriksaan Na/K/Cl',
  'Pemeriksaan GDA',
  'Pemeriksaan Hematologi',
  'Pemeriksaan Kimia Klinik',
  'Pembersihan alat',
  'Sterilisasi',
  'Kalibrasi',
  'Pengenceran',
  'Quality Control',
  'Lainnya',
];

// ─── Hazard display config ───

export const HAZARD_CONFIG: Record<HazardClass, { bg: string; text: string; border: string; icon: string }> = {
  'Mudah Terbakar': { bg: 'bg-red-50 dark:bg-red-950/30', text: 'text-red-700 dark:text-red-400', border: 'border-red-200 dark:border-red-800', icon: '🔥' },
  'Beracun':       { bg: 'bg-purple-50 dark:bg-purple-950/30', text: 'text-purple-700 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-800', icon: '☠️' },
  'Korosif':       { bg: 'bg-orange-50 dark:bg-orange-950/30', text: 'text-orange-700 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800', icon: '🧪' },
  'Reaktif':       { bg: 'bg-yellow-50 dark:bg-yellow-950/30', text: 'text-yellow-700 dark:text-yellow-400', border: 'border-yellow-200 dark:border-yellow-800', icon: '💥' },
  'Iritan':        { bg: 'bg-green-50 dark:bg-green-950/30', text: 'text-green-700 dark:text-green-400', border: 'border-green-200 dark:border-green-800', icon: '⚠️' },
};

export function parseHazardClasses(raw: string): HazardClass[] {
  if (!raw) return [];
  return raw.split(',').map(s => s.trim()).filter((s): s is HazardClass => HAZARD_CLASSES.includes(s as HazardClass));
}

export function getExpiryStatus(expiryDate: string): 'expired' | 'expiring-soon' | 'ok' | 'unknown' {
  if (!expiryDate) return 'unknown';
  const exp = new Date(expiryDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  if (isNaN(exp.getTime())) return 'unknown';
  if (exp < now) return 'expired';
  const days = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (days <= 30) return 'expiring-soon';
  return 'ok';
}

export const EXPIRY_LABELS: Record<string, string> = {
  expired: 'Kadaluarsa',
  'expiring-soon': 'Akan Kadaluarsa',
  ok: 'Normal',
  unknown: 'Tidak Diketahui',
};

export const EXPIRY_COLORS: Record<string, string> = {
  expired: 'text-red-700 bg-red-50 border-red-200',
  'expiring-soon': 'text-amber-700 bg-amber-50 border-amber-200',
  ok: 'text-green-700 bg-green-50 border-green-200',
  unknown: 'text-gray-500 bg-gray-50 border-gray-200',
};
