import type { QCRecord, ParamName } from '@/lib/types';
import { format, parse } from 'date-fns';

interface LogSheetTableProps {
  title: string;
  records: QCRecord[];
  param: ParamName;
}

/** Format YYYY-MM-DD → DD/MM/YYYY (Indonesian locale) */
function formatDate(ymd: string): string {
  try {
    return format(parse(ymd, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy');
  } catch {
    return ymd;
  }
}

/** Split records into 2 column groups for compact multi-column layout */
function splitIntoGroups(records: QCRecord[]) {
  const perCol = Math.ceil(records.length / 2);
  return {
    col1: records.slice(0, perCol),
    col2: records.slice(perCol),
  };
}

export function LogSheetTable({ title, records, param }: LogSheetTableProps) {
  const sorted = [...records].sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  const { col1, col2 } = splitIntoGroups(sorted);
  const maxRows = Math.max(col1.length, col2.length);

  // Derive lot number (use most common lot) and value range
  const lotCounts = new Map<string, number>();
  const values: number[] = [];
  sorted.forEach((r) => {
    if (r.lot) lotCounts.set(r.lot, (lotCounts.get(r.lot) || 0) + 1);
    if (r.params[param] != null) values.push(r.params[param]!);
  });
  const lot = [...lotCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
  const minVal = values.length > 0 ? Math.min(...values) : null;
  const maxVal = values.length > 0 ? Math.max(...values) : null;
  const range = minVal != null && maxVal != null
    ? `${minVal.toFixed(2)} – ${maxVal.toFixed(2)}`
    : null;

  if (sorted.length === 0) return null;

  const thClass = 'border border-gray-300 px-2 py-1.5 text-[10px] font-semibold bg-gray-50 text-center whitespace-nowrap';
  const tdClass = 'border border-gray-300 px-2 py-1.5 text-[10px] whitespace-nowrap';
  const tdNumClass = 'border border-gray-300 px-2 py-1.5 text-[10px] text-right font-mono-data whitespace-nowrap';
  const tdEmpty = 'border border-gray-300 px-2 py-1.5 text-[10px]';

  return (
    <div className="log-sheet-table mb-6">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-bold text-foreground">{title}</h4>
        <div className="text-right text-[11px] text-muted-foreground">
          <span className="font-medium">Lot:</span> {lot}
          {range && (
            <span className="ml-3">
              <span className="font-medium">Range:</span> {range}
            </span>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-400">
          <thead>
            <tr>
              <th className={thClass}>Tanggal</th>
              <th className={thClass}>Hasil</th>
              <th className={thClass}>Operator</th>
              <th className={thClass}>Tanggal</th>
              <th className={thClass}>Hasil</th>
              <th className={thClass}>Operator</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: maxRows }, (_, rowIdx) => {
              const cols = [col1, col2];
              return (
                <tr key={rowIdx}>
                  {cols.map((col, ci) => {
                    const item = col[rowIdx];
                    if (!item) {
                      return (
                        <>
                          <td key={`d${ci}`} className={tdEmpty}>&nbsp;</td>
                          <td key={`r${ci}`} className={tdEmpty}>&nbsp;</td>
                          <td key={`o${ci}`} className={tdEmpty}>&nbsp;</td>
                        </>
                      );
                    }
                    return (
                      <>
                        <td key={`d${ci}`} className={tdClass}>{formatDate(item.tanggal)}</td>
                        <td key={`r${ci}`} className={tdNumClass}>
                          {item.params[param] != null ? item.params[param]!.toFixed(2) : '--'}
                        </td>
                        <td key={`o${ci}`} className={tdClass}>{item.analis || ''}</td>
                      </>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {sorted.length > 0 && (
        <p className="text-[10px] text-muted-foreground text-center mt-1">
          n = {sorted.length}
        </p>
      )}
    </div>
  );
}
