import { cn } from '@/lib/utils';

interface Props {
  status: 'done' | 'pending' | 'overdue';
  className?: string;
}

const styles: Record<Props['status'], string> = {
  done: 'bg-green-100 text-green-700 border-green-200',
  pending: 'bg-muted text-muted-foreground border-border',
  overdue: 'bg-red-100 text-red-700 border-red-200',
};

const labels: Record<Props['status'], string> = {
  done: 'Selesai',
  pending: 'Belum',
  overdue: 'Terlambat',
};

export function MaintenanceStatusBadge({ status, className }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border',
        styles[status],
        className,
      )}
    >
      {labels[status]}
    </span>
  );
}
