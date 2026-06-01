import { useState, useEffect, useCallback, useRef } from 'react';
import type { B3Material, B3Stock, B3Pemakaian, B3Limbah, B3Dashboard } from '@/lib/b3-types';
import {
  isB3Connected, pingB3,
  fetchMaterials, createMaterial, updateMaterial, toggleMaterialActive, deleteMaterial,
  fetchStock, createStock,
  fetchPemakaian, createPemakaian, deletePemakaian,
  fetchLimbah, createLimbah, deleteLimbah,
  fetchDashboard,
} from '@/lib/b3-api';
import { toast } from 'sonner';

export type ConnectionStatus = 'live' | 'loading' | 'offline' | 'error';

// Embedded demo data — used when GAS URL is not configured
const EMBEDDED_MATERIALS: B3Material[] = [];
const EMBEDDED_STOCK: B3Stock[] = [];
const EMBEDDED_PEMAKAIAN: B3Pemakaian[] = [];
const EMBEDDED_LIMBAH: B3Limbah[] = [];
const EMBEDDED_DASHBOARD: B3Dashboard = {
  total_materials: 0,
  low_stock_count: 0,
  expiring_soon_count: 0,
  expired_count: 0,
  waste_month_total: 0,
  waste_pending_count: 0,
  recent_usage: [],
  recent_waste: [],
};

