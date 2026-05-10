import { useMemo, useState } from 'react';
import { useQCStore } from '@/hooks/use-qc-store';
import { getOverallStatus } from '@/lib/westgard';
import type { WestgardStatus } from '@/lib/types';
import { Activity, CheckCircle, AlertTriangle, XCircle, Wifi, WifiOff, FlaskConical, ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { QCRecordCard, DashboardSkeleton } from '@/features/qc/components';
import { cn } from '@/lib/utils';

interface StatChip {
  label: string;
  value: string | number;
  icon: typeof Activity;
  colorClass: string;
  bgClass: string;
}

export default function Dashboard() {
  const { records, loading, connected } = useQCStore();
  const [statusFilter, setStatusFilter] = useState<'all' | 'ok' | 'warning' | 'oos'>('all');
  const [showFiltered, setShowFiltered] = useState(false);

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const todayKey = `${monthKey}-${String(now.getDate()).padStart(2, '0')}`;

  const monthRecords = useMemo(() => records.filter((r) => r.tanggal.startsWith(monthKey)), [records, monthKey]);
  const todayRecords = useMemo(
    () =>
      records
        .filter((r) => r.tanggal === todayKey)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [records, todayKey],
  );

  // Filtered today's records based on status filter
  const filteredTodayRecords = useMemo(() => {
    if (statusFilter === 'all') return todayRecords;
    return todayRecords.filter((r) => {
      const statuses = Object.values(r.status).filter(Boolean) as WestgardStatus[];
      return getOverallStatus(statuses) === statusFilter;
    });
  }, [todayRecords, statusFilter]);

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
      // Toggle off if clicking same filter
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
      <div>
        <h1 className="text-xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Ringkasan QC bulan ini</p>
      </div>

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
                  {statusFilter === 'warning' && `Peringatan Hari Ini (${filteredTodayRecords.length})`}
                  {statusFilter === 'oos' && `Diluar Kontrol Hari Ini (${filteredTodayRecords.length})`}
                  {statusFilter === 'ok' && `In-Control Hari Ini (${filteredTodayRecords.length})`}
                </h3>
              </div>
              <button
                onClick={() => setShowFiltered(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronUp size={16} />
              </button>
            </div>
            {filteredTodayRecords.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Tidak ada data dengan status ini hari ini
              </p>
            ) : (
              <div className="space-y-2">
                {filteredTodayRecords.map((record) => (
                  <QCRecordCard key={record.id} record={record} />
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Today's QC */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Status QC Hari Ini</h2>
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
        {todayRecords.length === 0 ? (
          <Card className="p-8 text-center">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <FlaskConical size={20} />
              </div>
              <p className="text-sm font-medium">Belum ada data QC hari ini</p>
              <p className="text-xs">Tap tombol + untuk mulai input QC harian</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-2.5">
            {todayRecords.map((record) => (
              <QCRecordCard key={record.id} record={record} />
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
