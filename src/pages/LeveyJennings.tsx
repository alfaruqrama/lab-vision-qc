import { useState, useMemo } from 'react';
import { useQCStore } from '@/hooks/use-qc-store';
import type { ParamName, InstrumentType, ControlLevel } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { INSTRUMENT_LABELS } from '@/features/qc/lib/constants';
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

const ALL_PARAMS: { name: ParamName; alat: InstrumentType; levels: ControlLevel[] }[] = [
  { name: 'PT', alat: 'CA660', levels: ['Kontrol'] },
  { name: 'APTT', alat: 'CA660', levels: ['Kontrol'] },
  { name: 'INR', alat: 'CA660', levels: ['Kontrol'] },
  { name: 'Na', alat: 'EASYLITE', levels: ['NORMAL', 'HIGH'] },
  { name: 'K', alat: 'EASYLITE', levels: ['NORMAL', 'HIGH'] },
  { name: 'Cl', alat: 'EASYLITE', levels: ['NORMAL', 'HIGH'] },
  { name: 'GDA', alat: 'ONCALL1', levels: ['CTRL0', 'CTRL1', 'CTRL2'] },
  { name: 'GDA', alat: 'ONCALL2', levels: ['CTRL0', 'CTRL1', 'CTRL2'] },
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
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [selectedLevel, setSelectedLevel] = useState<ControlLevel>('Kontrol');

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
  );

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

  const selected = ALL_PARAMS[selectedIdx];
  const levelOptions = selected.levels;

  const filteredRecords = useMemo(() => {
    const lvl = selected.levels.length === 1 ? selected.levels[0] : selectedLevel;
    return records
      .filter(
        (r) =>
          r.alat === selected.alat &&
          r.level === lvl &&
          r.params[selected.name] != null &&
          r.tanggal.startsWith(selectedMonth),
      )
      .sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  }, [records, selected, selectedLevel, selectedMonth]);

  const lotConfig = useMemo(() => {
    if (selected.alat === 'CA660') {
      const lot = config.CA660[0];
      return lot?.Kontrol?.[selected.name as 'PT' | 'APTT' | 'INR'] || null;
    } else if (selected.alat === 'ONCALL1' || selected.alat === 'ONCALL2') {
      const lot = (selected.alat === 'ONCALL1' ? config.ONCALL1 : config.ONCALL2)[0];
      const lvl = selected.levels.length === 1 ? selected.levels[0] : selectedLevel;
      return (lot as any)?.[lvl]?.GDA || null;
    } else {
      const lot = config.EASYLITE[0];
      const lvl = selected.levels.length === 1 ? selected.levels[0] : selectedLevel;
      return (lot as any)?.[lvl]?.[selected.name] || null;
    }
  }, [config, selected, selectedLevel]);

  const chartData = useMemo(() => {
    return filteredRecords.map((r, i) => ({
      run: i + 1,
      value: r.params[selected.name],
      status: r.status[selected.name] || 'ok',
      date: r.tanggal,
      analis: r.analis,
    }));
  }, [filteredRecords, selected]);

  const mean = lotConfig?.mean || 0;
  const sd = lotConfig?.sd || 1;

  // Stats
  const actualValues = chartData.map((d) => d.value!).filter((v) => v != null);
  const actualMean = actualValues.length ? actualValues.reduce((a, b) => a + b, 0) / actualValues.length : 0;
  const actualSD =
    actualValues.length > 1
      ? Math.sqrt(actualValues.reduce((sum, v) => sum + Math.pow(v - actualMean, 2), 0) / (actualValues.length - 1))
      : 0;
  const cv = actualMean !== 0 ? (actualSD / actualMean) * 100 : 0;
  const inControl = chartData.filter((d) => d.status === 'ok').length;
  const inControlPct = chartData.length ? (inControl / chartData.length) * 100 : 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Grafik Levey-Jennings</h1>
        <p className="text-sm text-muted-foreground">Kontrol kualitas berdasarkan parameter</p>
      </div>

      {/* Month selector */}
      <div className="flex items-center gap-2">
        <Label className="text-xs whitespace-nowrap">Bulan:</Label>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="w-40 h-8 text-sm rounded-md border border-input bg-background px-2 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {monthOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Parameter tabs — grouped by instrument */}
      <Card className="p-3 space-y-2.5">
        {(['CA660', 'EASYLITE', 'ONCALL1', 'ONCALL2'] as InstrumentType[]).map((alat) => {
          const params = ALL_PARAMS.map((p, i) => ({ ...p, i })).filter((p) => p.alat === alat);
          return (
            <div key={alat} className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-muted-foreground w-20 shrink-0 truncate">
                {INSTRUMENT_LABELS[alat].split(' ').slice(-1)[0]}
              </span>
              <div className="flex gap-1.5 flex-wrap">
                {params.map((p) => (
                  <button
                    key={p.i}
                    onClick={() => {
                      setSelectedIdx(p.i);
                      setSelectedLevel(p.levels[0]);
                    }}
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

      {/* Level selector for multi-level params */}
      {levelOptions.length > 1 && (
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

      {/* Chart */}
      <Card className="p-4">
        {chartData.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-muted-foreground gap-2">
            <p className="text-sm font-medium">Belum ada data untuk bulan ini</p>
            <p className="text-xs">Pilih bulan lain atau input data QC terlebih dahulu</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
              {/* SD bands */}
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
                }}
                formatter={(value: number) => [value, selected.name]}
                labelFormatter={(label, payload) => {
                  const item = payload?.[0]?.payload;
                  return item ? `Run #${label} — ${item.date} (${item.analis})` : `Run #${label}`;
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

      {/* Stats cards */}
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
    </div>
  );
}
