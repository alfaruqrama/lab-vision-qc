import { BarChart3 } from 'lucide-react';

export default function KunjunganPlaceholder() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Dashboard Kunjungan</h1>
        <p className="text-sm text-muted-foreground">Omzet harian, kunjungan RJ/RI/IGD/MCU, dan laporan bulanan</p>
      </div>
      <div className="card-clinical p-12 flex flex-col items-center justify-center text-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center">
          <BarChart3 size={28} className="text-accent" />
        </div>
        <h2 className="font-bold text-lg">Modul Kunjungan</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Modul ini akan menampilkan dashboard kunjungan lengkap dengan tab Omzet, Kunjungan, MCU, dan Laporan.
          Fitur ini sedang dalam pengembangan.
        </p>
        <span className="text-[10px] px-3 py-1 rounded-full bg-warning/10 text-warning font-medium">Segera Hadir</span>
      </div>
    </div>
  );
}
