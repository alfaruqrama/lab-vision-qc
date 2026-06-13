import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { MaintenanceRecord, UjiFungsiRecord } from '@/lib/maintenance-types';
import {
  isMaintenanceConnected,
  fetchRecords as gsFetchRecords,
  saveRecord as gsSaveRecord,
  deleteRecord as gsDeleteRecord,
  fetchUjiFungsi as gsFetchUjiFungsi,
  saveUjiFungsiBulk as gsSaveUjiFungsiBulk,
  deleteUjiFungsi as gsDeleteUjiFungsi,
} from '@/lib/maintenance-gs-api';
import { toast } from 'sonner';

const STORAGE_KEY = 'lab_maintenance_records';
const STORAGE_KEY_UF = 'lab_uji_fungsi_records';

// ─── LocalStorage helpers ────────────────────────────────────────────────

function loadLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveLocal<T>(key: string, data: T) {
  localStorage.setItem(key, JSON.stringify(data));
}

// ─── Maintenance Records ─────────────────────────────────────────────────

function loadLocalRecords(): MaintenanceRecord[] {
  return loadLocal<MaintenanceRecord[]>(STORAGE_KEY, []);
}

function saveLocalRecords(records: MaintenanceRecord[]) {
  saveLocal(STORAGE_KEY, records);
}

async function fetchRecords(): Promise<MaintenanceRecord[]> {
  if (isMaintenanceConnected()) {
    return gsFetchRecords();
  }
  return loadLocalRecords();
}

async function addRecord(record: MaintenanceRecord): Promise<MaintenanceRecord> {
  if (isMaintenanceConnected()) {
    await gsSaveRecord(record);
  } else {
    const records = loadLocalRecords();
    // Upsert: replace if same id exists
    const idx = records.findIndex((r) => r.id === record.id);
    if (idx >= 0) records[idx] = record;
    else records.push(record);
    saveLocalRecords(records);
  }
  return record;
}

async function removeRecord(id: string): Promise<void> {
  if (isMaintenanceConnected()) {
    await gsDeleteRecord(id);
  } else {
    const records = loadLocalRecords();
    saveLocalRecords(records.filter((r) => r.id !== id));
  }
}

export const maintenanceKeys = {
  all: ['maintenance-records'] as const,
  byAlat: (alat: string) => ['maintenance-records', 'alat', alat] as const,
  byMonth: (month: string) => ['maintenance-records', 'month', month] as const,
  ujiFungsi: {
    all: ['uji-fungsi-records'] as const,
    byAlatBulan: (alat: string, bulan: string) => ['uji-fungsi-records', alat, bulan] as const,
  },
};

export function useMaintenanceRecords() {
  return useQuery({
    queryKey: maintenanceKeys.all,
    queryFn: fetchRecords,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: isMaintenanceConnected(),
  });
}

export function useAddMaintenanceRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addRecord,
    onMutate: async (newRecord) => {
      await queryClient.cancelQueries({ queryKey: maintenanceKeys.all });
      const previous = queryClient.getQueryData<MaintenanceRecord[]>(maintenanceKeys.all);
      queryClient.setQueryData<MaintenanceRecord[]>(maintenanceKeys.all, (old) => {
        if (!old) return [newRecord];
        const idx = old.findIndex((r) => r.id === newRecord.id);
        if (idx >= 0) {
          const updated = [...old];
          updated[idx] = newRecord;
          return updated;
        }
        return [...old, newRecord];
      });
      return { previous };
    },
    onError: (_err, _record, context) => {
      if (context?.previous) {
        queryClient.setQueryData(maintenanceKeys.all, context.previous);
      }
      toast.error('Gagal menyimpan data maintenance');
    },
    onSuccess: () => {
      toast.success('Data maintenance tersimpan');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.all });
    },
  });
}

