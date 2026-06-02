import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface ActivityItem {
  nama: string;
  checked: boolean;
  catatan: string;
}

interface Props {
  aktivitas: string[];
  initial?: Record<string, boolean>;
  initialCatatan?: Record<string, string>;
  onChange?: (items: ActivityItem[]) => void;
  readOnly?: boolean;
  className?: string;
}

export function ChecklistForm({
  aktivitas,
  initial = {},
  initialCatatan = {},
  onChange,
  readOnly = false,
  className,
}: Props) {
  const [items, setItems] = useState<ActivityItem[]>(
    aktivitas.map((a) => ({
      nama: a,
      checked: initial[a] ?? false,
      catatan: initialCatatan[a] ?? '',
    })),
  );

  const updateItem = (idx: number, patch: Partial<ActivityItem>) => {
    const next = items.map((item, i) => (i === idx ? { ...item, ...patch } : item));
    setItems(next);
    onChange?.(next);
  };

  const done = items.filter((i) => i.checked).length;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground font-medium">
          {done}/{items.length} selesai
        </span>
      </div>
      {items.map((item, idx) => (
        <Card
          key={item.nama}
          className={cn(
            'p-3 transition-colors',
            item.checked && 'border-green-200 bg-green-50/50',
          )}
        >
          <div className="flex items-start gap-3">
            <Checkbox
              id={`act-${idx}`}
              checked={item.checked}
              onCheckedChange={(v) => updateItem(idx, { checked: !!v })}
              disabled={readOnly}
              className="mt-0.5"
            />
            <div className="flex-1 min-w-0">
              <Label
                htmlFor={`act-${idx}`}
                className={cn(
                  'text-sm font-medium cursor-pointer',
                  item.checked && 'line-through text-muted-foreground',
                  readOnly && 'cursor-default',
                )}
              >
                {item.nama}
              </Label>
              {!readOnly && (
                <Input
                  placeholder="Catatan (opsional)"
                  value={item.catatan}
                  onChange={(e) => updateItem(idx, { catatan: e.target.value })}
                  className="h-7 text-xs mt-1"
                />
              )}
              {readOnly && item.catatan && (
                <p className="text-xs text-muted-foreground mt-0.5">{item.catatan}</p>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// Re-export ChecklistForm's helper type
export type { ActivityItem };
