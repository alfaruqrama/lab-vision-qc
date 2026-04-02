import { useState, useMemo } from 'react';
import { useQCStore } from '@/hooks/use-qc-store';
import type { ParamName, InstrumentType, ControlLevel } from '@/lib/types';
import { PARAM_UNITS } from '@/lib/types';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  ReferenceArea, ReferenceLine, Tooltip, Dot
} from 'recharts';

// ── Parameter per instrumen ──────────────────────────────
const INSTRUMENTS: { alat: InstrumentType; label: string; params: { name: ParamName; levels: ControlLevel[] }[] }[] = [
  {
    alat: 'CA660', label: 'CA660',
    params: [
      { name: 'PT',   levels: ['Kontrol'] },
      { name: 'APTT', levels: ['Kontrol'] },
      { name: 'INR',  levels: ['Kontrol'] },
    ],
  },
  {
    alat: 'EASYLITE', label: 'EASYLITE',
    params: [
      { name: 'Na', levels: ['NORMAL', 'HIGH'] },
      { name: 'K',  levels: ['NORMAL', 'HIGH'] },
      { name: 'Cl', levels: ['NORMAL', 'HIGH'] },
    ],
  },
];

const BULAN = [
  'Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember',
];

function CustomDot(props: any) {
  const { cx, cy, payload } = props;
  if (!cx || !cy) return null;
  const st = payload.status;
  const color = st === 'oos' ? 'hsl(0,72%,51%)' : st === 'warning' ? 'hsl(38,92%,44%)' : 'hsl(220,79%,48%)';
  if (st === 'oos') {
    return (
      <g>
        <line x1={cx - 5} y1={cy - 5} x2={cx + 5} y2={cy + 5} stroke={color} strokeWidth={2} />
        <line x1={cx + 5} y1={cy - 5} x2={cx - 5} y2={cy + 5} stroke={color} strokeWidth={2} />
      </g>
    );
  }
  return <Dot cx={cx} cy={cy} r={4} fill={color} stroke="none" />;
}

