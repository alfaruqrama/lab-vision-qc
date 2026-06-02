import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { MaintenanceRecord } from '@/lib/maintenance-types';
import {
  isMaintenanceConnected,
  fetchRecords as gsFetchRecords,
  saveRecord as gsSaveRecord,
  deleteRecord as gsDeleteRecord,
} from '@/lib/maintenance-gs-api';
import { toast } from 'sonner';

const STORAGE_KEY = 'lab_maintenance_records';

function loadLocal(): MaintenanceRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocal(records: MaintenanceRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

async function fetchRecords(): Promise<MaintenanceRecord[]> {
  if (isMaintenanceConnected()) {
    return gsFetchRecords();
  }
  return loadLocal();
}

async function addRecord(record: MaintenanceRecord): Promise<MaintenanceRecord> {
  if (isMaintenanceConnected()) {
    await gsSaveRecord(record);
  } else {
    const records = loadLocal();
    records.push(record);
    saveLocal(records);
  }
  return record;
}

async function removeRecord(id: string): Promise<void> {
  if (isMaintenanceConnected()) {
    await gsDeleteRecord(id);
  } else {
    const records = loadLocal();
    saveLocal(records.filter((r) => r.id !== id));
  }
}

export const maintenanceKeys = {
  all: ['maintenance-records'] as const,
  byAlat: (alat: string) => ['maintenance-records', 'alat', alat] as const,
  byMonth: (month: string) => ['maintenance-records', 'month', month] as const,
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
      queryClient.setQueryData<MaintenanceRecord[]>(maintenanceKeys.all, (old) =>
        old ? [...old, newRecord] : [newRecord],
      );
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
