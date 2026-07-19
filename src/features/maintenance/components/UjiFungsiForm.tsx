import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface UjiFungsiRow {
  day: number;
  date: string;
  fungsi: 'baik' | 'rusak' | null;
  petugas: string;
  keterangan: string;
}

interface Props {
  month: string; // YYYY-MM
  initialData?: Record<string, { fungsi: 'baik' | 'rusak' | null; petugas: string; keterangan: string }>;
  onChange?: (rows: UjiFungsiRow[]) => void;
  readOnly?: boolean;
  defaultPetugas?: string;
}

function getDaysInMonth(month: string): { day: number; date: string }[] {
  const [year, m] = month.split('-').map(Number);
  const lastDay = new Date(year, m, 0).getDate();
  const result: { day: number; date: string }[] = [];
  for (let d = 1; d <= lastDay; d++) {
    const dateStr = `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    result.push({ day: d, date: dateStr });
  }
  return result;
}

export function UjiFungsiForm({ month, initialData = {}, onChange, readOnly = false, defaultPetugas = '' }: Props) {
  const days = getDaysInMonth(month);

  const [rows, setRows] = useState<UjiFungsiRow[]>(
    days.map((d) => ({
      day: d.day,
      date: d.date,
      fungsi: initialData[d.date]?.fungsi ?? null,
      petugas: initialData[d.date]?.petugas || defaultPetugas,
      keterangan: initialData[d.date]?.keterangan ?? '',
    })),
  );

  useEffect(() => {
    setRows(
      days.map((d) => ({
        day: d.day,
        date: d.date,
        fungsi: initialData[d.date]?.fungsi ?? null,
        petugas: initialData[d.date]?.petugas || defaultPetugas,
        keterangan: initialData[d.date]?.keterangan ?? '',
      })),
    );
  }, [month, initialData, defaultPetugas]);

  const updateRow = (idx: number, patch: Partial<UjiFungsiRow>) => {
    const next = rows.map((row, i) => (i === idx ? { ...row, ...patch } : row));
    setRows(next);
    onChange?.(next);
  };

  const done = rows.filter((r) => r.fungsi).length;
  const total = rows.length;

  const MONTHS_ID = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];
  const [year, m] = month.split('-').map(Number);
  const monthLabel = `${MONTHS_ID[m - 1]} ${year}`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold">{monthLabel}</h4>
        <span className="text-xs text-muted-foreground">
          {done}/{total} hari terisi
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-2 py-2 text-xs font-semibold text-muted-foreground w-14">
                Tgl
              </th>
              <th className="text-center px-2 py-2 text-xs font-semibold text-muted-foreground w-28">
                Uji Fungsi
                <div className="flex justify-center gap-3 mt-0.5">
                  <span className="text-[10px] text-green-600 font-normal">Baik</span>
                  <span className="text-[10px] text-red-600 font-normal">Rusak</span>
                </div>
              </th>
              <th className="text-left px-2 py-2 text-xs font-semibold text-muted-foreground">
                Petugas
              </th>
              <th className="text-left px-2 py-2 text-xs font-semibold text-muted-foreground">
                Keterangan
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={row.day}
                className={cn(
                  'border-b border-border transition-colors',
                  row.fungsi === 'baik' && 'bg-green-50/30',
                  row.fungsi === 'rusak' && 'bg-red-50/30',
                )}
              >
                <td className="px-2 py-1.5 font-mono-data text-xs text-center">
                  {row.day}
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex justify-center gap-3">
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => updateRow(idx, { fungsi: row.fungsi === 'baik' ? null : 'baik' })}
                      className={cn(
                        'w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors',
                        row.fungsi === 'baik'
                          ? 'border-green-500 bg-green-500 text-white'
                          : 'border-green-300 hover:border-green-400',
                      )}
                    >
                      {row.fungsi === 'baik' && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => updateRow(idx, { fungsi: row.fungsi === 'rusak' ? null : 'rusak' })}
                      className={cn(
                        'w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors',
                        row.fungsi === 'rusak'
                          ? 'border-red-500 bg-red-500 text-white'
                          : 'border-red-300 hover:border-red-400',
                      )}
                    >
                      {row.fungsi === 'rusak' && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2.5 2.5L9.5 9.5M9.5 2.5L2.5 9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </td>
                <td className="px-2 py-1.5">
                  <Input
                    placeholder="Nama"
                    value={row.petugas}
                    onChange={(e) => updateRow(idx, { petugas: e.target.value })}
                    disabled={readOnly}
                    className="h-7 text-xs"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Input
                    placeholder="-"
                    value={row.keterangan}
                    onChange={(e) => updateRow(idx, { keterangan: e.target.value })}
                    disabled={readOnly}
                    className="h-7 text-xs"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
