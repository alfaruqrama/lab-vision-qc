import { badgeClass } from '@/lib/kunjungan-types';

export function KpiCard({ label, value, sub, color }: {
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="card-clinical flex-shrink-0 min-w-[150px] p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl" style={{ background: color }} />
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground font-mono-data mb-2">{label}</p>
      <p className="text-lg font-bold font-display" style={{ color }}>{value}</p>
      <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>
    </div>
  );
}

export function PctBadge({ pct }: { pct: number }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeClass(pct)}`}>
      {pct}%
    </span>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="card-clinical p-12 text-center text-muted-foreground">
      <p className="text-3xl mb-3">📊</p>
      <p className="font-semibold">{text}</p>
    </div>
  );
}
