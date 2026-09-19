import { useState, useEffect, useCallback, useContext, createContext } from 'react';
import { useModuleConfig } from './use-module-config';
import { useAuth } from './use-auth';
import {
  parseLaporanLayout,
  buildExtraFromLayout,
  DEFAULT_LAYOUT,
  LAPORAN_EXTRA_KEY,
  type LaporanLayout,
} from '@/lib/laporan-sections';

interface LaporanLayoutContextType {
  layout: LaporanLayout;
  isLoading: boolean;
  saveLayout: (layout: LaporanLayout) => Promise<{ success: boolean; message?: string }>;
  resetToDefault: () => Promise<{ success: boolean; message?: string }>;
}

const LaporanLayoutContext = createContext<LaporanLayoutContextType | undefined>(undefined);

export function LaporanLayoutProvider({ children }: { children: React.ReactNode }) {
  const { config, update, refresh, isLoading: configLoading } = useModuleConfig();
  const { user } = useAuth();

  const [layout, setLayout] = useState<LaporanLayout>(DEFAULT_LAYOUT);
  const [ready, setReady] = useState(false);

  // Parse layout dari module_config setiap kali config berubah
  useEffect(() => {
    const row = config[LAPORAN_EXTRA_KEY];
    if (row?.extra) {
      setLayout(parseLaporanLayout(row.extra));
    } else {
      setLayout({ ...DEFAULT_LAYOUT });
    }
    setReady(true);
  }, [config]);

  const saveLayout = useCallback(
    async (newLayout: LaporanLayout) => {
      if (!user) return { success: false, message: 'Tidak ada sesi user' };
      const extra = buildExtraFromLayout(newLayout) as Record<string, unknown>;
      const result = await update(LAPORAN_EXTRA_KEY, { extra });
      if (result.success) {
        setLayout(newLayout);
      }
      return result;
    },
    [user, update],
  );

  const resetToDefault = useCallback(async () => {
    // Untuk reset, kita perlu hapus extra (set null)
    // Tapi upsertModuleConfig tidak support delete — kita set ke default layout saja
    return saveLayout(DEFAULT_LAYOUT);
  }, [saveLayout]);

  const value: LaporanLayoutContextType = {
    layout,
    isLoading: configLoading || !ready,
    saveLayout,
    resetToDefault,
  };

  return (
    <LaporanLayoutContext.Provider value={value}>
      {children}
    </LaporanLayoutContext.Provider>
  );
}

export function useLaporanLayout() {
  const ctx = useContext(LaporanLayoutContext);
  if (!ctx) throw new Error('useLaporanLayout must be used within LaporanLayoutProvider');
  return ctx;
}
