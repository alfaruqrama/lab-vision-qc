import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { isConnected } from '@/lib/api';
import { saveDraft, fetchDraft, fetchAllDrafts, deleteDraft } from '@/lib/draft-api';
import { toast } from 'sonner';

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const draftKeys = {
  all: ['input-drafts'] as const,
  byTanggal: (tanggal: string) => ['input-draft', tanggal] as const,
};

// ─── Query ───────────────────────────────────────────────────────────────────

export function useDraft(tanggal: string) {
  return useQuery({
    queryKey: draftKeys.byTanggal(tanggal),
    queryFn: () => fetchDraft(tanggal),
    enabled: !!tanggal && isConnected(),
    staleTime: 0,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export function useSaveDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      tanggal,
      kunjungan,
      mcu,
    }: {
      tanggal: string;
      kunjungan: any[];
      mcu: any[];
    }) => saveDraft(tanggal, kunjungan, mcu),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({
        queryKey: draftKeys.byTanggal(vars.tanggal),
      });
      queryClient.invalidateQueries({ queryKey: draftKeys.all });
      toast.success('Draft tersimpan ke server');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Gagal menyimpan draft');
    },
  });
}

export function useAllDrafts() {
  return useQuery({
    queryKey: draftKeys.all,
    queryFn: fetchAllDrafts,
    enabled: isConnected(),
    staleTime: 30_000,
  });
}

export function useDeleteDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tanggal: string) => deleteDraft(tanggal),
    onSuccess: (_data, tanggal) => {
      queryClient.invalidateQueries({
        queryKey: draftKeys.byTanggal(tanggal),
      });
      queryClient.invalidateQueries({ queryKey: draftKeys.all });
    },
    onError: () => {
      // Silent fail — deletion is best-effort
    },
  });
}
