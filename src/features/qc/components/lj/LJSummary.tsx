import React from 'react';
import { Card } from '@/components/ui/card';
import { CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ControlSummaryProps {
  total: number;
  inControl: number;
  outOfControl: number;
  inControlPct: number;
  meanTarget?: number;
  meanActual?: number;
  sdTarget?: number;
  levelLabel?: string;
}

export function ControlSummary({ total, inControl, outOfControl, inControlPct, meanTarget, meanActual, sdTarget, levelLabel }: ControlSummaryProps) {
  const isInControl = inControlPct >= 95;

  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 mb-2">
        {isInControl ? (
          <CheckCircle size={16} className="text-success" />
        ) : (
          <XCircle size={16} className="text-destructive" />
        )}
        <h3 className="text-sm font-bold">
          Resume Kontrol{levelLabel ? ` (${levelLabel})` : ''}
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

      {meanTarget !== undefined && meanActual !== undefined && (
        <div className="grid grid-cols-3 gap-2 text-xs p-2 bg-muted rounded-md mb-2">
          <div>
            <p className="text-muted-foreground">Mean Target</p>
            <p className="font-bold font-mono-data">{meanTarget.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Mean Aktual</p>
            <p className="font-bold font-mono-data">{meanActual.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Bias %</p>
            <p className={cn("font-bold font-mono-data", Math.abs(((meanActual - meanTarget) / meanTarget) * 100) > 5 ? 'text-destructive' : 'text-success')}>
              {(((meanActual - meanTarget) / meanTarget) * 100).toFixed(2)}%
            </p>
          </div>
        </div>
      )}
      <p className={cn("text-xs font-semibold mt-2", isInControl ? 'text-success' : 'text-destructive')}>
        {isInControl ? '✓ Kontrol Masuk' : '✗ Kontrol Tidak Masuk'}
      </p>
    </Card>
  );
}
