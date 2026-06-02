import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { MaintenanceStatusBadge } from '@/features/maintenance/components/MaintenanceStatusBadge';
import { MAINTENANCE_TEMPLATES, ALAT_LABELS, TIPE_LABELS } from '@/features/maintenance/lib/constants';
import { useMaintenanceStore } from '@/hooks/use-maintenance-store';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { MaintenanceAlat, MaintenanceTipe } from '@/lib/maintenance-types';

const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const DAYS_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export default function MaintenanceSchedule() {
  const navigate = useNavigate();
  const { records } = useMaintenanceStore();

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const days = useMemo(() => {
    const result: { day: number; date: string; isToday: boolean; isWeekend: boolean }[] = [];
    const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();

    for (let d = 1; d <= lastDay; d++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const date = new Date(currentYear, currentMonth, d);
      result.push({
        day: d,
        date: dateStr,
        isToday: dateStr === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
      });
    }

    // Pad beginning with nulls for alignment
    const padStart = Array(firstDayOfWeek).fill(null);
    return [...padStart, ...result];
  }, [currentMonth, currentYear]);

  const dailyAlat = useMemo(
    () =>
      MAINTENANCE_TEMPLATES.filter((t) => t.tipe === 'daily').map((t) => ({
        alat: t.alat,
        nama: t.nama,
      })),
    [],
  );

  const getRecordForDate = (alat: MaintenanceAlat, date: string, tipe: MaintenanceTipe) => {
    return records.find((r) => r.alat === alat && r.tanggal === date && r.tipe === tipe);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate('/maintenance')} className="text-muted-foreground">
          <ChevronLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold">Jadwal Maintenance</h1>
          <p className="text-sm text-muted-foreground">
            {MONTHS_ID[currentMonth]} {currentYear}
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-green-100 border border-green-200" />
          Selesai
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-100 border border-red-200" />
          Terlambat
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-muted border border-border" />
          Belum
        </div>
      </div>

      {/* Per-alat calendar */}
      {dailyAlat.map(({ alat, nama }) => (
        <Card key={alat} className="p-4">
          <h3 className="font-bold text-sm mb-3">{nama} — Harian</h3>
          <div className="grid grid-cols-7 gap-1">
            {DAYS_ID.map((d) => (
              <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1">
                {d}
              </div>
            ))}
            {days.map((day, idx) => {
              if (!day) return <div key={`pad-${idx}`} />;

              const record = getRecordForDate(alat as MaintenanceAlat, day.date, 'daily');
              const status = record
                ? 'done'
                : day.isToday
                ? 'pending'
                : day.date < `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
                ? 'overdue'
                : 'pending';

              return (
                <div
                  key={day.date}
                  className={`text-center py-2 rounded text-[10px] font-mono-data ${
                    day.isToday ? 'ring-1 ring-accent' : ''
                  } ${
                    status === 'done'
                      ? 'bg-green-50 text-green-700'
                      : status === 'overdue'
                      ? 'bg-red-50 text-red-700'
                      : day.isWeekend
                      ? 'bg-muted/30 text-muted-foreground/50'
                      : 'bg-muted/30 text-muted-foreground'
                  } ${day.isWeekend ? 'opacity-50' : ''}`}
                >
                  {day.day}
                </div>
              );
            })}
          </div>
        </Card>
      ))}

      {/* Weekly/monthly schedule table */}
      <Card className="p-4">
        <h3 className="font-bold text-sm mb-3">Jadwal Mingguan & Bulanan</h3>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 font-semibold text-muted-foreground">Alat</th>
              <th className="text-left py-2 font-semibold text-muted-foreground">Tipe</th>
              <th className="text-left py-2 font-semibold text-muted-foreground">Frekuensi</th>
              <th className="text-left py-2 font-semibold text-muted-foreground">Status Bulan Ini</th>
            </tr>
          </thead>
          <tbody>
            {MAINTENANCE_TEMPLATES.filter((t) => t.tipe !== 'daily' && t.tipe !== 'as_needed').map(
              (tpl) => {
                const monthlyRecords = records.filter(
                  (r) =>
                    r.alat === tpl.alat &&
                    r.tipe === tpl.tipe &&
                    r.tanggal.startsWith(`${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`),
                );
                const done = monthlyRecords.length > 0 && monthlyRecords.some((r) =>
                  Object.values(r.aktivitas).some(Boolean),
                );

                return (
                  <tr key={`${tpl.alat}-${tpl.tipe}`} className="border-b border-border">
                    <td className="py-2 font-medium">{ALAT_LABELS[tpl.alat]}</td>
                    <td className="py-2">{TIPE_LABELS[tpl.tipe]}</td>
                    <td className="py-2 text-muted-foreground">
                      {tpl.tipe === 'weekly' ? '1x / minggu' : '1x / bulan'}
                    </td>
                    <td className="py-2">
                      <MaintenanceStatusBadge
                        status={done ? 'done' : new Date().getDate() > 7 ? 'overdue' : 'pending'}
                      />
                    </td>
                  </tr>
                );
              },
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
