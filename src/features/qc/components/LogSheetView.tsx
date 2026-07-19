import type { QCRecord, ControlLevel, InstrumentType, ParamName } from '@/lib/types';
import { getParamsForInstrument, PARAM_UNITS } from '@/lib/types';
import { INSTRUMENT_LABELS } from '@/features/qc/lib/constants';
import { LogSheetTable } from './LogSheetTable';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { FileSpreadsheet } from 'lucide-react';

const LEVEL_LABELS: Record<ControlLevel, string> = {
  Kontrol: 'Control',
  NORMAL: 'Normal',
  HIGH: 'High',
  CTRL0: 'CTRL 0',
  CTRL1: 'CTRL 1',
  CTRL2: 'CTRL 2',
};

interface LogSheetViewProps {
  records: QCRecord[];
  month: string;
  instrument: InstrumentType | 'ALL';
  selectedParam: ParamName;
  onParamChange: (param: ParamName) => void;
}

/** Get available parameters based on instrument filter */
function getAvailableParams(
  instrument: InstrumentType | 'ALL',
  records: QCRecord[],
): ParamName[] {
  if (instrument === 'ALL') {
    const params = new Set<ParamName>();
    records.forEach((r) => Object.keys(r.params).forEach((p) => params.add(p as ParamName)));
    if (params.size === 0) {
      // Fallback: show all possible params
      return ['PT', 'APTT', 'INR', 'Na', 'K', 'Cl', 'GDA'];
    }
    return Array.from(params);
  }
  return getParamsForInstrument(instrument);
}

export function LogSheetView({
  records,
  instrument,
  selectedParam,
  onParamChange,
}: LogSheetViewProps) {
  const availableParams = getAvailableParams(instrument, records);

  // Group records by instrument + level
  const groups: { alat: InstrumentType; level: ControlLevel; title: string; recs: QCRecord[] }[] = [];

  const groupMap = new Map<string, { alat: InstrumentType; level: ControlLevel; recs: QCRecord[] }>();
  records.forEach((r) => {
    if (r.params[selectedParam] == null) return;
    const key = `${r.alat}|${r.level}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, { alat: r.alat, level: r.level, recs: [] });
    }
    groupMap.get(key)!.recs.push(r);
  });

  // Convert to array and sort
  groups.push(
    ...Array.from(groupMap.values()).map((g) => ({
      ...g,
      title: `${INSTRUMENT_LABELS[g.alat] || g.alat} — ${LEVEL_LABELS[g.level] || g.level}`,
    })),
  );

  // Sort: by instrument label, then by level
  groups.sort((a, b) => {
    const la = INSTRUMENT_LABELS[a.alat] || a.alat;
    const lb = INSTRUMENT_LABELS[b.alat] || b.alat;
    if (la !== lb) return la.localeCompare(lb);
    return a.level.localeCompare(b.level);
  });

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <FileSpreadsheet size={48} className="mb-3 opacity-30" />
        <p className="text-sm font-medium">Tidak ada data QC untuk filter yang dipilih</p>
        <p className="text-xs mt-1 opacity-70">Coba ubah bulan, instrumen, atau parameter</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Parameter selector — only show when multiple params available */}
      {availableParams.length > 1 && (
        <div className="flex items-center gap-2 no-print">
          <Label className="text-xs whitespace-nowrap">Parameter:</Label>
          <Select value={selectedParam} onValueChange={(v) => onParamChange(v as ParamName)}>
            <SelectTrigger className="h-8 w-[180px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableParams.map((p) => (
                <SelectItem key={p} value={p} className="text-xs">
                  {p} ({PARAM_UNITS[p]})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Log sheet tables per instrument/level group */}
      {groups.map((group) => (
        <Card key={`${group.alat}-${group.level}`} className="p-4 print:shadow-none print:border-gray-300">
          <LogSheetTable
            title={group.title}
            records={group.recs}
            param={selectedParam}
          />
        </Card>
      ))}

      {/* Summary count */}
      <p className="text-[10px] text-muted-foreground text-center no-print">
        Total: {records.length} records • {groups.length} grup • Parameter: {selectedParam} ({PARAM_UNITS[selectedParam]})
      </p>
    </div>
  );
}
