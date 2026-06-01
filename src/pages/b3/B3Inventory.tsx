import { useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, Power, PowerOff, Box, Search } from 'lucide-react';
import { useB3Store } from '@/hooks/use-b3-store';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  type B3Material, type B3Stock,
  B3_KATEGORI, HAZARD_CLASSES, STORAGE_LOCATIONS, SATUAN_LIST,
  HAZARD_CONFIG, getExpiryStatus, EXPIRY_LABELS, EXPIRY_COLORS,
} from '@/lib/b3-types';

// ─── Hazard Badge ───
function HazardBadge({ hazardClass }: { hazardClass: string }) {
  const c = HAZARD_CONFIG[hazardClass as keyof typeof HAZARD_CONFIG];
  if (!c) return <span className="text-xs px-2 py-0.5 rounded-full border bg-gray-50 text-gray-600">{hazardClass}</span>;
  return (
    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border font-medium inline-flex items-center gap-1', c.bg, c.text, c.border)}>
      {c.icon} {hazardClass}
    </span>
  );
}

// ─── Material Form Dialog ───
function MaterialFormDialog({
  open, onClose, material, onSave
}: {
  open: boolean; onClose: () => void; material?: B3Material | null; onSave: (data: any) => Promise<void>;
}) {
  const [form, setForm] = useState({
    kode: material?.kode || '',
    nama: material?.nama || '',
    kategori: material?.kategori || 'Reagen' as string,
    hazard_class: material?.hazard_class ? material.hazard_class.split(', ').filter(Boolean) : [] as string[],
    storage_location: material?.storage_location || '',
    satuan: material?.satuan || 'L',
    low_stock_threshold: material?.low_stock_threshold || 0,
  });
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleSave = async () => {
    if (!form.nama.trim()) { toast.error('Nama material harus diisi'); return; }
    if (!form.kode.trim()) { toast.error('Kode material harus diisi'); return; }
    setSaving(true);
    try {
      await onSave(material?.id ? { ...form, id: material.id } : form);
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  const toggleHazard = (h: string) => {
    setForm(f => ({
      ...f,
      hazard_class: f.hazard_class.includes(h) ? f.hazard_class.filter(x => x !== h) : [...f.hazard_class, h],
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-xl border border-border w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold">{material ? 'Edit Material' : 'Tambah Material B3'}</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs font-medium">Kode *</span>
              <input value={form.kode} onChange={e => setForm({ ...form, kode: e.target.value })} placeholder="B3-001" className="w-full px-3 py-2 border rounded-lg text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium">Satuan *</span>
              <select value={form.satuan} onChange={e => setForm({ ...form, satuan: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm">
                {SATUAN_LIST.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>
          <label className="space-y-1 block">
            <span className="text-xs font-medium">Nama Material *</span>
            <input value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })} placeholder="Formalin 10%" className="w-full px-3 py-2 border rounded-lg text-sm" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs font-medium">Kategori</span>
              <select value={form.kategori} onChange={e => setForm({ ...form, kategori: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm">
                {B3_KATEGORI.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium">Lokasi Penyimpanan</span>
              <select value={form.storage_location} onChange={e => setForm({ ...form, storage_location: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="">-- Pilih --</option>
                {STORAGE_LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </label>
          </div>
          {/* Hazard Class */}
          <div className="space-y-1">
            <span className="text-xs font-medium">Kelas Bahaya</span>
            <div className="flex flex-wrap gap-1.5">
              {HAZARD_CLASSES.map(h => {
                const active = form.hazard_class.includes(h);
                const c = HAZARD_CONFIG[h];
                return (
                  <button
                    key={h}
                    onClick={() => toggleHazard(h)}
                    className={cn(
                      'text-[10px] px-2 py-1 rounded-full border transition-colors',
                      active ? `${c.bg} ${c.text} ${c.border} font-medium` : 'bg-muted text-muted-foreground border-transparent hover:border-border',
                    )}
                  >
                    {c.icon} {h}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="space-y-1 block">
            <span className="text-xs font-medium">Threshold Stok Menipis</span>
            <input type="number" value={form.low_stock_threshold} onChange={e => setForm({ ...form, low_stock_threshold: parseFloat(e.target.value) || 0 })} min="0" step="0.1" className="w-full px-3 py-2 border rounded-lg text-sm" />
          </label>
        </div>
        <div className="p-6 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border hover:bg-muted">Batal</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-accent text-white hover:bg-accent/90 disabled:opacity-50">
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Stock In Dialog ───
function StockInDialog({
  open, onClose, material, onSave
}: {
  open: boolean; onClose: () => void; material: B3Material; onSave: (data: any) => Promise<void>;
}) {
  const [form, setForm] = useState({
    batch_lot: '',
    initial_qty: '',
    satuan: material.satuan,
    expiry_date: '',
    received_date: new Date().toISOString().slice(0, 10),
    supplier: '',
  });
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleSave = async () => {
    if (!form.batch_lot.trim() || !form.initial_qty) {
      toast.error('Batch dan quantity harus diisi');
      return;
    }
    setSaving(true);
    try {
      await onSave({ ...form, material_id: material.id, initial_qty: parseFloat(form.initial_qty) });
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-xl border border-border w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold">Tambah Stok — {material.nama}</h2>
          <p className="text-xs text-muted-foreground mt-1">Kode: {material.kode}</p>
        </div>
        <div className="p-6 space-y-4">
          <label className="space-y-1 block">
            <span className="text-xs font-medium">Batch / Lot *</span>
            <input value={form.batch_lot} onChange={e => setForm({ ...form, batch_lot: e.target.value })} placeholder="EL-2026-05" className="w-full px-3 py-2 border rounded-lg text-sm" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs font-medium">Quantity *</span>
              <input type="number" value={form.initial_qty} onChange={e => setForm({ ...form, initial_qty: e.target.value })} min="0" step="0.01" className="w-full px-3 py-2 border rounded-lg text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium">Satuan</span>
              <select value={form.satuan} onChange={e => setForm({ ...form, satuan: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm">
                {SATUAN_LIST.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs font-medium">Tanggal Kadaluarsa</span>
              <input type="date" value={form.expiry_date} onChange={e => setForm({ ...form, expiry_date: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium">Tanggal Terima</span>
              <input type="date" value={form.received_date} onChange={e => setForm({ ...form, received_date: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </label>
          </div>
          <label className="space-y-1 block">
            <span className="text-xs font-medium">Supplier</span>
            <input value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} placeholder="Merck" className="w-full px-3 py-2 border rounded-lg text-sm" />
          </label>
        </div>
        <div className="p-6 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border hover:bg-muted">Batal</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-accent text-white hover:bg-accent/90 disabled:opacity-50">
            {saving ? 'Menyimpan...' : 'Tambah Stok'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───
export default function B3Inventory() {
  const { materials, stockEntries, addMaterial, editMaterial, toggleMaterial, removeMaterial, addStock, refreshStock, connected } = useB3Store();
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'petugas';

  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [editTarget, setEditTarget] = useState<B3Material | null>(null);
  const [showStockDialog, setShowStockDialog] = useState(false);
  const [stockTarget, setStockTarget] = useState<B3Material | null>(null);
  const [expandedMaterial, setExpandedMaterial] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Compute stock per material
  const stockMap = useMemo(() => {
    const map: Record<string, { total: number; entries: B3Stock[] }> = {};
    stockEntries.forEach(s => {
      if (!map[s.material_id]) map[s.material_id] = { total: 0, entries: [] };
      map[s.material_id].total += s.current_qty;
      map[s.material_id].entries.push(s);
    });
    return map;
  }, [stockEntries]);

  const filtered = useMemo(() => {
    if (!search) return materials;
    const q = search.toLowerCase();
    return materials.filter(m =>
      m.nama.toLowerCase().includes(q) || m.kode.toLowerCase().includes(q)
    );
  }, [materials, search]);

  if (!connected) {
    return (
      <div className="text-center py-20">
        <Box size={48} className="text-muted-foreground/30 mx-auto mb-4" />
        <p className="text-muted-foreground">Modul B3 belum terhubung</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-display">Inventaris B3</h1>
          <p className="text-sm text-muted-foreground">{materials.length} material terdaftar</p>
        </div>
        {canEdit && (
          <button
            onClick={() => { setEditTarget(null); setShowMaterialForm(true); }}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-accent text-white hover:bg-accent/90"
          >
            <Plus size={16} /> Tambah Material
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cari material berdasarkan nama atau kode..."
          className="w-full pl-9 pr-4 py-2.5 border rounded-lg text-sm"
        />
      </div>

      {/* Materials Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-muted/20 rounded-xl">
          <Box size={40} className="text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {search ? 'Tidak ada material yang cocok' : 'Belum ada material B3 terdaftar'}
          </p>
          {!search && canEdit && (
            <button
              onClick={() => { setEditTarget(null); setShowMaterialForm(true); }}
              className="mt-3 text-sm text-accent hover:underline"
            >
              Tambah material pertama →
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(m => {
            const stock = stockMap[m.id];
            const isExpanded = expandedMaterial === m.id;
            return (
              <div key={m.id} className={cn('rounded-xl border bg-card overflow-hidden', !m.is_active && 'opacity-50')}>
                {/* Material Row */}
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => {
                    setExpandedMaterial(isExpanded ? null : m.id);
                    if (!isExpanded) refreshStock(m.id);
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-muted-foreground">{m.kode}</span>
                      <h3 className="font-semibold text-sm truncate">{m.nama}</h3>
                      {!m.is_active && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-600">Nonaktif</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{m.kategori}</span>
                      {m.hazard_class && (typeof m.hazard_class === 'string' ? m.hazard_class.split(', ') : []).map((h: string) => (
                        <HazardBadge key={h} hazardClass={h.trim()} />
                      ))}
                      {m.storage_location && (
                        <span className="text-[10px] text-muted-foreground">· {m.storage_location}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={cn('text-lg font-bold', (stock?.total || 0) <= m.low_stock_threshold ? 'text-orange-600' : 'text-green-600')}>
                      {stock?.total ?? 0}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{m.satuan}</p>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => { setStockTarget(m); setShowStockDialog(true); }}
                        className="p-1.5 rounded-lg hover:bg-green-50 text-green-600"
                        title="Tambah Stok"
                      >
                        <Plus size={14} />
                      </button>
                      <button
                        onClick={() => { setEditTarget(m); setShowMaterialForm(true); }}
                        className="p-1.5 rounded-lg hover:bg-muted"
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => toggleMaterial(m.id)}
                        className="p-1.5 rounded-lg hover:bg-muted"
                        title={m.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                      >
                        {m.is_active ? <PowerOff size={14} /> : <Power size={14} />}
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Hapus material "${m.nama}"? Semua stok dan data terkait akan ikut terhapus.`)) {
                            removeMaterial(m.id);
                          }
                        }}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"
                        title="Hapus"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Expanded Stock Detail */}
                {isExpanded && (
                  <div className="border-t bg-muted/10 px-4 py-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Riwayat Stok</p>
                    {(stock?.entries || []).length === 0 ? (
                      <p className="text-xs text-muted-foreground">Belum ada stok tercatat</p>
                    ) : (
                      <div className="space-y-1.5">
                        {stock!.entries.map(e => {
                          const expStatus = getExpiryStatus(e.expiry_date);
                          return (
                            <div key={e.id} className="flex items-center justify-between text-xs py-1.5 px-2 rounded bg-white/50">
                              <div>
                                <span className="font-medium">{e.batch_lot}</span>
                                <span className="text-muted-foreground ml-2">
                                  Awal: {e.initial_qty} {e.satuan}
                                </span>
                                {e.supplier && <span className="text-muted-foreground ml-2">· {e.supplier}</span>}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono">{e.current_qty} {e.satuan}</span>
                                {e.expiry_date && (
                                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border', EXPIRY_COLORS[expStatus])}>
                                    {EXPIRY_LABELS[expStatus]} ({e.expiry_date})
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Dialogs */}
      <MaterialFormDialog
        open={showMaterialForm}
        onClose={() => { setShowMaterialForm(false); setEditTarget(null); }}
        material={editTarget}
        onSave={async (data) => {
          if (editTarget) await editMaterial({ ...data, id: editTarget.id });
          else await addMaterial(data);
        }}
      />
      {stockTarget && (
        <StockInDialog
          open={showStockDialog}
          onClose={() => { setShowStockDialog(false); setStockTarget(null); }}
          material={stockTarget}
          onSave={addStock}
        />
      )}
    </div>
  );
}
