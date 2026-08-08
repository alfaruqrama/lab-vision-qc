import { getStoredAuth } from './auth-api';
import { createSupabaseClient } from './supabase';
import { isConnected } from './api';
import type { KunjunganInputRow, McuInputRow } from '@/components/kunjungan/InputHarianTab';
import type { InputDraft } from './draft-types';

const DRAFT_KEY = 'input-harian-draft';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function draftId(tanggal: string): string {
  return `draft-${tanggal}`;
}

function localToDraft(tanggal: string): InputDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return {
      id: draftId(tanggal),
      tanggal: d.tanggal || tanggal,
      kunjungan: d.kunjungan || [],
      mcu: d.mcu || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

// ─── Supabase API ────────────────────────────────────────────────────────────

export async function saveDraft(
  tanggal: string,
  kunjungan: KunjunganInputRow[],
  mcu: McuInputRow[],
): Promise<void> {
  // Always write to localStorage (offline fallback)
  localStorage.setItem(DRAFT_KEY, JSON.stringify({ tanggal, kunjungan, mcu }));

  if (!isConnected()) {
    throw new Error('Tidak terhubung ke server. Draft hanya tersimpan lokal.');
  }

  const auth = getStoredAuth();
  if (!auth) throw new Error('Not authenticated');

  const client = createSupabaseClient(auth.token);

  const payload = {
    id: draftId(tanggal),
    tanggal,
    kunjungan,
    mcu,
    created_by: auth.id,
    updated_at: new Date().toISOString(),
  };

  const { error } = await client.from('input_drafts').upsert(payload);

  if (error) {
    console.error('Save draft error:', error);
    throw new Error(error.message);
  }
}

export async function fetchDraft(tanggal: string): Promise<InputDraft | null> {
  if (!isConnected()) return localToDraft(tanggal);

  const auth = getStoredAuth();
  if (!auth) return localToDraft(tanggal);

  const client = createSupabaseClient(auth.token);

  const { data, error } = await client
    .from('input_drafts')
    .select('*')
    .eq('id', draftId(tanggal))
    .maybeSingle();

  if (error) {
    console.error('Fetch draft error:', error);
    return localToDraft(tanggal);
  }

  return data as InputDraft | null;
}

export async function fetchAllDrafts(): Promise<InputDraft[]> {
  if (!isConnected()) return [];

  const auth = getStoredAuth();
  if (!auth) return [];

  const client = createSupabaseClient(auth.token);

  const { data, error } = await client
    .from('input_drafts')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Fetch all drafts error:', error);
    return [];
  }

  return (data || []) as InputDraft[];
}

export async function deleteDraft(tanggal: string): Promise<void> {
  // Also clear localStorage
  localStorage.removeItem(DRAFT_KEY);

  if (!isConnected()) return;

  const auth = getStoredAuth();
  if (!auth) return;

  const client = createSupabaseClient(auth.token);

  const { error } = await client
    .from('input_drafts')
    .delete()
    .eq('id', draftId(tanggal));

  if (error) {
    console.error('Delete draft error:', error);
  }
}
