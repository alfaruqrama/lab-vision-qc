
import React from 'react';
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
import { cn } from '@/lib/utils';
import type { ParamName, InstrumentType, ControlLevel } from '@/lib/types';
import { PARAM_UNITS } from '@/lib/types';

const NORMAL_COLOR = 'hsl(220,79%,48%)';
const HIGH_COLOR = 'hsl(142,69%,40%)';
const MULTI_LEVEL_COLORS: Record<string, string> = {
  NORMAL: 'hsl(220,79%,48%)',
  HIGH: 'hsl(142,69%,40%)',
  CTRL0: 'hsl(220,79%,48%)',
  CTRL1: 'hsl(142,69%,40%)',
  CTRL2: 'hsl(30,85%,50%)',
};

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

interface LJChartProps {
  mode: 'single' | 'multi';
  data: any[];
  selected: { alat: InstrumentType; name: ParamName; levels: ControlLevel[] };
  config: any;
  multiLevels?: ControlLevel[];
  mean?: number;
  sd?: number;
}

export function LJChart({ mode, data, selected, config, multiLevels, mean = 0, sd = 1 }: LJChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-48 flex flex-col items-center justify-center text-muted-foreground gap-2">
        <p className="text-sm font-medium">Belum ada data untuk bulan ini</p>
        <p className="text-xs">Pilih bulan lain atau input data QC terlebih dahulu</p>
      </div>
    );
  }

  if (mode === 'single') {
    return (
      <>
        <div className="flex items-center gap-4 mb-2">
          <span className="flex items-center gap-1.5 text-xs">
            <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: NORMAL_COLOR }} />
            {selected.levels.length === 1
              ? selected.levels[0]
              : 'Selected Level'}
          </span>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
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
            <XAxis dataKey="run" fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} label={{ value: 'Run Ke-', position: 'insideBottom', offset: -10, fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
            <YAxis fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} domain={[mean - 4 * sd, mean + 4 * sd]} label={{ value: `${selected.name} (${PARAM_UNITS[selected.name]})`, angle: -90, position: 'insideLeft', offset: 0, fontSize: 10, fill: 'hsl(var(--muted-foreground))', style: { textAnchor: 'middle' } }} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))', maxWidth: 280, padding: 0 }}
              content={({ payload }) => {
                if (!payload || payload.length === 0) return null;
                const item = payload[0].payload;
                const isOoc = item.status === 'oos';
                const isWarning = item.status === 'warning';
                return (
                  <div className="p-2.5 space-y-1 text-xs">
                    <p className="font-semibold">Run #{item.run} — {item.date}</p>
                    <p className="text-muted-foreground">Analis: {item.analis}</p>
                    <p className={cn('font-mono-data font-bold text-sm', isOoc ? 'text-destructive' : isWarning ? 'text-warning' : '')}>
                      {selected.name}: {item.value}
                    </p>
                    {item.catatan && item.catatan.trim() !== '' && (
                      <div className="pt-1.5 mt-1 border-t border-border/50">
                        <p className="text-[10px] text-muted-foreground font-semibold mb-0.5 uppercase tracking-wide">Tindakan Korektif</p>
                        <p className="text-[11px] leading-relaxed whitespace-pre-wrap">{item.catatan}</p>
                      </div>
                    )}
                  </div>
                );
              }}
            />
            <Line type="linear" dataKey="value" stroke="hsl(220,79%,48%)" strokeWidth={2} dot={<CustomDot />} activeDot={{ r: 6, fill: 'hsl(220,79%,48%)' }} />
          </LineChart>
        </ResponsiveContainer>
      </>
    );
  }

  return (
    <>
      <div className="flex items-center gap-4 mb-2">
        {multiLevels?.map((lvl) => (
          <span key={lvl} className="flex items-center gap-1.5 text-xs">
            <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: MULTI_LEVEL_COLORS[lvl] || 'hsl(var(--foreground))' }} />
            {lvl}
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
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
          <XAxis dataKey="date" fontSize={9} tick={{ fill: 'hsl(var(--muted-foreground))' }} interval="preserveStartEnd" label={{ value: 'Tanggal', position: 'insideBottom', offset: -10, fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
          <YAxis fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} domain={[-4, 4]} ticks={[-3, -2, -1, 0, 1, 2, 3]} tickFormatter={(v: number) => `${v}`} label={{ value: 'Z-Score', angle: -90, position: 'insideLeft', offset: 0, fontSize: 10, fill: 'hsl(var(--muted-foreground))', style: { textAnchor: 'middle' } }} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))', maxWidth: 260, padding: 0 }}
            content={({ payload }) => {
              if (!payload || payload.length === 0) return null;
              const item = payload[0].payload;
              return (
                <div className="p-2.5 space-y-1 text-xs">
                  <p className="font-semibold">{item.date}</p>
                  {multiLevels?.map((lvl) => {
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
          {multiLevels?.map((lvl) => {
            const color = MULTI_LEVEL_COLORS[lvl] || 'hsl(var(--foreground))';
            return (
              <Line key={lvl} type="linear" dataKey={lvl.toLowerCase()} stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 5, fill: color }} connectNulls />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </>
  );
}
