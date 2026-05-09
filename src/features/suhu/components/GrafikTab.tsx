import { Camera } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { type SuhuEntry } from '@/hooks/use-suhu-store';
import { ROOMS, isNormal } from './InputTab';

interface GrafikTabProps {
  sessionData: Record<string, SuhuEntry>;
  doneCount: number;
  avgSuhu: string;
  avgRh: string;
  chartMode: 'suhu' | 'rh';
  setChartMode: (m: 'suhu' | 'rh') => void;
  chartData: Array<{ name: string; suhu: number | null; rh: number | null; type: 'room' | 'fridge' }>;
}

export function GrafikTab({ sessionData, doneCount, avgSuhu, avgRh, chartMode, setChartMode, chartData }: GrafikTabProps) {
  if (doneCount === 0) {
    return (
      <Card className="p-12 text-center">
        <Camera size={40} className="mx-auto text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">📷 Input data di tab Input dulu</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="pt-4 pb-4 text-center"><p className="text-[10px] text-muted-foreground">Lokasi</p><p className="text-xl font-bold">{doneCount}/6</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4 text-center"><p className="text-[10px] text-muted-foreground">Rata-rata Suhu</p><p className="text-xl font-bold font-mono">{avgSuhu}°C</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4 text-center"><p className="text-[10px] text-muted-foreground">Rata-rata RH</p><p className="text-xl font-bold font-mono">{avgRh}%</p></CardContent></Card>
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant={chartMode === 'suhu' ? 'default' : 'outline'} onClick={() => setChartMode('suhu')}>Suhu °C</Button>
        <Button size="sm" variant={chartMode === 'rh' ? 'default' : 'outline'} onClick={() => setChartMode('rh')}>Kelembapan %</Button>
      </div>

      <Card>
        <CardContent className="pt-4 pb-4">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart
              data={chartMode === 'rh' ? chartData.filter(d => d.rh !== null) : chartData}
              margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} domain={chartMode === 'rh' ? [0, 100] : ['auto', 'auto']} />
              <Tooltip formatter={(val: number) => chartMode === 'rh' ? `${val}%` : `${val}°C`} />
              <Bar dataKey={chartMode === 'rh' ? 'rh' : 'suhu'} radius={[4, 4, 0, 0]}>
                {(chartMode === 'rh' ? chartData.filter(d => d.rh !== null) : chartData).map((entry, idx) => (
                  <Cell key={idx} fill={chartMode === 'rh' ? '#3b82f6' : entry.type === 'fridge' ? '#3b82f6' : '#10b981'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {ROOMS.map(room => {
          const d = sessionData[room.id];
          const ok = d ? isNormal(d.suhu, room.type) : null;
          return (
            <div key={room.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
              <span className="text-lg">{room.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">{room.label}</p>
              </div>
              <span className="font-mono text-sm font-semibold">{d ? `${d.suhu}°C` : '—'}</span>
              {d?.rh != null && <span className="font-mono text-xs text-muted-foreground">{d.rh}%</span>}
              {ok !== null && (
                <Badge variant={ok ? 'default' : 'outline'} className={`text-[10px] ${ok ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-0' : 'border-amber-500 text-amber-600'}`}>
                  {ok ? 'Normal' : '⚠ Cek'}
                </Badge>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
