import React from 'react';
import { Card } from '@/components/ui/card';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { levelLabel as formatLevel } from '@/lib/types';
import type { RuleViolation } from '@/lib/westgard-multi';

interface ControlSummaryProps {
  total: number;
  inControl: number;
  outOfControl: number;
  inControlPct: number;
  meanTarget?: number;
  meanActual?: number;
  sdTarget?: number;
  levelLabel?: string;
  /**
   * Sequence rules (2-2s, R-4s, 10x) reject the run set without any single run
   * leaving ±3SD, so `outOfControl` alone can read "in control" beside a rejection.
   */
  rejectionRules?: RuleViolation[];
}

export function ControlSummary({ total, inControl, outOfControl, inControlPct, meanTarget, meanActual, sdTarget, levelLabel, rejectionRules }: ControlSummaryProps) {
  const ruleFlags = rejectionRules ?? [];
  // A green tick means "nothing to investigate" — which a violated rejection
  // rule contradicts, whatever the in-control percentage says.
  const isInControl = outOfControl === 0 && ruleFlags.length === 0;

  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 mb-2">
        {isInControl ? (
          <CheckCircle size={16} className="text-success" />
        ) : (
          <XCircle size={16} className="text-destructive" />
        )}
        <h3 className="text-sm font-bold">
          Resume Kontrol{levelLabel ? ` (${formatLevel(levelLabel)})` : ''}
        </h3>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs mb-3">
        <div>
          <p className="text-muted-foreground">Total Run</p>
          <p className="font-bold font-mono-data">{total}</p>
        </div>
        <div>
          <p className="text-success">In-Control</p>
          <p className="font-bold font-mono-data text-success">
            {inControl} ({inControlPct.toFixed(0)}%)
          </p>
        </div>
        <div>
          <p className="text-destructive">Out-of-Control</p>
          <p className="font-bold font-mono-data text-destructive">
            {outOfControl} ({total > 0 ? ((outOfControl / total) * 100).toFixed(0) : 0}%)
          </p>
        </div>
      </div>
      {ruleFlags.length > 0 && (
        <div className="mb-3 rounded-md border border-destructive/20 bg-destructive/10 px-2.5 py-2 space-y-1">
          <p className="flex items-center gap-1.5 font-semibold text-xs text-destructive">
            <AlertTriangle size={12} className="shrink-0" />
            Aturan ditolak
          </p>
          {ruleFlags.map((r, i) => (
            <p key={i} className="text-[11px] text-destructive">
              {r.rule} — {r.description}
            </p>
          ))}
          <p className="text-[10px] text-muted-foreground">
            In/Out-of-Control dihitung per run (1-3s); aturan berurutan menolak set run ini.
          </p>
        </div>
      )}
      {/* Mean/SD targets are shown by the dedicated readout above the chart,
          which also carries the measured values and CV% — showing them twice
          left this panel with dashes whenever the caller had no target to pass. */}
      {(meanTarget !== undefined || sdTarget !== undefined) && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-muted-foreground">Mean (Target)</p>
            <p className="font-bold font-mono-data">
              {meanActual?.toFixed(2) ?? '-'} ({meanTarget?.toFixed(2) ?? '-'})
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">SD (Target)</p>
            <p className="font-bold font-mono-data">
              {sdTarget?.toFixed(3) ?? '-'}
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}

// Alias export untuk kompatibilitas
export { ControlSummary as LJSummary };
