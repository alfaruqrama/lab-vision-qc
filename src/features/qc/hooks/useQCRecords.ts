import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { QCRecord } from '@/lib/types';
import * as api from '@/lib/api';
import { generateMockRecords } from '@/lib/mock-data';
import { toast } from 'sonner';
import { safeJSONParse, QCRecordSchema } from '@/lib/validation';
import { z } from 'zod';

const STORAGE_KEY = 'labqc_records';

/** Fetch all QC records — handles both online and demo mode */
async function fetchRecords(): Promise<QCRecord[]> {
  if (api.isConnected()) {
    return api.fetchAllRecords();
  }
  // Demo mode: read from localStorage with safe parsing
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    const parsed = safeJSONParse(stored, z.array(QCRecordSchema));
    if (parsed.success && parsed.data) {
      return parsed.data;
    }
    console.warn('Invalid QC records in localStorage, generating mock data');
  }
  const mock = generateMockRecords();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(mock));
  return mock;
}

/** Save a QC record — handles both online and demo mode */
async function saveRecord(record: QCRecord): Promise<QCRecord> {
  if (api.isConnected()) {
    await api.saveRecord(record);
  } else {
    const stored = localStorage.getItem(STORAGE_KEY);
    let records: QCRecord[] = [];
    
    if (stored) {
      const parsed = safeJSONParse(stored, z.array(QCRecordSchema));
      if (parsed.success && parsed.data) {
        records = parsed.data;
      }
    }
    
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
