import { cn } from '@/lib/utils';
import type { QCRecord, ParamName, WestgardStatus } from '@/lib/types';
import { getOverallStatus } from '@/lib/westgard';
import { Card } from '@/components/ui/card';
import { StatusBadge } from './StatusBadge';
import { ParamValueDisplay } from './ParamValueCard';
import { INSTRUMENT_LABELS, INSTRUMENT_ICONS, INSTRUMENT_COLORS } from '../lib/constants';

interface QCRecordCardProps {
  record: QCRecord;
  /** Show full details or compact view */
  compact?: boolean;
  onClick?: () => void;
  className?: string;
}

/**
 * Displays a single QC record with instrument info, parameter values, and overall status.
 * Used in Dashboard (today's records) and potentially in a record list view.
 */
export function QCRecordCard({ record, compact = false, onClick, className }: QCRecordCardProps) {
  const params = Object.entries(record.params).filter(([, v]) => v != null) as [ParamName, number][];
  const statuses = Object.values(record.status).filter(Boolean) as WestgardStatus[];
  const overallStatus = getOverallStatus(statuses);

  const Icon = INSTRUMENT_ICONS[record.alat];
  const colors = INSTRUMENT_COLORS[record.alat];
  const label = INSTRUMENT_LABELS[record.alat];

  return (
    <Card
      className={cn(
        'overflow-hidden transition-all',
        onClick && 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:translate-y-0',
        className,
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className="p-4 space-y-3">
        {/* Header: instrument + level + status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg border',
                colors.bg,
                colors.border,
              )}
            >
              <Icon size={14} className={colors.text} />
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight">{label}</p>
              <p className="text-[11px] text-muted-foreground">{record.level}</p>
            </div>
          </div>
          <StatusBadge status={overallStatus} showIcon />
        </div>

        {/* Parameter values grid */}
        {!compact && params.length > 0 && (
          <div className={cn('grid gap-2', params.length <= 3 ? 'grid-cols-3' : 'grid-cols-4')}>
            {params.map(([name, value]) => (
              <ParamValueDisplay
                key={name}
                param={name}
                value={value}
                status={record.status[name] || 'ok'}
              />
            ))}
          </div>
        )}

        {/* Footer: analyst name + time */}
        <div className="flex items-center justify-between pt-1 border-t border-border/50">
          <p className="text-[11px] text-muted-foreground">
            Analis: <span className="font-medium text-foreground/80">{record.analis}</span>
          </p>
          {record.tanggal && (
            <p className="text-[10px] text-muted-foreground font-mono-data">{record.tanggal}</p>
          )}
        </div>
      </div>
    </Card>
  );
}
