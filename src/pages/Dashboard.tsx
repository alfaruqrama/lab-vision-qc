import { useMemo, useState } from 'react';
import { useQCStore } from '@/hooks/use-qc-store';
import { getOverallStatus } from '@/lib/westgard';
import type { WestgardStatus } from '@/lib/types';
import { Activity, CheckCircle, AlertTriangle, XCircle, Wifi, WifiOff, FlaskConical, ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { QCRecordCard, DashboardSkeleton, LotExpiryBanner } from '@/features/qc/components';
import { cn } from '@/lib/utils';
import { getAllLotExpiryInfo, getLotConfigHash, LOT_EXPIRY_BANNER_KEY } from '@/lib/lot-expiry';

interface StatChip {
  label: string;
  value: string | number;
  icon: typeof Activity;
  colorClass: string;
  bgClass: string;
}

export default function Dashboard() {
  const { records, loading, connected, config, deleteRecord } = useQCStore();
  const [statusFilter, setStatusFilter] = useState<'all' | 'ok' | 'warning' | 'oos'>('all');
  const [showFiltered, setShowFiltered] = useState(false);

  // Month selector
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
  );
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const isCurrentMonth = selectedMonth === currentMonth;
  const todayKey = `${currentMonth}-${String(now.getDate()).padStart(2, '0')}`;

  const monthOptions = useMemo(() => {
    const options = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('id-ID', { year: 'numeric', month: 'long' });
      options.push({ value, label });
    }
    return options;
  }, [now.getFullYear(), now.getMonth()]);

  // Lot expiry banner
  const configHash = useMemo(() => getLotConfigHash(config), [config]);
  const [dismissedHash, setDismissedHash] = useState<string | null>(
    () => localStorage.getItem(LOT_EXPIRY_BANNER_KEY),
  );
  const lotExpiryInfo = useMemo(() => {
    const all = getAllLotExpiryInfo(config);
    return {
      expired: all.filter((l) => l.status === 'expired'),
      expiringSoon: all.filter((l) => l.status === 'expiring-soon'),
    };
  }, [config]);
  const showBanner =
    (lotExpiryInfo.expired.length > 0 || lotExpiryInfo.expiringSoon.length > 0) &&
    dismissedHash !== configHash;

  function handleDismissBanner() {
    localStorage.setItem(LOT_EXPIRY_BANNER_KEY, configHash);
    setDismissedHash(configHash);
  }

  const monthRecords = useMemo(() => records.filter((r) => r.tanggal.startsWith(selectedMonth)), [records, selectedMonth]);
  const todayRecords = useMemo(
    () =>
      records
        .filter((r) => r.tanggal === todayKey)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [records, todayKey],
  );

  // For past months: show all records sorted desc
  const pastMonthRecords = useMemo(
    () =>
      [...monthRecords].sort((a, b) => {
        // Sort by date desc, then by timestamp desc
        const dateCmp = b.tanggal.localeCompare(a.tanggal);
        if (dateCmp !== 0) return dateCmp;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      }),
    [monthRecords],
  );

  // Filtered records based on status filter
  const filteredRecords = useMemo(() => {
    const source = isCurrentMonth ? todayRecords : pastMonthRecords;
    if (statusFilter === 'all') return source;
    return source.filter((r) => {
      const statuses = Object.values(r.status).filter(Boolean) as WestgardStatus[];
      return getOverallStatus(statuses) === statusFilter;
    });
  }, [isCurrentMonth ? todayRecords : pastMonthRecords, statusFilter, isCurrentMonth]);

  const stats = useMemo(() => {
    let ok = 0,
      warn = 0,
      oos = 0;
    monthRecords.forEach((r) => {
      const statuses = Object.values(r.status).filter(Boolean) as WestgardStatus[];
      const overall = getOverallStatus(statuses);
      if (overall === 'ok') ok++;
      else if (overall === 'warning') warn++;
      else oos++;
    });
    return { total: monthRecords.length, ok, warn, oos };
  }, [monthRecords]);

  const statChips: StatChip[] = [
    {
      label: 'Total QC',
      value: stats.total,
      icon: Activity,
      colorClass: 'text-primary',
      bgClass: 'bg-primary/10',
    },
    {
      label: 'In-Control',
      value: `${stats.ok} (${stats.total ? Math.round((stats.ok / stats.total) * 100) : 0}%)`,
      icon: CheckCircle,
      colorClass: 'text-success',
      bgClass: 'bg-success/10',
    },
    {
      label: 'Peringatan',
      value: stats.warn,
      icon: AlertTriangle,
      colorClass: 'text-warning',
      bgClass: 'bg-warning/10',
    },
    {
      label: 'Diluar Kontrol',
      value: stats.oos,
      icon: XCircle,
      colorClass: 'text-destructive',
      bgClass: 'bg-destructive/10',
    },
  ];

  function handleStatClick(filter: 'all' | 'ok' | 'warning' | 'oos') {
    if (statusFilter === filter) {
      setStatusFilter('all');
      setShowFiltered(false);
    } else {
      setStatusFilter(filter);
      setShowFiltered(true);
    }
  }

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {isCurrentMonth ? 'Ringkasan QC bulan ini' : 'Data QC historis'}
          </p>
        </div>
        <select
          value={selectedMonth}
          onChange={(e) => {
            setSelectedMonth(e.target.value);
            setStatusFilter('all');
            setShowFiltered(false);
          }}
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {monthOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Lot expiry banner */}
      {showBanner && (
        <LotExpiryBanner
          expiredLots={lotExpiryInfo.expired}
          expiringSoonLots={lotExpiryInfo.expiringSoon}
          onDismiss={handleDismissBanner}
        />
      )}

      {/* Stat chips */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statChips.map((chip, idx) => {
          const filterValue: 'all' | 'ok' | 'warning' | 'oos' = 
            idx === 0 ? 'all' : idx === 1 ? 'ok' : idx === 2 ? 'warning' : 'oos';
          const isActive = statusFilter === filterValue;
          
          return (
            <Card
              key={chip.label}
              className={cn(
                'p-3.5 transition-all cursor-pointer',
                isActive ? 'ring-2 ring-offset-2 shadow-md' : 'hover:shadow-md',
                isActive && idx === 0 && 'ring-primary',
                isActive && idx === 1 && 'ring-success',
                isActive && idx === 2 && 'ring-warning',
                isActive && idx === 3 && 'ring-destructive',
              )}
              onClick={() => handleStatClick(filterValue)}
              role="button"
              tabIndex={0}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg', chip.bgClass)}>
                  <chip.icon size={14} className={chip.colorClass} />
                </div>
                <span className="text-xs text-muted-foreground font-medium">{chip.label}</span>
              </div>
              <p className={cn('text-lg font-bold font-mono-data', chip.colorClass)}>{chip.value}</p>
            </Card>
          );
        })}
      </div>

      {/* Filtered results (collapsible) */}
      {showFiltered && statusFilter !== 'all' && (
        <Card className={cn(
          'overflow-hidden transition-all',
          statusFilter === 'warning' && 'border-warning/50 bg-warning/5',
          statusFilter === 'oos' && 'border-destructive/50 bg-destructive/5',
          statusFilter === 'ok' && 'border-success/50 bg-success/5',
        )}>
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {statusFilter === 'warning' && <AlertTriangle size={16} className="text-warning" />}
                {statusFilter === 'oos' && <XCircle size={16} className="text-destructive" />}
                {statusFilter === 'ok' && <CheckCircle size={16} className="text-success" />}
                <h3 className="text-sm font-semibold">
                  {statusFilter === 'warning' && `Peringatan (${filteredRecords.length})`}
                  {statusFilter === 'oos' && `Diluar Kontrol (${filteredRecords.length})`}
                  {statusFilter === 'ok' && `In-Control (${filteredRecords.length})`}
                </h3>
              </div>
              <button
                onClick={() => setShowFiltered(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronUp size={16} />
              </button>
            </div>
            {filteredRecords.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Tidak ada data dengan status ini
              </p>
            ) : (
              <div className="space-y-2">
                {filteredRecords.map((record) => (
                  <QCRecordCard key={record.id} record={record} onDelete={() => deleteRecord(record.id)} />
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Records list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {isCurrentMonth ? 'Status QC Hari Ini' : 'Semua QC Bulan Ini'}
          </h2>
          {statusFilter !== 'all' && (
            <button
              onClick={() => {
                setStatusFilter('all');
                setShowFiltered(false);
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Tampilkan semua
            </button>
          )}
        </div>
        {isCurrentMonth && todayRecords.length === 0 ? (
          <Card className="p-8 text-center">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <FlaskConical size={20} />
              </div>
              <p className="text-sm font-medium">Belum ada data QC hari ini</p>
              <p className="text-xs">Tap tombol + untuk mulai input QC harian</p>
            </div>
          </Card>
        ) : !isCurrentMonth && pastMonthRecords.length === 0 ? (
          <Card className="p-8 text-center">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <FlaskConical size={20} />
              </div>
              <p className="text-sm font-medium">Tidak ada data QC di bulan ini</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-2.5">
            {(isCurrentMonth ? todayRecords : pastMonthRecords).map((record) => (
              <QCRecordCard key={record.id} record={record} onDelete={() => deleteRecord(record.id)} />
            ))}
          </div>
        )}
      </div>

      {/* Connection status */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center pt-2">
        {connected ? (
          <>
            <Wifi size={12} className="text-success" /> Terhubung ke Supabase
          </>
        ) : (
          <>
            <WifiOff size={12} /> Mode Demo — data lokal
          </>
        )}
      </div>
    </div>
  );
}