export default function LeveyJennings() {
  const { records, config } = useQCStore();

  // ── State ─────────────────────────────────────────────
  const now = new Date();
  const [selMonth, setSelMonth] = useState(now.getMonth()); // 0-based
  const [selYear, setSelYear]   = useState(now.getFullYear());
  const [instrIdx, setInstrIdx] = useState(0);
  const [paramIdx, setParamIdx] = useState(0);
  const [selectedLevel, setSelectedLevel] = useState<ControlLevel>('Kontrol');

  const instrument = INSTRUMENTS[instrIdx];
  const selected   = instrument.params[paramIdx];
  const levelOptions = selected.levels;

  // ── Available years from data ─────────────────────────
  const availableYears = useMemo(() => {
    const yrs = new Set<number>();
    records.forEach(r => { const y = parseInt(r.tanggal); if (!isNaN(y)) yrs.add(y); });
    if (yrs.size === 0) yrs.add(now.getFullYear());
    return Array.from(yrs).sort();
  }, [records]);

  // ── Filter records by month/year + param ──────────────
  const filteredRecords = useMemo(() => {
    const lvl = selected.levels.length === 1 ? selected.levels[0] : selectedLevel;
    const mm  = String(selMonth + 1).padStart(2, '0');
    const prefix = `${selYear}-${mm}`;
    return records
      .filter(r =>
        r.alat === instrument.alat &&
        r.level === lvl &&
        r.params[selected.name] != null &&
        r.tanggal.startsWith(prefix)
      )
      .sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  }, [records, instrument, selected, selectedLevel, selMonth, selYear]);

  const lotConfig = useMemo(() => {
    if (instrument.alat === 'CA660') {
      const lot = config.CA660[0];
      return lot?.Kontrol?.[selected.name as 'PT' | 'APTT' | 'INR'] || null;
    } else {
      const lot = config.EASYLITE[0];
      const lvl = selected.levels.length === 1 ? selected.levels[0] : selectedLevel;
      return lot?.[lvl as 'NORMAL' | 'HIGH']?.[selected.name as 'Na' | 'K' | 'Cl'] || null;
    }
  }, [config, instrument, selected, selectedLevel]);

  const chartData = useMemo(() => {
    return filteredRecords.map((r, i) => ({
      run: i + 1,
      value: r.params[selected.name],
      status: r.status[selected.name] || 'ok',
      date: r.tanggal,
    }));
  }, [filteredRecords, selected]);

  const mean = lotConfig?.mean || 0;
  const sd   = lotConfig?.sd || 1;

  // Stats
  const actualValues = chartData.map(d => d.value!).filter(v => v != null);
  const actualMean   = actualValues.length ? actualValues.reduce((a, b) => a + b, 0) / actualValues.length : 0;
  const actualSD     = actualValues.length > 1
    ? Math.sqrt(actualValues.reduce((sum, v) => sum + Math.pow(v - actualMean, 2), 0) / (actualValues.length - 1))
    : 0;
  const cv = actualMean !== 0 ? (actualSD / actualMean) * 100 : 0;
  const inControl    = chartData.filter(d => d.status === 'ok').length;
  const inControlPct = chartData.length ? (inControl / chartData.length) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Header + date picker */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">Grafik Levey-Jennings</h1>
          <p className="text-sm text-muted-foreground">Kontrol kualitas berdasarkan parameter</p>
        </div>
        <div className="flex items-center gap-1.5">
          <select
            value={selMonth}
            onChange={e => setSelMonth(Number(e.target.value))}
            className="text-xs bg-card border border-border rounded-md px-2 py-1 h-7 font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent"
          >
            {BULAN.map((b, i) => <option key={i} value={i}>{b}</option>)}
          </select>
          <select
            value={selYear}
            onChange={e => setSelYear(Number(e.target.value))}
            className="text-xs bg-card border border-border rounded-md px-2 py-1 h-7 font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent"
          >
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Instrument group tabs */}
      <div className="space-y-2">
        <div className="flex gap-2">
          {INSTRUMENTS.map((ins, i) => (
            <button
              key={ins.alat}
              onClick={() => { setInstrIdx(i); setParamIdx(0); if (ins.params[0].levels.length === 1) setSelectedLevel(ins.params[0].levels[0]); }}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                instrIdx === i
                  ? 'bg-[#1a3a5c] text-white'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {ins.label}
            </button>
          ))}
        </div>

        {/* Parameter tabs within instrument */}
        <div className="flex gap-1.5">
          {instrument.params.map((p, i) => (
            <button
              key={p.name}
              onClick={() => { setParamIdx(i); if (p.levels.length === 1) setSelectedLevel(p.levels[0]); else setSelectedLevel(p.levels[0]); }}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                paramIdx === i
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/60 text-muted-foreground hover:text-foreground'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Level selector for multi-level params */}
      {levelOptions.length > 1 && (
        <div className="flex gap-2">
          {levelOptions.map(lvl => (
            <button
              key={lvl}
              onClick={() => setSelectedLevel(lvl)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                selectedLevel === lvl ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>
      )}

      {/* Info badge */}
      <div className="text-[10px] text-muted-foreground">
        {instrument.label} &middot; {selected.name} &middot; {BULAN[selMonth]} {selYear}
        {chartData.length > 0 && <span className="ml-2 text-foreground font-medium">{chartData.length} data point{chartData.length > 1 ? 's' : ''}</span>}
      </div>

      {/* Chart */}
      <div className="card-clinical p-3">
        {chartData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
            Belum ada data untuk {BULAN[selMonth]} {selYear}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,32%,91%)" />
              {/* SD bands */}
              <ReferenceArea y1={mean - 3 * sd} y2={mean - 2 * sd} fill="hsl(0,72%,51%)" fillOpacity={0.06} />
              <ReferenceArea y1={mean + 2 * sd} y2={mean + 3 * sd} fill="hsl(0,72%,51%)" fillOpacity={0.06} />
              <ReferenceArea y1={mean - 2 * sd} y2={mean - sd} fill="hsl(38,92%,44%)" fillOpacity={0.06} />
              <ReferenceArea y1={mean + sd} y2={mean + 2 * sd} fill="hsl(38,92%,44%)" fillOpacity={0.06} />
              <ReferenceArea y1={mean - sd} y2={mean + sd} fill="hsl(160,94%,31%)" fillOpacity={0.06} />

              <ReferenceLine y={mean} stroke="hsl(214,70%,14%)" strokeDasharray="5 3" label={{ value: 'Mean', position: 'left', fontSize: 10 }} />
              <ReferenceLine y={mean + sd} stroke="hsl(160,94%,31%)" strokeDasharray="3 3" label={{ value: '+1SD', position: 'left', fontSize: 9 }} />
              <ReferenceLine y={mean - sd} stroke="hsl(160,94%,31%)" strokeDasharray="3 3" label={{ value: '-1SD', position: 'left', fontSize: 9 }} />
              <ReferenceLine y={mean + 2 * sd} stroke="hsl(38,92%,44%)" strokeDasharray="3 3" label={{ value: '+2SD', position: 'left', fontSize: 9 }} />
              <ReferenceLine y={mean - 2 * sd} stroke="hsl(38,92%,44%)" strokeDasharray="3 3" label={{ value: '-2SD', position: 'left', fontSize: 9 }} />
              <ReferenceLine y={mean + 3 * sd} stroke="hsl(0,72%,51%)" strokeDasharray="3 3" label={{ value: '+3SD', position: 'left', fontSize: 9 }} />
              <ReferenceLine y={mean - 3 * sd} stroke="hsl(0,72%,51%)" strokeDasharray="3 3" label={{ value: '-3SD', position: 'left', fontSize: 9 }} />

              <XAxis dataKey="run" fontSize={10} tick={{ fill: 'hsl(215,16%,47%)' }} />
              <YAxis fontSize={10} tick={{ fill: 'hsl(215,16%,47%)' }} domain={[mean - 4 * sd, mean + 4 * sd]} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(214,32%,91%)' }}
                formatter={(value: number) => [value, selected.name]}
                labelFormatter={(label) => `Run #${label}`}
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
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card-clinical p-3 text-center">
          <p className="text-[10px] text-muted-foreground">Mean Aktual</p>
          <p className="text-lg font-mono-data font-bold">{actualMean.toFixed(2)}</p>
        </div>
        <div className="card-clinical p-3 text-center">
          <p className="text-[10px] text-muted-foreground">SD</p>
          <p className="text-lg font-mono-data font-bold">{actualSD.toFixed(2)}</p>
        </div>
        <div className="card-clinical p-3 text-center">
          <p className="text-[10px] text-muted-foreground">CV%</p>
          <p className="text-lg font-mono-data font-bold">{cv.toFixed(1)}%</p>
        </div>
        <div className="card-clinical p-3 text-center">
          <p className="text-[10px] text-muted-foreground">In-Control</p>
          <p className="text-lg font-mono-data font-bold text-success">{inControlPct.toFixed(0)}%</p>
        </div>
      </div>
    </div>
  );
}
