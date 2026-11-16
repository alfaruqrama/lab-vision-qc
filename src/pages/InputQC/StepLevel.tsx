import { cn } from '@/lib/utils';
import type { InstrumentType, ControlLevel } from '@/lib/types';
import { levelsForInstrument, levelLabel } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { INSTRUMENT_LABELS } from '@/features/qc/lib/constants';

interface StepLevelProps {
  instrument: InstrumentType;
  onSelect: (level: ControlLevel) => void;
  onBack: () => void;
}

interface LevelChoice {
  level: ControlLevel;
  label: string;
  description?: string;
}

/** Level descriptions are about position in the range, not the level name. */
const LEVEL_DESCRIPTIONS: Partial<Record<ControlLevel, string>> = {
  CTRL0: 'Level rendah',
  CTRL1: 'Level normal',
  CTRL2: 'Level tinggi',
  NORMAL: 'Rentang normal',
  HIGH: 'Rentang tinggi',
};

function getLevelChoices(instrument: InstrumentType): LevelChoice[] {
  return levelsForInstrument(instrument).map((level) => ({
    level,
    label: levelLabel(level),
    description: LEVEL_DESCRIPTIONS[level],
  }));
}

export function StepLevel({ instrument, onSelect, onBack }: StepLevelProps) {
  const choices = getLevelChoices(instrument);

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 -ml-2 text-muted-foreground">
        <ArrowLeft size={16} /> Kembali
      </Button>

      <div>
        <h1 className="text-xl font-bold">Pilih Level Kontrol</h1>
        <p className="text-sm text-muted-foreground">{INSTRUMENT_LABELS[instrument]}</p>
      </div>

      <div className={cn('grid gap-3', choices.length === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2')}>
        {choices.map(({ level, label, description }) => (
          <Card
            key={level}
            className={cn(
              'cursor-pointer border transition-all duration-200 hover:border-primary hover:shadow-md',
              'active:translate-y-0 active:shadow-sm',
            )}
            onClick={() => onSelect(level)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(level);
              }
            }}
          >
            <div className="p-5 text-center space-y-1">
              <h3 className="text-lg font-bold">{label}</h3>
              {description && <p className="text-xs text-muted-foreground">{description}</p>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
