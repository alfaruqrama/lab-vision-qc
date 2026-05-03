import { cn } from '@/lib/utils';
import type { InstrumentType, ParamName } from '@/lib/types';
import { PARAM_UNITS } from '@/lib/types';
import type { ReadStrukResult } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Sparkles } from 'lucide-react';

interface AIResultPanelProps {
  result: ReadStrukResult;
  instrument: InstrumentType;
  confidence: number | null;
  className?: string;
}

/**
 * Displays AI-extracted values from a receipt photo.
 * Handles different layouts for Easylite (dual level) and CA660 (single level).
 */
export function AIResultPanel({ result, instrument, confidence, className }: AIResultPanelProps) {
  // Easylite: show both NORMAL and HIGH levels
  if (instrument === 'EASYLITE' && result.NORMAL && result.HIGH) {
    return (
      <Card className={cn('border-primary/20 bg-primary/5 overflow-hidden', className)}>
        <div className="p-3 space-y-2.5">
          <Header confidence={confidence} />

          <div className="grid grid-cols-1 gap-2">
            <LevelRow
              label="NORMAL"
              params={['Na', 'K', 'Cl']}
              data={result.NORMAL as Record<string, number | null | undefined>}
              variant="accent"
            />
            <LevelRow
              label="HIGH"
              params={['Na', 'K', 'Cl']}
              data={result.HIGH as Record<string, number | null | undefined>}
              variant="secondary"
            />
          </div>
        </div>
      </Card>
    );
  }

  // CA660: show PT, APTT, INR
  if (instrument === 'CA660' && !result.parseError) {
    return (
      <Card className={cn('border-primary/20 bg-primary/5 overflow-hidden', className)}>
        <div className="p-3 space-y-2.5">
          <Header confidence={confidence} />

          <div className="grid grid-cols-3 gap-2">
            {(['PT', 'APTT', 'INR'] as ParamName[]).map((p) => (
              <div key={p} className="bg-card rounded-lg p-2.5 border border-border text-center">
                <div className="text-[10px] font-bold text-muted-foreground uppercase">{p}</div>
                <div className="text-sm font-mono-data font-bold mt-0.5">
                  {(result as Record<string, unknown>)[p] ?? '—'}
                </div>
                <div className="text-[9px] text-muted-foreground">{PARAM_UNITS[p]}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  return null;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Header({ confidence }: { confidence: number | null }) {
  return (
    <div className="flex items-center justify-between">
      <span className="inline-flex items-center gap-1 text-xs font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
        <Sparkles size={10} /> AI Vision
      </span>
      {confidence !== null && (
        <span className="text-xs text-muted-foreground">
          Akurasi: <b className="text-success">{confidence}%</b>
        </span>
      )}
    </div>
  );
}

function LevelRow({
  label,
  params,
  data,
  variant,
}: {
  label: string;
  params: string[];
  data: Record<string, number | null | undefined>;
  variant: 'accent' | 'secondary';
}) {
  const bgClass = variant === 'accent' ? 'bg-accent/10 border-accent/20' : 'bg-secondary/50 border-secondary/30';

  return (
    <div className={cn('rounded-lg p-2.5 border', bgClass)}>
      <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1">
        {label} — {params.join(' / ')}
      </div>
      <div className="text-sm font-mono-data font-bold">
        {params.map((p) => data[p] ?? '—').join(' / ')}{' '}
        <span className="text-xs text-muted-foreground font-normal">mmol/L</span>
      </div>
    </div>
  );
}
