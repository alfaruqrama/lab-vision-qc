import { useState, useEffect, useCallback, useRef } from 'react';
import { type KunjunganData, normalizeMonthKeys, sortMonths } from '@/lib/kunjungan-types';
import { isKunjunganConnected, fetchSummary } from '@/lib/kunjungan-api';
import embeddedRaw from '@/lib/kunjungan-data.json';

const EMBEDDED: KunjunganData = {
  omzet: normalizeMonthKeys(embeddedRaw.omzet),
  kunjungan: normalizeMonthKeys(embeddedRaw.kunjungan),
  mcu: normalizeMonthKeys(embeddedRaw.mcu || {}),
};

export type ConnectionStatus = 'live' | 'loading' | 'embedded' | 'error';

export function useKunjunganData() {
  const [data, setData] = useState<KunjunganData>(EMBEDDED);
  const [status, setStatus] = useState<ConnectionStatus>('embedded');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    if (!isKunjunganConnected()) {
      setData(EMBEDDED);
      setStatus('embedded');
      setLastUpdated(null);
      setError(null);
      return;
    }

    setStatus('loading');
    try {
      const result = await fetchSummary();
      setData({
        omzet: result.omzet,
        kunjungan: result.kunjungan,
        mcu: result.mcu,
      });
      setLastUpdated(result.lastUpdated);
      setStatus('live');
      setError(null);
    } catch (e: any) {
      console.error('Fetch kunjungan failed:', e);
      setError(e.message || 'Gagal terhubung');
      setStatus('error');
      // If an error occurs, we don't want to clear the data.
      // The data state will retain its previous value, which could be
      // either the last successfully fetched live data or the initial embedded data.
      // This ensures that the dashboard doesn't go blank on a temporary network issue.
    }
  }, []);

  // Initial fetch + auto-refresh every 5 minutes
  useEffect(() => {
    refresh();
    if (isKunjunganConnected()) {
      intervalRef.current = setInterval(refresh, 5 * 60 * 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refresh]);

  const availableMonths = useCallback(
    (tab: 'omzet' | 'kunjungan' | 'mcu') => {
      const src = tab === 'mcu' ? data.mcu : tab === 'kunjungan' ? data.kunjungan : data.omzet;
      return sortMonths(Object.keys(src));
    },
    [data]
  );

  return { data, status, lastUpdated, error, refresh, availableMonths };
}
