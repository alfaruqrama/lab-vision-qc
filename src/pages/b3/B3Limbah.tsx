import { useState, useMemo } from 'react';
import { Save, Trash2, Beaker } from 'lucide-react';
import { useB3Store } from '@/hooks/use-b3-store';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { WASTE_TYPES, DISPOSAL_METHODS } from '@/lib/b3-types';

export default function B3Limbah() {
  const { materials, limbahRecords, addLimbah, removeLimbah, refreshLimbah, connected } = useB3Store();
  const { user } = useAuth();
  const canInput = user?.role === 'admin' || user?.role === 'petugas';

  // Form
  const [wasteType, setWasteType] = useState('Cair');
  const [materialId, setMaterialId] = useState('');
  const [qty, setQty] = useState('');
  const [satuan, setSatuan] = useState('L');
  const [sumber, setSumber] = useState('');
  const [tanggalGenerasi, setTanggalGenerasi] = useState(new Date().toISOString().slice(0, 10));
  const [disposalMethod, setDisposalMethod] = useState('Belum Dibuang');
  const [manifestNo, setManifestNo] = useState('');
  const [catatan, setCatatan] = useState('');
  const [saving, setSaving] = useState(false);

  // Filters
  const [filterTglMulai, setFilterTglMulai] = useState('');
  const [filterTglAkhir, setFilterTglAkhir] = useState('');
  const [filterWasteType, setFilterWasteType] = useState('');

  const handleSubmit = async () => {
    if (!qty) { toast.error('Quantity harus diisi'); return; }
    setSaving(true);
    try {
      await addLimbah({
        material_id: materialId || undefined,
        waste_type: wasteType as any,
        qty: parseFloat(qty),
        satuan,
        sumber,
        tanggal_generasi: tanggalGenerasi,
        disposal_method: disposalMethod,
        manifest_no: manifestNo,
        tps_location: 'TPS B3',
        catatan,
      });
      setQty('');
      setSumber('');
      setManifestNo('');
      setCatatan('');
      toast.success('Limbah berhasil dicatat');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleFilter = () => {
    refreshLimbah({ tglMulai: filterTglMulai, tglAkhir: filterTglAkhir, waste_type: filterWasteType });
  };

  // Summary
  const summary = useMemo(() => {
    const total = limbahRecords.reduce((s, r) => s + r.qty, 0);
    const byType: Record<string, number> = {};
    const byDisposal: Record<string, number> = {};
    let pending = 0;
    limbahRecords.forEach(r => {
      byType[r.waste_type] = (byType[r.waste_type] || 0) + r.qty;
      byDisposal[r.disposal_method] = (byDisposal[r.disposal_method] || 0) + r.qty;
      if (r.disposal_method === 'Belum Dibuang') pending++;
    });
    return { total, byType, byDisposal, pending };
  }, [limbahRecords]);

  if (!connected) {
    return (
      <div className="text-center py-20">
        <Beaker size={48} className="text-muted-foreground/30 mx-auto mb-4" />
        <p className="text-muted-foreground">Modul B3 belum terhubung</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold font-display">Limbah B3</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card-clinical p-3">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground">Total Limbah</p>
          <p className="text-lg font-bold text-purple-600">{summary.total} unit</p>
        </div>
        {Object.entries(summary.byType).map(([type, qty]) => (
          <div key={type} className="card-clinical p-3">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">{type}</p>
            <p className="text-lg font-bold">{qty} unit</p>
          </div>
        ))}
        <div className="card-clinical p-3">
          <p className="text-[10px] font-semibold uppercase text-muted-foreground">Pending Disposal</p>
          <p className={cn('text-lg font-bold', summary.pending > 0 ? 'text-red-600' : 'text-green-600')}>{summary.pending}</p>
        </div>
      </div>

      {/* Input Form */}
      {canInput && (
        <div className="border rounded-xl p-6 space-y-4 bg-card">
          <h2 className="font-semibold text-sm">Input Limbah Baru</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <label className="space-y-1">
              <span className="text-xs font-medium">Jenis Limbah</span>
              <select value={wasteType} onChange={e => setWasteType(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                {WASTE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium">Material Sumber (opsional)</span>
              <select value={materialId} onChange={e => setMaterialId(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="">-- Tidak spesifik --</option>
                {materials.filter(m => m.is_active).map(m => (
                  <option key={m.id} value={m.id}>{m.kode} — {m.nama}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium">Quantity</span>
              <input type="number" value={qty} onChange={e => setQty(e.target.value)} min="0" step="any" className="w-full px-3 py-2 border rounded-lg text-sm" />
            </label>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <label className="space-y-1">
              <span className="text-xs font-medium">Satuan</span>
              <select value={satuan} onChange={e => setSatuan(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                {['L', 'mL', 'kg', 'g', 'buah'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium">Tanggal Generasi</span>
              <input type="date" value={tanggalGenerasi} onChange={e => setTanggalGenerasi(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium">Metode Disposal</span>
              <select value={disposalMethod} onChange={e => setDisposalMethod(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                {DISPOSAL_METHODS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <label className="space-y-1">
              <span className="text-xs font-medium">Sumber</span>
              <input value={sumber} onChange={e => setSumber(e.target.value)} placeholder="Sisa reagen PT..." className="w-full px-3 py-2 border rounded-lg text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium">No. Manifest</span>
              <input value={manifestNo} onChange={e => setManifestNo(e.target.value)} placeholder="MN-2026-001" className="w-full px-3 py-2 border rounded-lg text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium">Catatan</span>
              <input value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="Opsional..." className="w-full px-3 py-2 border rounded-lg text-sm" />
            </label>
          </div>
          <button
            onClick={handleSubmit}
            disabled={saving || !qty}
            className="flex items-center gap-2 px-6 py-2.5 text-sm rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? 'Menyimpan...' : 'Simpan Limbah'}
          </button>
        </div>
      )}

      {/* Waste Log */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm">Log Limbah</h2>
          <div className="flex items-center gap-2">
            <select value={filterWasteType} onChange={e => setFilterWasteType(e.target.value)} className="px-2 py-1 border rounded text-xs">
              <option value="">Semua Jenis</option>
              {WASTE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input type="date" value={filterTglMulai} onChange={e => setFilterTglMulai(e.target.value)} className="px-2 py-1 border rounded text-xs" />
            <span className="text-xs text-muted-foreground">s/d</span>
            <input type="date" value={filterTglAkhir} onChange={e => setFilterTglAkhir(e.target.value)} className="px-2 py-1 border rounded text-xs" />
            <button onClick={handleFilter} className="px-3 py-1 text-xs rounded bg-muted hover:bg-muted/80">Filter</button>
          </div>
        </div>

        {limbahRecords.length === 0 ? (
          <div className="text-center py-12 bg-muted/20 rounded-xl text-sm text-muted-foreground">
            Belum ada limbah tercatat
          </div>
        ) : (
          <div className="border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Tgl</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Jenis</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Material</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Qty</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Disposal</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Manifest</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Catatan</th>
                    {canInput && <th className="w-10"></th>}
                  </tr>
                </thead>
                <tbody>
                  {limbahRecords.map((r, i) => (
                    <tr key={r.id || i} className={cn('border-t hover:bg-muted/20', r.disposal_method === 'Belum Dibuang' && 'bg-red-50/30')}>
                      <td className="px-4 py-2 text-xs">{r.tanggal_generasi}</td>
                      <td className="px-4 py-2 text-xs">
                        <span className={cn(
                          'px-1.5 py-0.5 rounded-full text-[10px] font-medium',
                          r.waste_type === 'Cair' ? 'bg-blue-100 text-blue-700' :
                          r.waste_type === 'Padat' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700',
                        )}>{r.waste_type}</span>
                      </td>
                      <td className="px-4 py-2 text-xs">{r.material_nama || r.sumber || '-'}</td>
                      <td className="px-4 py-2 text-xs text-right font-mono">{r.qty} {r.satuan}</td>
                      <td className="px-4 py-2 text-xs">
                        <span className={cn(
                          'text-[10px]',
                          r.disposal_method === 'Belum Dibuang' ? 'text-red-600 font-medium' : 'text-muted-foreground',
                        )}>{r.disposal_method}</span>
                      </td>
                      <td className="px-4 py-2 text-xs font-mono">{r.manifest_no || '-'}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{r.catatan || '-'}</td>
                      {canInput && (
                        <td className="px-2 py-2">
                          <button
                            onClick={() => {
                              if (confirm('Hapus limbah ini?')) removeLimbah(r.id);
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
