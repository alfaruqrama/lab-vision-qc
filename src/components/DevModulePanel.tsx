import { useState } from 'react';
import { toast } from 'sonner';
import { X, Save, EyeOff, Eye, Construction, RotateCcw } from 'lucide-react';
import { useModuleConfig } from '@/hooks/use-module-config';
import type { ModuleOverride } from '@/lib/module-config';

export interface BaseModule {
  key: string;
  title: string;
  descDefault: string;
  badgeLabelDefault: string;
  badgeLiveDefault: boolean;
  chipsDefault: string[];
  wipDefault: boolean;
}

interface DevModulePanelProps {
  modules: BaseModule[];
}

interface DraftState {
  wip: boolean;
  hidden: boolean;
  badgeLabel: string;
  badgeLive: boolean;
  desc: string;
  chips: string;
}

function overrideToDraft(mod: BaseModule, ov: ModuleOverride | undefined): DraftState {
  return {
    wip: ov?.wip ?? mod.wipDefault,
    hidden: ov?.hidden ?? false,
    badgeLabel: ov?.badge_label ?? mod.badgeLabelDefault,
    badgeLive: ov?.badge_live ?? mod.badgeLiveDefault,
    desc: ov?.desc_override ?? mod.descDefault,
    chips: (ov?.chips_override ?? mod.chipsDefault).join(', '),
  };
}

