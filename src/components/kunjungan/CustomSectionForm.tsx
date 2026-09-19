import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { CustomSectionDef, CustomFieldDef } from '@/lib/laporan-sections';

interface CustomSectionFormProps {
  section: CustomSectionDef;
  values: Record<string, string>;
  onChange: (sectionId: string, fieldId: string, value: string) => void;
  letter?: string; // optional letter label (H, I, J, ...)
}

export function CustomSectionForm({ section, values, onChange, letter }: CustomSectionFormProps) {
  const displayLabel = letter
    ? `${letter} — ${section.label}`
    : section.label;

  return (
    <div className="card-clinical border rounded-lg overflow-hidden border-l-2 border-l-blue-400">
      {/* Trigger — simulating AccordionTrigger style */}
      <div className="px-4 py-2 text-xs font-semibold flex items-center gap-2">
        <span>{displayLabel}</span>
        <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-600 border border-blue-200">
          Manual
        </span>
      </div>

      {/* Content */}
      <div className="px-4 pb-3 space-y-1.5">
        <p className="text-[9px] text-muted-foreground pb-0.5">
          Section custom (ditambahkan dev). Semua field diisi manual.
        </p>
        {section.fields.map((field) => (
          <div key={field.id} className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground flex-1 min-w-0">
              {field.label}
              <span className="text-[9px] ml-1 text-red-500 font-medium">(input manual)</span>
            </label>
            <Input
              type={field.type === 'number' ? 'text' : 'text'}
              inputMode={field.type === 'number' ? 'numeric' : 'text'}
              value={values[field.id] ?? ''}
              onChange={(e) => {
                const val = field.type === 'number'
                  ? e.target.value.replace(/\D/g, '')
                  : e.target.value;
                onChange(section.id, field.id, val);
              }}
              className={cn(
                "h-8 text-right text-xs font-mono border-red-300 bg-red-50/30 focus-visible:ring-red-400",
                field.type === 'number' ? 'w-24' : 'w-36'
              )}
              placeholder={field.type === 'number' ? '0' : '-'}
            />
          </div>
        ))}
        {section.fields.length === 0 && (
          <p className="text-[10px] text-muted-foreground italic">Belum ada field. Tambahkan lewat panel dev.</p>
        )}
      </div>
    </div>
  );
}
