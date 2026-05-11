import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { QCRecord } from '@/lib/types';
import * as api from '@/lib/api';
import { generateMockRecords } from '@/lib/mock-data';
import { toast } from 'sonner';
import { getStoredAuth } from '@/lib/auth-api';
import { createSupabaseClient } from '@/lib/supabase';

const STORAGE_KEY = 'labqc_records';

/** Fetch QC records — online: Supabase current month, offline: localStorage */
async function fetchRecords(): Promise<QCRecord[]> {
  if (api.isConnected()) {
    const auth = getStoredAuth();
    if (!auth) return [];

    const client = createSupabaseClient(auth.token);
    
    // Fetch current month records
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    
    // Calculate next month for upper bound
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    const { data, error } = await client
      .from('qc_records')
      .select('*')
      .gte('tanggal', startDate)
      .lt('tanggal', endDate)
      .order('tanggal', { ascending: true })
      .order('timestamp', { ascending: true });

    if (error) {
      console.error('Fetch QC records error:', error);
      return [];
    }

    return data || [];
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
    if (!auth) throw new Error('Not authenticated');

    const client = createSupabaseClient(auth.token);
    
    const { error } = await client.from('qc_records').insert({
      id: record.id,
      timestamp: record.timestamp,
      tanggal: record.tanggal,
      alat: record.alat,
      level: record.level,
      lot: record.lot,
      params: record.params,
      status: record.status,
      analis: record.analis,
      catatan: record.catatan,
      created_by: auth.id,
    });

    if (error) {
      console.error('Save QC record error:', error);
      throw new Error(error.message);
    }

    return record;
  } else {
    // Demo mode: save to localStorage
    const stored = localStorage.getItem(STORAGE_KEY);
    const records: QCRecord[] = stored ? JSON.parse(stored) : [];
    records.push(record);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    return record;
  }
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
