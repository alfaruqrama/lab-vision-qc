import { useState, useEffect, useRef, useCallback } from 'react';

export type SyncStatus = 'idle' | 'saved' | 'saving' | 'offline' | 'error';

interface DraftData {
  kunjungan: any[];
  mcu: any[];
}

interface DraftMeta {
  updatedAt: string | null;
  updatedBy: string | null;
}

interface UseDraftSyncOptions {
  tanggal: string;
  kunjungan: any[];
  mcu: any[];
  username: string;
  enabled?: boolean; // false to disable server sync (e.g. during initial load)
}

interface UseDraftSyncResult {
  syncStatus: SyncStatus;
  isOnline: boolean;
  lastSavedBy: string | null;
  lastSavedAt: string | null;
  loadFromServer: (tanggal: string) => Promise<{ data: DraftData; meta: DraftMeta } | null>;
  forceSave: () => void;
}

const DRAFT_KEY = 'input-harian-draft';
const DEBOUNCE_MS = 3000;

export function useDraftSync({
  tanggal,
  kunjungan,
  mcu,
  username,
  enabled = true,
}: UseDraftSyncOptions): UseDraftSyncResult {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [lastSavedBy, setLastSavedBy] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const GS_URL = (import.meta.env.VITE_GAS_LAPORAN_URL as string) || '';

  // ── Online/Offline detection ──
  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      // Retry pending save when back online
      if (pendingRef.current) {
        saveToServer();
      }
    };
    const onOffline = () => {
      setIsOnline(false);
      setSyncStatus('offline');
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Save to server ──
  const saveToServer = useCallback(async () => {
    if (!GS_URL || !enabledRef.current) return;
    if (!navigator.onLine) {
      setSyncStatus('offline');
      pendingRef.current = true;
      return;
    }

    setSyncStatus('saving');
    try {
      const res = await fetch(GS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'saveDraft',
          tanggal,
          kunjungan,
          mcu,
          username,
        }),
      });
      const result = await res.json();
      if (result.status === 'ok') {
        setSyncStatus('saved');
        setLastSavedBy(result.updatedBy || username);
        setLastSavedAt(result.updatedAt || new Date().toISOString());
        pendingRef.current = false;
      } else {
        setSyncStatus('error');
      }
    } catch {
      setSyncStatus('error');
      pendingRef.current = true;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [GS_URL, tanggal, kunjungan, mcu, username]);

  // ── Debounced auto-save ──
  useEffect(() => {
    if (!enabled || !GS_URL) return;

    // Always save to localStorage immediately
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ tanggal, kunjungan, mcu }));

    if (!isOnline) {
      setSyncStatus('offline');
      pendingRef.current = true;
      return;
    }

    // Debounce server save
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      saveToServer();
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tanggal, kunjungan, mcu, enabled, isOnline]);

  // ── Load from server ──
  const loadFromServer = useCallback(async (date: string): Promise<{ data: DraftData; meta: DraftMeta } | null> => {
    if (!GS_URL || !navigator.onLine) return null;

    try {
      const res = await fetch(`${GS_URL}?action=loadDraft&tanggal=${encodeURIComponent(date)}`);
      const result = await res.json();
      if (result.status === 'ok' && result.data) {
        setLastSavedBy(result.updatedBy || null);
        setLastSavedAt(result.updatedAt || null);
        return {
          data: result.data,
          meta: {
            updatedAt: result.updatedAt || null,
            updatedBy: result.updatedBy || null,
          },
        };
      }
      return null;
    } catch {
      return null;
    }
  }, [GS_URL]);

  // ── Force save (for manual trigger) ──
  const forceSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    saveToServer();
  }, [saveToServer]);

  return {
    syncStatus,
    isOnline,
    lastSavedBy,
    lastSavedAt,
    loadFromServer,
    forceSave,
  };
}
