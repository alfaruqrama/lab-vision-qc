import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MaintenanceStatusBadge } from '@/features/maintenance/components/MaintenanceStatusBadge';
import { DashboardSkeleton } from '@/features/maintenance/components/DashboardSkeleton';
import { MAINTENANCE_TEMPLATES } from '@/features/maintenance/lib/constants';
import { useMaintenanceStore } from '@/hooks/use-maintenance-store';
import { ClipboardCheck, ChevronRight } from 'lucide-react';
import type { MaintenanceRecord, MaintenanceTipe } from '@/lib/maintenance-types';

function getToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getThisWeekRange(): { start: string; end: string } {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  };
}

function getStatus(
  records: MaintenanceRecord[],
  alat: string,
  tipe: MaintenanceTipe,
): 'done' | 'overdue' | 'pending' {
  const today = getToday();
  const todayRecords = records.filter((r) => r.alat === alat && r.tipe === tipe && r.tanggal === today);

  if (todayRecords.length > 0 && todayRecords.some((r) => Object.values(r.aktivitas).some(Boolean))) {
    return 'done';
  }

  if (tipe === 'daily') {
    // Daily — overdue if not done today
    const now = new Date();
    if (now.getHours() >= 10) return 'overdue';
    return 'pending';
  }

  if (tipe === 'weekly') {
    const { end } = getThisWeekRange();
    if (today > end) return 'overdue';
    return 'pending';
  }

  if (tipe === 'monthly') {
    const lastDay = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
    if (today > lastDay.toISOString().slice(0, 10)) return 'overdue';
    return 'pending';
  }

  return 'pending';
}

export default function MaintenanceDashboard() {
  const navigate = useNavigate();
  const { records, loading } = useMaintenanceStore();

  const alatList = useMemo(() => {
    const alatSet = new Set(MAINTENANCE_TEMPLATES.map((t) => t.alat));
    return Array.from(alatSet).map((alat) => {
      const templates = MAINTENANCE_TEMPLATES.filter((t) => t.alat === alat);
      return {
        alat,
        nama: templates[0].nama,
        tipeSet: new Set(templates.map((t) => t.tipe)),
      };
    });
  }, []);

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Dashboard Maintenance</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {records.length} record — {alatList.length} alat terpantau
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {alatList.map(({ alat, nama, tipeSet }) => (
          <Card key={alat} className="p-5">
            <h3 className="font-bold text-sm mb-3">{nama}</h3>

            <div className="space-y-2 mb-4">
              {tipeSet.has('daily') && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Harian</span>
                  <MaintenanceStatusBadge status={getStatus(records, alat, 'daily')} />
                </div>
              )}
              {tipeSet.has('weekly') && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Mingguan</span>
                  <MaintenanceStatusBadge status={getStatus(records, alat, 'weekly')} />
                </div>
              )}
              {tipeSet.has('monthly') && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Bulanan</span>
                  <MaintenanceStatusBadge status={getStatus(records, alat, 'monthly')} />
                </div>
              )}
              {tipeSet.has('as_needed') && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Insidental</span>
                  <span className="text-[10px] text-muted-foreground">
                    {records.filter((r) => r.alat === alat && r.tipe === 'as_needed').length} kali
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-8 text-xs"
                onClick={() => navigate(`/maintenance/harian?alat=${alat}`)}
              >
                <ClipboardCheck size={14} className="mr-1" />
                Checklist
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => navigate(`/maintenance/history?alat=${alat}`)}
              >
                Riwayat
                <ChevronRight size={14} className="ml-1" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {alatList.length === 0 && (
        <Card className="p-8 text-center">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <ClipboardCheck size={20} />
            <p className="text-sm font-medium">Belum ada data maintenance</p>
            <p className="text-xs">Tap tombol + untuk mulai isi checklist</p>
          </div>
        </Card>
      )}
    </div>
  );
}
