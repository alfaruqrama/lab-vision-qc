import { cn } from '@/lib/utils';
import type { ParamName, WestgardStatus, ParamConfig } from '@/lib/types';
import { PARAM_UNITS } from '@/lib/types';
import { evaluateWestgard } from '@/lib/westgard';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusBadge, WestgardRuleChip } from './StatusBadge';

interface ParamValueCardProps {
  param: ParamName;
  value: string;
  onChange: (value: string) => void;
  config: ParamConfig | null;
  className?: string;
}

/**
 * Parameter value input card with real-time Westgard evaluation.
 * Shows status dot, reference range, and violated rules.
 */
export function ParamValueCard({ param, value, onChange, config, className }: ParamValueCardProps) {
  const numVal = parseFloat(value);
  const hasValue = value.trim() !== '' && !isNaN(numVal);

  let status: WestgardStatus = 'ok';
  let violatedRules: string[] = [];

  if (hasValue && config) {
    const result = evaluateWestgard(numVal, config);
    status = result.status;
    violatedRules = result.rules;
  }

  return (
    <Card className={cn('overflow-hidden transition-all', className)}>
      <div className="p-3 space-y-2">
        {/* Header: param name + unit + status dot */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusBadge status={hasValue ? status : 'ok'} dot className={cn(!hasValue && 'opacity-30')} />
            <Label className="text-sm font-semibold">{param}</Label>
          </div>
          <span className="text-[10px] text-muted-foreground font-medium">{PARAM_UNITS[param]}</span>
        </div>

        {/* Reference range */}
        {config && (
          <p className="text-[10px] text-muted-foreground">
            Ref: {config.mean} &plusmn; {config.sd}
          </p>
        )}

        {/* Input */}
        <Input
          type="number"
          step="any"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0.0"
          className={cn(
            'font-mono-data text-center text-base h-9',
            hasValue && status === 'oos' && 'border-destructive/50 focus-visible:ring-destructive/30',
            hasValue && status === 'warning' && 'border-warning/50 focus-visible:ring-warning/30',
          )}
          aria-label={`Nilai ${param}`}
        />

        {/* Westgard rule violations */}
        {violatedRules.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {violatedRules.map((rule) => (
              <WestgardRuleChip key={rule} rule={rule} status={status} />
            ))}
          </div>
        )}

        {/* Warning badge for 1-2s (not in violatedRules but status is warning) */}
        {hasValue && status === 'warning' && violatedRules.length === 0 && (
          <div className="flex gap-1">
            <WestgardRuleChip rule="1-2s" status="warning" />
          </div>
        )}
      </div>
    </Card>
  );
}

/**
 * Read-only parameter value display (used in Dashboard/Report).
 */
interface ParamValueDisplayProps {
  param: ParamName;
  value: number;
  status: WestgardStatus;
  className?: string;
}

export function ParamValueDisplay({ param, value, status, className }: ParamValueDisplayProps) {
  return (
    <div className={cn('text-center space-y-0.5', className)}>
      <p className="text-[10px] text-muted-foreground font-medium">{param}</p>
      <p className="font-mono-data text-sm font-bold">{value}</p>
      <StatusBadge status={status} />
    </div>
  );
}
