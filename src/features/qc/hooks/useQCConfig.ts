import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { LotConfig } from '@/lib/types';
import * as api from '@/lib/api';
import { DEFAULT_LOT_CONFIG } from '@/lib/mock-data';
import { toast } from 'sonner';
import { safeJSONParse, LotConfigSchema } from '@/lib/validation';

const STORAGE_KEY = 'labqc_config';

/** Fetch lot configuration — handles both online and demo mode */
async function fetchConfig(): Promise<LotConfig> {
  if (api.isConnected()) {
    try {
      const cfg = await api.fetchConfig();
      // Merge with defaults so new instruments always have config
      return {
        CA660: cfg.CA660 || DEFAULT_LOT_CONFIG.CA660,
        EASYLITE: cfg.EASYLITE || DEFAULT_LOT_CONFIG.EASYLITE,
        ONCALL1: cfg.ONCALL1 || DEFAULT_LOT_CONFIG.ONCALL1,
        ONCALL2: cfg.ONCALL2 || DEFAULT_LOT_CONFIG.ONCALL2,
      };
    } catch {
      return DEFAULT_LOT_CONFIG;
    }
  }
  // Demo mode: read from localStorage with safe parsing
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    const parsed = safeJSONParse(stored, LotConfigSchema);
    if (parsed.success && parsed.data) {
      return parsed.data;
    }
    console.warn('Invalid lot config in localStorage, using defaults');
  }
  return DEFAULT_LOT_CONFIG;
}

/** Save lot configuration — handles both online and demo mode */
async function saveConfig(config: LotConfig): Promise<LotConfig> {
  if (api.isConnected()) {
    await api.saveConfig(config);
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }
  return config;
}

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const qcConfigKeys = {
  all: ['qc-config'] as const,
};

// ─── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Fetch lot configuration with React Query caching.
 * Config changes less frequently, so longer stale time.
 */
export function useQCConfig() {
  return useQuery({
    queryKey: qcConfigKeys.all,
    queryFn: fetchConfig,
    staleTime: 5 * 60_000, // 5 minutes
    gcTime: 30 * 60_000, // 30 minutes garbage collection
    refetchOnWindowFocus: false, // Config rarely changes
  });
}

/**
 * Mutation hook for updating lot configuration.
 * Optimistically updates the cache.
 */
export function useUpdateQCConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveConfig,
    onMutate: async (newConfig) => {
      await queryClient.cancelQueries({ queryKey: qcConfigKeys.all });
      const previousConfig = queryClient.getQueryData<LotConfig>(qcConfigKeys.all);
      queryClient.setQueryData<LotConfig>(qcConfigKeys.all, newConfig);
      return { previousConfig };
    },
    onError: (_err, _newConfig, context) => {
      if (context?.previousConfig) {
        queryClient.setQueryData(qcConfigKeys.all, context.previousConfig);
      }
      toast.error('Gagal menyimpan konfigurasi');
    },
    onSuccess: () => {
      toast.success('Konfigurasi lot berhasil disimpan!');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: qcConfigKeys.all });
    },
  });
}
