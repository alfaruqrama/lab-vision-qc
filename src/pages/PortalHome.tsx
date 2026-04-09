import { useNavigate } from 'react-router-dom';
import { BarChart3, Thermometer, FlaskConical, Shield, Users } from 'lucide-react';
import { useQCStore } from '@/hooks/use-qc-store';
import { useAuth } from '@/hooks/use-auth';
import { useMemo } from 'react';
import { getOverallStatus } from '@/lib/westgard';
import type { WestgardStatus } from '@/lib/types';

const DAYS_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function formatTodayID() {
  const d = new Date();
  return `${DAYS_ID[d.getDay()]}, ${d.getDate()} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;
}

export default function PortalHome() {
  const navigate = useNavigate();
  const { records, connected } = useQCStore();
  const { user, canAccess } = useAuth();

  const todayKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const qcToday = useMemo(() => records.filter(r => r.tanggal === todayKey), [records, todayKey]);
  const lastStatus = useMemo(() => {
    if (records.length === 0) return null;
    const last = records[records.length - 1];
    return getOverallStatus(Object.values(last.status).filter(Boolean) as WestgardStatus[]);
  }, [records]);

  const modules = [
    {
      title: 'Dashboard Kunjungan',
      desc: 'Omzet harian, kunjungan RJ/RI/IGD/MCU, dan laporan bulanan',
      icon: BarChart3,
      path: '/kunjungan',
      colorClass: 'bg-accent text-accent-foreground',
      badge: connected ? { label: 'LIVE · Google Sheets', live: true } : { label: 'OFFLINE', live: false },
      chips: ['Total Kunjungan', 'Omzet Harian', '% Target'],
      visible: canAccess('dashboard'),
    },
    {
      title: 'Monitor Suhu Lab',
      desc: 'Pantau suhu ruang lab, kulkas reagen, freezer, dan bank darah',
      icon: Thermometer,
      path: '/suhu',
      colorClass: 'bg-accent2 text-accent2-foreground',
      badge: { label: 'DUMMY DATA', live: false },
      chips: ['6 Ruangan', '1 Alert'],
      visible: canAccess('suhu'),
    },
    {
      title: 'Lab QC',
      desc: 'Input QC harian, grafik Levey-Jennings, dan laporan bulanan',
      icon: FlaskConical,
      path: '/qc',
      colorClass: 'bg-accent text-accent-foreground',
      badge: connected ? { label: 'LIVE · Google Sheets', live: true } : { label: 'OFFLINE', live: false },
      chips: [
        `${qcToday.length} run hari ini`,
        lastStatus ? (lastStatus === 'ok' ? '✓ Pass' : lastStatus === 'warning' ? '⚠ Warning' : '✕ Fail') : 'Belum ada data',
      ],
      visible: canAccess('qc'),
    },
    {
      title: 'Kelola User',
      desc: 'Manajemen user dan hak akses sistem',
      icon: Users,
      path: '/admin/users',
      colorClass: 'bg-red-50 text-red-700',
      badge: { label: 'ADMIN ONLY', live: false },
      chips: ['User Management', 'Role & Access'],
      visible: canAccess('admin-users'),
    },
  ].filter(mod => mod.visible);

  return (
    <div className="grid-bg min-h-[calc(100vh-3.5rem)]">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Selamat datang, {user?.nama || 'User'}</h1>
          <h2 className="text-xl md:text-2xl font-display font-bold text-accent">{formatTodayID()}</h2>
          <p className="text-sm text-muted-foreground mt-1">Pilih modul untuk mulai bekerja</p>
        </div>

        {/* Module cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {modules.map((mod) => (
            <button
              key={mod.path}
              onClick={() => navigate(mod.path)}
              className="card-clinical p-5 text-left group hover:shadow-md hover:ring-1 hover:ring-accent transition-all duration-200 hover:scale-[1.01]"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl ${mod.colorClass} flex items-center justify-center shrink-0`}>
                  <mod.icon size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-sm">{mod.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{mod.desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <span className={`w-1.5 h-1.5 rounded-full ${mod.badge.live ? 'bg-success animate-pulse-dot' : 'bg-muted-foreground/40'}`} />
                <span className="text-[10px] font-medium text-muted-foreground">{mod.badge.label}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {mod.chips.map((chip) => (
                  <span key={chip} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">{chip}</span>
                ))}
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="card-clinical p-4 flex items-center gap-3 text-xs text-muted-foreground">
          <Shield size={14} className="shrink-0" />
          <div className="flex-1">
            <span className="font-medium">Portal Lab Internal v1.0 · RS Petrokimia Gresik · 2026</span>
            <span className="block text-[10px]">Data internal rumah sakit — tidak untuk publik</span>
          </div>
          <span className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/60">Developed by RAMA</span>
        </div>
      </div>
    </div>
  );
}
