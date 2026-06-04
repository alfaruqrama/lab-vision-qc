import { useState, useMemo } from 'react';
import { Save, Trash2, Clock, AlertTriangle } from 'lucide-react';
import { useB3Store } from '@/hooks/use-b3-store';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { TUJUAN_LIST } from '@/lib/b3-types';

export default function B3Pemakaian() {
  const { materials, stockEntries, pemakaianRecords, addPemakaian, removePemakaian, refreshPemakaian, refreshStock, connected } = useB3Store();
  const { user } = useAuth();
  const canInput = user?.role === 'admin' || user?.role === 'petugas';

  // Form state
  const [materialId, setMaterialId] = useState('');
  const [stockId, setStockId] = useState('');
  const [qty, setQty] = useState('');
  const [tujuan, setTujuan] = useState('');
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [analis, setAnalis] = useState(user?.nama || '');
  const [catatan, setCatatan] = useState('');
  const [saving, setSaving] = useState(false);

  // Filter state
  const [filterTglMulai, setFilterTglMulai] = useState('');
  const [filterTglAkhir, setFilterTglAkhir] = useState('');

  // Get available materials (must have stock)
  const availableMaterials = useMemo(() => {
    const stockMaterialIds = new Set(stockEntries.filter(s => s.current_qty > 0).map(s => s.material_id));
    return materials.filter(m => stockMaterialIds.has(m.id) && m.is_active);
  }, [materials, stockEntries]);

  // Get available batches for selected material
  const availableBatches = useMemo(() => {
    if (!materialId) return [];
    return stockEntries.filter(s => s.material_id === materialId && s.current_qty > 0);
  }, [materialId, stockEntries]);

  const selectedMaterial = materials.find(m => m.id === materialId);
  const selectedBatch = stockEntries.find(s => s.id === stockId);

  const handleSubmit = async () => {
    if (!materialId || !stockId || !qty) {
      toast.error('Material, batch, dan quantity harus diisi');
      return;
    }
    const qtyNum = parseFloat(qty);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      toast.error('Quantity harus positif');
      return;
    }
    if (selectedBatch && qtyNum > selectedBatch.current_qty) {
      toast.error(`Stok batch ${selectedBatch.batch_lot} tidak cukup. Tersedia: ${selectedBatch.current_qty} ${selectedBatch.satuan}`);
      return;
    }
    setSaving(true);
    try {
      await addPemakaian({
        material_id: materialId,
        stock_id: stockId,
        qty: qtyNum,
        satuan: selectedBatch?.satuan,
        tujuan: tujuan || 'Lainnya',
        tanggal,
        jam: new Date().toTimeString().slice(0, 5),
        analis: analis || user?.nama || '',
        catatan,
      });
      // Reset form
      setQty('');
      setTujuan('');
      setCatatan('');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleFilter = () => {
    refreshPemakaian({ tglMulai: filterTglMulai, tglAkhir: filterTglAkhir });
  };

  // Quick stats from today
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayUsage = pemakaianRecords.filter(r => r.tanggal === todayStr);
  const todayTotal = todayUsage.reduce((s, r) => s + r.qty, 0);

  if (!connected) {
    return (
      <div className="text-center py-20">
        <Clock size={48} className="text-muted-foreground/30 mx-auto mb-4" />
        <p className="text-muted-foreground">Modul B3 belum terhubung</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold font-display">Pemakaian B3</h1>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card-clinical p-3">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground">Entry Hari Ini</p>
          <p className="text-lg font-bold">{todayUsage.length}</p>
        </div>
        <div className="card-clinical p-3">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground">Total Qty Hari Ini</p>
          <p className="text-lg font-bold">{todayTotal} unit</p>
        </div>
        <div className="card-clinical p-3">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground">Material Tersedia</p>
          <p className="text-lg font-bold">{availableMaterials.length}</p>
        </div>
      </div>

      {/* Input Form */}
      {canInput && (
        <div className="border rounded-xl p-6 space-y-4 bg-card">
          <h2 className="font-semibold text-sm">Input Pemakaian Baru</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {/* Material */}
            <label className="space-y-1">
              <span className="text-xs font-medium">Material</span>
              <select value={materialId} onChange={e => { setMaterialId(e.target.value); setStockId(''); }} className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="">-- Pilih Material --</option>
                {availableMaterials.map(m => (
                  <option key={m.id} value={m.id}>{m.kode} — {m.nama} (Stok: {stockEntries.filter(s => s.material_id === m.id).reduce((sum, s) => sum + s.current_qty, 0)} {m.satuan})</option>
                ))}
              </select>
              {availableMaterials.length === 0 && (
                <p className="text-[10px] text-amber-600 flex items-center gap-1">
                  <AlertTriangle size={10} /> Tidak ada material dengan stok
                </p>
              )}
            </label>
            {/* Batch */}
            <label className="space-y-1">
              <span className="text-xs font-medium">Batch</span>
              <select value={stockId} onChange={e => setStockId(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" disabled={!materialId}>
                <option value="">-- Pilih Batch --</option>
                {availableBatches.map(b => (
                  <option key={b.id} value={b.id}>{b.batch_lot} (sisa: {b.current_qty} {b.satuan}{b.expiry_date ? ` · Exp: ${b.expiry_date}` : ''})</option>
                ))}
              </select>
              {selectedBatch && (
                <p className={cn('text-[10px]', selectedBatch.current_qty <= 1 ? 'text-orange-600' : 'text-green-600')}>
                  Tersedia: {selectedBatch.current_qty} {selectedBatch.satuan}
                </p>
              )}
            </label>
            {/* Qty */}
            <label className="space-y-1">
              <span className="text-xs font-medium">Quantity</span>
              <input
                type="number"
                value={qty}
                onChange={e => setQty(e.target.value)}
                min="0"
                step="any"
                placeholder={selectedBatch ? `Max ${selectedBatch.current_qty}` : '0'}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </label>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <label className="space-y-1">
              <span className="text-xs font-medium">Tanggal</span>
              <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium">Tujuan</span>
              <select value={tujuan} onChange={e => setTujuan(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="">-- Pilih --</option>
                {TUJUAN_LIST.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium">Analis</span>
              <input value={analis} onChange={e => setAnalis(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </label>
          </div>
          <label className="space-y-1 block">
            <span className="text-xs font-medium">Catatan (opsional)</span>
            <input value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="Catatan tambahan..." className="w-full px-3 py-2 border rounded-lg text-sm" />
          </label>
          <button
            onClick={handleSubmit}
            disabled={saving || !materialId || !stockId || !qty}
            className="flex items-center gap-2 px-6 py-2.5 text-sm rounded-lg bg-accent text-white hover:bg-accent/90 disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? 'Menyimpan...' : 'Simpan Pemakaian'}
          </button>
        </div>
      )}

      {/* Usage Log */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm">Log Pemakaian</h2>
          <div className="flex items-center gap-2">
            <input type="date" value={filterTglMulai} onChange={e => setFilterTglMulai(e.target.value)} className="px-2 py-1 border rounded text-xs" />
            <span className="text-xs text-muted-foreground">s/d</span>
            <input type="date" value={filterTglAkhir} onChange={e => setFilterTglAkhir(e.target.value)} className="px-2 py-1 border rounded text-xs" />
            <button onClick={handleFilter} className="px-3 py-1 text-xs rounded bg-muted hover:bg-muted/80">Filter</button>
          </div>
        </div>

        {pemakaianRecords.length === 0 ? (
          <div className="text-center py-12 bg-muted/20 rounded-xl text-sm text-muted-foreground">
            Belum ada pemakaian tercatat
          </div>
        ) : (
          <div className="border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Tgl</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Jam</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Material</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Batch</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Qty</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Tujuan</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Analis</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Catatan</th>
                    {canInput && <th className="w-10"></th>}
                  </tr>
                </thead>
                <tbody>
                  {pemakaianRecords.map((r, i) => (
                    <tr key={r.id || i} className="border-t hover:bg-muted/20">
                      <td className="px-4 py-2 text-xs">{r.tanggal}</td>
                      <td className="px-4 py-2 text-xs">{r.jam}</td>
                      <td className="px-4 py-2 text-xs font-medium">{r.material_nama || r.material_id}</td>
                      <td className="px-4 py-2 text-xs font-mono">{r.batch_lot || '-'}</td>
                      <td className="px-4 py-2 text-xs text-right font-mono">{r.qty} {r.satuan}</td>
                      <td className="px-4 py-2 text-xs">{r.tujuan}</td>
                      <td className="px-4 py-2 text-xs">{r.analis}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{r.catatan || '-'}</td>
                      {canInput && (
                        <td className="px-2 py-2">
                          <button
                            onClick={() => {
                              if (confirm('Hapus pemakaian ini? Stok akan dikembalikan.')) {
                                removePemakaian(r.id);
                              }
                            }}
                            className="p-1 rounded hover:bg-red-50 text-red-500"
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
