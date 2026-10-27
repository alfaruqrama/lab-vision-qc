
import React from 'react';
import { Card } from '@/components/ui/card';
import { AlertTriangle, Trash2, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RuleViolation } from '@/lib/westgard-engine';

interface WestgardEvaluationPanelProps {
  violations: RuleViolation[];
  onExclude: (id: string, status: boolean) => Promise<void>;
}

export function WestgardEvaluationPanel({ violations, onExclude }: WestgardEvaluationPanelProps) {
  if (violations.length === 0) {
    return (
      <Card className="p-4 text-center">
        <CheckCircle className="mx-auto text-success mb-2" size={24} />
        <p className="text-sm font-medium">Tidak ada pelanggaran aturan Westgard.</p>
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="text-destructive" size={18} />
        <h3 className="font-bold text-sm">Analisis Pelanggaran Westgard</h3>
      </div>
      <div className="space-y-3">
        {violations.map((v, i) => (
          <div key={i} className="p-3 rounded-md bg-muted text-xs space-y-2 border-l-4 border-destructive">
            <div className="flex justify-between items-start">
              <span className="font-bold text-destructive">{v.rule} - {v.severity.toUpperCase()}</span>
              <span className="text-muted-foreground">{v.level}</span>
            </div>
            <p>{v.message}</p>
            <div className="flex justify-between items-center pt-2 border-t">
              <span className="text-muted-foreground italic">Tindakan: {v.action}</span>
              <button 
                onClick={() => onExclude(v.triggeredAt, true)}
                className="flex items-center gap-1 text-destructive hover:underline font-medium"
              >
                <Trash2 size={12} /> Exclude Point
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
