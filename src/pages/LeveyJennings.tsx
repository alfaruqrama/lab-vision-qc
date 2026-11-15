
import React, { useState, useMemo, useRef, useEffect, Suspense } from 'react';
import { lazy } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Filter, 
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

import { useQCRecords } from '@/features/qc/hooks/useQCRecords';
import { useQCConfig } from '@/features/qc/hooks/useQCConfig';
import { computeZScores, getParamTarget } from '@/lib/zscore';
import { analyzeMultiLevel } from '@/lib/westgard-multi';
import type { ParamName, InstrumentType, ControlLevel } from '@/lib/types';
import { getParamsForInstrument, PARAM_UNITS, INSTRUMENTS } from '@/lib/types';

/**
 * Control level(s) each instrument actually records.
 *
 * CA-660 and CLEVER store a single flat run under the level `Kontrol`; ONCALL
 * stores three separate controls; EASYLITE stores its two pack levels. Using
 * CTRL0/1/2 for CA-660 (as this page used to) matches no record at all and the
 * chart comes out empty.
 */
function getLevelsForInstrument(alat: InstrumentType): ControlLevel[] {
  if (alat === 'EASYLITE') return ['NORMAL', 'HIGH'];
  if (alat === 'ONCALL1' || alat === 'ONCALL2') return ['CTRL0', 'CTRL1', 'CTRL2'];
  return ['Kontrol'];
}

const PARAM_LABELS: Record<ParamName, string> = {
  PT: 'PT',
  APTT: 'APTT',
  INR: 'INR',
  Na: 'Sodium (Na)',
  K: 'Potassium (K)',
  Cl: 'Chloride (Cl)',
  GDA: 'Glukosa (GDA)',
};

// Modular Components
import { LJSummary } from '@/features/qc/components/lj/LJSummary';
import { LJAnalysis } from '@/features/qc/components/lj/LJAnalysis';
import { WestgardEvaluationPanel } from '@/features/qc/components/WestgardEvaluationPanel';
import { LJExportControls } from '@/features/qc/components/lj/LJExport';

// Lazy load the heaviest component
const LJChart = lazy(() => import('@/features/qc/components/lj/LJChart').then(mod => ({ default: mod.LJChart })));

