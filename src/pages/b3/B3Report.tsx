import { useState, useMemo, useRef } from 'react';
import { Printer, Download, FileText, Package, ClipboardList, Beaker, BarChart3 } from 'lucide-react';
import { useB3Store } from '@/hooks/use-b3-store';
import { cn } from '@/lib/utils';
import { getExpiryStatus, EXPIRY_LABELS } from '@/lib/b3-types';
import * as XLSX from 'xlsx';

type TabType = 'stock' | 'pemakaian' | 'limbah' | 'rekapan';

// ─── Month options ───
function useMonthOptions() {
  return useMemo(() => {
    const options = [];
    const today = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('id-ID', { year: 'numeric', month: 'long' });
      options.push({ value, label });
    }
    return options;
  }, []);
}

// ─── Stat Card ───
function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="card-clinical p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl" style={{ background: color }} />
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className="text-xl font-bold" style={{ color }}>{value}</p>
    </div>
  );
}

// ─── Tab button ───
function TabBtn({ active, label, icon: Icon, onClick }: { active: boolean; label: string; icon: any; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors',
        active ? 'bg-accent text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80',
      )}
    >
      <Icon size={16} /> {label}
    </button>
  );
}

// ─── Export Helpers ───
function exportExcel(data: any[][], sheetName: string, fileName: string) {
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

function printReport(ref: React.RefObject<HTMLDivElement | null>) {
  if (!ref.current) return;
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;
  win.document.write(`
    <html><head><title>Laporan B3</title>
    <style>
      body { font-family: system-ui, sans-serif; padding: 2rem; color: #1e293b; }
      table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
      th, td { border: 1px solid #e2e8f0; padding: 0.5rem 0.75rem; text-align: left; font-size: 0.8rem; }
      th { background: #f1f5f9; font-weight: 600; }
      .header { text-align: center; margin-bottom: 1.5rem; }
      .header h1 { font-size: 1.2rem; margin: 0; }
      .header p { color: #64748b; font-size: 0.85rem; margin: 0.25rem 0; }
      .footer { margin-top: 2rem; display: flex; justify-content: space-between; }
      .footer div { text-align: center; }
      .footer .name { margin-top: 3rem; font-weight: 600; }
      .red { color: #dc2626; }
      .amber { color: #d97706; }
      .green { color: #16a34a; }
    </style></head><body>
    ${ref.current.innerHTML}
    </body></html>
  `);
  win.document.close();
  win.print();
}

export default function B3Report() {
  const { materials, stockEntries, pemakaianRecords, limbahRecords, dashboard, connected } = useB3Store();
  const monthOptions = useMonthOptions();
  const [tab, setTab] = useState<TabType>('stock');
  const [month, setMonth] = useState(monthOptions[0]?.value || '');
  const [showReport, setShowReport] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  // ─── Filter helpers ───
  const byMonth = (date: string) => (date || '').startsWith(month);

  if (!connected) {
    return (
      <div className="text-center py-20">
        <FileText size={48} className="text-muted-foreground/30 mx-auto mb-4" />
        <p className="text-muted-foreground">Modul B3 belum terhubung</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-display">Laporan B3</h1>
          <p className="text-sm text-muted-foreground">Laporan dan neraca bahan berbahaya & beracun</p>
        </div>
        {/* Month selector */}
        <select value={month} onChange={e => { setMonth(e.target.value); setShowReport(false); }} className="px-3 py-2 border rounded-lg text-sm">
          {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <TabBtn active={tab === 'stock'} label="Stok" icon={Package} onClick={() => setTab('stock')} />
        <TabBtn active={tab === 'pemakaian'} label="Pemakaian" icon={ClipboardList} onClick={() => setTab('pemakaian')} />
        <TabBtn active={tab === 'limbah'} label="Neraca Limbah" icon={Beaker} onClick={() => setTab('limbah')} />
        <TabBtn active={tab === 'rekapan'} label="Rekap Bulanan" icon={BarChart3} onClick={() => setTab('rekapan')} />
      </div>

      {/* Generate button */}
      <button
        onClick={() => setShowReport(true)}
        className="px-6 py-2.5 text-sm rounded-lg bg-accent text-white hover:bg-accent/90"
      >
        Generate Laporan
      </button>

      {showReport && (
        <div ref={reportRef} className="space-y-6">
          {/* Report Header */}
          <div className="text-center border-b pb-4">
            <h2 className="text-base font-bold">RS PETROKIMIA GRESIK</h2>
            <p className="text-sm text-muted-foreground">Unit Laboratorium — Laporan B3</p>
            <p className="text-xs text-muted-foreground mt-1">
              Periode: {monthOptions.find(o => o.value === month)?.label || month}
            </p>
          </div>

          {/* Export Buttons */}
          <div className="flex items-center gap-2 print:hidden">
            <button onClick={() => printReport(reportRef)} className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border hover:bg-muted">
              <Printer size={14} /> Print
            </button>
            <button onClick={() => {
              if (tab === 'stock') exportStock();
              else if (tab === 'pemakaian') exportPemakaian();
              else if (tab === 'limbah') exportLimbah();
              else exportRekapan();
            }} className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border hover:bg-muted">
              <Download size={14} /> Excel
            </button>
          </div>

          {/* Tab Content */}
          {tab === 'stock' && <StockReport materials={materials} stockEntries={stockEntries} />}
          {tab === 'pemakaian' && <PemakaianReport records={pemakaianRecords} month={month} materials={materials} />}
          {tab === 'limbah' && <LimbahReport records={limbahRecords} month={month} materials={materials} />}
          {tab === 'rekapan' && <RekapanReport materials={materials} stockEntries={stockEntries} pemakaianRecords={pemakaianRecords} limbahRecords={limbahRecords} month={month} monthLabel={monthOptions.find(o => o.value === month)?.label || ''} />}

          {/* Signature */}
          <div className="flex justify-end pt-8 border-t mt-8">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Penanggung Jawab B3</p>
              <p className="mt-8 font-semibold text-sm">_________________</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── STOCK REPORT ───
function StockReport({ materials, stockEntries }: { materials: any[]; stockEntries: any[] }) {
  const expired = stockEntries.filter((s: any) => getExpiryStatus(s.expiry_date) === 'expired').length;
  const expiringSoon = stockEntries.filter((s: any) => getExpiryStatus(s.expiry_date) === 'expiring-soon').length;
  const lowStock = materials.filter((m: any) => {
    const total = stockEntries.filter((s: any) => s.material_id === m.id).reduce((sum: number, s: any) => sum + s.current_qty, 0);
    return total <= m.low_stock_threshold;
  });

  const rows = stockEntries.map((s: any) => {
    const expStatus = getExpiryStatus(s.expiry_date);
    return [
      s.material_kode || '', s.material_nama || '', s.batch_lot,
      s.initial_qty, s.current_qty, s.satuan, s.expiry_date || '-',
      EXPIRY_LABELS[expStatus],
    ];
  });

  function exportStock() {
    exportExcel([
      ['LAPORAN STOK B3', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['Kode', 'Material', 'Batch/Lot', 'Qty Awal', 'Qty Saat Ini', 'Satuan', 'Expiry', 'Status'],
      ...rows,
    ], 'Stok B3', `Laporan_Stok_B3_${new Date().toISOString().slice(0, 10)}`);
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <StatCard label="Total Material" value={materials.filter((m: any) => m.is_active).length} color="#2563eb" />
        <StatCard label="Kadaluarsa / 30 Hari" value={`${expired} / ${expiringSoon}`} color={expired > 0 ? '#dc2626' : '#d97706'} />
        <StatCard label="Stok Menipis" value={lowStock.length} color="#ea580c" />
      </div>
      <table className="w-full text-sm border">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left px-3 py-2 text-xs">Kode</th>
            <th className="text-left px-3 py-2 text-xs">Material</th>
            <th className="text-left px-3 py-2 text-xs">Batch</th>
            <th className="text-right px-3 py-2 text-xs">Qty Awal</th>
            <th className="text-right px-3 py-2 text-xs">Qty Saat Ini</th>
            <th className="text-left px-3 py-2 text-xs">Satuan</th>
            <th className="text-left px-3 py-2 text-xs">Expiry</th>
            <th className="text-left px-3 py-2 text-xs">Status</th>
          </tr>
        </thead>
        <tbody>
          {stockEntries.map((s: any, i: number) => {
            const expStatus = getExpiryStatus(s.expiry_date);
            return (
              <tr key={s.id || i} className={cn('border-t',
                expStatus === 'expired' ? 'bg-red-50/30' : expStatus === 'expiring-soon' ? 'bg-amber-50/30' : '',
              )}>
                <td className="px-3 py-1.5 text-xs">{s.material_kode}</td>
                <td className="px-3 py-1.5 text-xs font-medium">{s.material_nama}</td>
                <td className="px-3 py-1.5 text-xs font-mono">{s.batch_lot}</td>
                <td className="px-3 py-1.5 text-xs text-right">{s.initial_qty}</td>
                <td className="px-3 py-1.5 text-xs text-right font-mono">{s.current_qty}</td>
                <td className="px-3 py-1.5 text-xs">{s.satuan}</td>
                <td className="px-3 py-1.5 text-xs">{s.expiry_date || '-'}</td>
                <td className="px-3 py-1.5 text-xs">
                  <span className={cn('px-1.5 py-0.5 rounded-full text-[10px]',
                    expStatus === 'expired' ? 'bg-red-100 text-red-700' :
                    expStatus === 'expiring-soon' ? 'bg-amber-100 text-amber-700' :
                    'bg-green-100 text-green-700',
                  )}>{EXPIRY_LABELS[expStatus]}</span>
                </td>
              </tr>
            );
          })}
          {stockEntries.length === 0 && (
            <tr><td colSpan={8} className="text-center py-8 text-xs text-muted-foreground">Belum ada data stok</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── PEMAKAIAN REPORT ───
function PemakaianReport({ records, month, materials }: { records: any[]; month: string; materials: any[] }) {
  const filtered = records.filter((r: any) => (r.tanggal || '').startsWith(month));
  const totalQty = filtered.reduce((s: number, r: any) => s + r.qty, 0);

  // Summary per material
  const byMaterial: Record<string, number> = {};
  filtered.forEach((r: any) => {
    byMaterial[r.material_nama || r.material_id] = (byMaterial[r.material_nama || r.material_id] || 0) + r.qty;
  });

  function exportPemakaian() {
    const data = [
      ['LOG PEMAKAIAN B3', '', '', '', '', '', ''],
      ['', '', '', '', '', '', ''],
      ['Tanggal', 'Jam', 'Material', 'Batch', 'Qty', 'Tujuan', 'Analis'],
      ...filtered.map((r: any) => [r.tanggal, r.jam, r.material_nama, r.batch_lot, r.qty, r.tujuan, r.analis]),
      ['', '', '', '', '', '', ''],
      ['RINGKASAN PER MATERIAL', '', '', '', '', '', ''],
      ['Material', 'Total Qty', '', '', '', '', ''],
      ...Object.entries(byMaterial).map(([nama, qty]) => [nama, qty]),
    ];
    exportExcel(data, 'Pemakaian', `Log_Pemakaian_B3_${month}`);
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <StatCard label="Total Entry" value={filtered.length} color="#2563eb" />
        <StatCard label="Total Qty" value={`${totalQty} unit`} color="#16a34a" />
        <StatCard label="Material Digunakan" value={Object.keys(byMaterial).length} color="#7c3aed" />
      </div>
      <table className="w-full text-sm border mb-4">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left px-3 py-2 text-xs">Tanggal</th>
            <th className="text-left px-3 py-2 text-xs">Jam</th>
            <th className="text-left px-3 py-2 text-xs">Material</th>
            <th className="text-left px-3 py-2 text-xs">Batch</th>
            <th className="text-right px-3 py-2 text-xs">Qty</th>
            <th className="text-left px-3 py-2 text-xs">Tujuan</th>
            <th className="text-left px-3 py-2 text-xs">Analis</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r: any, i: number) => (
            <tr key={r.id || i} className="border-t">
              <td className="px-3 py-1.5 text-xs">{r.tanggal}</td>
              <td className="px-3 py-1.5 text-xs">{r.jam}</td>
              <td className="px-3 py-1.5 text-xs">{r.material_nama}</td>
              <td className="px-3 py-1.5 text-xs font-mono">{r.batch_lot || '-'}</td>
              <td className="px-3 py-1.5 text-xs text-right">{r.qty} {r.satuan}</td>
              <td className="px-3 py-1.5 text-xs">{r.tujuan}</td>
              <td className="px-3 py-1.5 text-xs">{r.analis}</td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr><td colSpan={7} className="text-center py-8 text-xs text-muted-foreground">Tidak ada pemakaian di bulan ini</td></tr>
          )}
        </tbody>
      </table>
      {/* Summary per material */}
      <h3 className="text-sm font-semibold mb-2">Ringkasan per Material</h3>
      <table className="w-full text-sm border">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left px-3 py-2 text-xs">Material</th>
            <th className="text-right px-3 py-2 text-xs">Total Qty</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(byMaterial).map(([nama, qty]) => (
            <tr key={nama} className="border-t">
              <td className="px-3 py-1.5 text-xs">{nama}</td>
              <td className="px-3 py-1.5 text-xs text-right font-mono">{qty}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Export references for buttons
let exportStockFn: any, exportPemakaianFn: any, exportLimbahFn: any, exportRekapanFn: any;

// ─── LIMBAH REPORT (NERACA B3) ───
function LimbahReport({ records, month, materials }: { records: any[]; month: string; materials: any[] }) {
  const filtered = records.filter((r: any) => (r.tanggal_generasi || '').startsWith(month));
  const totalQty = filtered.reduce((s: number, r: any) => s + r.qty, 0);

  const byType: Record<string, number> = {};
  const byDisposal: Record<string, number> = {};
  let pendingCount = 0;
  filtered.forEach((r: any) => {
    byType[r.waste_type] = (byType[r.waste_type] || 0) + r.qty;
    byDisposal[r.disposal_method] = (byDisposal[r.disposal_method] || 0) + r.qty;
    if (r.disposal_method === 'Belum Dibuang') pendingCount++;
  });

  const disposed = Object.entries(byDisposal).filter(([k]) => k !== 'Belum Dibuang').reduce((s, [, v]) => s + (v as number), 0);

  return (
    <div>
      <div className="grid grid-cols-4 gap-3 mb-4">
        <StatCard label="Total Dihasilkan" value={`${totalQty} unit`} color="#7c3aed" />
        <StatCard label="Sudah Dibuang" value={`${disposed} unit`} color="#16a34a" />
        <StatCard label="Pending" value={`${pendingCount} entry`} color={pendingCount > 0 ? '#dc2626' : '#16a34a'} />
        <StatCard label="% Terselesaikan" value={totalQty > 0 ? `${Math.round((disposed / totalQty) * 100)}%` : 'N/A'} color="#2563eb" />
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        {/* Per Jenis */}
        <div>
          <h3 className="text-sm font-semibold mb-2">Limbah per Jenis</h3>
          <table className="w-full text-sm border">
            <thead className="bg-muted/50">
              <tr><th className="text-left px-3 py-2 text-xs">Jenis</th><th className="text-right px-3 py-2 text-xs">Qty</th></tr>
            </thead>
            <tbody>
              {Object.entries(byType).map(([type, qty]) => (
                <tr key={type} className="border-t">
                  <td className="px-3 py-1.5 text-xs">{type}</td>
                  <td className="px-3 py-1.5 text-xs text-right font-mono">{qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Per Disposal */}
        <div>
          <h3 className="text-sm font-semibold mb-2">Limbah per Metode Disposal</h3>
          <table className="w-full text-sm border">
            <thead className="bg-muted/50">
              <tr><th className="text-left px-3 py-2 text-xs">Metode</th><th className="text-right px-3 py-2 text-xs">Qty</th></tr>
            </thead>
            <tbody>
              {Object.entries(byDisposal).map(([method, qty]) => (
                <tr key={method} className="border-t">
                  <td className="px-3 py-1.5 text-xs">{method}</td>
                  <td className="px-3 py-1.5 text-xs text-right font-mono">{qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Table */}
      <table className="w-full text-sm border">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left px-3 py-2 text-xs">Tgl</th>
            <th className="text-left px-3 py-2 text-xs">Jenis</th>
            <th className="text-left px-3 py-2 text-xs">Sumber</th>
            <th className="text-right px-3 py-2 text-xs">Qty</th>
            <th className="text-left px-3 py-2 text-xs">Disposal</th>
            <th className="text-left px-3 py-2 text-xs">Manifest</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r: any, i: number) => (
            <tr key={r.id || i} className="border-t">
              <td className="px-3 py-1.5 text-xs">{r.tanggal_generasi}</td>
              <td className="px-3 py-1.5 text-xs">{r.waste_type}</td>
              <td className="px-3 py-1.5 text-xs">{r.material_nama || r.sumber || '-'}</td>
              <td className="px-3 py-1.5 text-xs text-right">{r.qty} {r.satuan}</td>
              <td className="px-3 py-1.5 text-xs">{r.disposal_method}</td>
              <td className="px-3 py-1.5 text-xs font-mono">{r.manifest_no || '-'}</td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr><td colSpan={6} className="text-center py-8 text-xs text-muted-foreground">Tidak ada limbah di bulan ini</td></tr>
          )}
        </tbody>
      </table>

      {/* Neraca */}
      <div className="mt-6 p-4 border rounded-lg bg-muted/10">
        <h3 className="text-sm font-semibold mb-3">Neraca Limbah B3 — {month}</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Dihasilkan</p>
            <p className="text-lg font-bold">{totalQty} unit</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Dibuang</p>
            <p className="text-lg font-bold text-green-600">{disposed} unit</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Saldo Akhir (Pending)</p>
            <p className="text-lg font-bold text-red-600">{totalQty - disposed} unit</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── REKAPAN REPORT ───
function RekapanReport({ materials, stockEntries, pemakaianRecords, limbahRecords, month, monthLabel }: {
  materials: any[]; stockEntries: any[]; pemakaianRecords: any[]; limbahRecords: any[]; month: string; monthLabel: string;
}) {
  const pemFiltered = pemakaianRecords.filter((r: any) => (r.tanggal || '').startsWith(month));
  const limbFiltered = limbahRecords.filter((r: any) => (r.tanggal_generasi || '').startsWith(month));

  const byMaterial: Record<string, number> = {};
  pemFiltered.forEach((r: any) => {
    const key = r.material_nama || r.material_id;
    byMaterial[key] = (byMaterial[key] || 0) + r.qty;
  });

  const sorted = Object.entries(byMaterial).sort(([, a], [, b]) => b - a).slice(0, 10);

  return (
    <div>
      <div className="grid grid-cols-4 gap-3 mb-4">
        <StatCard label="Material Aktif" value={materials.filter((m: any) => m.is_active).length} color="#2563eb" />
        <StatCard label="Pemakaian Bulan Ini" value={`${pemFiltered.length} entry`} color="#16a34a" />
        <StatCard label="Total Pemakaian" value={`${pemFiltered.reduce((s: number, r: any) => s + r.qty, 0)} unit`} color="#7c3aed" />
        <StatCard label="Limbah Bulan Ini" value={`${limbFiltered.reduce((s: number, r: any) => s + r.qty, 0)} unit`} color="#ea580c" />
      </div>

      {/* Top 10 */}
      <h3 className="text-sm font-semibold mb-2">Top 10 Pemakaian Material — {monthLabel}</h3>
      <table className="w-full text-sm border mb-4">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left px-3 py-2 text-xs w-10">#</th>
            <th className="text-left px-3 py-2 text-xs">Material</th>
            <th className="text-right px-3 py-2 text-xs">Total Qty</th>
            <th className="text-right px-3 py-2 text-xs">%</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(([nama, qty], i) => {
            const total = sorted.reduce((s, [, v]) => s + v, 0);
            const pct = total > 0 ? ((qty / total) * 100) : 0;
            return (
              <tr key={nama} className="border-t">
                <td className="px-3 py-1.5 text-xs text-muted-foreground">{i + 1}</td>
                <td className="px-3 py-1.5 text-xs font-medium">{nama}</td>
                <td className="px-3 py-1.5 text-xs text-right font-mono">{qty}</td>
                <td className="px-3 py-1.5 text-xs text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-accent rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                    <span>{Math.round(pct)}%</span>
                  </div>
                </td>
              </tr>
            );
          })}
          {sorted.length === 0 && (
            <tr><td colSpan={4} className="text-center py-8 text-xs text-muted-foreground">Tidak ada pemakaian di bulan ini</td></tr>
          )}
        </tbody>
      </table>

      {/* Waste Summary */}
      <h3 className="text-sm font-semibold mb-2">Ringkasan Limbah — {monthLabel}</h3>
      {limbFiltered.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4">Tidak ada limbah tercatat di bulan ini</p>
      ) : (
        <table className="w-full text-sm border">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-3 py-2 text-xs">Tgl</th>
              <th className="text-left px-3 py-2 text-xs">Jenis</th>
              <th className="text-right px-3 py-2 text-xs">Qty</th>
              <th className="text-left px-3 py-2 text-xs">Disposal</th>
              <th className="text-left px-3 py-2 text-xs">Status</th>
            </tr>
          </thead>
          <tbody>
            {limbFiltered.map((r: any, i: number) => (
              <tr key={r.id || i} className="border-t">
                <td className="px-3 py-1.5 text-xs">{r.tanggal_generasi}</td>
                <td className="px-3 py-1.5 text-xs">{r.waste_type}</td>
                <td className="px-3 py-1.5 text-xs text-right">{r.qty} {r.satuan}</td>
                <td className="px-3 py-1.5 text-xs">{r.disposal_method}</td>
                <td className="px-3 py-1.5 text-xs">
                  <span className={cn('px-1.5 py-0.5 rounded-full text-[10px]',
                    r.disposal_method === 'Belum Dibuang' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700',
                  )}>{r.disposal_method === 'Belum Dibuang' ? 'Pending' : 'Selesai'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