export function useDeleteMaintenanceRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: removeRecord,
    onMutate: async (recordId) => {
      await queryClient.cancelQueries({ queryKey: maintenanceKeys.all });
      const previous = queryClient.getQueryData<MaintenanceRecord[]>(maintenanceKeys.all);
      queryClient.setQueryData<MaintenanceRecord[]>(maintenanceKeys.all, (old) =>
        old ? old.filter((r) => r.id !== recordId) : [],
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(maintenanceKeys.all, context.previous);
      }
      toast.error('Gagal menghapus data maintenance');
    },
    onSuccess: () => {
      toast.success('Data maintenance terhapus');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.all });
    },
  });
}

// ─── Uji Fungsi Records ──────────────────────────────────────────────────

function loadLocalUjiFungsi(): UjiFungsiRecord[] {
  return loadLocal<UjiFungsiRecord[]>(STORAGE_KEY_UF, []);
}

function saveLocalUjiFungsi(records: UjiFungsiRecord[]) {
  saveLocal(STORAGE_KEY_UF, records);
}

async function fetchUjiFungsiRecords(alat: string, bulan: string): Promise<UjiFungsiRecord[]> {
  if (isMaintenanceConnected()) {
    return gsFetchUjiFungsi(alat, bulan);
  }
  // localStorage fallback: filter by alat + bulan
  const all = loadLocalUjiFungsi();
  return all.filter((r) => r.alat === alat && r.tanggal.startsWith(bulan));
}

async function saveUjiFungsiRecords(
  alat: string,
  bulan: string,
  data: { id: string; tanggal: string; fungsi: 'baik' | 'rusak'; petugas: string; keterangan: string }[],
): Promise<{ count: number; deleted: number }> {
  if (isMaintenanceConnected()) {
    return gsSaveUjiFungsiBulk(alat, bulan, data);
  }
  // localStorage fallback: remove existing for this alat+bulan, insert new
  const all = loadLocalUjiFungsi();
  const filtered = all.filter((r) => !(r.alat === alat && r.tanggal.startsWith(bulan)));
  const now = new Date().toISOString();
  const newRecords: UjiFungsiRecord[] = data.map((d) => ({
    id: d.id,
    alat: alat as UjiFungsiRecord['alat'],
    tanggal: d.tanggal,
    fungsi: d.fungsi,
    petugas: d.petugas,
    keterangan: d.keterangan,
    created_at: now,
  }));
  saveLocalUjiFungsi([...filtered, ...newRecords]);
  return { count: data.length, deleted: all.length - filtered.length };
}

async function removeUjiFungsiRecord(id: string): Promise<void> {
  if (isMaintenanceConnected()) {
    await gsDeleteUjiFungsi(id);
  } else {
    const all = loadLocalUjiFungsi();
    saveLocalUjiFungsi(all.filter((r) => r.id !== id));
  }
}

export function useUjiFungsiRecords(alat: string, bulan: string) {
  return useQuery({
    queryKey: maintenanceKeys.ujiFungsi.byAlatBulan(alat, bulan),
    queryFn: () => fetchUjiFungsiRecords(alat, bulan),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    enabled: !!alat && !!bulan,
    refetchOnWindowFocus: isMaintenanceConnected(),
  });
}

export function useSaveUjiFungsi() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      alat,
      bulan,
      data,
    }: {
      alat: string;
      bulan: string;
      data: { id: string; tanggal: string; fungsi: 'baik' | 'rusak'; petugas: string; keterangan: string }[];
    }) => saveUjiFungsiRecords(alat, bulan, data),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: maintenanceKeys.ujiFungsi.byAlatBulan(variables.alat, variables.bulan),
      });
      toast.success(`Uji fungsi tersimpan (${variables.data.length} hari)`);
    },
    onError: () => {
      toast.error('Gagal menyimpan data uji fungsi');
    },
  });
}

export function useDeleteUjiFungsi() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: removeUjiFungsiRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.ujiFungsi.all });
      toast.success('Data uji fungsi terhapus');
    },
    onError: () => {
      toast.error('Gagal menghapus data uji fungsi');
    },
  });
}
