import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { EasyliteLotConfig, LegacyEasyliteLotConfig, LotConfig } from '@/lib/types';
import * as api from '@/lib/api';
import { DEFAULT_LOT_CONFIG } from '@/lib/mock-data';
import { toast } from 'sonner';
import { getStoredAuth } from '@/lib/auth-api';
import { createSupabaseClient } from '@/lib/supabase';

const STORAGE_KEY = 'labqc_config';

type StoredLotConfig = Omit<LotConfig, 'EASYLITE'> & {
  EASYLITE?: LotConfig['EASYLITE'] | LegacyEasyliteLotConfig[];
};

function normalizeEasyliteConfig(easylite: StoredLotConfig['EASYLITE']): LotConfig['EASYLITE'] {
  if (!easylite) return DEFAULT_LOT_CONFIG.EASYLITE;
  if (!Array.isArray(easylite)) return easylite;

  const toLevelLot = (
    lot: LegacyEasyliteLotConfig,
    level: 'NORMAL' | 'HIGH',
  ): EasyliteLotConfig => ({
    lot: lot.lot,
    exp: lot.exp,
    params: lot[level],
  });

  return {
    NORMAL: easylite.map((lot) => toLevelLot(lot, 'NORMAL')),
    HIGH: easylite.map((lot) => toLevelLot(lot, 'HIGH')),
  };
}

function normalizeLotConfig(config: StoredLotConfig | null | undefined): LotConfig {
  if (!config) return DEFAULT_LOT_CONFIG;

  return {
    CA660: config.CA660 || DEFAULT_LOT_CONFIG.CA660,
    EASYLITE: normalizeEasyliteConfig(config.EASYLITE),
    ONCALL1: config.ONCALL1 || DEFAULT_LOT_CONFIG.ONCALL1,
    ONCALL2: config.ONCALL2 || DEFAULT_LOT_CONFIG.ONCALL2,
    CLEVER1: (config as any).CLEVER1 || DEFAULT_LOT_CONFIG.CLEVER1,
    CLEVER2: (config as any).CLEVER2 || DEFAULT_LOT_CONFIG.CLEVER2,
  };
}

/** Fetch lot configuration — handles both online and demo mode */
async function fetchConfig(): Promise<LotConfig> {
  if (api.isConnected()) {
    const auth = getStoredAuth();
    if (!auth) return DEFAULT_LOT_CONFIG;

    const client = createSupabaseClient(auth.token);
    
    // Fetch latest config
    const { data, error } = await client
      .from('lot_config')
      .select('config')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      console.warn('No lot config found, using defaults');
      return DEFAULT_LOT_CONFIG;
    }

    // Merge with defaults so new instruments always have config
    return normalizeLotConfig(data.config as StoredLotConfig);
  }

  // Demo mode: read from localStorage or use defaults
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? normalizeLotConfig(JSON.parse(stored) as StoredLotConfig) : DEFAULT_LOT_CONFIG;
}

/** Save lot configuration — handles both online and demo mode */
async function saveConfig(config: LotConfig): Promise<LotConfig> {
  if (api.isConnected()) {
    const auth = getStoredAuth();
    if (!auth) throw new Error('Not authenticated');

    const client = createSupabaseClient(auth.token);
    
    // Insert new config row (audit trail — don't update existing)
    const { error } = await client.from('lot_config').insert({
      config,
      updated_at: new Date().toISOString(),
      updated_by: auth.id,
    });

    if (error) {
      console.error('Save lot config error:', error);
      throw new Error(error.message);
    }

    return config;
  } else {
    // Demo mode: save to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    return config;
  }
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
