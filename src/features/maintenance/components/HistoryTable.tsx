import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MaintenanceStatusBadge } from './MaintenanceStatusBadge';
import { ALAT_LABELS, TIPE_LABELS } from '@/features/maintenance/lib/constants';
import type { MaintenanceRecord } from '@/lib/maintenance-types';
import { Trash2, CheckCircle, XCircle } from 'lucide-react';

interface Props {
  records: MaintenanceRecord[];
  onDelete?: (id: string) => void;
  onViewDetail?: (record: MaintenanceRecord) => void;
}

export function HistoryTable({ records, onDelete, onViewDetail }: Props) {
  const sorted = useMemo(
    () => [...records].sort((a, b) => b.tanggal.localeCompare(a.tanggal)),
    [records],
  );

  if (sorted.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        <p className="text-sm font-medium">Belum ada riwayat maintenance</p>
        <p className="text-xs mt-1">Data akan muncul setelah checklist diisi</p>
      </Card>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground">Tanggal</th>
            <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground">Alat</th>
            <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground">Tipe</th>
            <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground">Status</th>
            <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground">Petugas</th>
            <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const aktivitasList = Object.entries(r.aktivitas);
            const done = aktivitasList.filter(([, v]) => v).length;
            const total = aktivitasList.length;
            const complete = total > 0 && done === total;

            return (
              <tr
                key={r.id}
                className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => onViewDetail?.(r)}
              >
                <td className="px-3 py-2.5 font-mono-data text-xs whitespace-nowrap">
                  {new Date(r.tanggal).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </td>
                <td className="px-3 py-2.5 text-xs">{ALAT_LABELS[r.alat] || r.alat}</td>
                <td className="px-3 py-2.5">
                  <Badge variant="outline" className="text-[10px]">
                    {TIPE_LABELS[r.tipe]}
                  </Badge>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1.5">
                    {complete ? (
                      <CheckCircle size={14} className="text-green-600" />
                    ) : (
                      <XCircle size={14} className="text-amber-600" />
                    )}
                    <span className="text-xs text-muted-foreground">
                      {done}/{total}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.petugas}</td>
                <td className="px-3 py-2.5 text-right">
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Hapus data ${r.tanggal} — ${ALAT_LABELS[r.alat]}?`)) {
                          onDelete(r.id);
                        }
                      }}
                    >
                      <Trash2 size={14} />
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
