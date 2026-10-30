import { CheckCircle2, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface StatusCardProps {
  status: 'baik' | 'rusak';
  onChange: (status: 'baik' | 'rusak') => void;
}

export function StatusCard({ status, onChange }: StatusCardProps) {
  return (
    <Card className="p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold">Uji Fungsi Harian</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Kondisi fisik dan operasional alat hari ini
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={status === 'baik' ? 'default' : 'outline'}
            onClick={() => onChange('baik')}
            className={cn(status === 'baik' && 'bg-success hover:bg-success/90 text-success-foreground')}
          >
            <CheckCircle2 size={15} className="mr-1" />
            Baik
          </Button>
          <Button
            type="button"
            size="sm"
            variant={status === 'rusak' ? 'default' : 'outline'}
            onClick={() => onChange('rusak')}
            className={cn(
              status === 'rusak' && 'bg-destructive hover:bg-destructive/90 text-destructive-foreground',
            )}
          >
            <AlertCircle size={15} className="mr-1" />
            Rusak
          </Button>
        </div>
      </div>

      {status === 'rusak' && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3">
          <AlertCircle size={16} className="text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-destructive">Tindakan Diperlukan</p>
            <p className="text-xs text-destructive/90 mt-0.5">
              Segera hubungi teknisi alat (BME) atau vendor terkait. Pasang label "Rusak" pada fisik alat.
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}
