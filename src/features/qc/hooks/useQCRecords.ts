import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { QCRecord } from '@/lib/types';
import * as api from '@/lib/api';
import { generateMockRecords } from '@/lib/mock-data';
import { toast } from 'sonner';
import { getStoredAuth } from '@/lib/auth-api';

const STORAGE_KEY = 'labqc_records';

/** Fetch QC records — online: getByMonth for current month, offline: localStorage */
async function fetchRecords(): Promise<QCRecord[]> {
  if (api.isConnected()) {
    const month = new Date().toLocaleString('id-ID', { month: 'long' }).toUpperCase();
    const auth = getStoredAuth();
    console.log('=== Fetching QC Records ===');
    console.log('Month:', month);
    console.log('Token:', auth?.token ? 'Present' : 'Missing');
    console.log('GAS URL:', import.meta.env.VITE_GAS_QC_URL);
    const records = await api.fetchRecordsByMonth(month, auth?.token);
    console.log('Records fetched:', records.length);
    if (records.length > 0) {
      console.log('First record:', records[0]);
    }
    return records;
  }
  // Demo mode: read from localStorage or generate mock data
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    return JSON.parse(stored) as QCRecord[];
  }
  const mock = generateMockRecords();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(mock));
  return mock;
}

/** Save a QC record — handles both online and demo mode */
async function saveRecord(record: QCRecord): Promise<QCRecord> {
  if (api.isConnected()) {
    const auth = getStoredAuth();
    await api.saveRecord(record, auth?.token);
  } else {
    const stored = localStorage.getItem(STORAGE_KEY);
    const records: QCRecord[] = stored ? JSON.parse(stored) : [];
    records.push(record);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }
  return record;
}

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const qcRecordKeys = {
  all: ['qc-records'] as const,
  byMonth: (month: string) => ['qc-records', 'month', month] as const,
};

// ─── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Fetch all QC records with React Query caching.
 * Supports background refetch and stale-while-revalidate.
 */
export function useQCRecords() {
  return useQuery({
    queryKey: qcRecordKeys.all,
    queryFn: fetchRecords,
    staleTime: 30_000, // 30 seconds
    gcTime: 5 * 60_000, // 5 minutes garbage collection
    refetchOnWindowFocus: api.isConnected(), // Only refetch on focus if online
  });
}

/**
 * Mutation hook for adding a new QC record.
 * Optimistically adds the record to the cache, then invalidates on success.
 */
export function useAddQCRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveRecord,
    onMutate: async (newRecord) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: qcRecordKeys.all });

      // Snapshot previous value
      const previousRecords = queryClient.getQueryData<QCRecord[]>(qcRecordKeys.all);

      // Optimistically add the new record
      queryClient.setQueryData<QCRecord[]>(qcRecordKeys.all, (old) => {
        return old ? [...old, newRecord] : [newRecord];
      });

      return { previousRecords };
    },
    onError: (_err, _newRecord, context) => {
      // Rollback on error
      if (context?.previousRecords) {
        queryClient.setQueryData(qcRecordKeys.all, context.previousRecords);
      }
      toast.error('Gagal menyimpan data QC');
    },
    onSuccess: () => {
      toast.success('Data QC berhasil disimpan!');
    },
    onSettled: () => {
      // Always refetch after mutation settles
      queryClient.invalidateQueries({ queryKey: qcRecordKeys.all });
    },
  });
}
