import { useState, useMemo, useRef } from 'react';
import { useQCStore } from '@/hooks/use-qc-store';
import type { ParamName, WestgardStatus } from '@/lib/types';
import { getParamsForInstrument } from '@/lib/types';
import { getOverallStatus } from '@/lib/westgard';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { StatusBadge } from '@/features/qc/components';
import { INSTRUMENT_LABELS } from '@/features/qc/lib/constants';
import { FileText, Printer, Download, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

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

export default function MonthlyReport() {
  const { records, config } = useQCStore();
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [instrument, setInstrument] = useState<'ALL' | 'CA660' | 'EASYLITE' | 'ONCALL1' | 'ONCALL2'>('ALL');
  const [showReport, setShowReport] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  // Generate last 12 months for dropdown
  const monthOptions = useMemo(() => {
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

  const filtered = useMemo(() => {
    let recs = records.filter((r) => r.tanggal.startsWith(month));
    if (instrument !== 'ALL') recs = recs.filter((r) => r.alat === instrument);
    return recs;
  }, [records, month, instrument]);

  const summary = useMemo((): SummaryRow[] => {
    const groups: Record<
      string,
      { param: ParamName; alat: string; level: string; values: number[]; statuses: WestgardStatus[]; meanTarget: number }
    > = {};

    filtered.forEach((r) => {
      const params = getParamsForInstrument(r.alat);
      params.forEach((p) => {
        if (r.params[p] == null) return;
        const key = `${r.alat}-${r.level}-${p}`;
        if (!groups[key]) {
          let meanTarget = 0;
          if (r.alat === 'CA660') {
            const lot = config.CA660.find((l) => l.lot === r.lot);
            meanTarget = lot?.Kontrol?.[p as 'PT' | 'APTT' | 'INR']?.mean || 0;
          } else if (r.alat === 'ONCALL1') {
            const lot = config.ONCALL1.find((l) => l.lot === r.lot);
            meanTarget = (lot as any)?.[r.level]?.GDA?.mean || 0;
          } else if (r.alat === 'ONCALL2') {
            const lot = config.ONCALL2.find((l) => l.lot === r.lot);
            meanTarget = (lot as any)?.[r.level]?.GDA?.mean || 0;
          } else {
            const lot = config.EASYLITE.find((l) => l.lot === r.lot);
            meanTarget = (lot as any)?.[r.level]?.[p]?.mean || 0;
          }
          const alatLabel = INSTRUMENT_LABELS[r.alat] || r.alat;
          groups[key] = { param: p, alat: alatLabel, level: r.level, values: [], statuses: [], meanTarget };
        }
        groups[key].values.push(r.params[p]!);
        groups[key].statuses.push(r.status[p] || 'ok');
      });
    });

    return Object.values(groups).map((g) => {
      const n = g.values.length;
      const mean = g.values.reduce((a, b) => a + b, 0) / n;
      const sd = n > 1 ? Math.sqrt(g.values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)) : 0;
      const cv = mean !== 0 ? (sd / mean) * 100 : 0;
      const status = getOverallStatus(g.statuses);
      return { param: g.param, alat: g.alat, level: g.level, n, meanTarget: g.meanTarget, meanActual: mean, sd, cv, status };
    });
  }, [filtered, config]);

  // Summary stats
  const summaryStats = useMemo(() => {
    const pass = summary.filter((r) => r.status === 'ok').length;
    const warn = summary.filter((r) => r.status === 'warning').length;
    const reject = summary.filter((r) => r.status === 'oos').length;
    return { pass, warn, reject, total: summary.length };
  }, [summary]);

  function handlePrint() {
    window.print();
  }

  function handleExportExcel() {
    const headers = ['Parameter', 'Alat', 'Level', 'N', 'Mean Target', 'Mean Aktual', 'SD', 'CV%', 'Status'];
    const rows = summary.map((r) => [
      r.param,
      r.alat,
      r.level,
      r.n,
      parseFloat(r.meanTarget.toFixed(2)),
      parseFloat(r.meanActual.toFixed(2)),
      parseFloat(r.sd.toFixed(2)),
      parseFloat(r.cv.toFixed(1)),
      r.status === 'ok' ? 'Pass' : r.status === 'warning' ? 'Warning' : 'Reject',
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = [8, 16, 10, 5, 12, 12, 8, 8, 10].map((w) => ({ wch: w }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Laporan PMI');
    XLSX.writeFile(wb, `Laporan_PMI_${month}.xlsx`);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Laporan Bulanan</h1>
        <p className="text-sm text-muted-foreground">Laporan QC</p>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Bulan</Label>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {monthOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Instrumen</Label>
          <select
            value={instrument}
            onChange={(e) => setInstrument(e.target.value as any)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="ALL">Semua</option>
            <option value="CA660">Sysmex CA-660</option>
            <option value="EASYLITE">Easylite</option>
            <option value="ONCALL1">On Call Sure 1</option>
            <option value="ONCALL2">On Call Sure 2</option>
          </select>
        </div>
        <div className="flex items-end">
          <Button onClick={() => setShowReport(true)} className="w-full gap-2">
            <FileText size={16} /> Generate
          </Button>
        </div>
      </div>

      {showReport && (
        <>
          {/* Summary stat cards */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <CheckCircle size={14} className="text-success" />
                <span className="text-xs text-muted-foreground">Pass</span>
              </div>
              <p className="text-lg font-bold font-mono-data text-success">{summaryStats.pass}</p>
            </Card>
            <Card className="p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <AlertTriangle size={14} className="text-warning" />
                <span className="text-xs text-muted-foreground">Warning</span>
              </div>
              <p className="text-lg font-bold font-mono-data text-warning">{summaryStats.warn}</p>
            </Card>
            <Card className="p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <XCircle size={14} className="text-destructive" />
                <span className="text-xs text-muted-foreground">Reject</span>
              </div>
              <p className="text-lg font-bold font-mono-data text-destructive">{summaryStats.reject}</p>
            </Card>
          </div>

          {/* Export buttons */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
              <Printer size={14} /> Print / PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-1.5">
              <Download size={14} /> Export Excel
            </Button>
          </div>

          {/* Report preview */}
          <Card ref={reportRef} className="overflow-hidden print:shadow-none print:border-none">
            {/* Header banner */}
            <div className="gradient-navy px-6 py-5 text-center">
              <h2 className="text-lg font-bold text-navy-foreground">RS Petrokimia Gresik</h2>
              <p className="text-xs text-navy-foreground/70 mt-1">Instalasi Laboratorium Klinik</p>
            </div>

            <div className="p-5 space-y-4">
              <div className="text-center">
                <h3 className="text-base font-bold">LAPORAN QC</h3>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <p>
                  Periode: <span className="font-semibold text-foreground">{month}</span>
                </p>
                <p>
                  Total Data: <span className="font-semibold text-foreground">{filtered.length}</span>
                </p>
                <p>
                  Tanggal Cetak: <span className="font-semibold text-foreground">{new Date().toLocaleDateString('id-ID')}</span>
                </p>
                <p>
                  Sumber Data: <span className="font-semibold text-foreground">LabQC App</span>
                </p>
              </div>

              {/* Summary table */}
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="h-9 px-2 text-xs">Parameter</TableHead>
                    <TableHead className="h-9 px-2 text-xs">Alat</TableHead>
                    <TableHead className="h-9 px-2 text-xs">Level</TableHead>
                    <TableHead className="h-9 px-2 text-xs text-center">N</TableHead>
                    <TableHead className="h-9 px-2 text-xs text-center">Mean Target</TableHead>
                    <TableHead className="h-9 px-2 text-xs text-center">Mean Aktual</TableHead>
                    <TableHead className="h-9 px-2 text-xs text-center">SD</TableHead>
                    <TableHead className="h-9 px-2 text-xs text-center">CV%</TableHead>
                    <TableHead className="h-9 px-2 text-xs text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="px-2 py-2 text-xs font-semibold">{row.param}</TableCell>
                      <TableCell className="px-2 py-2 text-xs">{row.alat}</TableCell>
                      <TableCell className="px-2 py-2 text-xs">{row.level}</TableCell>
                      <TableCell className="px-2 py-2 text-xs text-center font-mono-data">{row.n}</TableCell>
                      <TableCell className="px-2 py-2 text-xs text-center font-mono-data">{row.meanTarget.toFixed(2)}</TableCell>
                      <TableCell className="px-2 py-2 text-xs text-center font-mono-data">{row.meanActual.toFixed(2)}</TableCell>
                      <TableCell className="px-2 py-2 text-xs text-center font-mono-data">{row.sd.toFixed(2)}</TableCell>
                      <TableCell className="px-2 py-2 text-xs text-center font-mono-data">{row.cv.toFixed(1)}%</TableCell>
                      <TableCell className="px-2 py-2 text-center">
                        <StatusBadge status={row.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

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
          </Card>
        </>
      )}
    </div>
  );
}
