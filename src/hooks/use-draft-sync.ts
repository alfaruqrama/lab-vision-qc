import { useState, useEffect, useCallback } from 'react';

export type SyncStatus = 'idle' | 'saved' | 'saving' | 'unsaved' | 'error';

interface DraftData {
  kunjungan: any[];
  mcu: any[];
}

interface DraftMeta {
  updatedAt: string | null;
  updatedBy: string | null;
}

interface UseDraftSyncResult {
  syncStatus: SyncStatus;
  isOnline: boolean;
  lastSavedBy: string | null;
  lastSavedAt: string | null;
  saveToServer: (tanggal: string, kunjungan: any[], mcu: any[]) => Promise<boolean>;
  loadFromServer: (tanggal: string) => Promise<{ data: DraftData; meta: DraftMeta } | null>;
  markUnsaved: () => void;
}

export function useDraftSync(username: string): UseDraftSyncResult {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [lastSavedBy, setLastSavedBy] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const GS_URL = (import.meta.env.VITE_GAS_LAPORAN_URL as string) || '';

  // ── Online/Offline detection ──
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // ── Manual save to server ──
  const saveToServer = useCallback(async (tanggal: string, kunjungan: any[], mcu: any[]): Promise<boolean> => {
    if (!GS_URL) {
      setSyncStatus('error');
      return false;
    }
    if (!navigator.onLine) {
      setSyncStatus('error');
      return false;
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
        return true;
      }
      setSyncStatus('error');
      return false;
    } catch {
      setSyncStatus('error');
      return false;
    }
  }, [GS_URL, username]);

  // ── Load from server ──
  const loadFromServer = useCallback(async (tanggal: string): Promise<{ data: DraftData; meta: DraftMeta } | null> => {
    if (!GS_URL || !navigator.onLine) return null;

    try {
      const res = await fetch(`${GS_URL}?action=loadDraft&tanggal=${encodeURIComponent(tanggal)}`);
      const result = await res.json();
      if (result.status === 'ok' && result.data) {
        setLastSavedBy(result.updatedBy || null);
        setLastSavedAt(result.updatedAt || null);
        setSyncStatus('saved');
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

  // ── Mark as unsaved (called when data changes) ──
  const markUnsaved = useCallback(() => {
    setSyncStatus(prev => prev === 'idle' ? 'idle' : 'unsaved');
  }, []);

  return {
    syncStatus,
    isOnline,
    lastSavedBy,
    lastSavedAt,
    saveToServer,
    loadFromServer,
    markUnsaved,
  };
}
