import type { MaintenanceAlat, MaintenanceTemplate, MaintenanceTipe } from '@/lib/maintenance-types';

export const MAINTENANCE_TEMPLATES: MaintenanceTemplate[] = [
  // BC-6800
  {
    alat: 'BC6800',
    nama: 'BC-6800 Hematology Analyzer',
    tipe: 'daily',
    label: 'Harian',
    aktivitas: [
      'Probe Cleanser',
      'Running Background',
      'Cek aturan pendispian',
      'Cek printer paper',
      'Cek limbah',
    ],
  },
  {
    alat: 'BC6800',
    nama: 'BC-6800 Hematology Analyzer',
    tipe: 'weekly',
    label: 'Mingguan',
    aktivitas: [
      'Probe Cleanser',
      'Cek Fluidics',
      'Cek Flow Cell',
      'Cek SRV',
      'Cek Aperture Unclog',
    ],
  },
  {
    alat: 'BC6800',
    nama: 'BC-6800 Hematology Analyzer',
    tipe: 'monthly',
    label: 'Bulanan',
    aktivitas: [
      'Cek Fluidics',
      'Cek Flow Cell',
      'Cek SRV',
      'Cek Jalur Pembuangan',
      'Cek Valve',
      'Selftest',
    ],
  },

  // BC-760
  {
    alat: 'BC760',
    nama: 'BC-760 Hematology Analyzer',
    tipe: 'daily',
    label: 'Harian',
    aktivitas: ['Probe Cleanser', 'Shutdown'],
  },
  {
    alat: 'BC760',
    nama: 'BC-760 Hematology Analyzer',
    tipe: 'as_needed',
    label: 'Insidental',
    aktivitas: [
      'Cleaning',
      'Fluidics Maintenance',
      'Preventive Maintenance',
      'Ganti kertas printer',
      'Ganti akuades rinse tank',
    ],
  },

  // CA-500/600
  {
    alat: 'CA500600',
    nama: 'Sysmex CA-500/600',
    tipe: 'daily',
    label: 'Harian',
    aktivitas: [
      'Bersihkan probe manual',
      'Rinse probe',
      'Rinse and prepare',
      'Buang reaction tube bekas',
      'Buang limbah',
    ],
  },
  {
    alat: 'CA500600',
    nama: 'Sysmex CA-500/600',
    tipe: 'as_needed',
    label: 'Insidental',
    aktivitas: [
      'Cleaning',
      'Fluidics Maintenance',
      'Preventive Maintenance',
      'Ganti kertas printer',
      'Ganti akuades rinse tank',
    ],
  },
];

export const ALAT_LABELS: Record<MaintenanceAlat, string> = {
  BC6800: 'BC-6800',
  BC760: 'BC-760',
  CA500600: 'CA-500/600',
};

export const TIPE_LABELS: Record<MaintenanceTipe, string> = {
  daily: 'Harian',
  weekly: 'Mingguan',
  monthly: 'Bulanan',
  as_needed: 'Insidental',
};

export function getTemplatesForAlat(alat: MaintenanceAlat): MaintenanceTemplate[] {
  return MAINTENANCE_TEMPLATES.filter((t) => t.alat === alat);
}