export function useB3Data() {
  const [status, setStatus] = useState<ConnectionStatus>('offline');
  const [error, setError] = useState<string | null>(null);

  // Data
  const [materials, setMaterials] = useState<B3Material[]>(EMBEDDED_MATERIALS);
  const [stockEntries, setStockEntries] = useState<B3Stock[]>(EMBEDDED_STOCK);
  const [pemakaianRecords, setPemakaianRecords] = useState<B3Pemakaian[]>(EMBEDDED_PEMAKAIAN);
  const [limbahRecords, setLimbahRecords] = useState<B3Limbah[]>(EMBEDDED_LIMBAH);
  const [dashboard, setDashboard] = useState<B3Dashboard>(EMBEDDED_DASHBOARD);

  // Filters for pemakaian and limbah
  const [pemakaianFilters, setPemakaianFilters] = useState<{ tglMulai?: string; tglAkhir?: string; material_id?: string }>({});
  const [limbahFilters, setLimbahFilters] = useState<{ tglMulai?: string; tglAkhir?: string; waste_type?: string }>({});

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const connected = isB3Connected();

  const refresh = useCallback(async () => {
    if (!connected) {
      setStatus('offline');
      setError(null);
      return;
    }

    setStatus('loading');
    try {
      const [matData, dashData] = await Promise.all([
        fetchMaterials(),
        fetchDashboard().catch(() => null),
      ]);

      setMaterials(matData);
      if (dashData) setDashboard(dashData);
      setStatus('live');
      setError(null);
    } catch (e: any) {
      console.error('[B3] Refresh failed:', e);
      setError(e.message || 'Gagal terhubung ke server B3');
      setStatus('error');
    }
  }, [connected]);

  // Refresh stock
  const refreshStock = useCallback(async (materialId?: string) => {
    if (!connected) return;
    try {
      const data = await fetchStock(materialId);
      setStockEntries(data);
    } catch (e: any) {
      console.error('[B3] Stock refresh failed:', e);
    }
  }, [connected]);

  // Refresh pemakaian with filters
  const refreshPemakaian = useCallback(async (filters?: { tglMulai?: string; tglAkhir?: string; material_id?: string }) => {
    if (!connected) return;
    const f = filters || pemakaianFilters;
    try {
      const data = await fetchPemakaian(f);
      setPemakaianRecords(data);
      setPemakaianFilters(f);
    } catch (e: any) {
      console.error('[B3] Pemakaian refresh failed:', e);
    }
  }, [connected, pemakaianFilters]);

  // Refresh limbah with filters
  const refreshLimbah = useCallback(async (filters?: { tglMulai?: string; tglAkhir?: string; waste_type?: string }) => {
    if (!connected) return;
    const f = filters || limbahFilters;
    try {
      const data = await fetchLimbah(f);
      setLimbahRecords(data);
      setLimbahFilters(f);
    } catch (e: any) {
      console.error('[B3] Limbah refresh failed:', e);
    }
  }, [connected, limbahFilters]);

  // ─── Mutations ───

  const addMaterial = useCallback(async (data: Partial<B3Material>) => {
    if (!connected) throw new Error('Tidak terhubung');
    const result = await createMaterial(data);
    await refresh();
    toast.success('Material B3 berhasil ditambahkan');
    return result;
  }, [connected, refresh]);

  const editMaterial = useCallback(async (data: Partial<B3Material> & { id: string }) => {
    if (!connected) throw new Error('Tidak terhubung');
    const result = await updateMaterial(data);
    await refresh();
    toast.success('Material B3 berhasil diupdate');
    return result;
  }, [connected, refresh]);

  const toggleMaterial = useCallback(async (id: string) => {
    if (!connected) throw new Error('Tidak terhubung');
    const newState = await toggleMaterialActive(id);
    await refresh();
    toast.success(newState ? 'Material diaktifkan' : 'Material dinonaktifkan');
  }, [connected, refresh]);

  const removeMaterial = useCallback(async (id: string) => {
    if (!connected) throw new Error('Tidak terhubung');
    await deleteMaterial(id);
    await refresh();
    toast.success('Material B3 dihapus');
  }, [connected, refresh]);

  const addStock = useCallback(async (data: Partial<B3Stock>) => {
    if (!connected) throw new Error('Tidak terhubung');
    const result = await createStock(data);
    await refreshStock(data.material_id);
    toast.success('Stok berhasil ditambahkan');
    return result;
  }, [connected, refreshStock]);

  const addPemakaian = useCallback(async (data: {
    material_id: string;
    stock_id: string;
    qty: number;
    satuan?: string;
    tujuan?: string;
    tanggal?: string;
    jam?: string;
    analis?: string;
    catatan?: string;
  }) => {
    if (!connected) throw new Error('Tidak terhubung');
    const result = await createPemakaian(data);
    await Promise.all([refreshPemakaian(), refreshStock(data.material_id), refresh()]);
    toast.success(`Pemakaian tercatat — sisa stok: ${result.remaining_stock}`);
    return result;
  }, [connected, refreshPemakaian, refreshStock, refresh]);

  const removePemakaian = useCallback(async (id: string) => {
    if (!connected) throw new Error('Tidak terhubung');
    await deletePemakaian(id);
    await Promise.all([refreshPemakaian(), refresh()]);
    toast.success('Pemakaian dihapus — stok dikembalikan');
  }, [connected, refreshPemakaian, refresh]);

  const addLimbah = useCallback(async (data: Partial<B3Limbah>) => {
    if (!connected) throw new Error('Tidak terhubung');
    const result = await createLimbah(data);
    await Promise.all([refreshLimbah(), refresh()]);
    toast.success('Limbah B3 berhasil dicatat');
    return result;
  }, [connected, refreshLimbah, refresh]);

  const removeLimbah = useCallback(async (id: string) => {
    if (!connected) throw new Error('Tidak terhubung');
    await deleteLimbah(id);
    await Promise.all([refreshLimbah(), refresh()]);
    toast.success('Limbah B3 dihapus');
  }, [connected, refreshLimbah, refresh]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    if (connected) {
      refresh();
      refreshPemakaian();
      refreshLimbah();
      intervalRef.current = setInterval(() => {
        refresh();
        refreshPemakaian();
        refreshLimbah();
      }, 5 * 60 * 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [connected]);

  return {
    // Status
    status, error, connected,
    // Data
    materials, stockEntries, pemakaianRecords, limbahRecords, dashboard,
    // Queries
    refresh, refreshStock, refreshPemakaian, refreshLimbah,
    // Mutations
    addMaterial, editMaterial, toggleMaterial, removeMaterial,
    addStock,
    addPemakaian, removePemakaian,
    addLimbah, removeLimbah,
  };
}
