import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { isConnected } from '@/lib/api';
import {
  fetchPenjaminOverrides,
  savePenjaminOverride,
  deletePenjaminOverride,
  localToRows,
} from '@/lib/penjamin-api';
import type { PenjaminOverrideRow } from '@/lib/penjamin-types';
import { toast } from 'sonner';

// ─── Query Keys ────────────────────────────────────────────────────────────

export const penjaminKeys = {
  all: ['penjamin-overrides'] as const,
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function loadLocalRowsSafe(): PenjaminOverrideRow[] {
  try {
    return localToRows();
  } catch {
    return [];
  }
}

// ─── Query ─────────────────────────────────────────────────────────────────

export function usePenjaminOverrides() {
  return useQuery({
    queryKey: penjaminKeys.all,
    queryFn: fetchPenjaminOverrides,
    initialData: loadLocalRowsSafe,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: isConnected(),
  });
}

// ─── Mutations ─────────────────────────────────────────────────────────────

export function useSavePenjaminOverride() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: savePenjaminOverride,
    onMutate: async (row) => {
      await queryClient.cancelQueries({ queryKey: penjaminKeys.all });
      const previous = queryClient.getQueryData<PenjaminOverrideRow[]>(
        penjaminKeys.all,
      );
      queryClient.setQueryData<PenjaminOverrideRow[]>(
        penjaminKeys.all,
        (old) => {
          if (!old) return [row];
          const idx = old.findIndex((r) => r.id === row.id);
          if (idx >= 0) {
            const next = [...old];
            next[idx] = row;
            return next;
          }
          return [...old, row];
        },
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(penjaminKeys.all, ctx.previous);
      }
      toast.error('Gagal menyimpan penjamin');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: penjaminKeys.all });
    },
  });
}

export function useDeletePenjaminOverride() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deletePenjaminOverride,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: penjaminKeys.all });
      const previous = queryClient.getQueryData<PenjaminOverrideRow[]>(
        penjaminKeys.all,
      );
      queryClient.setQueryData<PenjaminOverrideRow[]>(
        penjaminKeys.all,
        (old) => (old ? old.filter((r) => r.id !== id) : []),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(penjaminKeys.all, ctx.previous);
      }
      toast.error('Gagal menghapus penjamin');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: penjaminKeys.all });
    },
  });
}
