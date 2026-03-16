import { useMemo } from 'react';
import { useQCStore } from '@/hooks/use-qc-store';
import { getOverallStatus } from '@/lib/westgard';
import type { WestgardStatus, ParamName } from '@/lib/types';
import { Activity, CheckCircle, AlertTriangle, XCircle, Wifi, WifiOff } from 'lucide-react';

function StatusPill({ status }: { status: WestgardStatus }) {
  const cls = status === 'ok' ? 'status-ok' : status === 'warning' ? 'status-warning' : 'status-oos';
  const label = status === 'ok' ? 'OK' : status === 'warning' ? 'Peringatan' : 'Diluar Kendali';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{label}</span>;
}

export default function Dashboard() {
  const { records, loading, connected } = useQCStore();

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const todayKey = `${monthKey}-${String(now.getDate()).padStart(2, '0')}`;

  const monthRecords = useMemo(() => records.filter(r => r.tanggal.startsWith(monthKey)), [records, monthKey]);
  const todayRecords = useMemo(() => records.filter(r => r.tanggal === todayKey), [records, todayKey]);

  const stats = useMemo(() => {
    let ok = 0, warn = 0, oos = 0;
    monthRecords.forEach(r => {
      const statuses = Object.values(r.status).filter(Boolean) as WestgardStatus[];
      const overall = getOverallStatus(statuses);
      if (overall === 'ok') ok++;
      else if (overall === 'warning') warn++;
      else oos++;
    });
    return { total: monthRecords.length, ok, warn, oos };
  }, [monthRecords]);

  const statChips = [
    { label: 'Total QC', value: stats.total, icon: Activity, color: 'text-primary' },
    { label: 'In-Control', value: `${stats.ok} (${stats.total ? Math.round(stats.ok / stats.total * 100) : 0}%)`, icon: CheckCircle, color: 'text-success' },
    { label: 'Peringatan', value: stats.warn, icon: AlertTriangle, color: 'text-warning' },
    { label: 'Diluar Kendali', value: stats.oos, icon: XCircle, color: 'text-destructive' },
  ];

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-pulse-ai text-muted-foreground">Memuat data...</div></div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Ringkasan QC bulan ini</p>
      </div>

      {/* Stat chips - horizontal scroll on mobile */}
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 md:grid md:grid-cols-4">
        {statChips.map((chip) => (
          <div key={chip.label} className="card-clinical flex-shrink-0 min-w-[140px] p-3 md:min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <chip.icon size={16} className={chip.color} />
              <span className="text-xs text-muted-foreground">{chip.label}</span>
            </div>
            <p className={`text-lg font-bold font-mono-data ${chip.color}`}>{chip.value}</p>
          </div>
        ))}
      </div>

      {/* Today's QC */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">Status QC Hari Ini</h2>
        {todayRecords.length === 0 ? (
          <div className="card-clinical p-6 text-center text-sm text-muted-foreground">
            Belum ada data QC hari ini
          </div>
        ) : (
          <div className="space-y-2">
            {todayRecords.map((record) => {
              const params = Object.entries(record.params).filter(([, v]) => v != null) as [ParamName, number][];
              const overallStatus = getOverallStatus(Object.values(record.status).filter(Boolean) as WestgardStatus[]);
              return (
                <div key={record.id} className="card-clinical p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-sm font-semibold">{record.alat === 'CA660' ? 'Sysmex CA-660' : 'Easylite'}</span>
                      <span className="text-xs text-muted-foreground ml-2">{record.level}</span>
                    </div>
                    <StatusPill status={overallStatus} />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {params.map(([name, value]) => (
                      <div key={name} className="text-center">
                        <p className="text-[10px] text-muted-foreground">{name}</p>
                        <p className="font-mono-data text-sm font-semibold">{value}</p>
                        <StatusPill status={record.status[name] || 'ok'} />
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">Analis: {record.analis}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Connection status */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center pt-2">
        {connected ? (
          <><Wifi size={12} className="text-success" /> Terhubung ke Google Sheets</>
        ) : (
          <><WifiOff size={12} /> Mode Demo — data lokal</>
        )}
      </div>
    </div>
  );
}
