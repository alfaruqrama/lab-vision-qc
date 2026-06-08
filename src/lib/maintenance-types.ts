export type MaintenanceAlat = 'BC6800' | 'BC760' | 'CA500600' | 'EasyLyte' | 'ALAT_UMUM';

export type MaintenanceTipe = 'daily' | 'weekly' | 'monthly' | 'as_needed' | 'uji_fungsi';

export interface MaintenanceTemplate {
  alat: MaintenanceAlat;
  nama: string;
  tipe: MaintenanceTipe;
  label: string;
  aktivitas: string[];
}

export interface MaintenanceRecord {
  id: string;
  alat: MaintenanceAlat;
  tipe: MaintenanceTipe;
  tanggal: string;
  aktivitas: Record<string, boolean>;
  catatan: Record<string, string>;
  catatan_umum: string;
  petugas: string;
}

export interface MaintenanceStatus {
  alat: MaintenanceAlat;
  nama: string;
  daily: { done: boolean; date: string };
  weekly: { done: boolean; date: string };
  monthly: { done: boolean; date: string };
}
