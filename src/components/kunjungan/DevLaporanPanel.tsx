import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  ChevronUp, ChevronDown, EyeOff, Eye, Save, RotateCcw,
  Plus, Trash2, GripVertical, Pencil, X,
} from 'lucide-react';
import { Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useLaporanLayout } from '@/hooks/use-laporan-layout';
import { useAuth } from '@/hooks/use-auth';
import {
  EXISTING_SECTIONS,
  DEFAULT_LAYOUT,
  generateCustomSectionId,
  generateCustomFieldId,
  type LaporanLayout,
  type CustomSectionDef,
  type CustomFieldDef,
} from '@/lib/laporan-sections';

interface DevLaporanPanelProps {
  /** Dipanggil setelah save berhasil (untuk trigger refresh parent) */
  onSaved?: () => void;
}

export function DevLaporanPanel({ onSaved }: DevLaporanPanelProps) {
  const { user } = useAuth();
  const { layout, saveLayout, resetToDefault } = useLaporanLayout();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Hanya render untuk developer
  if (user?.role !== 'developer') return null;

  // Draft state — kita clone layout untuk edit sementara
  const [draft, setDraft] = useState<LaporanLayout>({ ...layout, sectionOrder: [...layout.sectionOrder], sectionHidden: [...layout.sectionHidden], sectionLabels: { ...layout.sectionLabels }, customSections: layout.customSections.map(cs => ({ ...cs, fields: cs.fields.map(f => ({ ...f })) })) });

  // Sync draft when external layout changes (e.g., after reset)
  const resetDraft = useCallback((source: LaporanLayout) => {
    setDraft({
      ...source,
      sectionOrder: [...source.sectionOrder],
      sectionHidden: [...source.sectionHidden],
      sectionLabels: { ...source.sectionLabels },
      customSections: source.customSections.map(cs => ({ ...cs, fields: cs.fields.map(f => ({ ...f })) })),
    });
  }, []);

  // ── Section order operations ──

  function moveSection(index: number, direction: 'up' | 'down') {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= draft.sectionOrder.length) return;
    const newOrder = [...draft.sectionOrder];
    [newOrder[index], newOrder[newIndex]] = [newOrder[newIndex], newOrder[index]];
    setDraft(prev => ({ ...prev, sectionOrder: newOrder }));
  }

  function toggleHidden(key: string) {
    setDraft(prev => ({
      ...prev,
      sectionHidden: prev.sectionHidden.includes(key)
        ? prev.sectionHidden.filter(k => k !== key)
        : [...prev.sectionHidden, key],
    }));
  }

  function updateLabel(key: string, label: string) {
    setDraft(prev => ({
      ...prev,
      sectionLabels: { ...prev.sectionLabels, [key]: label },
    }));
  }

  // ── Custom section CRUD ──

  function addCustomSection() {
    const id = generateCustomSectionId();
    const letter = String.fromCharCode(65 + draft.sectionOrder.length); // H, I, J, ...
    const newCs: CustomSectionDef = {
      id,
      label: `Section ${letter}`,
      fields: [
        { id: generateCustomFieldId(), label: 'Field 1', type: 'number' },
      ],
    };
    setDraft(prev => ({
      ...prev,
      sectionOrder: [...prev.sectionOrder, id],
      customSections: [...prev.customSections, newCs],
      sectionLabels: { ...prev.sectionLabels, [id]: `Section ${letter}` },
    }));
  }

  function removeCustomSection(id: string) {
    setDraft(prev => ({
      ...prev,
      sectionOrder: prev.sectionOrder.filter(k => k !== id),
      sectionHidden: prev.sectionHidden.filter(k => k !== id),
      customSections: prev.customSections.filter(cs => cs.id !== id),
      // Clean up label
      sectionLabels: Object.fromEntries(
        Object.entries(prev.sectionLabels).filter(([k]) => k !== id)
      ),
    }));
  }

  function updateCustomSectionLabel(id: string, label: string) {
    setDraft(prev => ({
      ...prev,
      customSections: prev.customSections.map(cs =>
        cs.id === id ? { ...cs, label } : cs
      ),
      sectionLabels: { ...prev.sectionLabels, [id]: label },
    }));
  }

  function addFieldToSection(sectionId: string) {
    setDraft(prev => ({
      ...prev,
      customSections: prev.customSections.map(cs =>
        cs.id === sectionId
          ? { ...cs, fields: [...cs.fields, { id: generateCustomFieldId(), label: `Field ${cs.fields.length + 1}`, type: 'number' as const }] }
          : cs
      ),
    }));
  }

  function removeFieldFromSection(sectionId: string, fieldId: string) {
    setDraft(prev => ({
      ...prev,
      customSections: prev.customSections.map(cs =>
        cs.id === sectionId
          ? { ...cs, fields: cs.fields.filter(f => f.id !== fieldId) }
          : cs
      ),
    }));
  }

  function updateField(sectionId: string, fieldId: string, patch: Partial<CustomFieldDef>) {
    setDraft(prev => ({
      ...prev,
      customSections: prev.customSections.map(cs =>
        cs.id === sectionId
          ? { ...cs, fields: cs.fields.map(f => f.id === fieldId ? { ...f, ...patch } : f) }
          : cs
      ),
    }));
  }

  // ── Save / Reset ──

  async function handleSave() {
    setSaving(true);
    try {
      const result = await saveLayout(draft);
      if (result.success) {
        toast.success('Layout laporan disimpan');
        onSaved?.();
      } else {
        toast.error('Gagal menyimpan', { description: result.message });
      }
    } catch (e: any) {
      toast.error('Error', { description: e.message });
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    const result = await resetToDefault();
    if (result.success) {
      resetDraft({ ...DEFAULT_LAYOUT, sectionOrder: [...DEFAULT_LAYOUT.sectionOrder], sectionHidden: [], sectionLabels: { ...DEFAULT_LAYOUT.sectionLabels }, customSections: [] });
      toast.success('Layout direset ke default');
      onSaved?.();
    } else {
      toast.error('Gagal reset', { description: result.message });
    }
  }

  // ── Render helpers ──

  const isExisting = (key: string) => EXISTING_SECTIONS.some(s => s.key === key);
  const getSectionInfo = (key: string) => {
    const existing = EXISTING_SECTIONS.find(s => s.key === key);
    if (existing) return { ...existing, isCustom: false };
    const custom = draft.customSections.find(cs => cs.id === key);
    return custom ? { key: custom.id, label: custom.label, letter: '', isCustom: true } : null;
  };

  if (!open) {
    return (
      <div className="mb-3">
        <button
          onClick={() => { resetDraft(layout); setOpen(true); }}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100 transition-colors"
        >
          <span className="text-[11px] font-bold flex items-center gap-1.5">
            <Pencil className="w-3.5 h-3.5" />
            Dev · Edit Layout Laporan
          </span>
          <span className="text-[9px] text-purple-500">{draft.customSections.length} section custom</span>
        </button>
      </div>
    );
  }

  return (
    <div className="mb-3 rounded-lg bg-purple-50/80 border border-purple-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-purple-100/60 border-b border-purple-200">
        <span className="text-[11px] font-bold text-purple-700 flex items-center gap-1.5">
          <Pencil className="w-3.5 h-3.5" />
          Dev · Edit Layout Laporan
        </span>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={handleReset} className="h-6 px-2 text-[10px] text-muted-foreground hover:text-destructive">
            <RotateCcw className="w-3 h-3 mr-1" /> Reset
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="h-6 px-3 text-[10px] bg-purple-600 hover:bg-purple-700 text-white">
            <Save className="w-3 h-3 mr-1" /> {saving ? 'Menyimpan...' : 'Simpan'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)} className="h-6 w-6 p-0 text-muted-foreground">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="p-3 space-y-3 max-h-[50vh] overflow-y-auto">
        {/* Section list */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-purple-600 uppercase tracking-wider">Urutan & Visibility</p>
          {draft.sectionOrder.map((key, idx) => {
            const info = getSectionInfo(key);
            if (!info) return null;
            const hidden = draft.sectionHidden.includes(key);
            const label = draft.sectionLabels[key] ?? info.label;

            return (
              <div
                key={key}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1.5 rounded-md border text-[11px]",
                  hidden ? "bg-gray-50 border-gray-200 text-muted-foreground" : "bg-white border-purple-150",
                  info.isCustom && "border-l-2 border-l-blue-400"
                )}
              >
                <GripVertical className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />

                {/* Reorder buttons */}
                <div className="flex flex-col gap-0.5 flex-shrink-0">
                  <button
                    onClick={() => moveSection(idx, 'up')}
                    disabled={idx === 0}
                    className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20"
                    title="Pindah ke atas"
                  >
                    <ChevronUp className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => moveSection(idx, 'down')}
                    disabled={idx >= draft.sectionOrder.length - 1}
                    className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20"
                    title="Pindah ke bawah"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>

                {/* Label (editable) */}
                <span className={cn("font-medium min-w-0 flex-1 truncate", hidden && "line-through")}>
                  {info.isCustom ? '✎ ' : ''}{label}
                </span>

                {/* Hidden toggle */}
                <button
                  onClick={() => toggleHidden(key)}
                  className={cn(
                    "p-1 rounded transition-colors",
                    hidden ? "bg-red-100 text-red-500" : "bg-green-50 text-green-600"
                  )}
                  title={hidden ? "Tampilkan" : "Sembunyikan"}
                >
                  {hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>

                {/* Rename input (inline) */}
                <Input
                  value={label}
                  onChange={(e) => updateLabel(key, e.target.value)}
                  className="h-6 w-28 text-[10px] py-0"
                  placeholder="Label..."
                />

                {/* Delete custom section */}
                {info.isCustom && (
                  <button
                    onClick={() => removeCustomSection(key)}
                    className="p-1 text-muted-foreground hover:text-destructive"
                    title="Hapus section custom"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Add custom section button */}
        <Button
          variant="outline"
          size="sm"
          onClick={addCustomSection}
          className="w-full h-7 text-[10px] border-dashed border-purple-300 text-purple-600 hover:bg-purple-50"
        >
          <Plus className="w-3 h-3 mr-1" /> Tambah Section Custom
        </Button>

        {/* Custom section field editors */}
        {draft.customSections.map(cs => (
          <div key={cs.id} className="ml-4 pl-3 border-l-2 border-blue-200 space-y-1.5">
            <p className="text-[10px] font-semibold text-blue-600">Fields: {cs.label}</p>
            {cs.fields.map((field, fIdx) => (
              <div key={field.id} className="flex items-center gap-1.5">
                <Input
                  value={field.label}
                  onChange={(e) => updateField(cs.id, field.id, { label: e.target.value })}
                  className="h-6 flex-1 text-[10px]"
                  placeholder="Label field"
                />
                <select
                  value={field.type}
                  onChange={(e) => updateField(cs.id, field.id, { type: e.target.value as 'number' | 'text' })}
                  className="h-6 text-[10px] border rounded px-1"
                >
                  <option value="number">Angka</option>
                  <option value="text">Teks</option>
                </select>
                <button
                  onClick={() => removeFieldFromSection(cs.id, field.id)}
                  className="p-1 text-muted-foreground hover:text-destructive"
                >
                  <Minus className="w-3 h-3" />
                </button>
              </div>
            ))}
            <button
              onClick={() => addFieldToSection(cs.id)}
              className="text-[10px] text-blue-500 hover:text-blue-700 font-medium"
            >
              <Plus className="w-3 h-3 inline mr-0.5" /> Tambah Field
            </button>
          </div>
        ))}

        {/* Info */}
        <p className="text-[9px] text-muted-foreground pt-1 border-t border-purple-200">
          Section yang di-hidden tidak tampil di form dan tidak masuk output WhatsApp.
          Section custom selalu manual (tidak sync dengan Input Harian).
        </p>
      </div>
    </div>
  );
}
