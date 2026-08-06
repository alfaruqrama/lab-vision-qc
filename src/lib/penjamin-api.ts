import { getStoredAuth } from './auth-api';
import { createSupabaseClient } from './supabase';
import { isConnected } from './api';
import type { PenjaminOverrideRow } from './penjamin-types';

/**
 * Penjamin API — Supabase backend with localStorage fallback.
 * Migrates from browser-only localStorage to shared Supabase storage.
 */

// ─── localStorage Keys (moved from InputHarianTab) ─────────────────────────

export const PENJAMIN_KEY = 'penjamin-list-custom';
export const BADGE_OVERRIDE_KEY = 'penjamin-badge-overrides';
export const NAME_OVERRIDE_KEY = 'penjamin-name-overrides';
const MIGRATION_FLAG = 'penjamin-migrated-v1';

// ─── Supabase API ──────────────────────────────────────────────────────────

export async function fetchPenjaminOverrides(): Promise<PenjaminOverrideRow[]> {
  if (!isConnected()) {
    return localToRows();
  }

  const auth = getStoredAuth();
  if (!auth) return localToRows();

  const client = createSupabaseClient(auth.token);

  const { data, error } = await client
    .from('penjamin_overrides')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Fetch penjamin overrides error:', error);
    return localToRows();
  }

  return (data || []) as PenjaminOverrideRow[];
}

export async function savePenjaminOverride(
  row: PenjaminOverrideRow,
): Promise<void> {
  if (!isConnected()) {
    // Offline fallback: write to localStorage
    const rows = localToRows();
    const idx = rows.findIndex((r) => r.id === row.id);
    if (idx >= 0) rows[idx] = row;
    else rows.push(row);
    rowsToLocal(rows);
    return;
  }

  const auth = getStoredAuth();
  if (!auth) throw new Error('Not authenticated');

  const client = createSupabaseClient(auth.token);

  const payload = {
    ...row,
    created_by: auth.id,
    updated_at: new Date().toISOString(),
  };

  const { error } = await client.from('penjamin_overrides').upsert(payload);

  if (error) {
    console.error('Save penjamin override error:', error);
    throw new Error(error.message);
  }

  // Also write-through to localStorage for offline fallback
  const rows = localToRows();
  const idx = rows.findIndex((r) => r.id === row.id);
  if (idx >= 0) rows[idx] = row;
  else rows.push(row);
  rowsToLocal(rows);
}

export async function deletePenjaminOverride(id: string): Promise<void> {
  if (!isConnected()) {
    const rows = localToRows().filter((r) => r.id !== id);
    rowsToLocal(rows);
    return;
  }

  const auth = getStoredAuth();
  if (!auth) throw new Error('Not authenticated');

  const client = createSupabaseClient(auth.token);
  const { error } = await client.from('penjamin_overrides').delete().eq('id', id);

  if (error) {
    console.error('Delete penjamin override error:', error);
    throw new Error(error.message);
  }

  const rows = localToRows().filter((r) => r.id !== id);
  rowsToLocal(rows);
}

export async function savePenjaminOverrideBulk(
  rows: PenjaminOverrideRow[],
): Promise<void> {
  if (!isConnected()) throw new Error('Not connected');

  const auth = getStoredAuth();
  if (!auth) throw new Error('Not authenticated');

  const client = createSupabaseClient(auth.token);

  const payload = rows.map((row) => ({
    ...row,
    created_by: auth.id,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await client.from('penjamin_overrides').upsert(payload);

  if (error) {
    console.error('Bulk save penjamin overrides error:', error);
    throw new Error(error.message);
  }
}

// ─── localStorage ↔ Rows Transform ─────────────────────────────────────────

export function localToRows(): PenjaminOverrideRow[] {
  const rows: PenjaminOverrideRow[] = [];

  try {
    // Badge overrides
    const badgeOv: Record<string, string> = JSON.parse(
      localStorage.getItem(BADGE_OVERRIDE_KEY) || '{}',
    );
    for (const [original, badge] of Object.entries(badgeOv)) {
      rows.push({
        id: `ov-${original}`,
        original_name: original,
        new_name: null,
        badge,
        is_custom: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  } catch { /* ignore */ }

  try {
    // Name overrides
    const nameOv: Record<string, string> = JSON.parse(
      localStorage.getItem(NAME_OVERRIDE_KEY) || '{}',
    );
    for (const [original, newName] of Object.entries(nameOv)) {
      const existing = rows.find((r) => r.id === `ov-${original}`);
      if (existing) {
        existing.new_name = newName;
      } else {
        rows.push({
          id: `ov-${original}`,
          original_name: original,
          new_name: newName,
          badge: null,
          is_custom: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    }
  } catch { /* ignore */ }

  try {
    // Custom entries
    const custom: { nama: string; badge: string }[] = JSON.parse(
      localStorage.getItem(PENJAMIN_KEY) || '[]',
    );
    for (const c of custom) {
      rows.push({
        id: `cu-${c.nama}`,
        original_name: null,
        new_name: c.nama,
        badge: c.badge,
        is_custom: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  } catch { /* ignore */ }

  return rows;
}

export function rowsToLocal(rows: PenjaminOverrideRow[]): void {
  const badgeOv: Record<string, string> = {};
  const nameOv: Record<string, string> = {};
  const custom: { nama: string; badge: string }[] = [];

  for (const r of rows) {
    if (r.is_custom) {
      custom.push({ nama: r.new_name || '', badge: r.badge || 'NPG' });
    } else if (r.original_name) {
      if (r.badge) badgeOv[r.original_name] = r.badge;
      if (r.new_name) nameOv[r.original_name] = r.new_name;
    }
  }

  localStorage.setItem(BADGE_OVERRIDE_KEY, JSON.stringify(badgeOv));
  localStorage.setItem(NAME_OVERRIDE_KEY, JSON.stringify(nameOv));
  localStorage.setItem(PENJAMIN_KEY, JSON.stringify(custom));
}

// ─── One-time Migration ────────────────────────────────────────────────────

export async function migrateLocalPenjaminData(): Promise<void> {
  if (!isConnected()) return;
  if (localStorage.getItem(MIGRATION_FLAG)) return;

  const rows = localToRows();
  if (rows.length === 0) {
    localStorage.setItem(MIGRATION_FLAG, '1');
    return;
  }

  try {
    // Server-wins: only migrate if server table is empty
    const existing = await fetchPenjaminOverrides();
    if (existing.length > 0) {
      // Server already has data — keep server version, update local
      rowsToLocal(existing);
      localStorage.setItem(MIGRATION_FLAG, '1');
      return;
    }

    await savePenjaminOverrideBulk(rows);
  } catch (err) {
    console.warn('Migration penjamin failed, will retry:', err);
    return; // Don't set flag — will retry next time
  }

  localStorage.setItem(MIGRATION_FLAG, '1');
}
