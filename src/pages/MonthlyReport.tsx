import { useState, useMemo, useRef } from 'react';
import { useQCStore } from '@/hooks/use-qc-store';
import type { ParamName, WestgardStatus } from '@/lib/types';
import { PARAM_UNITS, getParamsForInstrument } from '@/lib/types';
import { getOverallStatus } from '@/lib/westgard';
import { FileText, Printer, Download } from 'lucide-react';

export default function MonthlyReport() {
  const { records, config } = useQCStore();
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [instrument, setInstrument] = useState<'ALL' | 'CA660' | 'EASYLITE' | 'ONCALL'>('ALL');
  const [showReport, setShowReport] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    let recs = records.filter(r => r.tanggal.startsWith(month));
    if (instrument !== 'ALL') recs = recs.filter(r => r.alat === instrument);
    return recs;
  }, [records, month, instrument]);

  interface SummaryRow {
    param: ParamName;
    alat: string;
    level: string;
    n: number;
    meanTarget: number;
    meanActual: number;
    sd: number;
    cv: number;
    status: WestgardStatus;
  }

  const summary = useMemo((): SummaryRow[] => {
    const groups: Record<string, { param: ParamName; alat: string; level: string; values: number[]; statuses: WestgardStatus[]; meanTarget: number }> = {};

    filtered.forEach(r => {
      const params = getParamsForInstrument(r.alat);
      params.forEach(p => {
        if (r.params[p] == null) return;
        const key = `${r.alat}-${r.level}-${p}`;
        if (!groups[key]) {
          let meanTarget = 0;
          if (r.alat === 'CA660') {
            const lot = config.CA660.find(l => l.lot === r.lot);
            meanTarget = lot?.Kontrol?.[p as 'PT' | 'APTT' | 'INR']?.mean || 0;
          } else if (r.alat === 'ONCALL') {
            const lot = config.ONCALL.find(l => l.lot === r.lot);
            meanTarget = (lot as any)?.[r.level]?.GDA?.mean || 0;
          } else {
            const lot = config.EASYLITE.find(l => l.lot === r.lot);
            meanTarget = (lot as any)?.[r.level]?.[p]?.mean || 0;
          }
          groups[key] = { param: p, alat: r.alat === 'CA660' ? 'Sysmex CA-660' : r.alat === 'ONCALL' ? 'On Call Sure' : 'Easylite', level: r.level, values: [], statuses: [], meanTarget };
        }
        groups[key].values.push(r.params[p]!);
        groups[key].statuses.push(r.status[p] || 'ok');
      });
    });

    return Object.values(groups).map(g => {
      const n = g.values.length;
      const mean = g.values.reduce((a, b) => a + b, 0) / n;
      const sd = n > 1 ? Math.sqrt(g.values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)) : 0;
      const cv = mean !== 0 ? (sd / mean) * 100 : 0;
      const status = getOverallStatus(g.statuses);
      return { param: g.param, alat: g.alat, level: g.level, n, meanTarget: g.meanTarget, meanActual: mean, sd, cv, status };
    });
  }, [filtered, config]);

  function handlePrint() {
    window.print();
  }

  function handleExportCSV() {
    const headers = ['Parameter', 'Alat', 'Level', 'N', 'Mean Target', 'Mean Aktual', 'SD', 'CV%', 'Status'];
    const rows = summary.map(r => [r.param, r.alat, r.level, r.n, r.meanTarget.toFixed(2), r.meanActual.toFixed(2), r.sd.toFixed(2), r.cv.toFixed(1), r.status === 'ok' ? 'Pass' : r.status === 'warning' ? 'Warning' : 'Reject']);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Laporan_PMI_${month}.csv`;
    a.click();
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Laporan Bulanan</h1>
        <p className="text-sm text-muted-foreground">Laporan Pemantapan Mutu Internal (PMI)</p>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Bulan</label>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-card text-sm font-mono-data" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Instrumen</label>
          <select value={instrument} onChange={e => setInstrument(e.target.value as any)} className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-card text-sm">
            <option value="ALL">Semua</option>
            <option value="CA660">Sysmex CA-660</option>
            <option value="EASYLITE">Easylite</option>
            <option value="ONCALL">On Call Sure</option>
          </select>
        </div>
        <div className="flex items-end">
          <button onClick={() => setShowReport(true)} className="w-full py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
            <FileText size={16} /> Generate
          </button>
        </div>
      </div>

      {showReport && (
        <>
          {/* Export buttons */}
          <div className="flex gap-2">
            <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted text-sm font-medium hover:bg-muted/80 transition-colors">
              <Printer size={14} /> Print / PDF
            </button>
            <button onClick={handleExportCSV} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted text-sm font-medium hover:bg-muted/80 transition-colors">
              <Download size={14} /> Export CSV
            </button>
          </div>

          {/* Report preview */}
          <div ref={reportRef} className="card-clinical overflow-hidden print:shadow-none print:border-none">
            {/* Header banner */}
            <div className="gradient-navy px-6 py-5 text-center">
              <h2 className="text-lg font-bold text-navy-foreground">RS Petrokimia Gresik</h2>
              <p className="text-xs text-navy-foreground/70 mt-1">Instalasi Laboratorium Klinik</p>
            </div>

            <div className="p-5 space-y-4">
              <div className="text-center">
                <h3 className="text-base font-bold">LAPORAN PEMANTAPAN MUTU INTERNAL (PMI)</h3>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <p>Periode: <span className="font-semibold text-foreground">{month}</span></p>
                <p>Total Data: <span className="font-semibold text-foreground">{filtered.length}</span></p>
                <p>Tanggal Cetak: <span className="font-semibold text-foreground">{new Date().toLocaleDateString('id-ID')}</span></p>
                <p>Sumber Data: <span className="font-semibold text-foreground">LabQC App</span></p>
              </div>

              {/* Summary table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted">
                      <th className="px-2 py-2 text-left font-semibold">Parameter</th>
                      <th className="px-2 py-2 text-left font-semibold">Alat</th>
                      <th className="px-2 py-2 text-left font-semibold">Level</th>
                      <th className="px-2 py-2 text-center font-semibold">N</th>
                      <th className="px-2 py-2 text-center font-semibold">Mean Target</th>
                      <th className="px-2 py-2 text-center font-semibold">Mean Aktual</th>
                      <th className="px-2 py-2 text-center font-semibold">SD</th>
                      <th className="px-2 py-2 text-center font-semibold">CV%</th>
                      <th className="px-2 py-2 text-center font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.map((row, i) => (
                      <tr key={i} className="border-b border-border">
                        <td className="px-2 py-2 font-semibold">{row.param}</td>
                        <td className="px-2 py-2">{row.alat}</td>
                        <td className="px-2 py-2">{row.level}</td>
                        <td className="px-2 py-2 text-center font-mono-data">{row.n}</td>
                        <td className="px-2 py-2 text-center font-mono-data">{row.meanTarget.toFixed(2)}</td>
                        <td className="px-2 py-2 text-center font-mono-data">{row.meanActual.toFixed(2)}</td>
                        <td className="px-2 py-2 text-center font-mono-data">{row.sd.toFixed(2)}</td>
                        <td className="px-2 py-2 text-center font-mono-data">{row.cv.toFixed(1)}%</td>
                        <td className="px-2 py-2 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            row.status === 'ok' ? 'status-ok' : row.status === 'warning' ? 'status-warning' : 'status-oos'
                          }`}>
                            {row.status === 'ok' ? 'Pass' : row.status === 'warning' ? 'Warning' : 'Reject'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Signature section */}
              <div className="grid grid-cols-2 gap-8 pt-8 mt-8 border-t border-border">
                <div className="text-center text-xs">
                  <p className="font-semibold">Penanggung Jawab QC</p>
                  <p className="text-muted-foreground">Analis Laboratorium</p>
                  <div className="h-16 mt-2 border-b border-border" />
                  <p className="mt-1">(...............................)</p>
                </div>
                <div className="text-center text-xs">
                  <p className="font-semibold">Ka. Instalasi Lab</p>
                  <p className="text-muted-foreground">Dokter Sp. PK</p>
                  <div className="h-16 mt-2 border-b border-border" />
                  <p className="mt-1">(...............................)</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
