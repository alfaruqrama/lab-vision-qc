import { useState, useMemo, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, ComposedChart
} from 'recharts';
import { ChevronLeft, RefreshCw, Wifi, WifiOff, Settings2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  type KunjunganData, type OmzetRow, type KunjunganRow, type McuRow,
  normalizeMonthKeys, sortMonths, fmtRp, fmtRpFull, badgeClass, PAYERS
} from '@/lib/kunjungan-types';
import { useKunjunganData, type ConnectionStatus } from '@/hooks/use-kunjungan-data';
import { getGsUrl, setGsUrl } from '@/lib/kunjungan-api';
import { toast } from 'sonner';

type TabType = 'omzet' | 'kunjungan' | 'mcu' | 'laporan';

// ─── KPI Card ───
function KpiCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="card-clinical flex-shrink-0 min-w-[150px] p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl" style={{ background: color }} />
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground font-mono-data mb-2">{label}</p>
      <p className="text-lg font-bold font-display" style={{ color }}>{value}</p>
      <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>
    </div>
  );
}

// ─── Badge ───
function PctBadge({ pct }: { pct: number }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeClass(pct)}`}>
      {pct}%
    </span>
  );
}

// ─── TAB: OMZET ───
function OmzetTab({ month, data }: { month: string; data: OmzetRow[] }) {
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
      {/* KPIs */}
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4">
        <KpiCard label={`Total Omzet ${month}`} value={fmtRp(tot)} sub={`${data.length} hari tercatat`} color="#0a9e87" />
        <KpiCard label="Avg Target / Hari" value={fmtRp(avgTgt)} sub="Target rata-rata harian" color="#3b82f6" />
        <KpiCard label="Hari Capai Target" value={`${dHit} hari`} sub={`dari ${data.length} hari`} color="#f59e0b" />
        <KpiCard label="Capaian Tertinggi" value={`${best.pct}%`} sub={`Tgl ${best.d} ${month}`} color="#e11d48" />
        <KpiCard label="Avg Capaian" value={`${avgPct}%`} sub="Rata-rata per hari" color="#8b5cf6" />
      </div>

      {/* Payer grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
        {payerTotals.map(p => (
          <div key={p.name} className="card-clinical p-3 hover:shadow-md transition-shadow">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground font-mono-data mb-1">{p.name}</p>
            <p className="text-sm font-bold font-display" style={{ color: p.color }}>{fmtRp(p.value)}</p>
            <p className="text-[10px] text-muted-foreground">{((p.value / tot) * 100).toFixed(1)}% dari total</p>
          </div>
        ))}
      </div>

      {/* Chart: Daily vs Target */}
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

      {/* Chart row: Capaian % + Pie */}
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

      {/* Table */}
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

// ─── TAB: KUNJUNGAN ───
function KunjunganTab({ month, data }: { month: string; data: KunjunganRow[] }) {
  if (!data.length) return <EmptyState text="Belum ada data kunjungan" />;

  const totK = data.reduce((s, r) => s + r.total, 0);
  const dHit = data.filter(r => r.pct >= 100).length;
  const bestK = data.reduce((a, b) => (b.total > a.total ? b : a));
  const avgK = Math.round(totK / data.length);
  const totRJ = data.reduce((s, r) => s + r.rjTotal, 0);
  const totRI = data.reduce((s, r) => s + r.riTotal, 0);
  const totIGD = data.reduce((s, r) => s + r.igdTotal, 0);
  const totMCU = data.reduce((s, r) => s + r.mcuTotal, 0);

  const chartData = data.map(r => ({ name: String(r.d), total: r.total, target: r.target, pct: r.pct, rj: r.rjTotal, ri: r.riTotal, igd: r.igdTotal, mcu: r.mcuTotal }));
  const unitData = [
    { name: 'Rawat Jalan', value: totRJ, color: '#3b82f6', emoji: '🚶' },
    { name: 'Rawat Inap', value: totRI, color: '#8b5cf6', emoji: '🛏️' },
    { name: 'IGD', value: totIGD, color: '#e11d48', emoji: '🚨' },
    { name: 'MCU', value: totMCU, color: '#f59e0b', emoji: '🩺' },
  ];

  return (
    <div className="space-y-4 page-transition">
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4">
        <KpiCard label={`Total Kunjungan ${month}`} value={totK.toLocaleString('id-ID')} sub={`${data.length} hari tercatat`} color="#0a9e87" />
        <KpiCard label="Avg per Hari" value={String(avgK)} sub="Pasien rata-rata harian" color="#3b82f6" />
        <KpiCard label="Hari Capai Target" value={`${dHit} hari`} sub={`dari ${data.length} hari`} color="#f59e0b" />
        <KpiCard label="Kunjungan Terbanyak" value={String(bestK.total)} sub={`Tgl ${bestK.d} ${month}`} color="#e11d48" />
      </div>

      {/* Unit breakdown cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {unitData.map(u => (
          <div key={u.name} className="card-clinical p-4 text-center hover:shadow-md transition-shadow">
            <p className="text-xl mb-1">{u.emoji}</p>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground font-mono-data mb-1">{u.name}</p>
            <p className="text-xl font-bold font-display" style={{ color: u.color }}>{u.value.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">{((u.value / totK) * 100).toFixed(1)}% dari total</p>
          </div>
        ))}
      </div>

      {/* Daily chart */}
      <div className="card-clinical p-4">
        <h3 className="text-sm font-bold mb-3">Total Kunjungan Harian — {month}</h3>
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="total" name="Total" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.pct >= 100 ? 'rgba(10,158,135,0.7)' : 'rgba(59,130,246,0.55)'} />
                ))}
              </Bar>
              <Line dataKey="target" name="Target" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 4" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Stacked + Pie */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card-clinical p-4">
          <h3 className="text-sm font-bold mb-3">Breakdown per Unit Harian</h3>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="rj" name="RJ" stackId="a" fill="rgba(59,130,246,0.65)" />
                <Bar dataKey="ri" name="RI" stackId="a" fill="rgba(139,92,246,0.65)" />
                <Bar dataKey="igd" name="IGD" stackId="a" fill="rgba(225,29,72,0.6)" />
                <Bar dataKey="mcu" name="MCU" stackId="a" fill="rgba(245,158,11,0.65)" radius={[4, 4, 0, 0]} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card-clinical p-4">
          <h3 className="text-sm font-bold mb-3">Komposisi Unit Layanan</h3>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={unitData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="42%" outerRadius="72%">
                  {unitData.map((u, i) => <Cell key={i} fill={u.color + '33'} stroke={u.color} strokeWidth={2} />)}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card-clinical p-4">
        <h3 className="text-sm font-bold mb-3">Detail Kunjungan Harian — {month}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] font-mono-data">
            <thead>
              <tr className="bg-muted">
                <th className="px-2 py-2 text-left">Tgl</th>
                <th className="px-2 py-2 text-right">RJ</th>
                <th className="px-2 py-2 text-right">RI</th>
                <th className="px-2 py-2 text-right">IGD</th>
                <th className="px-2 py-2 text-right">MCU</th>
                <th className="px-2 py-2 text-right font-bold">Total</th>
                <th className="px-2 py-2 text-right">Target</th>
                <th className="px-2 py-2 text-center">%</th>
              </tr>
            </thead>
            <tbody>
              {data.map(r => (
                <tr key={r.d} className="border-b border-border hover:bg-muted/50">
                  <td className="px-2 py-1.5 font-bold text-accent">{r.d}</td>
                  <td className="px-2 py-1.5 text-right">{r.rjTotal}</td>
                  <td className="px-2 py-1.5 text-right">{r.riTotal}</td>
                  <td className="px-2 py-1.5 text-right">{r.igdTotal}</td>
                  <td className="px-2 py-1.5 text-right">{r.mcuTotal}</td>
                  <td className="px-2 py-1.5 text-right font-semibold">{r.total}</td>
                  <td className="px-2 py-1.5 text-right text-muted-foreground">{r.target ? Math.round(r.target) : '—'}</td>
                  <td className="px-2 py-1.5 text-center">{r.pct ? <PctBadge pct={r.pct} /> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── TAB: MCU ───
function McuTab({ month, data }: { month: string; data: McuRow[] }) {
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

// ─── TAB: LAPORAN ───
function LaporanTab() {
  return (
    <div className="space-y-4 page-transition">
      <div className="card-clinical p-8 flex flex-col items-center justify-center text-center gap-3">
        <p className="text-3xl">📋</p>
        <h2 className="font-bold text-lg">Input Laporan Harian</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Fitur input laporan harian dan kirim via WhatsApp sedang dalam pengembangan.
        </p>
        <span className="text-[10px] px-3 py-1 rounded-full bg-warning/10 text-warning font-medium">Segera Hadir</span>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="card-clinical p-12 text-center text-muted-foreground">
      <p className="text-3xl mb-3">📊</p>
      <p className="font-semibold">{text}</p>
    </div>
  );
}

// ─── MAIN PAGE ───
export default function KunjunganDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabType>('omzet');
  const [month, setMonth] = useState(() => {
    const months = sortMonths(Object.keys(EMBEDDED.omzet));
    return months[months.length - 1] || 'JANUARI';
  });
  const [mcuMonth, setMcuMonth] = useState(() => {
    const months = sortMonths(Object.keys(EMBEDDED.mcu));
    return months[months.length - 1] || 'JANUARI';
  });

  const activeMonths = useMemo(() => {
    if (tab === 'mcu') return sortMonths(Object.keys(EMBEDDED.mcu));
    if (tab === 'kunjungan') return sortMonths(Object.keys(EMBEDDED.kunjungan));
    return sortMonths(Object.keys(EMBEDDED.omzet));
  }, [tab]);

  const activeMonth = tab === 'mcu' ? mcuMonth : month;
  const setActiveMonth = (m: string) => {
    if (tab === 'mcu') setMcuMonth(m);
    else setMonth(m);
  };

  const tabs: { key: TabType; label: string; emoji: string }[] = [
    { key: 'omzet', label: 'Omzet', emoji: '💰' },
    { key: 'kunjungan', label: 'Kunjungan', emoji: '👥' },
    { key: 'mcu', label: 'Omzet MCU', emoji: '🔬' },
    { key: 'laporan', label: 'Laporan', emoji: '📋' },
  ];

  return (
    <div className="space-y-0">
      {/* Tab bar */}
      <div className="bg-card border-b border-border -mx-4 px-4 flex items-center gap-1 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t.key
                ? 'border-accent text-accent font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.emoji} {t.label}
          </button>
        ))}

        {/* Month selector inline */}
        {tab !== 'laporan' && activeMonths.length > 0 && (
          <select
            value={activeMonth}
            onChange={e => setActiveMonth(e.target.value)}
            className="ml-auto text-xs bg-card border border-border rounded-lg px-3 py-1.5 font-medium text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent"
          >
            {activeMonths.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        )}
      </div>

      {/* Content */}
      <div className="pt-4">
        {tab === 'omzet' && <OmzetTab month={activeMonth} data={EMBEDDED.omzet[activeMonth] || []} />}
        {tab === 'kunjungan' && <KunjunganTab month={activeMonth} data={EMBEDDED.kunjungan[activeMonth] || []} />}
        {tab === 'mcu' && <McuTab month={activeMonth} data={EMBEDDED.mcu[activeMonth] || []} />}
        {tab === 'laporan' && <LaporanTab />}
      </div>
    </div>
  );
}
