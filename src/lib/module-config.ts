import { supabase, createSupabaseClient } from './supabase';

export interface ModuleOverride {
  key: string;
  wip: boolean | null;
  hidden: boolean | null;
  badge_label: string | null;
  badge_live: boolean | null;
  desc_override: string | null;
  chips_override: string[] | null;
}

export type ModuleConfigMap = Record<string, ModuleOverride>;

export async function fetchModuleConfig(): Promise<ModuleConfigMap> {
  const { data, error } = await supabase
    .from('module_config')
    .select('key, wip, hidden, badge_label, badge_live, desc_override, chips_override');

  if (error) {
    console.warn('fetchModuleConfig error:', error.message);
    return {};
  }

  const map: ModuleConfigMap = {};
  for (const row of data ?? []) {
    map[row.key] = row as ModuleOverride;
  }
  return map;
}

export async function upsertModuleConfig(
  token: string,
  key: string,
  patch: Partial<Omit<ModuleOverride, 'key'>>,
  userId: string,
): Promise<{ success: boolean; message?: string }> {
  const client = createSupabaseClient(token);
  const { error } = await client.from('module_config').upsert(
    {
      key,
      ...patch,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    },
    { onConflict: 'key' },
  );

  if (error) {
    return { success: false, message: error.message };
  }
  return { success: true };
}
