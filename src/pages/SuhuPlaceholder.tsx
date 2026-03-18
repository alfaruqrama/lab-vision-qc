import { Thermometer } from 'lucide-react';

export default function SuhuPlaceholder() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Monitor Suhu Lab</h1>
        <p className="text-sm text-muted-foreground">Pantau suhu ruang lab, kulkas reagen, freezer, dan bank darah</p>
      </div>
      <div className="card-clinical p-12 flex flex-col items-center justify-center text-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-accent2/10 flex items-center justify-center">
          <Thermometer size={28} className="text-accent2" />
        </div>
        <h2 className="font-bold text-lg">Monitor Suhu</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Modul ini akan menampilkan monitoring suhu real-time untuk ruang lab, kulkas reagen, freezer, dan bank darah.
          Fitur ini sedang dalam pengembangan.
        </p>
        <span className="text-[10px] px-3 py-1 rounded-full bg-warning/10 text-warning font-medium">Segera Hadir</span>
      </div>
    </div>
  );
}
