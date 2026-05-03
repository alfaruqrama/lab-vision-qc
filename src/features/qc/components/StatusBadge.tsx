import { cn } from '@/lib/utils';
import type { WestgardStatus } from '@/lib/types';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

interface StatusBadgeProps {
  status: WestgardStatus;
  /** Show icon alongside text */
  showIcon?: boolean;
  /** Compact mode: dot only, no text */
  dot?: boolean;
  className?: string;
}

const STATUS_CONFIG: Record<
  WestgardStatus,
  { label: string; dotClass: string; badgeClass: string; Icon: typeof CheckCircle }
> = {
  ok: {
    label: 'OK',
    dotClass: 'bg-success',
    badgeClass: 'bg-success/10 text-success border-success/20',
    Icon: CheckCircle,
  },
  warning: {
    label: 'Peringatan',
    dotClass: 'bg-warning',
    badgeClass: 'bg-warning/10 text-warning border-warning/20',
    Icon: AlertTriangle,
  },
  oos: {
    label: 'Diluar Kendali',
    dotClass: 'bg-destructive',
    badgeClass: 'bg-destructive/10 text-destructive border-destructive/20',
    Icon: XCircle,
  },
};

export function StatusBadge({ status, showIcon = false, dot = false, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  if (dot) {
    return (
      <span
        className={cn('inline-block w-2.5 h-2.5 rounded-full transition-colors', config.dotClass, className)}
        aria-label={config.label}
        role="status"
      />
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold',
        config.badgeClass,
        className,
      )}
      role="status"
    >
      {showIcon && <config.Icon size={12} />}
      {config.label}
    </span>
  );
}

/** Westgard rule chip (e.g. "1-2s", "1-3s", "R4s") */
export function WestgardRuleChip({ rule, status }: { rule: string; status: WestgardStatus }) {
  const badgeClass =
    status === 'oos'
      ? 'bg-destructive/10 text-destructive border-destructive/20'
      : 'bg-warning/10 text-warning border-warning/20';

  return (
    <span className={cn('inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-bold', badgeClass)}>
      {rule}
    </span>
  );
}
