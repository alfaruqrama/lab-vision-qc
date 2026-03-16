import { useState } from 'react';
import { useQCStore } from '@/hooks/use-qc-store';
import type { LotConfig, CA660LotConfig, EasyliteLotConfig, ParamConfig } from '@/lib/types';
import { Trash2, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type TabType = 'CA660' | 'EASYLITE';

function ParamRow({ label, config, onChange }: { label: string; config: ParamConfig; onChange: (c: ParamConfig) => void }) {
  return (
    <tr className="border-b border-border">
      <td className="px-2 py-2 text-sm font-semibold">{label}</td>
      <td className="px-2 py-1">
        <input
          type="number"
          step="any"
          value={config.mean}
          onChange={e => onChange({ ...config, mean: parseFloat(e.target.value) || 0 })}
          className="w-full px-2 py-1 rounded-md border border-border bg-background text-sm font-mono-data text-center"
        />
      </td>
      <td className="px-2 py-1">
        <input
          type="number"
          step="any"
          value={config.sd}
          onChange={e => onChange({ ...config, sd: parseFloat(e.target.value) || 0 })}
          className="w-full px-2 py-1 rounded-md border border-border bg-background text-sm font-mono-data text-center"
        />
      </td>
    </tr>
  );
}

function CA660Card({ lot, onUpdate, onDelete }: { lot: CA660LotConfig; onUpdate: (l: CA660LotConfig) => void; onDelete: () => void }) {
  return (
    <div className="card-clinical overflow-hidden">
      <div className="bg-navy px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-navy-foreground">{lot.lot || 'Lot Baru'}</p>
          <p className="text-[10px] text-navy-foreground/60">Sysmex CA-660</p>
        </div>
        <button onClick={onDelete} className="text-navy-foreground/60 hover:text-destructive transition-colors"><Trash2 size={16} /></button>
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">No. Lot</label>
            <input value={lot.lot} onChange={e => onUpdate({ ...lot, lot: e.target.value })} className="w-full mt-1 px-2 py-1.5 rounded-md border border-border bg-background text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Exp. Date</label>
            <input type="date" value={lot.exp} onChange={e => onUpdate({ ...lot, exp: e.target.value })} className="w-full mt-1 px-2 py-1.5 rounded-md border border-border bg-background text-sm font-mono-data" />
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1">Kontrol</p>
          <table className="w-full text-xs">
            <thead><tr className="bg-muted"><th className="px-2 py-1 text-left">Parameter</th><th className="px-2 py-1 text-center">Mean</th><th className="px-2 py-1 text-center">SD</th></tr></thead>
            <tbody>
              <ParamRow label="PT" config={lot.Kontrol.PT} onChange={c => onUpdate({ ...lot, Kontrol: { ...lot.Kontrol, PT: c } })} />
              <ParamRow label="APTT" config={lot.Kontrol.APTT} onChange={c => onUpdate({ ...lot, Kontrol: { ...lot.Kontrol, APTT: c } })} />
              <ParamRow label="INR" config={lot.Kontrol.INR} onChange={c => onUpdate({ ...lot, Kontrol: { ...lot.Kontrol, INR: c } })} />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function EasyliteCard({ lot, onUpdate, onDelete }: { lot: EasyliteLotConfig; onUpdate: (l: EasyliteLotConfig) => void; onDelete: () => void }) {
  function updateLevel(level: 'NORMAL' | 'HIGH', param: 'Na' | 'K' | 'Cl', config: ParamConfig) {
    onUpdate({ ...lot, [level]: { ...lot[level], [param]: config } });
  }

  return (
    <div className="card-clinical overflow-hidden">
      <div className="bg-navy px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-navy-foreground">{lot.lot || 'Lot Baru'}</p>
          <p className="text-[10px] text-navy-foreground/60">Easylite</p>
        </div>
        <button onClick={onDelete} className="text-navy-foreground/60 hover:text-destructive transition-colors"><Trash2 size={16} /></button>
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">No. Lot</label>
            <input value={lot.lot} onChange={e => onUpdate({ ...lot, lot: e.target.value })} className="w-full mt-1 px-2 py-1.5 rounded-md border border-border bg-background text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Exp. Date</label>
            <input type="date" value={lot.exp} onChange={e => onUpdate({ ...lot, exp: e.target.value })} className="w-full mt-1 px-2 py-1.5 rounded-md border border-border bg-background text-sm font-mono-data" />
          </div>
        </div>
        {(['NORMAL', 'HIGH'] as const).map(level => (
          <div key={level}>
            <p className="text-xs font-semibold text-muted-foreground mb-1">{level}</p>
            <table className="w-full text-xs">
              <thead><tr className="bg-muted"><th className="px-2 py-1 text-left">Parameter</th><th className="px-2 py-1 text-center">Mean</th><th className="px-2 py-1 text-center">SD</th></tr></thead>
              <tbody>
                {(['Na', 'K', 'Cl'] as const).map(p => (
                  <ParamRow key={p} label={p} config={lot[level][p]} onChange={c => updateLevel(level, p, c)} />
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LotConfigPage() {
  const { config, updateConfig } = useQCStore();
  const [tab, setTab] = useState<TabType>('CA660');
  const [localConfig, setLocalConfig] = useState<LotConfig>(() => JSON.parse(JSON.stringify(config)));
  const [saving, setSaving] = useState(false);

  function addCA660Lot() {
    setLocalConfig(prev => ({
      ...prev,
      CA660: [...prev.CA660, { lot: '', exp: '', Kontrol: { PT: { mean: 0, sd: 0 }, APTT: { mean: 0, sd: 0 }, INR: { mean: 0, sd: 0 } } }],
    }));
  }

  function addEasyliteLot() {
    setLocalConfig(prev => ({
      ...prev,
      EASYLITE: [...prev.EASYLITE, {
        lot: '', exp: '',
        NORMAL: { Na: { mean: 0, sd: 0 }, K: { mean: 0, sd: 0 }, Cl: { mean: 0, sd: 0 } },
        HIGH: { Na: { mean: 0, sd: 0 }, K: { mean: 0, sd: 0 }, Cl: { mean: 0, sd: 0 } },
      }],
    }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateConfig(localConfig);
      toast.success('Konfigurasi lot berhasil disimpan!');
    } catch {
      toast.error('Gagal menyimpan konfigurasi');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Konfigurasi Lot</h1>
        <p className="text-sm text-muted-foreground">Atur mean & SD untuk setiap lot kontrol</p>
      </div>

      {/* Tab switch */}
      <div className="flex gap-2">
        <button onClick={() => setTab('CA660')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'CA660' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
          Sysmex CA-660
        </button>
        <button onClick={() => setTab('EASYLITE')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'EASYLITE' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
          Easylite
        </button>
      </div>

      {/* Lot cards */}
      <div className="space-y-4">
        {tab === 'CA660' ? (
          <>
            {localConfig.CA660.map((lot, i) => (
              <CA660Card
                key={i}
                lot={lot}
                onUpdate={updated => {
                  const arr = [...localConfig.CA660];
                  arr[i] = updated;
                  setLocalConfig(prev => ({ ...prev, CA660: arr }));
                }}
                onDelete={() => {
                  setLocalConfig(prev => ({ ...prev, CA660: prev.CA660.filter((_, j) => j !== i) }));
                }}
              />
            ))}
            <button onClick={addCA660Lot} className="w-full py-4 rounded-lg border-2 border-dashed border-border text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2">
              <Plus size={16} /> Tambah Lot Baru
            </button>
          </>
        ) : (
          <>
            {localConfig.EASYLITE.map((lot, i) => (
              <EasyliteCard
                key={i}
                lot={lot}
                onUpdate={updated => {
                  const arr = [...localConfig.EASYLITE];
                  arr[i] = updated;
                  setLocalConfig(prev => ({ ...prev, EASYLITE: arr }));
                }}
                onDelete={() => {
                  setLocalConfig(prev => ({ ...prev, EASYLITE: prev.EASYLITE.filter((_, j) => j !== i) }));
                }}
              />
            ))}
            <button onClick={addEasyliteLot} className="w-full py-4 rounded-lg border-2 border-dashed border-border text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2">
              <Plus size={16} /> Tambah Lot Baru
            </button>
          </>
        )}
      </div>

      {/* Save */}
      <button onClick={handleSave} disabled={saving} className="w-full py-3 rounded-md bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
        {saving && <Loader2 className="animate-spin" size={16} />}
        {saving ? 'Menyimpan...' : 'Simpan Konfigurasi'}
      </button>
    </div>
  );
}
