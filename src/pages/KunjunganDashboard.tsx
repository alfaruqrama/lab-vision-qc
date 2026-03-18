import { useState, useMemo, useEffect } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, ComposedChart
} from 'recharts';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import embeddedRaw from '@/lib/kunjungan-data.json';
import { fetchKunjunganSummary } from '@/lib/api'; // <-- Import API GS
import {
  type KunjunganData, type OmzetRow, type KunjunganRow, type McuRow,
  normalizeMonthKeys, sortMonths, fmtRp, fmtRpFull, badgeClass, PAYERS
} from '@/lib/kunjungan-types';

// --- DATA CADANGAN JIKA GS GAGAL DIMUAT ---
const EMBEDDED: KunjunganData = {
  omzet: normalizeMonthKeys(embeddedRaw.omzet || {}),
  kunjungan: normalizeMonthKeys(embeddedRaw.kunjungan || {}),
  mcu: normalizeMonthKeys(embeddedRaw.mcu || {}),
};

type TabType = 'omzet' | 'kunjungan' | 'mcu' | 'laporan';

// ─── KOMPONEN KECIL ───
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

function PctBadge({ pct }: { pct: number }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeClass(pct)}`}>
      {pct}%
    </span>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <p className="text-sm font-medium">{text}</p>
    </div>
  );
}

// ─── TAB: OMZET ───
function OmzetTab({ month, data }: { month: string; data: OmzetRow[] }) {
  if (!data || !data.length) return <EmptyState text="Belum ada data omzet" />;

  const tot = data.reduce((s, r) => s + r.total, 0);
  const dHit = data.filter(r => r.pct >= 100).length;
  const best = [...data].sort((a, b) => b.pct - a.pct)[0];
  const avgPct = Math.round(data.reduce((s, r) => s + r.pct, 0) / data.length);

  return (
    <div className="space-y-6">
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory">
        <KpiCard label="Total Omzet" value={fmtRpFull(tot)} sub={`${dHit} hari capai target`} color="var(--primary)" />
        <KpiCard label="Rata-rata Capaian" value={`${avgPct}%`} sub="Dari target harian" color={avgPct >= 100 ? "var(--success)" : "var(--warning)"} />
        <KpiCard label="Kinerja Terbaik" value={`Hari ${best?.d || '-'}`} sub={`Capaian ${best?.pct || 0}%`} color="var(--accent)" />
      </div>
      <div className="card-clinical p-4 lg:p-6 overflow-hidden">
        <h3 className="text-sm font-bold mb-4 font-display">Tren Omzet Harian - {month}</h3>
        <div className="h-[250px] lg:h-[300px] w-full ml-[-15px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
              <XAxis dataKey="d" fontSize={10} tickLine={false} axisLine={false} tickMargin={8} minTickGap={10} />
              <YAxis yAxisId="left" tickFormatter={v => `${v/1000000}M`} fontSize={10} tickLine={false} axisLine={false} dx={-5} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={v => `${v}%`} fontSize={10} tickLine={false} axisLine={false} dx={5} domain={[0, 'dataMax + 20']} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: '1px solid var(--border)', fontSize: '12px', padding: '12px' }}
                formatter={(v: any, n) => [n === 'pct' ? `${v}%` : fmtRpFull(v as number), n === 'total' ? 'Omzet' : 'Capaian']}
                labelFormatter={l => `Tanggal ${l}`}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} iconType="circle" />
              <Bar yAxisId="left" dataKey="total" fill="var(--primary)" name="Total Omzet" radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Line yAxisId="right" type="monotone" dataKey="pct" stroke="var(--warning)" name="% Capaian" strokeWidth={2} dot={{ r: 3, fill: "var(--warning)" }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ─── TAB: KUNJUNGAN ───
function KunjunganTab({ month, data }: { month: string; data: KunjunganRow[] }) {
  if (!data || !data.length) return <EmptyState text="Belum ada data kunjungan" />;

  const tot = data.reduce((s, r) => s + r.total, 0);
  const murni = data.reduce((s, r) => s + (r.murni || 0), 0);
  const pctMurni = tot > 0 ? Math.round((murni / tot) * 100) : 0;
  
  return (
    <div className="space-y-6">
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory">
        <KpiCard label="Total Pasien" value={`${tot}`} sub="Kunjungan bulan ini" color="var(--primary)" />
        <KpiCard label="Pasien Murni" value={`${murni}`} sub={`${pctMurni}% dari total`} color="var(--success)" />
      </div>
      <div className="card-clinical p-4 lg:p-6 overflow-hidden">
        <h3 className="text-sm font-bold mb-4 font-display">Tren Kunjungan - {month}</h3>
        <div className="h-[250px] lg:h-[300px] w-full ml-[-15px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
              <XAxis dataKey="d" fontSize={10} tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis fontSize={10} tickLine={false} axisLine={false} dx={-5} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid var(--border)', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <Line type="monotone
