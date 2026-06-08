import type { MaintenanceAlat, MaintenanceTemplate, MaintenanceTipe } from '@/lib/maintenance-types';

export const MAINTENANCE_TEMPLATES: MaintenanceTemplate[] = [
  // BC-6800 (Mindray Hematology Analyzer)
  {
    alat: 'BC6800',
    nama: 'BC-6800 Hematology Analyzer',
    tipe: 'daily',
    label: 'Harian',
    aktivitas: [
      'Rinse Probe',
      'Washing Block',
      'Clean Cuvette',
      'Check SRV',
      'Check Flow Cell',
      'Check Aperture',
    ],
  },
  {
    alat: 'BC6800',
    nama: 'BC-6800 Hematology Analyzer',
    tipe: 'weekly',
    label: 'Mingguan',
    aktivitas: [
      'Clean Flow Cell',
      'Clean SRV',
      'Clean Aperture',
      'Clean Cuvette',
    ],
  },
  {
    alat: 'BC6800',
    nama: 'BC-6800 Hematology Analyzer',
    tipe: 'monthly',
    label: 'Bulanan',
    aktivitas: [
      'Clean Flow Cell',
      'Clean SRV',
      'Check Aperture',
      'Check Valves',
      'Check Waste',
    ],
  },

  // BC-760
  {
    alat: 'BC760',
    nama: 'BC-760 Hematology Analyzer',
    tipe: 'daily',
    label: 'Harian',
    aktivitas: ['Probe Cleaner', 'Aperture Cleaning'],
  },
  {
    alat: 'BC760',
    nama: 'BC-760 Hematology Analyzer',
    tipe: 'as_needed',
    label: 'Insidental',
    aktivitas: [
      'Probe Cleaner',
      'Aperture Cleaning',
      'Maintenance',
      'Service',
    ],
  },

  // CA-500/600 (Sysmex)
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
      'Paraf',
    ],
  },
  {
    alat: 'CA500600',
    nama: 'Sysmex CA-500/600',
    tipe: 'as_needed',
    label: 'Insidental',
    aktivitas: [
      'Ganti kertas printer',
      'Ganti leokring',
      'Ganti aquades di rinse tank',
    ],
  },

  // Medica EasyLyte Expand
  {
    alat: 'EasyLyte',
    nama: 'Medica EasyLyte Expand',
    tipe: 'daily',
    label: 'Harian',
    aktivitas: ['Daily Cleanse', 'Conditioner'],
  },
  {
    alat: 'EasyLyte',
    nama: 'Medica EasyLyte Expand',
    tipe: 'as_needed',
    label: 'Penggantian',
    aktivitas: [
      'Electrode',
      'Reference Electrode',
      'Solution Valve',
      'Pump Tube Assembly',
    ],
  },

  // Uji Fungsi — per alat
  {
    alat: 'BC6800',
    nama: 'BC-6800 Hematology Analyzer',
    tipe: 'uji_fungsi',
    label: 'Uji Fungsi',
    aktivitas: ['fungsi_baik'],
  },
  {
    alat: 'BC760',
    nama: 'BC-760 Hematology Analyzer',
    tipe: 'uji_fungsi',
    label: 'Uji Fungsi',
    aktivitas: ['fungsi_baik'],
  },
  {
    alat: 'CA500600',
    nama: 'Sysmex CA-500/600',
    tipe: 'uji_fungsi',
    label: 'Uji Fungsi',
    aktivitas: ['fungsi_baik'],
  },
  {
    alat: 'EasyLyte',
    nama: 'Medica EasyLyte Expand',
    tipe: 'uji_fungsi',
    label: 'Uji Fungsi',
    aktivitas: ['fungsi_baik'],
  },
];

export const ALAT_LABELS: Record<MaintenanceAlat, string> = {
  BC6800: 'BC-6800',
  BC760: 'BC-760',
  CA500600: 'CA-500/600',
  EasyLyte: 'EasyLyte Expand',
  ALAT_UMUM: 'Uji Fungsi',
};

export const TIPE_LABELS: Record<MaintenanceTipe, string> = {
  daily: 'Harian',
  weekly: 'Mingguan',
  monthly: 'Bulanan',
  as_needed: 'Insidental',
  uji_fungsi: 'Uji Fungsi',
};

export function getTemplatesForAlat(alat: MaintenanceAlat): MaintenanceTemplate[] {
  return MAINTENANCE_TEMPLATES.filter((t) => t.alat === alat);
}
