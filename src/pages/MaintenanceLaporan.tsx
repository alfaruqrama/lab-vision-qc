import { useState, useMemo, useEffect, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MAINTENANCE_TEMPLATES, ALAT_LABELS, TIPE_LABELS } from '@/features/maintenance/lib/constants';
import { useMaintenanceStore } from '@/hooks/use-maintenance-store';
import { useAuth } from '@/hooks/use-auth';
import { getUsers } from '@/lib/auth-api';
import type { User } from '@/lib/auth-types';
import { ChevronLeft, Printer } from 'lucide-react';
import type { MaintenanceAlat, MaintenanceTipe, MaintenanceRecord } from '@/lib/maintenance-types';

const KA_LAB_NAME = 'MARLINA SETYA DEWI';
const REPORT_TYPES: MaintenanceTipe[] = ['daily', 'weekly', 'monthly'];

function getMonthOptions() {
  const now = new Date();
  const options: { value: string; label: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('id-ID', { year: 'numeric', month: 'long' }),
    });
  }
  return options;
}

function daysInMonth(bulan: string): number {
  const [y, m] = bulan.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

function dayLabels(bulan: string): string[] {
  const n = daysInMonth(bulan);
  return Array.from({ length: n }, (_, i) => String(i + 1));
}

const BULAN_LABELS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

interface MatrixData {
  tipe: MaintenanceTipe;
  label: string;
  aktivitas: string[];
  days: string[];
  cells: Record<string, Record<string, boolean>>;
}

function buildMatrix(
  records: MaintenanceRecord[],
  alat: string,
  tipe: MaintenanceTipe,
  bulan: string,
  aktivitas: string[],
): MatrixData {
  const days = dayLabels(bulan);
  const cells: Record<string, Record<string, boolean>> = {};
  for (const act of aktivitas) {
    cells[act] = {};
    for (const day of days) cells[act][day] = false;
  }
  const filtered = records.filter(
    (r) => r.alat === alat && r.tipe === tipe && r.tanggal.startsWith(bulan),
  );
  for (const rec of filtered) {
    const day = String(new Date(rec.tanggal + 'T00:00:00').getDate());
    for (const act of aktivitas) {
      if (rec.aktivitas[act]) cells[act][day] = true;
    }
  }
  return { tipe, label: TIPE_LABELS[tipe], aktivitas, days, cells };
}

export default function MaintenanceLaporan() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { records, loading } = useMaintenanceStore();
  const monthOptions = useMemo(() => getMonthOptions(), []);

  const [selectedAlat, setSelectedAlat] = useState<MaintenanceAlat>('BC6800');
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0]?.value || '2026-06');

  // TTD fields
  const [picAlat, setPicAlat] = useState('');
  const [kaLab, setKaLab] = useState(KA_LAB_NAME);

  // User list for PIC dropdown
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const picUsers = useMemo(
    () => users.filter((u) => u.nama.toUpperCase() !== KA_LAB_NAME.toUpperCase()),
    [users],
  );

  useEffect(() => {
    if (!user?.token) return;
    setLoadingUsers(true);
    getUsers(user.token)
      .then(setUsers)
      .catch(() => {})
      .finally(() => setLoadingUsers(false));
  }, [user?.token]);

  // Build matrices
  const matrices = useMemo(() => {
    return REPORT_TYPES
      .map((tipe) => {
        const template = MAINTENANCE_TEMPLATES.find((t) => t.alat === selectedAlat && t.tipe === tipe);
        if (!template) return null;
        return buildMatrix(records, selectedAlat, tipe, selectedMonth, template.aktivitas);
      })
      .filter(Boolean) as MatrixData[];
  }, [records, selectedAlat, selectedMonth]);

  const allDays = matrices.length > 0 ? matrices[0].days : [];

  const handlePrint = () => window.print();

  const [year, monthNum] = selectedMonth.split('-').map(Number);
  const monthLabel = `${BULAN_LABELS[monthNum - 1]} ${year}`;

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">Laporan Checklist</h1>
        <Card className="p-8 text-center text-muted-foreground">Memuat data...</Card>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #laporan-content,
          #laporan-content * { visibility: visible; }
          #laporan-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0;
            margin: 0;
          }
          #laporan-content .no-print { display: none !important; }
          #laporan-content .overflow-x-auto { overflow: visible !important; }
          #laporan-content table { font-size: 7px !important; }
          @page { margin: 8mm; size: landscape; }
        }
      `}</style>

      <div className="space-y-6" id="laporan-content">
        {/* Header */}
        <div className="flex items-center gap-2 no-print">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/maintenance')}>
            <ChevronLeft size={18} />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Laporan Checklist</h1>
            <p className="text-sm text-muted-foreground">{ALAT_LABELS[selectedAlat]}</p>
          </div>
        </div>

        {/* Selectors + PIC/KA */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 no-print">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Alat</label>
            <select
              value={selectedAlat}
              onChange={(e) => setSelectedAlat(e.target.value as MaintenanceAlat)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {(['BC6800', 'BC760', 'CA500600', 'EasyLyte'] as MaintenanceAlat[]).map((a) => (
                <option key={a} value={a}>{ALAT_LABELS[a]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Bulan</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {monthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">PIC Alat</label>
            <Select value={picAlat} onValueChange={setPicAlat} disabled={loadingUsers}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Pilih PIC..." />
              </SelectTrigger>
              <SelectContent>
                {picUsers.map((u) => (
                  <SelectItem key={u.username} value={u.nama}>{u.nama}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">KA Lab</label>
            <Input
              value={kaLab}
              onChange={(e) => setKaLab(e.target.value)}
              className="h-9 text-sm"
              placeholder="Nama KA Lab..."
            />
          </div>
        </div>

        {matrices.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            <p>Tidak ada template checklist untuk {ALAT_LABELS[selectedAlat]}.</p>
          </Card>
        ) : (
          <>
            {/* Compact table — 3 tipe dalam 1 tabel */}
            <Card className="p-4 overflow-hidden">
              {/* Print title */}
              <div className="hidden print:block mb-2 text-center">
                <h3 className="text-sm font-bold">LAPORAN CHECKLIST — {ALAT_LABELS[selectedAlat]}</h3>
                <p className="text-xs text-muted-foreground">{monthLabel}</p>
              </div>

              <div className="flex items-center justify-between mb-3 no-print">
                <h3 className="text-sm font-bold">{ALAT_LABELS[selectedAlat]} — {monthLabel}</h3>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handlePrint}>
                  <Printer size={14} className="mr-1" /> Cetak
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table
                  className="w-full text-[10px] font-mono-data border-collapse"
                  style={{ minWidth: allDays.length * 26 + 180 }}
                >
                  <thead>
                    <tr className="bg-muted">
                      <th
                        className="sticky left-0 bg-muted text-left px-2 py-1.5 text-[10px] font-semibold border border-border"
                        style={{ minWidth: 170 }}
                      >
                        AKTIVITAS
                      </th>
                      {allDays.map((day) => (
                        <th
                          key={day}
                          className="text-center px-0 py-1.5 text-[10px] font-semibold border border-border"
                          style={{ width: 26 }}
                        >
                          {day}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrices.map((m, mi) => (
                      // Fragment per tipe — header row + activity rows
                      <Fragment key={m.tipe}>
                        {/* Section header */}
                        <tr className="bg-muted/40">
                          <td
                            colSpan={allDays.length + 1}
                            className="px-2 py-1 border border-border text-[10px] font-bold text-muted-foreground uppercase tracking-wider"
                          >
                            {m.label}
                          </td>
                        </tr>
                        {m.aktivitas.map((act) => {
                          return (
                            <tr key={act} className="hover:bg-muted/20">
                              <td
                                className="sticky left-0 bg-background hover:bg-muted/20 px-2 py-0.5 border border-border/50 text-[10px] whitespace-nowrap pl-4"
                              >
                                {act}
                              </td>
                              {m.days.map((day) => {
                                const checked = m.cells[act]?.[day];
                                return (
                                  <td
                                    key={day}
                                    className={`text-center border border-border/30 ${
                                      checked
                                        ? 'bg-emerald-100 text-emerald-700 font-bold'
                                        : 'text-muted-foreground/25'
                                    }`}
                                  >
                                    {checked ? '✓' : '—'}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* TTD */}
            <Card className="p-5">
              <div className="grid grid-cols-2 gap-8">
                <div className="text-center">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    PIC Alat
                  </p>
                  <div className="h-20" />
                  <div className="border-t border-border pt-2">
                    <p className="text-sm font-medium">{picAlat || '_________________'}</p>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    KA Lab
                  </p>
                  <div className="h-20" />
                  <div className="border-t border-border pt-2">
                    <p className="text-sm font-medium">{kaLab || '_________________'}</p>
                  </div>
                </div>
              </div>
            </Card>
          </>
        )}
      </div>
    </>
  );
}
