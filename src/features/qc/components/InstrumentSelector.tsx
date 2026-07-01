import { cn } from '@/lib/utils';
import type { InstrumentType } from '@/lib/types';
import { Card } from '@/components/ui/card';
import {
  INSTRUMENT_LABELS,
  INSTRUMENT_DESCRIPTIONS,
  INSTRUMENT_LEVEL_INFO,
  INSTRUMENT_ICONS,
  INSTRUMENT_COLORS,
} from '../lib/constants';

interface InstrumentSelectorProps {
  onSelect: (instrument: InstrumentType) => void;
  /** Instruments to show (defaults to all) */
  instruments?: InstrumentType[];
  className?: string;
}

const ALL_INSTRUMENTS: InstrumentType[] = ['CA660', 'EASYLITE', 'ONCALL1', 'ONCALL2', 'CLEVER1', 'CLEVER2'];

export function InstrumentSelector({
  onSelect,
  instruments = ALL_INSTRUMENTS,
  className,
}: InstrumentSelectorProps) {
  return (
    <div className={cn('grid grid-cols-1 gap-3', className)}>
      {instruments.map((instrument) => {
        const Icon = INSTRUMENT_ICONS[instrument];
        const colors = INSTRUMENT_COLORS[instrument];

        return (
          <Card
            key={instrument}
            className={cn(
              'group cursor-pointer border transition-all duration-200',
              'hover:border-primary hover:shadow-md hover:-translate-y-0.5',
              'active:translate-y-0 active:shadow-sm',
            )}
            onClick={() => onSelect(instrument)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(instrument);
              }
            }}
            aria-label={`Pilih ${INSTRUMENT_LABELS[instrument]}`}
          >
            <div className="flex items-start gap-4 p-5">
              <div
                className={cn(
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors',
                  colors.bg,
                  colors.border,
                  'group-hover:scale-105',
                )}
              >
                <Icon size={20} className={colors.text} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold leading-tight">{INSTRUMENT_LABELS[instrument]}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">{INSTRUMENT_DESCRIPTIONS[instrument]}</p>
                <p className="text-xs text-muted-foreground/70 mt-1">{INSTRUMENT_LEVEL_INFO[instrument]}</p>
              </div>
              <div className="shrink-0 text-muted-foreground/40 group-hover:text-primary transition-colors">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M7.5 5L12.5 10L7.5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
