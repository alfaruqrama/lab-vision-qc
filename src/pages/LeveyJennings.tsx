import { useState, useMemo } from 'react';
import { useQCStore } from '@/hooks/use-qc-store';
import type { ParamName, InstrumentType, ControlLevel } from '@/lib/types';
import { PARAM_UNITS } from '@/lib/types';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  ReferenceArea, ReferenceLine, Tooltip, Dot
} from 'recharts';

const ALL_PARAMS: { name: ParamName; alat: InstrumentType; levels: ControlLevel[] }[] = [
  { name: 'PT', alat: 'CA660', levels: ['Kontrol'] },
  { name: 'APTT', alat: 'CA660', levels: ['Kontrol'] },
  { name: 'INR', alat: 'CA660', levels: ['Kontrol'] },
  { name: 'Na', alat: 'EASYLITE', levels: ['NORMAL', 'HIGH'] },
  { name: 'K', alat: 'EASYLITE', levels: ['NORMAL', 'HIGH'] },
  { name: 'Cl', alat: 'EASYLITE', levels: ['NORMAL', 'HIGH'] },
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

  const selected = ALL_PARAMS[selectedIdx];

  const levelOptions = selected.levels;

  const filteredRecords = useMemo(() => {
    const lvl = selected.levels.length === 1 ? selected.levels[0] : selectedLevel;
    return records
      .filter(r => r.alat === selected.alat && r.level === lvl && r.params[selected.name] != null)
      .sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  }, [records, selected, selectedLevel]);

  const lotConfig = useMemo(() => {
    if (selected.alat === 'CA660') {
      const lot = config.CA660[0];
      return lot?.Kontrol?.[selected.name as 'PT' | 'APTT' | 'INR'] || null;
    } else {
      const lot = config.EASYLITE[0];
      const lvl = selected.levels.length === 1 ? selected.levels[0] : selectedLevel;
      return lot?.[lvl as 'NORMAL' | 'HIGH']?.[selected.name as 'Na' | 'K' | 'Cl'] || null;
    }
  }, [config, selected, selectedLevel]);

  const chartData = useMemo(() => {
    return filteredRecords.map((r, i) => ({
      run: i + 1,
      value: r.params[selected.name],
      status: r.status[selected.name] || 'ok',
      date: r.tanggal,
    }));
  }, [filteredRecords, selected]);

  const mean = lotConfig?.mean || 0;
  const sd = lotConfig?.sd || 1;

  // Stats
  const actualValues = chartData.map(d => d.value!).filter(v => v != null);
  const actualMean = actualValues.length ? actualValues.reduce((a, b) => a + b, 0) / actualValues.length : 0;
  const actualSD = actualValues.length > 1
    ? Math.sqrt(actualValues.reduce((sum, v) => sum + Math.pow(v - actualMean, 2), 0) / (actualValues.length - 1))
    : 0;
  const cv = actualMean !== 0 ? (actualSD / actualMean) * 100 : 0;
  const inControl = chartData.filter(d => d.status === 'ok').length;
  const inControlPct = chartData.length ? (inControl / chartData.length) * 100 : 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Grafik Levey-Jennings</h1>
        <p className="text-sm text-muted-foreground">Kontrol kualitas berdasarkan parameter</p>
      </div>

      {/* Parameter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0">
        {ALL_PARAMS.map((p, i) => (
          <button
            key={`${p.name}-${i}`}
            onClick={() => { setSelectedIdx(i); if (p.levels.length === 1) setSelectedLevel(p.levels[0]); }}
            className={`flex-shrink-0 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              selectedIdx === i ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Level selector for Easylite params */}
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

      {/* Chart */}
      <div className="card-clinical p-3">
        {chartData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">Belum ada data</div>
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
