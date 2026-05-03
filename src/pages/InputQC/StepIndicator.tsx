import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface StepIndicatorProps {
  currentStep: 1 | 2 | 3;
  totalSteps: 2 | 3;
}

const STEP_LABELS: Record<number, string> = {
  1: 'Instrumen',
  2: 'Level',
  3: 'Input Data',
};

export function StepIndicator({ currentStep, totalSteps }: StepIndicatorProps) {
  const steps = totalSteps === 2 ? [1, 3] : [1, 2, 3];

  return (
    <div className="flex items-center gap-2" role="navigation" aria-label="Progress langkah">
      {steps.map((step, idx) => {
        const isActive = step === currentStep;
        const isCompleted = step < currentStep;
        const isLast = idx === steps.length - 1;

        return (
          <div key={step} className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-all duration-200',
                  isCompleted && 'bg-primary text-primary-foreground',
                  isActive && 'bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-1 ring-offset-background',
                  !isActive && !isCompleted && 'bg-muted text-muted-foreground',
                )}
                aria-current={isActive ? 'step' : undefined}
              >
                {isCompleted ? <Check size={12} strokeWidth={3} /> : idx + 1}
              </div>
              <span
                className={cn(
                  'text-xs font-medium transition-colors',
                  isActive ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {STEP_LABELS[step]}
              </span>
            </div>
            {!isLast && (
              <div
                className={cn(
                  'h-px w-6 transition-colors',
                  isCompleted ? 'bg-primary' : 'bg-border',
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
