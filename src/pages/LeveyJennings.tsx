
import React, { useState, useMemo, useRef, Suspense } from 'react';
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
import { computeZScores } from '@/lib/zscore';
import { analyzeMultiLevel } from '@/lib/westgard-multi';
import type { ParamName, InstrumentType, ControlLevel } from '@/lib/types';

// Modular Components
import { LJSummary } from '@/features/qc/components/lj/LJSummary';
import { LJAnalysis } from '@/features/qc/components/lj/LJAnalysis';
import { WestgardEvaluationPanel } from '@/features/qc/components/WestgardEvaluationPanel';
import { LJExportControls } from '@/features/qc/components/lj/LJExport';

// Lazy load the heaviest component
const LJChart = lazy(() => import('@/features/qc/components/lj/LJChart').then(mod => ({ default: mod.LJChart })));

export default function LeveyJennings() {
  const { records, loading: recordsLoading } = useQCRecords();
  const { config, loading: configLoading } = useQCConfig();

  // State
  const [selectedAlat, setSelectedAlat] = useState<InstrumentType>('CA660');
  const [selectedParam, setSelectedParam] = useState<ParamName>('PT');
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [mode, setMode] = useState<'single' | 'multi'>('single');
  
  // Export state
  const chartRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Derived Data
  const filteredRecords = useMemo(() => {
    return records.filter(r => r.alat === selectedAlat && r.tanggal.startsWith(selectedMonth));
  }, [records, selectedAlat, selectedMonth]);

  const { chartData, stats, multiLevels } = useMemo(() => {
    if (!config || filteredRecords.length === 0) return { chartData: [], stats: null, multiLevels: [] };
    
    // FIX: Correct arguments for computeZScores (records, config, alat, param, levels)
    const levels: ControlLevel[] = selectedAlat === 'EASYLITE' ? ['NORMAL', 'HIGH'] : ['CTRL0', 'CTRL1', 'CTRL2'];
    const zScoresRecord = computeZScores(filteredRecords, config, selectedAlat, selectedParam, levels);
    
    if (mode === 'single') {
      const primaryLevel = levels[0];
      const points = zScoresRecord[primaryLevel] || [];
      
      const data = points.map((p, idx) => ({
        run: idx + 1,
        date: p.tanggal,
        value: p.zScore,
        status: p.status,
        analis: filteredRecords.find(r => r.tanggal === p.tanggal)?.analis || '',
        catatan: filteredRecords.find(r => r.tanggal === p.tanggal)?.catatan || '',
      }));
      
      const vals = data.map(d => d.value);
      const mean = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      const sd = vals.length > 0 
        ? Math.sqrt(vals.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / vals.length) 
        : 1;
      
      const inControl = data.filter((d: any) => d.overall_status !== 'oos').length;
      
      return { 
        chartData: data, 
        stats: { total: data.length, inControl, outOfControl: data.length - inControl, inControlPct: data.length > 0 ? (inControl/data.length)*100 : 0 },
        multiLevels: []
      };
    } else {
      const data = filteredRecords.map(r => {
        const obj: any = { date: r.tanggal };
        levels.forEach(lvl => {
          const points = zScoresRecord[lvl];
          const p = points?.find(pt => pt.tanggal === r.tanggal);
          if (p) {
            obj[lvl.toLowerCase()] = p.zScore;
            obj[`${lvl.toLowerCase()}Status`] = p.status;
            obj[`${lvl.toLowerCase()}Raw`] = r.params[selectedParam] || 0;
          }
        });
        return obj;
      });
      
      return { 
        chartData: data, 
        stats: null, 
        multiLevels: levels 
      };
    }
  }, [filteredRecords, config, selectedAlat, selectedParam, mode]);

  const analysis = useMemo(() => {
    if (!config || filteredRecords.length === 0) return null;
    const levels: ControlLevel[] = selectedAlat === 'EASYLITE' ? ['NORMAL', 'HIGH'] : ['CTRL0', 'CTRL1', 'CTRL2'];
    const zScoresRecord = computeZScores(filteredRecords, config, selectedAlat, selectedParam, levels);
    return analyzeMultiLevel(zScoresRecord);
  }, [filteredRecords, config, selectedAlat, selectedParam]);

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
                <option value="CA660">CA660</option>
                <option value="EASYLITE">EASYLITE</option>
                <option value="ONCALL1">ONCALL 1</option>
                <option value="ONCALL2">ONCALL 2</option>
              </select>
            </div>
            
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 block">Parameter</label>
              <select 
                className="w-full p-2 rounded-md border bg-background text-sm"
                value={selectedParam}
                onChange={(e) => setSelectedParam(e.target.value as ParamName)}
              >
                <option value="PT">PT</option>
                <option value="APTT">APTT</option>
                <option value="INR">INR</option>
                <option value="Na">Sodium</option>
                <option value="K">Potassium</option>
                <option value="Cl">Chloride</option>
              </select>
            </div>

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
                />
              )}
            </div>
            
            <Suspense fallback={<div className="h-[300px] flex items-center justify-center">Loading Chart...</div>}>
              <LJChart 
                mode={mode} 
                data={chartData} 
                selected={{ alat: selectedAlat, name: selectedParam, levels: [] }} 
                config={config} 
                multiLevels={multiLevels}
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