export default function LeveyJennings() {
  const { data: records = [], isLoading: recordsLoading } = useQCRecords();
  const { data: config, isLoading: configLoading } = useQCConfig();

  // State
  const [selectedAlat, setSelectedAlat] = useState<InstrumentType>('CA660');
  const [selectedParam, setSelectedParam] = useState<ParamName>(getParamsForInstrument('CA660')[0]);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [mode, setMode] = useState<'single' | 'multi'>('single');
  
  // Export state
  const chartRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Parameters offered by the selected instrument. Switching instrument must
  // move the selection along, otherwise CA-660's PT stays picked while ONCALL
  // is shown — a combination that has no data and no config.
  const availableParams = useMemo(() => getParamsForInstrument(selectedAlat), [selectedAlat]);

  useEffect(() => {
    if (!availableParams.includes(selectedParam)) {
      setSelectedParam(availableParams[0]);
    }
  }, [availableParams, selectedParam]);

  const levels = useMemo(() => getLevelsForInstrument(selectedAlat), [selectedAlat]);

  const [selectedLevel, setSelectedLevel] = useState<ControlLevel>(getLevelsForInstrument('CA660')[0]);

  useEffect(() => {
    if (!levels.includes(selectedLevel)) {
      setSelectedLevel(levels[0]);
    }
  }, [levels, selectedLevel]);

  // Derived Data
  const filteredRecords = useMemo(() => {
    return records.filter(r => r.alat === selectedAlat && r.tanggal.startsWith(selectedMonth));
  }, [records, selectedAlat, selectedMonth]);

  const { chartData, stats, multiLevels } = useMemo(() => {
    if (!config || filteredRecords.length === 0) return { chartData: [], stats: null, multiLevels: [] };

    const zScoresRecord = computeZScores(filteredRecords, config, selectedAlat, selectedParam, levels);

    if (mode === 'single') {
      // Single mode plots one level. Use the level the user picked; fall back to
      // the instrument's first level when the pick belongs to another instrument.
      const level = levels.includes(selectedLevel) ? selectedLevel : levels[0];
      const points = zScoresRecord[level] || [];

      const data = points.map((p, idx) => {
        const rec = filteredRecords.find(r => r.tanggal === p.tanggal && r.level === level);
        return {
          run: idx + 1,
          date: p.tanggal,
          value: p.zScore,
          rawValue: p.rawValue,
          level,
          status: p.status,
          analis: rec?.analis || '',
          catatan: rec?.catatan || '',
        };
      });

      const inControl = data.filter(d => d.status !== 'oos').length;

      const raws = data.map(d => d.rawValue).filter((v): v is number => typeof v === 'number');
      const meanActual = raws.length > 0 ? raws.reduce((a, b) => a + b, 0) / raws.length : undefined;
      // SD/CV of the observed values — the "Sum" column in analyser software,
      // shown next to the "Set" (target) column so drift is visible at a glance.
      const sdActual = raws.length > 1 && meanActual !== undefined
        ? Math.sqrt(raws.reduce((a, b) => a + Math.pow(b - meanActual, 2), 0) / (raws.length - 1))
        : undefined;
      const last = data[data.length - 1];

      // Mean/SD shown in the resume panel are the control targets actually used
      // for this level, not the spread of the plotted Z-scores (which is ~0/1
      // by construction and would tell the operator nothing).
      const cfg = getParamTarget(config, selectedAlat, level, selectedParam);

      return {
        chartData: data,
        stats: {
          total: data.length,
          inControl,
          outOfControl: data.length - inControl,
          inControlPct: data.length > 0 ? (inControl / data.length) * 100 : 0,
          meanTarget: cfg?.mean,
          meanActual,
          sdTarget: cfg?.sd,
          sdActual,
          cvTarget: cfg && cfg.mean ? (cfg.sd / cfg.mean) * 100 : undefined,
          cvActual: meanActual && sdActual !== undefined ? (sdActual / meanActual) * 100 : undefined,
          sumN: raws.length,
          lastValue: typeof last?.rawValue === 'number' ? last.rawValue : undefined,
          lastDate: last?.date,
          lastStatus: last?.status,
          levelLabel: level,
        },
        multiLevels: [],
      };
    }

    // Multi mode: one x point per (date, level) run, so two controls on the same
    // day each keep their own point instead of overwriting each other.
    const rows: any[] = [];
    const indexByKey = new Map<string, number>();
    for (const lvl of levels) {
      for (const p of zScoresRecord[lvl] || []) {
        const key = `${p.tanggal}|${lvl}`;
        let idx = indexByKey.get(key);
        if (idx === undefined) {
          idx = rows.length;
          indexByKey.set(key, idx);
          rows.push({ date: p.tanggal, _levels: {} });
        }
        const k = lvl.toLowerCase();
        rows[idx][k] = p.zScore;
        rows[idx][`${k}Status`] = p.status;
        rows[idx][`${k}Raw`] = p.rawValue;
        rows[idx]._levels[lvl] = true;
      }
    }
    rows.sort((a, b) => a.date.localeCompare(b.date));

    return { chartData: rows, stats: null, multiLevels: levels };
  }, [filteredRecords, config, selectedAlat, selectedParam, mode, levels, selectedLevel]);

  const analysis = useMemo(() => {
    if (!config || filteredRecords.length === 0) return null;
    const zScoresRecord = computeZScores(filteredRecords, config, selectedAlat, selectedParam, levels);
    return analyzeMultiLevel(zScoresRecord);
  }, [filteredRecords, config, selectedAlat, selectedParam, levels]);

  if (recordsLoading || configLoading) {
    return <div className="p-8 flex items-center justify-center h-full"><Loader2 className="animate-spin text-primary" /> Loading...</div>;
  }

  return (
    <div className="p-4 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Levey-Jennings</h1>
          <p className="text-muted-foreground text-sm">Monitoring Quality Control Laboratorium</p>
        </div>
        
        <div className="flex items-center gap-2">
          <LJExportControls 
            chartRef={chartRef} 
            previewRef={previewRef} 
            previewImage={previewImage}
            downloading={downloading}
            setDownloading={setDownloading}
            setPreviewImage={setPreviewImage}
            setPreviewOpen={setPreviewOpen}
            selected={{ alat: selectedAlat, name: selectedParam, month: selectedMonth }}
            user={{ nama: 'Admin' }}
            controlSummary={stats}
            displayLevel={mode === 'single' ? 'Default' : 'Multi'}
            formatMonthLabel={() => format(new Date(selectedMonth + '-01'), 'MMMM yyyy')}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="p-4 space-y-4 h-fit">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Instrumen</label>
              <select 
                className="w-full p-2 rounded-md border bg-background text-sm"
                value={selectedAlat}
                onChange={(e) => setSelectedAlat(e.target.value as InstrumentType)}
              >
                {INSTRUMENTS.map((i) => (
                  <option key={i.value} value={i.value}>{i.label}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Parameter</label>
              <select
                className="w-full p-2 rounded-md border bg-background text-sm"
                value={selectedParam}
                onChange={(e) => setSelectedParam(e.target.value as ParamName)}
              >
                {availableParams.map((p) => (
                  <option key={p} value={p}>{PARAM_LABELS[p]}</option>
                ))}
              </select>
            </div>

            {mode === 'single' && levels.length > 1 && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Level Kontrol</label>
                <select
                  className="w-full p-2 rounded-md border bg-background text-sm"
                  value={selectedLevel}
                  onChange={(e) => setSelectedLevel(e.target.value as ControlLevel)}
                >
                  {levels.map((lvl) => (
                    <option key={lvl} value={lvl}>{lvl}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Bulan</label>
              <div className="flex items-center gap-2">
                <input 
                  type="month" 
                  className="w-full p-2 rounded-md border bg-background text-sm"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                />
              </div>
            </div>

            <div className="pt-4 border-t">
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-2 block">Mode Visualisasi</label>
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant={mode === 'single' ? 'default' : 'outline'} 
                  size="sm" 
                  onClick={() => setMode('single')}
                >
                  Single
                </Button>
                <Button 
                  variant={mode === 'multi' ? 'default' : 'outline'} 
                  size="sm" 
                  onClick={() => setMode('multi')}
                >
                  Multi
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <div className="lg:col-span-3 space-y-6">
          <div ref={chartRef} className="bg-card p-6 rounded-xl border shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold flex items-center gap-2">
                <Filter size={16} className="text-muted-foreground" />
                Grafik Kontrol {selectedParam}
              </h3>
              {mode === 'single' && stats && (
                <LJSummary
                  total={stats.total}
                  inControl={stats.inControl}
                  outOfControl={stats.outOfControl}
                  inControlPct={stats.inControlPct}
                  levelLabel={stats.levelLabel}
                />
              )}
            </div>
            
            {mode === 'single' && stats && (
              <div className="mb-4 rounded-lg border bg-muted/30 p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <p className="text-xs font-semibold">
                    {selectedParam} · {stats.levelLabel} · titik terakhir {stats.lastDate ?? '-'}
                  </p>
                  {stats.lastValue !== undefined && (
                    <p className={cn(
                      'font-mono-data text-lg font-bold',
                      stats.lastStatus === 'oos' ? 'text-destructive' : stats.lastStatus === 'warning' ? 'text-warning' : '',
                    )}>
                      {stats.lastValue} {PARAM_UNITS[selectedParam]}
                    </p>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
                  <div>
                    <p className="text-muted-foreground">Set Mean</p>
                    <p className="font-mono-data font-semibold">{stats.meanTarget?.toFixed(2) ?? '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Mean Terukur</p>
                    <p className="font-mono-data font-semibold">{stats.meanActual?.toFixed(2) ?? '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Set SD / CV%</p>
                    <p className="font-mono-data font-semibold">
                      {stats.sdTarget?.toFixed(3) ?? '-'} / {stats.cvTarget?.toFixed(2) ?? '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">SD / CV% Terukur</p>
                    <p className="font-mono-data font-semibold">
                      {stats.sdActual?.toFixed(3) ?? '-'} / {stats.cvActual?.toFixed(2) ?? '-'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <Suspense fallback={<div className="h-[300px] flex items-center justify-center">Loading Chart...</div>}>
              <LJChart 
                mode={mode} 
                data={chartData} 
                selected={{
                  alat: selectedAlat,
                  name: selectedParam,
                  levels: [levels.includes(selectedLevel) ? selectedLevel : levels[0]],
                }}
                config={config}
                multiLevels={multiLevels}
                unit={availableParams.includes(selectedParam) ? PARAM_UNITS[selectedParam] : undefined}
              />
            </Suspense>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-cols-2 gap-6">
            {analysis && <LJAnalysis analysis={analysis} />}
            <Card className="p-4 flex flex-col justify-center items-center text-center space-y-2 opacity-60">
              <AlertCircle size={24} className="text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                Informasi tambahan dan catatan teknis akan muncul di sini.
              </p>
            </Card>
          </div>
        </div>
      </div>

      {previewOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-full overflow-auto p-4 relative">
            <Button 
              variant="ghost" 
              className="absolute top-2 right-2" 
              onClick={() => setPreviewOpen(false)}
            >
              ✕
            </Button>
            <div ref={previewRef} className="p-4 bg-white">
              <img src={previewImage || ''} className="w-full h-auto" alt="Preview" />
            </div>
            <div className="flex justify-center mt-4 gap-2">
              <Button onClick={() => window.print()}>Cetak Sekarang</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Loader2({ className }: { className?: string }) {
  return <svg className={cn('w-4 h-4', className)} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.001 0 01-15.357-2m15.357 2H15" />
  </svg>
}
