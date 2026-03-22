import { useState, useEffect, useCallback, useRef } from 'react';
import { type KunjunganData, normalizeMonthKeys, sortMonths } from '@/lib/kunjungan-types';
import { isKunjunganConnected, fetchSummary, fetchKumulatif } from '@/lib/kunjungan-api';
import embeddedRaw from '@/lib/kunjungan-data.json';

const EMBEDDED: KunjunganData = {
  omzet: normalizeMonthKeys(embeddedRaw.omzet),
  kunjungan: normalizeMonthKeys(embeddedRaw.kunjungan),
  mcu: normalizeMonthKeys(embeddedRaw.mcu || {}),
};

export type ConnectionStatus = 'live' | 'loading' | 'embedded' | 'error';

export interface KumulatifData {
  kumOmzet: number;
  kumKunj: number;
  tglAkhir: number;
  targetOmzetBulan: number;
  targetKunjBulan: number;
  targetOmzetHarian: Record<string, number>;
  targetKunjHarian: Record<string, number>;
}

export function useKunjunganData() {
  const [data, setData] = useState<KunjunganData>(EMBEDDED);
  const [status, setStatus] = useState<ConnectionStatus>('embedded');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kumulatif, setKumulatif] = useState<KumulatifData | null>(null);
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
      const [result, kumResult] = await Promise.all([
        fetchSummary(),
        fetchKumulatif().catch(() => null),
      ]);
      setData({
        omzet: result.omzet,
        kunjungan: result.kunjungan,
        mcu: result.mcu,
      });
      setLastUpdated(result.lastUpdated);
      setStatus('live');
      setError(null);

      if (kumResult && !kumResult.error) {
        setKumulatif({
          kumOmzet: kumResult.kumOmzet || 0,
          kumKunj: kumResult.kumKunj || 0,
          tglAkhir: kumResult.tglAkhir || 0,
          targetOmzetBulan: kumResult.targetOmzetBulan || 0,
          targetKunjBulan: kumResult.targetKunjBulan || 0,
          targetOmzetHarian: kumResult.targetOmzetHarian || {},
          targetKunjHarian: kumResult.targetKunjHarian || {},
        });
      }
    } catch (e: any) {
      console.error('Fetch kunjungan failed:', e);
      setError(e.message || 'Gagal terhubung');
      setStatus('error');
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

  return { data, status, lastUpdated, error, refresh, availableMonths, kumulatif };
}
