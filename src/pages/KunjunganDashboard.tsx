import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ComposedChart
} from 'recharts';
import { ChevronLeft, RefreshCw, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import embeddedRaw from '@/lib/kunjungan-data.json';
import { fetchKunjunganSummary } from '@/lib/api';
import {
  type KunjunganData, type OmzetRow, type KunjunganRow, type McuRow,
  normalizeMonthKeys, sortMonths, fmtRp, fmtRpFull, badgeClass, PAYERS
} from '@/lib/kunjungan-types';

const REFRESH_INTERVAL = 15 * 60; // 15 minutes in seconds

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

function KpiSkeleton() {
  return (
    <div className="card-clinical flex-shrink-0 min-w-[150px] p-4">
      <Skeleton className="h-3 w-20 mb-3" />
      <Skeleton className="h-6 w-24 mb-2" />
      <Skeleton className="h-3 w-16" />
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
function OmzetTab({ month, data, isRefreshing }: { month: string; data: OmzetRow[]; isRefreshing: boolean }) {
  if (!data || !data.length) return <EmptyState text="Belum ada data omzet" />;

  const tot = data.reduce((s, r) => s + r.total, 0);
  const dHit = data.filter(r => r.pct >= 100).length;
  const best = [...data].sort((a, b) => b.pct - a.pct)[0];
  const avgPct = Math.round(data.reduce((s, r) => s + r.pct, 0) / data.length);

  return (
    <div className="space-y-6">
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory">
        {isRefreshing ? (
          <><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /></>
        ) : (
          <>
            <KpiCard label="Total Omzet" value={fmtRpFull(tot)} sub={`${dHit} hari capai target`} color="var(--primary)" />
            <KpiCard label="Rata-rata Capaian" value={`${avgPct}%`} sub="Dari target harian" color={avgPct >= 100 ? "var(--success)" : "var(--warning)"} />
            <KpiCard label="Kinerja Terbaik" value={`Hari ${best?.d || '-'}`} sub={`Capaian ${best?.pct || 0}%`} color="var(--accent)" />
          </>
        )}
      </div>
      <div className="card-clinical p-4 lg:p-6 overflow-hidden">
        <h3 className="text-sm font-bold mb-4 font-display">Tren Omzet Harian - {month}</h3>
        <div className="h-[250px] lg:h-[300px] w-full ml-[-15px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
              <XAxis dataKey="d" fontSize={10} tickLine={false} axisLine={false} tickMargin={8} minTickGap={10} />
              <YAxis yAxisId="left" tickFormatter={v => `${v / 1000000}M`} fontSize={10} tickLine={false} axisLine={false} dx={-5} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={v => `${v}%`} fontSize={10} tickLine={false} axisLine={false} dx={5} domain={[0, 'dataMax + 20']} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: '1px solid var(--border)', fontSize: '12px', padding: '12px' }}
                formatter={(v: any, n: string) => [n === 'pct' ? `${v}%` : fmtRpFull(v as number), n === 'total' ? 'Omzet' : 'Capaian']}
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
function KunjunganTab({ month, data, isRefreshing }: { month: string; data: KunjunganRow[]; isRefreshing: boolean }) {
  if (!data || !data.length) return <EmptyState text="Belum ada data kunjungan" />;

  const tot = data.reduce((s, r) => s + r.total, 0);
  const rj = data.reduce((s, r) => s + (r.rjTotal || 0), 0);
  const ri = data.reduce((s, r) => s + (r.riTotal || 0), 0);
  const igd = data.reduce((s, r) => s + (r.igdTotal || 0), 0);
  const mcu = data.reduce((s, r) => s + (r.mcuTotal || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory">
        {isRefreshing ? (
          <><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /></>
        ) : (
          <>
            <KpiCard label="Total Pasien" value={`${tot}`} sub="Kunjungan bulan ini" color="var(--primary)" />
            <KpiCard label="Rawat Jalan" value={`${rj}`} sub={`${tot > 0 ? Math.round((rj / tot) * 100) : 0}% dari total`} color="var(--success)" />
            <KpiCard label="IGD" value={`${igd}`} sub={`RI: ${ri} · MCU: ${mcu}`} color="var(--warning)" />
          </>
        )}
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
              <Line type="monotone" dataKey="total" stroke="var(--primary)" name="Total" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="rjTotal" stroke="var(--success)" name="RJ" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="riTotal" stroke="var(--warning)" name="RI" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="igdTotal" stroke="var(--destructive)" name="IGD" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ─── TAB: MCU ───
function McuTab({ month, data, isRefreshing }: { month: string; data: McuRow[]; isRefreshing: boolean }) {
  if (!data || !data.length) return <EmptyState text="Belum ada data MCU" />;

  const tot = data.reduce((s, r) => s + r.omzet, 0);
  const daysWithMcu = data.filter(r => r.omzet > 0).length;
  const avg = daysWithMcu > 0 ? Math.round(tot / daysWithMcu) : 0;

  return (
    <div className="space-y-6">
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory">
        {isRefreshing ? (
          <><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /></>
        ) : (
          <>
            <KpiCard label="Total Omzet MCU" value={fmtRpFull(tot)} sub={`${daysWithMcu} hari ada MCU`} color="var(--primary)" />
            <KpiCard label="Rata-rata/Hari" value={fmtRp(avg)} sub="Hari dengan MCU" color="var(--accent)" />
          </>
        )}
      </div>
      <div className="card-clinical p-4 lg:p-6 overflow-hidden">
        <h3 className="text-sm font-bold mb-4 font-display">Omzet MCU Harian - {month}</h3>
        <div className="h-[250px] lg:h-[300px] w-full ml-[-15px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
              <XAxis dataKey="d" fontSize={10} tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis tickFormatter={v => `${v / 1000000}M`} fontSize={10} tickLine={false} axisLine={false} dx={-5} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: '1px solid var(--border)', fontSize: '12px' }}
                formatter={(v: any) => [fmtRpFull(v as number), 'Omzet MCU']}
                labelFormatter={l => `Tanggal ${l}`}
              />
              <Bar dataKey="omzet" fill="var(--accent)" name="Omzet MCU" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ─── TAB: LAPORAN ───
function LaporanTab() {
  return <EmptyState text="Fitur laporan akan segera hadir" />;
}

// ─── HALAMAN UTAMA ───
export default function KunjunganDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabType>('omzet');
  const [data, setData] = useState<KunjunganData>(EMBEDDED);
  const [isConnected, setIsConnected] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const countdownRef = useRef(REFRESH_INTERVAL);

  const months = useMemo(() => {
    const all = new Set([
      ...Object.keys(data.omzet),
      ...Object.keys(data.kunjungan),
      ...Object.keys(data.mcu),
    ]);
    return sortMonths([...all]);
  }, [data]);

  const [selectedMonth, setSelectedMonth] = useState('');

  useEffect(() => {
    if (months.length && !selectedMonth) setSelectedMonth(months[months.length - 1]);
  }, [months, selectedMonth]);

  // ─── FETCH ───
  const fetchSummary = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetchKunjunganSummary();
      if (res && typeof res === 'object') {
        const normalized: KunjunganData = {
          omzet: normalizeMonthKeys(res.omzet || {}),
          kunjungan: normalizeMonthKeys(res.kunjungan || {}),
          mcu: normalizeMonthKeys(res.mcu || {}),
        };
        setData(normalized);
        setIsConnected(true);
      }
    } catch {
      if (isFirstLoad) setData(EMBEDDED);
      setIsConnected(false);
    } finally {
      setIsRefreshing(false);
      setIsFirstLoad(false);
      setLastUpdated(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      countdownRef.current = REFRESH_INTERVAL;
      setCountdown(REFRESH_INTERVAL);
    }
  }, [isFirstLoad]);

  // Initial fetch + polling
  useEffect(() => {
    fetchSummary();
    const interval = setInterval(fetchSummary, REFRESH_INTERVAL * 1000);
    return () => clearInterval(interval);
  }, [fetchSummary]);

  // Visibility API
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') fetchSummary();
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [fetchSummary]);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      countdownRef.current -= 1;
      if (countdownRef.current <= 0) countdownRef.current = REFRESH_INTERVAL;
      setCountdown(countdownRef.current);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleManualRefresh = async () => {
    await fetchSummary();
    toast({ title: '✅ Data berhasil diperbarui' });
  };

  const formatCountdown = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const tabs: { key: TabType; label: string }[] = [
    { key: 'omzet', label: 'Omzet' },
    { key: 'kunjungan', label: 'Kunjungan' },
    { key: 'mcu', label: 'MCU' },
    { key: 'laporan', label: 'Laporan' },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/')} className="p-1.5 rounded-xl hover:bg-muted transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-base font-bold font-display">Dashboard Kunjungan</h1>
                <div className="flex items-center gap-2 mt-0.5">
                  {isRefreshing ? (
                    <span className="text-[10px] font-mono-data text-muted-foreground flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" /> MEMPERBARUI…
                    </span>
                  ) : (
                    <span className={`text-[10px] font-mono-data flex items-center gap-1 ${isConnected ? 'text-success' : 'text-muted-foreground'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`} />
                      {isConnected ? 'REALTIME' : 'EMBEDDED'}
                    </span>
                  )}
                  {lastUpdated && (
                    <span className="text-[10px] font-mono-data text-muted-foreground">· {lastUpdated}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono-data text-muted-foreground hidden sm:flex items-center gap-1">
                <Clock className="w-3 h-3" /> {formatCountdown(countdown)}
              </span>
              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="p-2 rounded-xl hover:bg-muted transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">
        {/* Month selector + Tabs */}
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="text-sm bg-muted border border-border rounded-xl px-3 py-1.5 font-medium"
          >
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <div className="flex gap-1 overflow-x-auto scrollbar-none">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                  tab === t.key
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        {tab === 'omzet' && <OmzetTab month={selectedMonth} data={data.omzet[selectedMonth] || []} isRefreshing={isRefreshing && !isFirstLoad} />}
        {tab === 'kunjungan' && <KunjunganTab month={selectedMonth} data={data.kunjungan[selectedMonth] || []} isRefreshing={isRefreshing && !isFirstLoad} />}
        {tab === 'mcu' && <McuTab month={selectedMonth} data={data.mcu[selectedMonth] || []} isRefreshing={isRefreshing && !isFirstLoad} />}
        {tab === 'laporan' && <LaporanTab />}
      </div>
    </div>
  );
}
