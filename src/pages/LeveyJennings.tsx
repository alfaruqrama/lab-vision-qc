import { useState, useMemo, useRef, useCallback } from 'react';
import { useQCStore } from '@/hooks/use-qc-store';
import type { ParamName, InstrumentType, ControlLevel } from '@/lib/types';
import { getEasyliteLots } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { INSTRUMENT_LABELS } from '@/features/qc/lib/constants';
import { computeZScores, type ZScorePoint } from '@/lib/zscore';
import { analyzeMultiLevel, detectR4s, type MultiLevelAnalysis } from '@/lib/westgard-multi';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
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
  Legend,
} from 'recharts';
import {
  Activity,
  CheckCircle,
  AlertTriangle,
  XCircle,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  ShieldCheck,
  Download,
  FileText,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react';

const ALL_PARAMS: { name: ParamName; alat: InstrumentType; levels: ControlLevel[] }[] = [
  { name: 'PT', alat: 'CA660', levels: ['Kontrol'] },
  { name: 'APTT', alat: 'CA660', levels: ['Kontrol'] },
  { name: 'INR', alat: 'CA660', levels: ['Kontrol'] },
  { name: 'Na', alat: 'EASYLITE', levels: ['NORMAL', 'HIGH'] },
  { name: 'K', alat: 'EASYLITE', levels: ['NORMAL', 'HIGH'] },
  { name: 'Cl', alat: 'EASYLITE', levels: ['NORMAL', 'HIGH'] },
  { name: 'GDA', alat: 'ONCALL1', levels: ['CTRL0', 'CTRL1', 'CTRL2'] },
  { name: 'GDA', alat: 'ONCALL2', levels: ['CTRL0', 'CTRL1', 'CTRL2'] },
  { name: 'GDA', alat: 'CLEVER1', levels: ['Kontrol'] },
  { name: 'GDA', alat: 'CLEVER2', levels: ['Kontrol'] },
];

const CHART_INSTRUMENT_LABELS: Record<InstrumentType, string> = {
  CA660: 'CA-660',
  EASYLITE: 'Easylite',
  ONCALL1: 'OnCall 1',
  ONCALL2: 'OnCall 2',
  CLEVER1: 'Clever 1',
  CLEVER2: 'Clever 2',
};

const NORMAL_COLOR = 'hsl(220,79%,48%)';
const HIGH_COLOR = 'hsl(142,69%,40%)';

const MULTI_LEVEL_COLORS: Record<string, string> = {
  NORMAL: 'hsl(220,79%,48%)',
  HIGH: 'hsl(142,69%,40%)',
  CTRL0: 'hsl(220,79%,48%)',
  CTRL1: 'hsl(142,69%,40%)',
  CTRL2: 'hsl(30,85%,50%)',
};

type ChartMode = 'single' | 'multi';

// ─── Custom Dot (Single Mode) ─────────────────────────────────────────────────

function CustomDot(props: any) {
  const { cx, cy, payload } = props;
  if (!cx || !cy) return null;
  const st = payload.status;
  const hasCatatan = payload.catatan && payload.catatan.trim() !== '';
  const color = st === 'oos' ? 'hsl(0,72%,51%)' : st === 'warning' ? 'hsl(38,92%,44%)' : 'hsl(220,79%,48%)';

  if (st === 'oos') {
    return (
      <g>
        <line x1={cx - 5} y1={cy - 5} x2={cx + 5} y2={cy + 5} stroke={color} strokeWidth={2} />
        <line x1={cx + 5} y1={cy - 5} x2={cx - 5} y2={cy + 5} stroke={color} strokeWidth={2} />
        {hasCatatan && (
          <circle cx={cx + 8} cy={cy - 8} r={3} fill="hsl(var(--foreground))" stroke="white" strokeWidth={1.5} />
        )}
      </g>
    );
  }
  return (
    <g>
      <Dot cx={cx} cy={cy} r={4} fill={color} stroke="none" />
      {hasCatatan && (
        <circle cx={cx + 6} cy={cy - 6} r={2.5} fill="hsl(var(--foreground))" stroke="white" strokeWidth={1.5} />
      )}
    </g>
  );
}

// ─── Multi Mode Dot ───────────────────────────────────────────────────────────

function MultiDot(props: any) {
  const { cx, cy, payload } = props;
  if (!cx || !cy) return null;
  const st = payload.status;
  const color = payload.level === 'HIGH' ? HIGH_COLOR : NORMAL_COLOR;

  if (st === 'oos') {
    return (
      <g>
        <line x1={cx - 4} y1={cy - 4} x2={cx + 4} y2={cy + 4} stroke="hsl(0,72%,51%)" strokeWidth={2} opacity={0.9} />
        <line x1={cx + 4} y1={cy - 4} x2={cx - 4} y2={cy + 4} stroke="hsl(0,72%,51%)" strokeWidth={2} opacity={0.9} />
        <circle cx={cx} cy={cy} r={5} stroke={color} strokeWidth={1.5} fill="white" />
      </g>
    );
  }
  if (st === 'warning') {
    return (
      <g>
        <circle cx={cx} cy={cy} r={5} fill="hsl(38,92%,44%)" stroke={color} strokeWidth={1.5} />
        <path d={`M${cx - 2} ${cy - 2} L${cx + 2} ${cy + 2}`} stroke="white" strokeWidth={1} />
        <path d={`M${cx + 2} ${cy - 2} L${cx - 2} ${cy + 2}`} stroke="white" strokeWidth={1} />
      </g>
    );
  }
  return <Dot cx={cx} cy={cy} r={4} fill={color} stroke="none" />;
}

// ─── Westgard Analysis Card ───────────────────────────────────────────────────

function WestgardAnalysisCard({ analysis }: { analysis: MultiLevelAnalysis }) {
  const { rules, patterns, crossLevel, recommendation } = analysis;
  const hasViolations = rules.length > 0;
  const hasPatterns = patterns.length > 0;

  return (
    <Card className="overflow-hidden">
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-primary" />
          <h3 className="text-sm font-bold">Analisis Westgard Multi-Level</h3>
        </div>

        {/* Rule Violations */}
        {hasViolations && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Aturan Terlanggar</h4>
            {rules.map((r, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-start gap-2 rounded-md px-3 py-2 text-xs',
                  r.status === 'oos' ? 'bg-destructive/10 border border-destructive/20' : 'bg-warning/10 border border-warning/20',
                )}
              >
                {r.status === 'oos' ? (
                  <XCircle size={14} className="text-destructive shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle size={14} className="text-warning shrink-0 mt-0.5" />
                )}
                <div className="space-y-0.5">
                  <p className="font-semibold">
                    {r.rule} — {r.level}
                  </p>
                  <p className="text-muted-foreground">{r.description}</p>
                  <p className="text-[10px] font-mono-data text-muted-foreground">
                    {r.affectedDays.slice(0, 5).join(', ')}
                    {r.affectedDays.length > 5 ? ` +${r.affectedDays.length - 5} hari` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Patterns */}
        {hasPatterns && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pola Terdeteksi</h4>
            {patterns.map((p, i) => (
              <div key={i} className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs">
                {p.type === 'shift' && <ArrowRightLeft size={14} className="text-primary shrink-0 mt-0.5" />}
                {p.type === 'trend_up' && <TrendingUp size={14} className="text-warning shrink-0 mt-0.5" />}
                {p.type === 'trend_down' && <TrendingDown size={14} className="text-warning shrink-0 mt-0.5" />}
                {(p.type === 'bias_high' || p.type === 'bias_low') && <Activity size={14} className="text-primary shrink-0 mt-0.5" />}
                {p.type === 'random_error' && <AlertTriangle size={14} className="text-muted-foreground shrink-0 mt-0.5" />}
                <div>
                  <p className="font-semibold">{p.level} — {p.type.replace('_', ' ')}</p>
                  <p className="text-muted-foreground">{p.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Cross-Level */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Analisis Cross-Level</h4>
          <div
            className={cn(
              'rounded-md px-3 py-2.5 text-xs space-y-1',
              crossLevel.type === 'systematic'
                ? 'bg-destructive/10 border border-destructive/20'
                : crossLevel.type === 'specific'
                  ? 'bg-warning/10 border border-warning/20'
                  : 'bg-success/10 border border-success/20',
            )}
          >
            <p className="font-semibold flex items-center gap-1.5">
              {crossLevel.type === 'stable' ? (
                <ShieldCheck size={14} className="text-success" />
              ) : crossLevel.type === 'systematic' ? (
                <XCircle size={14} className="text-destructive" />
              ) : crossLevel.type === 'specific' ? (
                <AlertTriangle size={14} className="text-warning" />
              ) : null}
              {crossLevel.summary}
            </p>
            {crossLevel.details.map((d, i) => (
              <p key={i} className="text-muted-foreground">{d}</p>
            ))}
          </div>
        </div>

        {/* Recommendation */}
        <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2.5">
          <p className="text-xs font-semibold text-primary mb-1">Rekomendasi</p>
          <p className="text-xs leading-relaxed whitespace-pre-wrap">{recommendation}</p>
        </div>
      </div>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LeveyJennings() {
  const { records, config } = useQCStore();
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [selectedLevel, setSelectedLevel] = useState<ControlLevel>('Kontrol');
  const [mode, setMode] = useState<ChartMode>('single');
  const [downloading, setDownloading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
  );

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

  const selected = ALL_PARAMS[selectedIdx];
  const levelOptions = selected.levels;
  const isMultiLevelInstrument = ['EASYLITE', 'ONCALL1', 'ONCALL2'].includes(selected.alat);
  const supportsMultiLevel = isMultiLevelInstrument && mode === 'multi';

  // ── Single Mode ─────────────────────────────────────────────────────────────

  const filteredRecords = useMemo(() => {
    const lvl = supportsMultiLevel ? 'NORMAL' : selected.levels.length === 1 ? selected.levels[0] : selectedLevel;
    return records
      .filter(
        (r) =>
          r.alat === selected.alat &&
          r.level === lvl &&
          r.params[selected.name] != null &&
          r.tanggal.startsWith(selectedMonth),
      )
      .sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  }, [records, selected, selectedLevel, selectedMonth, supportsMultiLevel]);

  // Match lot config to records by lot number — use most frequent lot
  const lotConfig = useMemo(() => {
    // Count lot numbers from filtered records
    const lotCounts = new Map<string, number>();
    for (const r of filteredRecords) {
      if (r.lot) lotCounts.set(r.lot, (lotCounts.get(r.lot) || 0) + 1);
    }
    // Find the most-used lot that has a matching config
    const sortedLots = [...lotCounts.entries()].sort((a, b) => b[1] - a[1]);

    if (selected.alat === 'CA660') {
      for (const [lotNum] of sortedLots) {
        const lot = config.CA660.find((l) => l.lot === lotNum);
        if (lot) return lot.Kontrol?.[selected.name as 'PT' | 'APTT' | 'INR'] || null;
      }
      return config.CA660[0]?.Kontrol?.[selected.name as 'PT' | 'APTT' | 'INR'] || null;
    }

    if (selected.alat === 'CLEVER1' || selected.alat === 'CLEVER2') {
      const cleverLots = selected.alat === 'CLEVER1' ? config.CLEVER1 : config.CLEVER2;
      for (const [lotNum] of sortedLots) {
        const lot = cleverLots.find((l) => l.lot === lotNum);
        if (lot) return lot.Kontrol?.GDA || null;
      }
      return cleverLots[0]?.Kontrol?.GDA || null;
    }

    if (selected.alat === 'ONCALL1' || selected.alat === 'ONCALL2') {
      const onCallLots = selected.alat === 'ONCALL1' ? config.ONCALL1 : config.ONCALL2;
      const lvl = selected.levels.length === 1 ? selected.levels[0] : selectedLevel;
      for (const [lotNum] of sortedLots) {
        const lot = onCallLots.find((l) => l.lot === lotNum);
        if (lot && (lot as any)?.[lvl]?.GDA) return (lot as any)[lvl].GDA;
      }
      return (onCallLots[0] as any)?.[lvl]?.GDA || null;
    }

    // EASYLITE
    const lvl = selected.levels.length === 1 ? selected.levels[0] : selectedLevel;
    for (const [lotNum] of sortedLots) {
      const lot = getEasyliteLots(config, lvl).find((l) => l.lot === lotNum);
      if (lot) return lot.params?.[selected.name as 'Na' | 'K' | 'Cl'] || null;
    }
    return getEasyliteLots(config, lvl)[0]?.params?.[selected.name as 'Na' | 'K' | 'Cl'] || null;
  }, [config, selected, selectedLevel, filteredRecords]);

  const chartData = useMemo(() => {
    return filteredRecords.map((r, i) => ({
      run: i + 1,
      value: r.params[selected.name],
      status: r.status[selected.name] || 'ok',
      date: r.tanggal,
      analis: r.analis,
      catatan: r.catatan || '',
    }));
  }, [filteredRecords, selected]);

  const mean = lotConfig?.mean || 0;
  const sd = lotConfig?.sd || 1;

  const actualValues = chartData.map((d) => d.value!).filter((v) => v != null);
  const actualMean = actualValues.length ? actualValues.reduce((a, b) => a + b, 0) / actualValues.length : 0;
  const actualSD =
    actualValues.length > 1
      ? Math.sqrt(actualValues.reduce((sum, v) => sum + Math.pow(v - actualMean, 2), 0) / (actualValues.length - 1))
      : 0;
  const cv = actualMean !== 0 ? (actualSD / actualMean) * 100 : 0;
  const inControl = chartData.filter((d) => d.status === 'ok').length;
  const inControlPct = chartData.length ? (inControl / chartData.length) * 100 : 0;

  // ── Multi Mode ──────────────────────────────────────────────────────────────

  const multiModeRecords = useMemo(() => {
    if (!supportsMultiLevel) return [];
    return records.filter(
      (r) =>
        r.alat === selected.alat &&
        r.tanggal.startsWith(selectedMonth) &&
        r.params[selected.name] != null,
    );
  }, [records, selected, selectedMonth, supportsMultiLevel]);

  const multiLevels = selected.levels;

  const multiZScores = useMemo(() => {
    if (!supportsMultiLevel || multiModeRecords.length === 0) {
      const empty: Record<ControlLevel, ZScorePoint[]> = {};
      for (const lvl of multiLevels) empty[lvl] = [];
      return empty;
    }
    return computeZScores(multiModeRecords, config, selected.alat, selected.name, multiLevels);
  }, [supportsMultiLevel, multiModeRecords, config, selected]);

  const multiChartData = useMemo(() => {
    if (!supportsMultiLevel) return [];

    // Merge all levels into a single chart dataset by date
    const dateMap = new Map<string, Record<string, ZScorePoint | undefined>>();
    for (const lvl of multiLevels) {
      const points = multiZScores[lvl] || [];
      for (const p of points) {
        const entry = dateMap.get(p.tanggal) || {};
        entry[lvl] = p;
        dateMap.set(p.tanggal, entry);
      }
    }

    return Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, byLevel]) => {
        const row: any = { date };
        for (const lvl of multiLevels) {
          const pt = byLevel[lvl];
          const key = lvl.toLowerCase();
          row[key] = pt?.zScore ?? null;
          row[`${key}Status`] = pt?.status ?? 'ok';
          row[`${key}Raw`] = pt?.rawValue;
        }
        return row;
      });
  }, [supportsMultiLevel, multiZScores, multiLevels]);

  const multiAnalysis = useMemo((): MultiLevelAnalysis | null => {
    if (!supportsMultiLevel || multiChartData.length === 0) return null;
    return analyzeMultiLevel(multiZScores);
  }, [supportsMultiLevel, multiZScores, multiChartData.length]);

  function handleParamClick(idx: number, levels: ControlLevel[]) {
    setSelectedIdx(idx);
    setSelectedLevel(levels[0]);
    if (!['EASYLITE', 'ONCALL1', 'ONCALL2'].includes(ALL_PARAMS[idx].alat)) {
      setMode('single');
    }
  }

  const formatMonthLabel = useCallback(() => {
    const [y, m] = selectedMonth.split('-');
    const d = new Date(parseInt(y), parseInt(m) - 1, 1);
    return d.toLocaleDateString('id-ID', { year: 'numeric', month: 'long' });
  }, [selectedMonth]);

  const displayLevel = supportsMultiLevel
    ? selected.levels.join(', ')
    : (selected.levels.length === 1 ? selected.levels[0] : selectedLevel);

  // ── Download handlers ─────────────────────────────────────────────────────────

  /** Capture chart and open preview dialog */
  async function handleOpenPreview() {
    if (!chartContainerRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(chartContainerRef.current, { quality: 0.95, pixelRatio: 2, skipFonts: true });
      setPreviewImage(dataUrl);
      setPreviewOpen(true);
    } catch (err) {
      console.error('Failed to capture chart:', err);
    } finally {
      setDownloading(false);
    }
  }

  /** Download PNG directly */
  async function handleDownloadPNG() {
    if (!chartContainerRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(chartContainerRef.current, { quality: 0.95, pixelRatio: 2, skipFonts: true });
      const link = document.createElement('a');
      link.download = `LJ_${selected.alat}_${selected.name}_${selectedMonth}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to capture chart:', err);
    } finally {
      setDownloading(false);
    }
  }

  /** Open print window with clean layout */
  function handlePrint() {
    if (!previewImage) return;

    const [y, m] = selectedMonth.split('-');
    const monthLabel = new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('id-ID', { year: 'numeric', month: 'long' });

    const printWin = window.open('', '_blank', 'width=800,height=600');
    if (!printWin) return;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Grafik LJ - ${CHART_INSTRUMENT_LABELS[selected.alat]} - ${selected.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; color: #1a1a1a; padding: 24px 28px; }
    .header { text-align: center; border-bottom: 2px solid #1a1a1a; padding-bottom: 12px; margin-bottom: 16px; }
    .header h2 { font-size: 16px; letter-spacing: 1px; }
    .header p { font-size: 11px; color: #555; margin-top: 2px; }
    .title { text-align: center; margin-bottom: 14px; }
    .title h3 { font-size: 13px; text-transform: uppercase; letter-spacing: 1px; }
    .title .main { font-size: 15px; font-weight: 700; margin: 4px 0; }
    .title .sub { font-size: 10px; color: #666; }
    .chart { border: 1px solid #ddd; border-radius: 4px; overflow: hidden; margin-bottom: 20px; }
    .chart img { width: 100%; display: block; }
    .signatures { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 16px; border-top: 1px solid #ccc; }
    .sig { text-align: center; flex: 1; }
    .sig .label { font-size: 11px; font-weight: 600; margin-bottom: 48px; }
    .sig .line { font-size: 10px; color: #999; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h2>RS PETROKIMIA GRESIK</h2>
    <p>Instalasi Laboratorium Klinik</p>
  </div>
  <div class="title">
    <h3>Grafik Levey-Jennings</h3>
    <p class="main">${CHART_INSTRUMENT_LABELS[selected.alat]} — ${selected.name}</p>
    <p class="sub">Level: ${displayLevel} &mdash; ${monthLabel}</p>
  </div>
  <div class="chart">
    <img src="${previewImage}" alt="LJ Chart" />
  </div>
  <div class="signatures">
    <div class="sig">
      <p class="label">PIC Alat</p>
      <p class="line">(.....................................)</p>
    </div>
    <div class="sig">
      <p class="label">Ka. Instalasi Lab</p>
      <p class="line">(.....................................)</p>
    </div>
  </div>
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

    printWin.document.write(html);
    printWin.document.close();
  }

  /** Download PDF from preview */
  async function handleDownloadPDF() {
    if (!previewRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(previewRef.current, { quality: 0.95, pixelRatio: 2, skipFonts: true });

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const imgWidth = pageWidth - margin * 2;

      const img = document.createElement('img');
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.src = dataUrl;
      });
      const imgHeight = Math.min((img.height / img.width) * imgWidth, pageHeight - margin * 2);

      pdf.addImage(dataUrl, 'PNG', margin, margin, imgWidth, imgHeight);
      pdf.save(`LJ_${selected.alat}_${selected.name}_${selectedMonth}.pdf`);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Grafik Levey-Jennings</h1>
          <p className="text-sm text-muted-foreground">Kontrol kualitas berdasarkan parameter</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Month selector */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-40 h-9 text-sm rounded-md border border-input bg-background px-2.5 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {monthOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {/* Download button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5" disabled={downloading}>
                {downloading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Download size={14} />
                )}
                Download
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleOpenPreview}>
                <FileText size={14} className="mr-2" />
                Preview &amp; Cetak
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownloadPNG}>
                <ImageIcon size={14} className="mr-2" />
                Download PNG
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Parameter tabs — grouped by instrument */}
      <Card className="p-3 space-y-2.5">
        {(['CA660', 'EASYLITE', 'ONCALL1', 'ONCALL2', 'CLEVER1', 'CLEVER2'] as InstrumentType[]).map((alat) => {
          const params = ALL_PARAMS.map((p, i) => ({ ...p, i })).filter((p) => p.alat === alat);
          return (
            <div key={alat} className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-muted-foreground w-24 shrink-0 truncate">
                {CHART_INSTRUMENT_LABELS[alat]}
              </span>
              <div className="flex gap-1.5 flex-wrap">
                {params.map((p) => (
                  <button
                    key={p.i}
                    onClick={() => handleParamClick(p.i, p.levels)}
                    className={cn(
                      'px-3 py-1 rounded-md text-xs font-medium transition-all',
                      selectedIdx === p.i
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80',
                    )}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </Card>

      {/* Mode toggle (multi-level instruments) */}
      {isMultiLevelInstrument && (
        <div className="flex items-center gap-3">
          <Label className="text-xs text-muted-foreground">Mode:</Label>
          <div className="flex rounded-md border border-input bg-muted p-0.5">
            <button
              onClick={() => setMode('single')}
              className={cn(
                'px-3 py-1 rounded-sm text-xs font-medium transition-all',
                mode === 'single'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Single
            </button>
            <button
              onClick={() => setMode('multi')}
              className={cn(
                'px-3 py-1 rounded-sm text-xs font-medium transition-all',
                mode === 'multi'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Multi
            </button>
          </div>
        </div>
      )}

      {/* Level selector — only in Single mode with multiple levels */}
      {!supportsMultiLevel && levelOptions.length > 1 && (
        <div className="flex gap-2">
          {levelOptions.map((lvl) => (
            <button
              key={lvl}
              onClick={() => setSelectedLevel(lvl)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                selectedLevel === lvl
                  ? 'bg-foreground text-background shadow-sm'
                  : 'bg-muted text-muted-foreground hover:text-foreground',
              )}
            >
              {lvl}
            </button>
          ))}
        </div>
      )}

      {/* Chart title */}
      <div className="text-center space-y-1">
        <h2 className="text-base font-bold">
          Grafik Levey-Jennings — {CHART_INSTRUMENT_LABELS[selected.alat]} — {selected.name}
        </h2>
        <p className="text-xs text-muted-foreground">
          Level: {displayLevel} &mdash; {formatMonthLabel()}
        </p>
      </div>

      {/* ── Single Mode Chart ─────────────────────────────────────────────────── */}
      {!supportsMultiLevel && (
        <>
          <Card className="p-4" ref={chartContainerRef}>
            {chartData.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-muted-foreground gap-2">
                <p className="text-sm font-medium">Belum ada data untuk bulan ini</p>
                <p className="text-xs">Pilih bulan lain atau input data QC terlebih dahulu</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                  <ReferenceArea y1={mean - 3 * sd} y2={mean - 2 * sd} fill="hsl(0,72%,51%)" fillOpacity={0.06} />
                  <ReferenceArea y1={mean + 2 * sd} y2={mean + 3 * sd} fill="hsl(0,72%,51%)" fillOpacity={0.06} />
                  <ReferenceArea y1={mean - 2 * sd} y2={mean - sd} fill="hsl(38,92%,44%)" fillOpacity={0.06} />
                  <ReferenceArea y1={mean + sd} y2={mean + 2 * sd} fill="hsl(38,92%,44%)" fillOpacity={0.06} />
                  <ReferenceArea y1={mean - sd} y2={mean + sd} fill="hsl(160,94%,31%)" fillOpacity={0.06} />
                  <ReferenceLine y={mean} stroke="hsl(var(--foreground))" strokeDasharray="5 3" strokeOpacity={0.5} label={{ value: 'Mean', position: 'left', fontSize: 10 }} />
                  <ReferenceLine y={mean + sd} stroke="hsl(160,94%,31%)" strokeDasharray="3 3" strokeOpacity={0.6} label={{ value: '+1SD', position: 'left', fontSize: 9 }} />
                  <ReferenceLine y={mean - sd} stroke="hsl(160,94%,31%)" strokeDasharray="3 3" strokeOpacity={0.6} label={{ value: '-1SD', position: 'left', fontSize: 9 }} />
                  <ReferenceLine y={mean + 2 * sd} stroke="hsl(38,92%,44%)" strokeDasharray="3 3" strokeOpacity={0.6} label={{ value: '+2SD', position: 'left', fontSize: 9 }} />
                  <ReferenceLine y={mean - 2 * sd} stroke="hsl(38,92%,44%)" strokeDasharray="3 3" strokeOpacity={0.6} label={{ value: '-2SD', position: 'left', fontSize: 9 }} />
                  <ReferenceLine y={mean + 3 * sd} stroke="hsl(0,72%,51%)" strokeDasharray="3 3" strokeOpacity={0.6} label={{ value: '+3SD', position: 'left', fontSize: 9 }} />
                  <ReferenceLine y={mean - 3 * sd} stroke="hsl(0,72%,51%)" strokeDasharray="3 3" strokeOpacity={0.6} label={{ value: '-3SD', position: 'left', fontSize: 9 }} />
                  <XAxis dataKey="run" fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} domain={[mean - 4 * sd, mean + 4 * sd]} />
                  <Tooltip
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 8,
                      border: '1px solid hsl(var(--border))',
                      backgroundColor: 'hsl(var(--card))',
                      color: 'hsl(var(--foreground))',
                      maxWidth: 280,
                      padding: 0,
                    }}
                    content={({ payload }) => {
                      if (!payload || payload.length === 0) return null;
                      const item = payload[0].payload;
                      const isOoc = item.status === 'oos';
                      const isWarning = item.status === 'warning';
                      return (
                        <div className="p-2.5 space-y-1 text-xs">
                          <p className="font-semibold">
                            Run #{item.run} — {item.date}
                          </p>
                          <p className="text-muted-foreground">Analis: {item.analis}</p>
                          <p className={cn(
                            'font-mono-data font-bold text-sm',
                            isOoc ? 'text-destructive' : isWarning ? 'text-warning' : '',
                          )}>
                            {selected.name}: {item.value}
                          </p>
                          {item.catatan && item.catatan.trim() !== '' && (
                            <div className="pt-1.5 mt-1 border-t border-border/50">
                              <p className="text-[10px] text-muted-foreground font-semibold mb-0.5 uppercase tracking-wide">
                                Tindakan Korektif
                              </p>
                              <p className="text-[11px] leading-relaxed whitespace-pre-wrap">
                                {item.catatan}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    }}
                  />
                  <Line
                    type="linear"
                    dataKey="value"
                    stroke="hsl(220,79%,48%)"
                    strokeWidth={2}
                    dot={<CustomDot />}
                    activeDot={{ r: 6, fill: 'hsl(220,79%,48%)' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Mean Aktual', value: actualMean.toFixed(2), color: '' },
              { label: 'SD', value: actualSD.toFixed(2), color: '' },
              { label: 'CV%', value: `${cv.toFixed(1)}%`, color: '' },
              { label: 'In-Control', value: `${inControlPct.toFixed(0)}%`, color: 'text-success' },
            ].map((stat) => (
              <Card key={stat.label} className="p-3 text-center">
                <p className="text-[10px] text-muted-foreground font-medium">{stat.label}</p>
                <p className={cn('text-lg font-mono-data font-bold mt-0.5', stat.color)}>{stat.value}</p>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* ── Multi Mode Chart ──────────────────────────────────────────────────── */}
      {supportsMultiLevel && (
        <>
          {/* Legend */}
          <div className="flex items-center gap-4">
            {multiLevels.map((lvl) => (
              <span key={lvl} className="flex items-center gap-1.5 text-xs">
                <span
                  className="w-3 h-0.5 rounded-full"
                  style={{ backgroundColor: MULTI_LEVEL_COLORS[lvl] || 'hsl(var(--foreground))' }}
                />
                {lvl}
              </span>
            ))}
          </div>

          <Card className="p-4" ref={chartContainerRef}>
            {multiChartData.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-muted-foreground gap-2">
                <p className="text-sm font-medium">Belum ada data untuk bulan ini</p>
                <p className="text-xs">Pilih bulan lain atau input data QC terlebih dahulu</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={multiChartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                  {/* SD bands for Z-score */}
                  <ReferenceArea y1={2} y2={3} fill="hsl(0,72%,51%)" fillOpacity={0.06} />
                  <ReferenceArea y1={-3} y2={-2} fill="hsl(0,72%,51%)" fillOpacity={0.06} />
                  <ReferenceArea y1={1} y2={2} fill="hsl(38,92%,44%)" fillOpacity={0.06} />
                  <ReferenceArea y1={-2} y2={-1} fill="hsl(38,92%,44%)" fillOpacity={0.06} />
                  <ReferenceArea y1={-1} y2={1} fill="hsl(160,94%,31%)" fillOpacity={0.06} />
                  <ReferenceLine y={0} stroke="hsl(var(--foreground))" strokeDasharray="5 3" strokeOpacity={0.5} />
                  <ReferenceLine y={1} stroke="hsl(160,94%,31%)" strokeDasharray="3 3" strokeOpacity={0.5} />
                  <ReferenceLine y={-1} stroke="hsl(160,94%,31%)" strokeDasharray="3 3" strokeOpacity={0.5} />
                  <ReferenceLine y={2} stroke="hsl(38,92%,44%)" strokeDasharray="3 3" strokeOpacity={0.5} />
                  <ReferenceLine y={-2} stroke="hsl(38,92%,44%)" strokeDasharray="3 3" strokeOpacity={0.5} />
                  <ReferenceLine y={3} stroke="hsl(0,72%,51%)" strokeDasharray="3 3" strokeOpacity={0.5} />
                  <ReferenceLine y={-3} stroke="hsl(0,72%,51%)" strokeDasharray="3 3" strokeOpacity={0.5} />
                  <XAxis dataKey="date" fontSize={9} tick={{ fill: 'hsl(var(--muted-foreground))' }} interval="preserveStartEnd" />
                  <YAxis
                    fontSize={10}
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    domain={[-4, 4]}
                    ticks={[-3, -2, -1, 0, 1, 2, 3]}
                    tickFormatter={(v: number) => `${v}`}
                  />
                  <Tooltip
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 8,
                      border: '1px solid hsl(var(--border))',
                      backgroundColor: 'hsl(var(--card))',
                      color: 'hsl(var(--foreground))',
                      maxWidth: 260,
                      padding: 0,
                    }}
                    content={({ payload }) => {
                      if (!payload || payload.length === 0) return null;
                      const item = payload[0].payload;
                      return (
                        <div className="p-2.5 space-y-1 text-xs">
                          <p className="font-semibold">{item.date}</p>
                          {multiLevels.map((lvl) => {
                            const key = lvl.toLowerCase();
                            const zVal = item[key];
                            const status = item[`${key}Status`];
                            const raw = item[`${key}Raw`];
                            if (zVal === null || zVal === undefined) return null;
                            const color = MULTI_LEVEL_COLORS[lvl] || 'hsl(var(--foreground))';
                            return (
                              <div key={lvl} className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                                <span className="text-muted-foreground">{lvl}</span>
                                <span className={cn('font-mono-data font-bold', status === 'oos' ? 'text-destructive' : status === 'warning' ? 'text-warning' : '')}>
                                  Z={zVal} ({selected.name}: {raw})
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    }}
                  />
                  {multiLevels.map((lvl) => {
                    const color = MULTI_LEVEL_COLORS[lvl] || 'hsl(var(--foreground))';
                    return (
                      <Line
                        key={lvl}
                        type="linear"
                        dataKey={lvl.toLowerCase()}
                        stroke={color}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 5, fill: color }}
                        connectNulls
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Multi-level stats */}
          {multiChartData.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {multiLevels.flatMap((lvl) => {
                const points = multiZScores[lvl] || [];
                const zAvg = points.length
                  ? (points.reduce((s, p) => s + p.zScore, 0) / points.length).toFixed(2)
                  : '-';
                const okCount = points.filter((p) => p.status === 'ok').length;
                return [
                  {
                    label: `${lvl} Z-avg`,
                    value: zAvg,
                    color: '',
                  },
                  {
                    label: `${lvl} OK`,
                    value: `${okCount}/${points.length}`,
                    color: 'text-success',
                  },
                ];
              }).map((stat) => (
                <Card key={stat.label} className="p-3 text-center">
                  <p className="text-[10px] text-muted-foreground font-medium">{stat.label}</p>
                  <p className={cn('text-lg font-mono-data font-bold mt-0.5', stat.color)}>{stat.value}</p>
                </Card>
              ))}
            </div>
          )}

          {/* Westgard Analysis Card */}
          {multiAnalysis && multiChartData.length > 0 && (
            <WestgardAnalysisCard analysis={multiAnalysis} />
          )}
        </>
      )}

      {/* ── Preview Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-[720px] w-[95vw] max-h-[90vh] overflow-auto p-0" aria-describedby="lj-preview-description">
          <DialogTitle className="sr-only">Preview Grafik Levey-Jennings</DialogTitle>
          <p id="lj-preview-description" className="sr-only">
            Preview grafik QC {CHART_INSTRUMENT_LABELS[selected.alat]} — {selected.name} untuk periode {formatMonthLabel()}
          </p>
          <div ref={previewRef}>
            {/* Header */}
            <div className="text-center py-6 px-4 border-b bg-navy text-navy-foreground rounded-t-lg">
              <h2 className="text-base font-bold tracking-wide">RS PETROKIMIA GRESIK</h2>
              <p className="text-xs mt-1 opacity-80">Instalasi Laboratorium Klinik</p>
            </div>

            <div className="p-6 space-y-5">
              {/* Title block */}
              <div className="text-center space-y-1">
                <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Grafik Levey-Jennings</h3>
                <p className="text-base font-semibold">
                  {CHART_INSTRUMENT_LABELS[selected.alat]} — {selected.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  Level: {displayLevel} &mdash; {formatMonthLabel()}
                </p>
              </div>

              {/* Chart image */}
              {previewImage && (
                <div className="border rounded-lg overflow-hidden bg-white">
                  <img src={previewImage} alt="LJ Chart" className="w-full" />
                </div>
              )}

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-8 mt-4 border-t">
                <div className="text-center space-y-12">
                  <p className="text-xs font-semibold">PIC Alat</p>
                  <div>
                    <p className="text-xs text-muted-foreground">(.....................................)</p>
                  </div>
                </div>
                <div className="text-center space-y-12">
                  <p className="text-xs font-semibold">Ka. Instalasi Lab</p>
                  <div>
                    <p className="text-xs text-muted-foreground">(.....................................)</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t bg-muted/30 rounded-b-lg">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <FileText size={14} className="mr-1.5" />
              Cetak
            </Button>
            <Button size="sm" onClick={handleDownloadPDF} disabled={downloading}>
              {downloading ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Download size={14} className="mr-1.5" />}
              Download PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
