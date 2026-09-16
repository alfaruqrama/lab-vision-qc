import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchModuleConfig, upsertModuleConfig, type ModuleConfigMap, type ModuleOverride } from '@/lib/module-config';
import { useAuth } from '@/hooks/use-auth';

interface ModuleConfigContextType {
  config: ModuleConfigMap;
  isLoading: boolean;
  refresh: () => Promise<void>;
  update: (key: string, patch: Partial<Omit<ModuleOverride, 'key'>>) => Promise<{ success: boolean; message?: string }>;
}

const ModuleConfigContext = createContext<ModuleConfigContextType | undefined>(undefined);

export function ModuleConfigProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [config, setConfig] = useState<ModuleConfigMap>({});
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await fetchModuleConfig();
    setConfig(data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const update = useCallback(
    async (key: string, patch: Partial<Omit<ModuleOverride, 'key'>>) => {
      if (!user) return { success: false, message: 'Tidak ada sesi user' };
      const result = await upsertModuleConfig(user.token, key, patch, user.id);
      if (result.success) {
        setConfig((prev) => ({
          ...prev,
          [key]: {
            key,
            wip: patch.wip ?? prev[key]?.wip ?? null,
            hidden: patch.hidden ?? prev[key]?.hidden ?? null,
            badge_label: patch.badge_label ?? prev[key]?.badge_label ?? null,
            badge_live: patch.badge_live ?? prev[key]?.badge_live ?? null,
            desc_override: patch.desc_override ?? prev[key]?.desc_override ?? null,
            chips_override: patch.chips_override ?? prev[key]?.chips_override ?? null,
          },
        }));
      }
      return result;
    },
    [user],
  );

  const value: ModuleConfigContextType = { config, isLoading, refresh, update };
  return <ModuleConfigContext.Provider value={value}>{children}</ModuleConfigContext.Provider>;
}

export function useModuleConfig() {
  const ctx = useContext(ModuleConfigContext);
  if (!ctx) throw new Error('useModuleConfig must be used within ModuleConfigProvider');
  return ctx;
}