export function DevModulePanel({ modules }: DevModulePanelProps) {
  const { config, update, refresh } = useModuleConfig();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DraftState>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  function getDraft(mod: BaseModule): DraftState {
    return drafts[mod.key] ?? overrideToDraft(mod, config[mod.key]);
  }

  function setDraft(key: string, patch: Partial<DraftState>) {
    setDrafts((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? overrideToDraft(modules.find((m) => m.key === key)!, config[key])), ...patch },
    }));
  }

  async function save(mod: BaseModule) {
    const d = getDraft(mod);
    setSavingKey(mod.key);
    const chipsArr = d.chips.split(',').map((s) => s.trim()).filter(Boolean);
    const result = await update(mod.key, {
      wip: d.wip === mod.wipDefault ? null : d.wip,
      hidden: d.hidden ? true : null,
      badge_label: d.badgeLabel === mod.badgeLabelDefault ? null : d.badgeLabel,
      badge_live: d.badgeLive === mod.badgeLiveDefault ? null : d.badgeLive,
      desc_override: d.desc === mod.descDefault ? null : d.desc,
      chips_override:
        JSON.stringify(chipsArr) === JSON.stringify(mod.chipsDefault) ? null : chipsArr,
    });
    setSavingKey(null);
    if (result.success) {
      toast.success(`${mod.title} tersimpan`);
      setDrafts((prev) => {
        const { [mod.key]: _, ...rest } = prev;
        return rest;
      });
    } else {
      toast.error('Gagal simpan', { description: result.message });
    }
  }

  async function reset(mod: BaseModule) {
    setSavingKey(mod.key);
    const result = await update(mod.key, {
      wip: null,
      hidden: null,
      badge_label: null,
      badge_live: null,
      desc_override: null,
      chips_override: null,
    });
    setSavingKey(null);
    if (result.success) {
      await refresh();
      toast.success(`${mod.title} direset ke default`);
      setDrafts((prev) => {
        const { [mod.key]: _, ...rest } = prev;
        return rest;
      });
    } else {
      toast.error('Gagal reset', { description: result.message });
    }
  }

  return (
    <section className="card-clinical p-5 border-2 border-dashed border-purple-300 bg-purple-50/30">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
          <Construction size={16} />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-bold text-purple-900">Dev Panel · Kelola Modul</h2>
          <p className="text-[11px] text-purple-700/70">
            Toggle banner WIP, edit badge, sembunyikan modul dari user. Perubahan langsung terlihat semua user.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {modules.map((mod) => {
          const isOpen = openKey === mod.key;
          const draft = getDraft(mod);
          const isDirty = drafts[mod.key] !== undefined;
          const hasOverride = !!config[mod.key];
          return (
            <div key={mod.key} className="rounded-lg border border-purple-200 bg-white overflow-hidden">
              <button
                onClick={() => setOpenKey(isOpen ? null : mod.key)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-purple-50/50 transition-colors text-left"
              >
                <span className="text-[11px] font-mono text-muted-foreground shrink-0 w-28 truncate">{mod.key}</span>
                <span className="flex-1 text-sm font-semibold truncate">{mod.title}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {draft.wip && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-bold">WIP</span>}
                  {draft.hidden && <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-bold">HIDDEN</span>}
                  {hasOverride && !draft.wip && !draft.hidden && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-bold">CUSTOM</span>
                  )}
                </div>
              </button>

              {isOpen && (
                <div className="px-3 pb-3 pt-1 space-y-3 border-t border-purple-100">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setDraft(mod.key, { wip: !draft.wip })}
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded border transition-colors flex items-center gap-1.5 ${
                        draft.wip
                          ? 'bg-amber-100 text-amber-700 border-amber-300'
                          : 'bg-white text-muted-foreground border-input hover:border-amber-300'
                      }`}
                    >
                      <Construction size={12} />
                      Banner WIP {draft.wip ? 'ON' : 'OFF'}
                    </button>
                    <button
                      onClick={() => setDraft(mod.key, { hidden: !draft.hidden })}
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded border transition-colors flex items-center gap-1.5 ${
                        draft.hidden
                          ? 'bg-red-100 text-red-700 border-red-300'
                          : 'bg-white text-muted-foreground border-input hover:border-red-300'
                      }`}
                    >
                      {draft.hidden ? <EyeOff size={12} /> : <Eye size={12} />}
                      {draft.hidden ? 'Disembunyikan' : 'Terlihat'}
                    </button>
                    <button
                      onClick={() => setDraft(mod.key, { badgeLive: !draft.badgeLive })}
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded border transition-colors flex items-center gap-1.5 ${
                        draft.badgeLive
                          ? 'bg-green-100 text-green-700 border-green-300'
                          : 'bg-white text-muted-foreground border-input hover:border-green-300'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${draft.badgeLive ? 'bg-green-500' : 'bg-muted-foreground/40'}`} />
                      Dot {draft.badgeLive ? 'Live' : 'Idle'}
                    </button>
                  </div>

                  <label className="block">
                    <span className="text-[11px] font-semibold text-muted-foreground">Badge label</span>
                    <input
                      type="text"
                      value={draft.badgeLabel}
                      onChange={(e) => setDraft(mod.key, { badgeLabel: e.target.value })}
                      className="mt-1 w-full text-xs px-2 py-1.5 rounded border border-input bg-white focus:outline-none focus:ring-1 focus:ring-purple-400"
                    />
                  </label>

                  <label className="block">
                    <span className="text-[11px] font-semibold text-muted-foreground">Deskripsi</span>
                    <textarea
                      value={draft.desc}
                      onChange={(e) => setDraft(mod.key, { desc: e.target.value })}
                      rows={2}
                      className="mt-1 w-full text-xs px-2 py-1.5 rounded border border-input bg-white focus:outline-none focus:ring-1 focus:ring-purple-400 resize-none"
                    />
                  </label>

                  <label className="block">
                    <span className="text-[11px] font-semibold text-muted-foreground">Chips (pisah dengan koma)</span>
                    <input
                      type="text"
                      value={draft.chips}
                      onChange={(e) => setDraft(mod.key, { chips: e.target.value })}
                      className="mt-1 w-full text-xs px-2 py-1.5 rounded border border-input bg-white focus:outline-none focus:ring-1 focus:ring-purple-400"
                    />
                  </label>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      onClick={() => reset(mod)}
                      disabled={savingKey === mod.key || !hasOverride}
                      className="text-[11px] font-semibold px-2.5 py-1.5 rounded border border-input text-muted-foreground hover:text-red-700 hover:border-red-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      <RotateCcw size={12} />
                      Reset default
                    </button>
                    <div className="flex items-center gap-2">
                      {isDirty && (
                        <button
                          onClick={() =>
                            setDrafts((prev) => {
                              const { [mod.key]: _, ...rest } = prev;
                              return rest;
                            })
                          }
                          className="text-[11px] font-semibold px-2.5 py-1.5 rounded text-muted-foreground hover:text-foreground flex items-center gap-1.5"
                        >
                          <X size={12} />
                          Batal
                        </button>
                      )}
                      <button
                        onClick={() => save(mod)}
                        disabled={savingKey === mod.key || !isDirty}
                        className="text-[11px] font-semibold px-3 py-1.5 rounded bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                      >
                        <Save size={12} />
                        {savingKey === mod.key ? 'Menyimpan…' : 'Simpan'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
