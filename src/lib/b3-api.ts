// B3 (Bahan Berbahaya dan Beracun) — Google Sheets API integration
import type { B3Material, B3Stock, B3Pemakaian, B3Limbah, B3Dashboard } from './b3-types';

const GS_URL = import.meta.env.VITE_GAS_B3_URL || '';

export function isB3Connected(): boolean {
  return GS_URL.length > 0;
}

// ─── Generic fetch ───

async function gsGet(action: string, params?: Record<string, string>): Promise<any> {
  const url = new URL(GS_URL);
  url.searchParams.set('action', action);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v) url.searchParams.set(k, v);
    });
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

async function gsPost(action: string, body: Record<string, any>): Promise<any> {
  const url = new URL(GS_URL);
  url.searchParams.set('action', action);
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

// ─── Ping ───

export async function pingB3(): Promise<boolean> {
  try {
    const data = await gsGet('ping');
    return data?.status === 'ok';
  } catch {
    return false;
  }
}

// ─── Materials ───

export async function fetchMaterials(): Promise<B3Material[]> {
  const result = await gsGet('getMaterials');
  return result.data || [];
}

export async function createMaterial(data: Partial<B3Material>): Promise<B3Material> {
  const result = await gsPost('addMaterial', data as Record<string, any>);
  return result.data;
}

export async function updateMaterial(data: Partial<B3Material> & { id: string }): Promise<B3Material> {
  const result = await gsPost('updateMaterial', data as Record<string, any>);
  return result.data;
}

export async function toggleMaterialActive(id: string): Promise<boolean> {
  const result = await gsPost('toggleMaterial', { id });
  return result.is_active;
}

export async function deleteMaterial(id: string): Promise<void> {
  await gsPost('deleteMaterial', { id });
}

// ─── Stock ───

export async function fetchStock(materialId?: string): Promise<B3Stock[]> {
  const params: Record<string, string> = {};
  if (materialId) params.material_id = materialId;
  const result = await gsGet('getStock', params);
  return result.data || [];
}

export async function createStock(data: Partial<B3Stock>): Promise<B3Stock> {
  const result = await gsPost('addStock', data as Record<string, any>);
  return result.data;
}

// ─── Pemakaian ───

export async function fetchPemakaian(filters?: {
  tglMulai?: string;
  tglAkhir?: string;
  material_id?: string;
}): Promise<B3Pemakaian[]> {
  const params: Record<string, string> = {};
  if (filters?.tglMulai) params.tglMulai = filters.tglMulai;
  if (filters?.tglAkhir) params.tglAkhir = filters.tglAkhir;
  if (filters?.material_id) params.material_id = filters.material_id;
  const result = await gsGet('getPemakaian', params);
  return result.data || [];
}

export async function createPemakaian(data: {
  material_id: string;
  stock_id: string;
  qty: number;
  satuan?: string;
  tujuan?: string;
  tanggal?: string;
  jam?: string;
  analis?: string;
  catatan?: string;
}): Promise<{ id: string; remaining_stock: number }> {
  const result = await gsPost('addPemakaian', data as Record<string, any>);
  return { id: result.id, remaining_stock: result.remaining_stock };
}

export async function deletePemakaian(id: string): Promise<void> {
  await gsPost('deletePemakaian', { id });
}

// ─── Limbah ───

export async function fetchLimbah(filters?: {
  tglMulai?: string;
  tglAkhir?: string;
  waste_type?: string;
}): Promise<B3Limbah[]> {
  const params: Record<string, string> = {};
  if (filters?.tglMulai) params.tglMulai = filters.tglMulai;
  if (filters?.tglAkhir) params.tglAkhir = filters.tglAkhir;
  if (filters?.waste_type) params.waste_type = filters.waste_type;
  const result = await gsGet('getLimbah', params);
  return result.data || [];
}

export async function createLimbah(data: Partial<B3Limbah>): Promise<B3Limbah> {
  const result = await gsPost('addLimbah', data as Record<string, any>);
  return result.data;
}

export async function deleteLimbah(id: string): Promise<void> {
  await gsPost('deleteLimbah', { id });
}

// ─── Dashboard ───

export async function fetchDashboard(): Promise<B3Dashboard> {
  const result = await gsGet('getDashboard');
  return result.data;
}
