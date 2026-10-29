
import React from 'react';
import { Card } from '@/components/ui/card';
import { Activity, AlertTriangle, XCircle, TrendingUp, TrendingDown, ArrowRightLeft, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MultiLevelAnalysis } from '@/lib/westgard-multi';

export function WestgardAnalysisCard({ analysis }: { analysis: MultiLevelAnalysis }) {
  const { rules, patterns, crossLevel, recommendation } = analysis;
  const hasViolations = rules.length > 0;
  const hasPatterns = patterns.length > 0;

  return (
    <Card className="overflow-hidden">
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-primary" />
          <h3 className="text-sm font-bold">Analisis Westgard Multi-Level</h3>
        </div>

        {hasViolations && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Aturan Terlanggar</h4>
            {rules.map((r, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-start gap-2 rounded-md px-3 py-2 text-xs',
                  r.status === 'oos' ? 'bg-destructive/10 border border-destructive/20' : 'bg-warning/10 border border-warning/20',
                )}
              >
                {r.status === 'oos' ? (
                  <XCircle size={14} className="text-destructive shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle size={14} className="text-warning shrink-0 mt-0.5" />
                )}
                <div className="space-y-0.5">
                  <p className="font-semibold">
                    {r.rule} — {r.level}
                  </p>
                  <p className="text-muted-foreground">{r.description}</p>
                  <p className="text-[10px] font-mono-data text-muted-foreground">
                    {r.affectedDays.slice(0, 5).join(', ')}
                    {r.affectedDays.length > 5 ? ` +${r.affectedDays.length - 5} hari` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {hasPatterns && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pola Terdeteksi</h4>
            {patterns.map((p, i) => (
              <div key={i} className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs">
                {p.type === 'shift' && <ArrowRightLeft size={14} className="text-primary shrink-0 mt-0.5" />}
                {p.type === 'trend_up' && <TrendingUp size={14} className="text-warning shrink-0 mt-0.5" />}
                {p.type === 'trend_down' && <TrendingDown size={14} className="text-warning shrink-0 mt-0.5" />}
                {(p.type === 'bias_high' || p.type === 'bias_low') && <Activity size={14} className="text-primary shrink-0 mt-0.5" />}
                {p.type === 'random_error' && <AlertTriangle size={14} className="text-muted-foreground shrink-0 mt-0.5" />}
                <div>
                  <p className="font-semibold">{p.level} — {p.type.replace('_', ' ')}</p>
                  <p className="text-muted-foreground">{p.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Analisis Cross-Level</h4>
          <div
            className={cn(
              'rounded-md px-3 py-2.5 text-xs space-y-1',
              crossLevel.type === 'systematic'
                ? 'bg-destructive/10 border border-destructive/20'
                : crossLevel.type === 'specific'
                  ? 'bg-warning/10 border border-warning/20'
                  : 'bg-success/10 border border-success/20',
            )}
          >
            <p className="font-semibold flex items-center gap-1.5">
              {crossLevel.type === 'stable' ? (
                <ShieldCheck size={14} className="text-success" />
              ) : crossLevel.type === 'systematic' ? (
                <XCircle size={14} className="text-destructive" />
              ) : crossLevel.type === 'specific' ? (
                <AlertTriangle size={14} className="text-warning" />
              ) : null}
              {crossLevel.summary}
            </p>
            {crossLevel.details.map((d, i) => (
              <p key={i} className="text-muted-foreground">{d}</p>
            ))}
          </div>
        </div>

        <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2.5">
          <p className="text-xs font-semibold text-primary mb-1">Rekomendasi</p>
          <p className="text-xs leading-relaxed whitespace-pre-wrap">{recommendation}</p>
        </div>
      </div>
    </Card>
  );
}

// Alias export untuk kompatibilitas
export { WestgardAnalysisCard as LJAnalysis };
