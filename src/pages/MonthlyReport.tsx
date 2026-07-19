import { useState, useMemo, useRef, useEffect } from 'react';
import { useQCStore } from '@/hooks/use-qc-store';
import type { ParamName, WestgardStatus, InstrumentType } from '@/lib/types';
import { getEasyliteLots, getParamsForInstrument, PARAM_UNITS } from '@/lib/types';
import { getOverallStatus } from '@/lib/westgard';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusBadge } from '@/features/qc/components';
import { LogSheetView } from '@/features/qc/components/LogSheetView';
import { INSTRUMENT_LABELS } from '@/features/qc/lib/constants';
import { useAuth } from '@/hooks/use-auth';
import { FileText, Printer, Download, CheckCircle, AlertTriangle, XCircle, Loader2 } from 'lucide-react';
import { toPng } from 'html-to-image';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  Tooltip,
  Dot,
} from 'recharts';
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
  const { user } = useAuth();
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [instrument, setInstrument] = useState<'ALL' | InstrumentType>('ALL');
  const [showReport, setShowReport] = useState(false);
  const [viewMode, setViewMode] = useState<'summary' | 'logsheet'>('summary');
  const [selectedParam, setSelectedParam] = useState<ParamName>('GDA');
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

  // Available params based on instrument selection (for log sheet mode)
  const availableParams = useMemo((): ParamName[] => {
    if (instrument === 'ALL') return ['PT', 'APTT', 'INR', 'Na', 'K', 'Cl', 'GDA'];
    return getParamsForInstrument(instrument);
  }, [instrument]);

  // Reset selectedParam when instrument changes and current param is unavailable
  useEffect(() => {
    if (!availableParams.includes(selectedParam)) {
      setSelectedParam(availableParams[0]);
    }
  }, [availableParams, selectedParam]);

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
          } else if (r.alat === 'CLEVER1') {
            const lot = config.CLEVER1.find((l) => l.lot === r.lot);
            meanTarget = lot?.Kontrol?.GDA?.mean || 0;
          } else if (r.alat === 'CLEVER2') {
            const lot = config.CLEVER2.find((l) => l.lot === r.lot);
            meanTarget = lot?.Kontrol?.GDA?.mean || 0;
          } else if (r.alat === 'ONCALL1') {
            const lot = config.ONCALL1.find((l) => l.lot === r.lot);
            meanTarget = (lot as any)?.[r.level]?.GDA?.mean || 0;
          } else if (r.alat === 'ONCALL2') {
            const lot = config.ONCALL2.find((l) => l.lot === r.lot);
            meanTarget = (lot as any)?.[r.level]?.GDA?.mean || 0;
          } else {
            const lot = getEasyliteLots(config, r.level).find((l) => l.lot === r.lot);
            meanTarget = lot?.params?.[p as 'Na' | 'K' | 'Cl']?.mean || 0;
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

  // Chart data for LJ overview (one chart per instrument group)
  const chartGroups = useMemo(() => {
    const groups: Record<string, { alat: string; level: string; param: ParamName; data: { run: number; value: number; date: string }[]; mean: number; sd: number; color: string }[]> = {};

    const COLORS = ['hsl(220,79%,48%)', 'hsl(142,69%,40%)', 'hsl(30,85%,50%)', 'hsl(0,72%,51%)', 'hsl(270,70%,50%)', 'hsl(180,70%,40%)'];

    // Group records by alat+level
    const recsByLevel: Record<string, typeof filtered> = {};
    filtered.forEach((r) => {
      const key = `${r.alat}|${r.level}`;
      if (!recsByLevel[key]) recsByLevel[key] = [];
      recsByLevel[key].push(r);
    });

    Object.entries(recsByLevel).forEach(([key, recs]) => {
      const [alat, level] = key.split('|');
      const alatLabel = INSTRUMENT_LABELS[alat as InstrumentType] || alat;
      if (!groups[alatLabel]) groups[alatLabel] = [];

      const sorted = recs.sort((a, b) => a.tanggal.localeCompare(b.tanggal));
      const params = getParamsForInstrument(alat as InstrumentType);

      params.forEach((param, pi) => {
        const points = sorted
          .map((r, i) => ({ run: i + 1, value: r.params[param], date: r.tanggal }))
          .filter((p) => p.value != null);

        if (points.length < 2) return;

        const values = points.map((p) => p.value!);
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const sd = values.length > 1
          ? Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1))
          : 0;

        groups[alatLabel].push({
          alat: alatLabel,
          level,
          param,
          data: points,
          mean,
          sd,
          color: COLORS[(pi * 3 + groups[alatLabel].length) % COLORS.length],
        });
      });
    });

    return groups;
  }, [filtered]);

  const [printing, setPrinting] = useState(false);

  async function handlePrint() {
    if (!reportRef.current) return;
    setPrinting(true);
    try {
      const dataUrl = await toPng(reportRef.current, { quality: 0.95, pixelRatio: 2, skipFonts: true });

      const monthLabel = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]) - 1, 1)
        .toLocaleDateString('id-ID', { year: 'numeric', month: 'long' });

      const printWin = window.open('', '_blank', 'width=800,height=600');
      if (!printWin) return;

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Laporan QC — ${monthLabel}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; color: #1a1a1a; padding: 16px 20px; }
    .report img { width: 100%; display: block; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="report">
    <img src="${dataUrl}" alt="Laporan QC" />
  </div>
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

      printWin.document.write(html);
      printWin.document.close();
    } catch (err) {
      console.error('Failed to print report:', err);
    } finally {
      setPrinting(false);
    }
  }

  function handleExportExcel() {
    if (viewMode === 'logsheet') {
      // Log sheet: export raw data
      const headers = ['Tanggal', 'Instrumen', 'Level', 'Parameter', 'Hasil', 'Operator', 'Status'];
      const rows = filtered
        .filter((r) => r.params[selectedParam] != null)
        .sort((a, b) => a.tanggal.localeCompare(b.tanggal))
        .map((r) => [
          r.tanggal,
          INSTRUMENT_LABELS[r.alat] || r.alat,
          r.level,
          selectedParam,
          parseFloat(r.params[selectedParam]!.toFixed(2)),
          r.analis || '',
          r.status[selectedParam] || 'ok',
        ]);

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!cols'] = [12, 18, 12, 10, 10, 14, 8].map((w) => ({ wch: w }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Log Sheet QC');
      XLSX.writeFile(wb, `Log_Sheet_QC_${month}.xlsx`);
    } else {
      // Summary: export statistics
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
            <option value="CLEVER1">GDA Clever Check 1</option>
            <option value="CLEVER2">GDA Clever Check 2</option>
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
          {/* View mode toggle */}
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'summary' | 'logsheet')}>
            <TabsList className="grid w-full max-w-xs grid-cols-2">
              <TabsTrigger value="summary" className="text-xs">Ringkasan</TabsTrigger>
              <TabsTrigger value="logsheet" className="text-xs">Log Sheet</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Summary stat cards — only in summary mode */}
          {viewMode === 'summary' && (
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
          )}

          {/* Export buttons */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint} disabled={printing} className="gap-1.5">
              {printing ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
              Print / PDF
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
                <h3 className="text-base font-bold">
                  {viewMode === 'summary' ? 'LAPORAN QC' : 'LOG SHEET QC'}
                </h3>
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

              {viewMode === 'summary' ? (
                <>
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

                  {/* LJ Chart overview */}
                  {Object.entries(chartGroups).length > 0 && (
                    <div className="space-y-6 mt-4 pt-4 border-t border-border">
                      <h4 className="text-sm font-bold text-center">Grafik Levey-Jennings</h4>
                      {Object.entries(chartGroups).map(([alatLabel, series]) => (
                        <div key={alatLabel} className="space-y-2">
                          <h5 className="text-xs font-semibold text-muted-foreground">{alatLabel}</h5>
                          {series.map((s, si) => (
                            <div key={`${s.level}-${s.param}`} className="space-y-1">
                              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                <span className="w-2.5 h-0.5 rounded-full" style={{ backgroundColor: s.color }} />
                                {s.level} — {s.param} ({PARAM_UNITS[s.param]})
                                <span className="text-muted-foreground/60">n={s.data.length} μ={s.mean.toFixed(1)} σ={s.sd.toFixed(1)}</span>
                              </div>
                              <div className="h-[120px]">
                                <ResponsiveContainer width="100%" height="100%">
                                  <LineChart data={s.data} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
                                    <ReferenceArea y1={s.mean - s.sd} y2={s.mean + s.sd} fill="#16a34a" fillOpacity={0.06} />
                                    <ReferenceArea y1={s.mean - 2 * s.sd} y2={s.mean - s.sd} fill="#f59e0b" fillOpacity={0.06} />
                                    <ReferenceArea y1={s.mean + s.sd} y2={s.mean + 2 * s.sd} fill="#f59e0b" fillOpacity={0.06} />
                                    <ReferenceArea y1={s.mean - 3 * s.sd} y2={s.mean - 2 * s.sd} fill="#dc2626" fillOpacity={0.06} />
                                    <ReferenceArea y1={s.mean + 2 * s.sd} y2={s.mean + 3 * s.sd} fill="#dc2626" fillOpacity={0.06} />
                                    <ReferenceLine y={s.mean} stroke="#888" strokeDasharray="4 2" strokeOpacity={0.5} />
                                    <XAxis dataKey="run" hide />
                                    <YAxis hide domain={[s.mean - 4 * s.sd, s.mean + 4 * s.sd]} />
                                    <Tooltip
                                      contentStyle={{ fontSize: 11, borderRadius: 6, border: '1px solid #ddd', padding: '4px 8px' }}
                                      formatter={(value: number) => [value.toFixed(1), `${s.param}`]}
                                      labelFormatter={(run: number) => {
                                        const pt = s.data[run - 1];
                                        return pt ? `Run #${run} — ${pt.date}` : `Run #${run}`;
                                      }}
                                    />
                                    <Line
                                      type="linear"
                                      dataKey="value"
                                      stroke={s.color}
                                      strokeWidth={1.5}
                                      dot={false}
                                      activeDot={{ r: 3, fill: s.color }}
                                    />
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <LogSheetView
                  records={filtered}
                  month={month}
                  instrument={instrument}
                  selectedParam={selectedParam}
                  onParamChange={setSelectedParam}
                />
              )}

              {/* Signature section */}
              <div className="grid grid-cols-2 gap-8 pt-8 mt-8 border-t border-border">
                <div className="text-center text-xs">
                  <p className="font-semibold">PIC Alat</p>
                  <p className="text-muted-foreground">{user?.nama || '(.....................................)'}</p>
                  <div className="h-16 mt-2 border-b border-border" />
                </div>
                <div className="text-center text-xs">
                  <p className="font-semibold">Ka. Instalasi Lab</p>
                  <p className="text-muted-foreground">Marlina Setya Dewi, Str.Kes</p>
                  <div className="h-16 mt-2 border-b border-border" />
                </div>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
