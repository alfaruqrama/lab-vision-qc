import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, ComposedChart
} from 'recharts';
import { type OmzetRow, fmtRp, fmtRpFull, PAYERS } from '@/lib/kunjungan-types';
import { KpiCard, PctBadge, EmptyState } from './KpiCard';

export function OmzetTab({ month, data }: { month: string; data: OmzetRow[] }) {
  if (!data.length) return <EmptyState text="Belum ada data omzet" />;

  const tot = data.reduce((s, r) => s + r.total, 0);
  const dHit = data.filter(r => r.pct >= 100).length;
  const best = data.reduce((a, b) => (b.pct > a.pct ? b : a));
  const avgPct = Math.round(data.reduce((s, r) => s + r.pct, 0) / data.length);
  const avgTgt = data.reduce((s, r) => s + r.target, 0) / data.length;

  const chartData = data.map(r => ({ name: String(r.d), total: r.total, target: r.target, pct: r.pct }));
  const payerTotals = PAYERS.map(p => ({
    name: p.l,
    value: data.reduce((s, r) => s + ((r as any)[p.k] || 0), 0),
    color: p.c,
  }));

  return (
    <div className="space-y-4 page-transition">
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4">
        <KpiCard label={`Total Omzet ${month}`} value={fmtRp(tot)} sub={`${data.length} hari tercatat`} color="#0a9e87" />
        <KpiCard label="Avg Target / Hari" value={fmtRp(avgTgt)} sub="Target rata-rata harian" color="#3b82f6" />
        <KpiCard label="Hari Capai Target" value={`${dHit} hari`} sub={`dari ${data.length} hari`} color="#f59e0b" />
        <KpiCard label="Capaian Tertinggi" value={`${best.pct}%`} sub={`Tgl ${best.d} ${month}`} color="#e11d48" />
        <KpiCard label="Avg Capaian" value={`${avgPct}%`} sub="Rata-rata per hari" color="#8b5cf6" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
        {payerTotals.map(p => (
          <div key={p.name} className="card-clinical p-3 hover:shadow-md transition-shadow">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground font-mono-data mb-1">{p.name}</p>
            <p className="text-sm font-bold font-display" style={{ color: p.color }}>{fmtRp(p.value)}</p>
            <p className="text-[10px] text-muted-foreground">{((p.value / tot) * 100).toFixed(1)}% dari total</p>
          </div>
        ))}
      </div>

      <div className="card-clinical p-4">
        <h3 className="text-sm font-bold mb-1">Omzet Harian vs Target — {month}</h3>
        <p className="text-[11px] text-muted-foreground mb-3">Hijau = melampaui target · Biru = di bawah target · Garis oranye = target</p>
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => fmtRp(v)} />
              <Tooltip formatter={(v: number) => fmtRpFull(v)} />
              <Bar dataKey="total" name="Omzet Aktual" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.pct >= 100 ? 'rgba(10,158,135,0.7)' : 'rgba(59,130,246,0.55)'} />
                ))}
              </Bar>
              <Line dataKey="target" name="Target" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 4" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card-clinical p-4">
          <h3 className="text-sm font-bold mb-3">Capaian % per Hari</h3>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Bar dataKey="pct" name="Capaian" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={
                      entry.pct >= 150 ? 'rgba(139,92,246,0.7)' :
                      entry.pct >= 100 ? 'rgba(10,158,135,0.7)' :
                      entry.pct >= 80 ? 'rgba(245,158,11,0.7)' : 'rgba(240,78,55,0.65)'
                    } />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card-clinical p-4">
          <h3 className="text-sm font-bold mb-3">Komposisi Payer — {month}</h3>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={payerTotals} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="45%" outerRadius="75%">
                  {payerTotals.map((p, i) => <Cell key={i} fill={p.color + '40'} stroke={p.color} strokeWidth={2} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmtRpFull(v)} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card-clinical p-4 overflow-hidden">
        <h3 className="text-sm font-bold mb-3">Detail Data Harian — {month}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] font-mono-data">
            <thead>
              <tr className="bg-muted">
                <th className="px-2 py-2 text-left">Tgl</th>
                {PAYERS.map(p => <th key={p.k} className="px-2 py-2 text-right whitespace-nowrap">{p.l}</th>)}
                <th className="px-2 py-2 text-right font-bold">Total</th>
                <th className="px-2 py-2 text-right">Target</th>
                <th className="px-2 py-2 text-center">%</th>
              </tr>
            </thead>
            <tbody>
              {data.map(r => (
                <tr key={r.d} className="border-b border-border hover:bg-muted/50 transition-colors">
                  <td className="px-2 py-1.5 font-bold text-accent">{r.d}</td>
                  {PAYERS.map(p => (
                    <td key={p.k} className="px-2 py-1.5 text-right text-muted-foreground">
                      {(r as any)[p.k] ? fmtRp((r as any)[p.k]) : '—'}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-right font-semibold">{fmtRp(r.total)}</td>
                  <td className="px-2 py-1.5 text-right text-muted-foreground">{fmtRp(r.target)}</td>
                  <td className="px-2 py-1.5 text-center"><PctBadge pct={r.pct} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
