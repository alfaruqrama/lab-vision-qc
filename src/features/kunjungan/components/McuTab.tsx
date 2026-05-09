import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts';
import { type McuRow, fmtRp, fmtRpFull } from '@/lib/kunjungan-types';
import { KpiCard, EmptyState } from './KpiCard';

export function McuTab({ month, data }: { month: string; data: McuRow[] }) {
  const rows = data.filter(r => r.omzet > 0);
  if (!rows.length) return <EmptyState text={`Belum ada data MCU untuk ${month}`} />;

  const total = rows.reduce((s, r) => s + r.omzet, 0);
  const avg = total / rows.length;
  const maxRow = rows.reduce((a, b) => (b.omzet > a.omzet ? b : a));
  const minRow = rows.reduce((a, b) => (b.omzet < a.omzet ? b : a));

  const chartData = rows.map(r => ({ name: String(r.d), omzet: r.omzet, avg }));

  return (
    <div className="space-y-4 page-transition">
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4">
        <KpiCard label={`Total MCU ${month}`} value={fmtRp(total)} sub={`${rows.length} hari tercatat`} color="#0a9e87" />
        <KpiCard label="Rata-rata / Hari" value={fmtRp(avg)} sub="per hari aktif" color="#3b82f6" />
        <KpiCard label="Tertinggi" value={fmtRp(maxRow.omzet)} sub={`Tgl ${maxRow.d} ${month}`} color="#f59e0b" />
        <KpiCard label="Terendah" value={fmtRp(minRow.omzet)} sub={`Tgl ${minRow.d} ${month}`} color="#e11d48" />
      </div>

      <div className="card-clinical p-4">
        <h3 className="text-sm font-bold mb-3">Omzet MCU Harian — {month}</h3>
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => fmtRp(v)} />
              <Tooltip formatter={(v: number) => fmtRpFull(v)} />
              <Bar dataKey="omzet" name="Omzet MCU" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.omzet >= avg ? 'rgba(13,158,132,0.75)' : 'rgba(245,158,11,0.65)'} />
                ))}
              </Bar>
              <Line dataKey="avg" name="Rata-rata" stroke="#e11d48" strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card-clinical p-4">
        <h3 className="text-sm font-bold mb-3">Detail Harian MCU — {month}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] font-mono-data">
            <thead>
              <tr className="bg-muted">
                <th className="px-3 py-2 text-left">Tgl</th>
                <th className="px-3 py-2 text-right">Omzet MCU</th>
                <th className="px-3 py-2 text-right">Kontribusi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.d} className="border-b border-border hover:bg-muted/50">
                  <td className="px-3 py-1.5 font-semibold text-muted-foreground">{r.d}</td>
                  <td className="px-3 py-1.5 text-right font-bold">{fmtRpFull(r.omzet)}</td>
                  <td className="px-3 py-1.5 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, (r.omzet / maxRow.omzet) * 100).toFixed(0)}%`,
                            background: r.omzet >= avg ? 'hsl(var(--accent))' : 'hsl(var(--warning))',
                          }}
                        />
                      </div>
                      <span className="text-muted-foreground min-w-[36px] text-right">{((r.omzet / total) * 100).toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-muted">
                <td className="px-3 py-2 font-bold">TOTAL</td>
                <td className="px-3 py-2 text-right font-extrabold text-accent">{fmtRpFull(total)}</td>
                <td className="px-3 py-2 text-right font-semibold text-muted-foreground">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
