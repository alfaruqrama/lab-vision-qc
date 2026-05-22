import { useState } from 'react';
import { useQCStore } from '@/hooks/use-qc-store';
import type { LotConfig, ParamConfig, InstrumentType } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { INSTRUMENT_LABELS, INSTRUMENT_ICONS, INSTRUMENT_COLORS } from '@/features/qc/lib/constants';
import { Trash2, Plus, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { checkLotExpiry, formatExpiryMessage } from '@/lib/lot-expiry';

type TabType = keyof LotConfig;
type EasyliteLevel = 'NORMAL' | 'HIGH';

// ─── Reusable ParamRow ───────────────────────────────────────────────────────

function ParamRow({
  label,
  config,
  onChange,
}: {
  label: string;
  config: ParamConfig;
  onChange: (c: ParamConfig) => void;
}) {
  return (
    <TableRow>
      <TableCell className="px-2 py-1.5 text-xs font-semibold">{label}</TableCell>
      <TableCell className="px-2 py-1">
        <Input
          type="number"
          step="any"
          value={config.mean === 0 ? '' : config.mean}
          onChange={(e) => onChange({ ...config, mean: e.target.value === '' ? 0 : parseFloat(e.target.value) || 0 })}
          className="h-7 text-xs font-mono-data text-center"
        />
      </TableCell>
      <TableCell className="px-2 py-1">
        <Input
          type="number"
          step="any"
          value={config.sd === 0 ? '' : config.sd}
          onChange={(e) => onChange({ ...config, sd: e.target.value === '' ? 0 : parseFloat(e.target.value) || 0 })}
          className="h-7 text-xs font-mono-data text-center"
        />
      </TableCell>
    </TableRow>
  );
}

// ─── Generic Lot Card ────────────────────────────────────────────────────────

interface LotCardProps {
  instrument: InstrumentType;
  lotNumber: string;
  expDate: string;
  onLotChange: (lot: string) => void;
  onExpChange: (exp: string) => void;
  onDelete: () => void;
  children: React.ReactNode;
}

function LotCard({ instrument, lotNumber, expDate, onLotChange, onExpChange, onDelete, children }: LotCardProps) {
  const Icon = INSTRUMENT_ICONS[instrument];
  const colors = INSTRUMENT_COLORS[instrument];
  const { status, daysRemaining } = checkLotExpiry(expDate);

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="bg-navy px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', colors.bg, colors.border, 'border')}>
            <Icon size={14} className={colors.text} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-navy-foreground">{lotNumber || 'Lot Baru'}</p>
              {status === 'expired' && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-destructive text-destructive-foreground rounded uppercase tracking-wide">
                  EXPIRED
                </span>
              )}
              {status === 'expiring-soon' && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-warning text-warning-foreground rounded tracking-wide">
                  {formatExpiryMessage(daysRemaining)}
                </span>
              )}
              {status === 'unknown' && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-muted text-muted-foreground rounded">
                  NO EXP
                </span>
              )}
            </div>
            <p className="text-[10px] text-navy-foreground/60">{INSTRUMENT_LABELS[instrument]}</p>
          </div>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-navy-foreground/60 hover:text-destructive hover:bg-destructive/10">
              <Trash2 size={16} />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Hapus Lot?</AlertDialogTitle>
              <AlertDialogDescription>
                Lot <strong>{lotNumber || 'ini'}</strong> akan dihapus. Tindakan ini tidak dapat dibatalkan.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Hapus
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">No. Lot</Label>
            <Input value={lotNumber} onChange={(e) => onLotChange(e.target.value)} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Exp. Date</Label>
            <Input type="date" value={expDate} onChange={(e) => onExpChange(e.target.value)} className="h-8 text-sm font-mono-data" />
          </div>
        </div>
        {children}
      </div>
    </Card>
  );
}

// ─── Param Table ─────────────────────────────────────────────────────────────

function ParamTable({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground mb-1">{label}</p>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="h-7 px-2 text-[10px]">Parameter</TableHead>
            <TableHead className="h-7 px-2 text-[10px] text-center">Mean</TableHead>
            <TableHead className="h-7 px-2 text-[10px] text-center">SD</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>{children}</TableBody>
      </Table>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function LotConfigPage() {
  const { config, updateConfig } = useQCStore();
  const [selectedInstrument, setSelectedInstrument] = useState<InstrumentType>('CA660');
  const [localConfig, setLocalConfig] = useState<LotConfig>(() => JSON.parse(JSON.stringify(config)));
  const [saving, setSaving] = useState(false);

  function addCA660Lot() {
    setLocalConfig((prev) => ({
      ...prev,
      CA660: [...prev.CA660, { lot: '', exp: '', Kontrol: { PT: { mean: 0, sd: 0 }, APTT: { mean: 0, sd: 0 }, INR: { mean: 0, sd: 0 } } }],
    }));
  }

  function addOnCallLot(key: 'ONCALL1' | 'ONCALL2') {
    setLocalConfig((prev) => ({
      ...prev,
      [key]: [
        ...prev[key],
        {
          lot: '',
          exp: '',
          CTRL0: { GDA: { mean: 0, sd: 0 } },
          CTRL1: { GDA: { mean: 0, sd: 0 } },
          CTRL2: { GDA: { mean: 0, sd: 0 } },
        },
      ],
    }));
  }

  function updateLot<T>(key: TabType, index: number, updated: T) {
    setLocalConfig((prev) => {
      const arr = [...(prev[key] as any[])];
      arr[index] = updated;
      return { ...prev, [key]: arr };
    });
  }

  function deleteLot(key: TabType, index: number) {
    setLocalConfig((prev) => ({
      ...prev,
      [key]: (prev[key] as any[]).filter((_, j) => j !== index),
    }));
  }

  function addEasyliteLevelLot(level: EasyliteLevel) {
    setLocalConfig((prev) => ({
      ...prev,
      EASYLITE: {
        ...prev.EASYLITE,
        [level]: [
          ...prev.EASYLITE[level],
          { lot: '', exp: '', params: { Na: { mean: 0, sd: 0 }, K: { mean: 0, sd: 0 }, Cl: { mean: 0, sd: 0 } } },
        ],
      },
    }));
  }

  function updateEasyliteLot(level: EasyliteLevel, index: number, updated: LotConfig['EASYLITE'][EasyliteLevel][number]) {
    setLocalConfig((prev) => {
      const lots = [...prev.EASYLITE[level]];
      lots[index] = updated;
      return { ...prev, EASYLITE: { ...prev.EASYLITE, [level]: lots } };
    });
  }

  function deleteEasyliteLot(level: EasyliteLevel, index: number) {
    setLocalConfig((prev) => ({
      ...prev,
      EASYLITE: {
        ...prev.EASYLITE,
        [level]: prev.EASYLITE[level].filter((_, j) => j !== index),
      },
    }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateConfig(localConfig);
    } catch {
      toast.error('Gagal menyimpan konfigurasi');
    } finally {
      setSaving(false);
    }
  }

  const instrumentOptions: { value: InstrumentType; label: string }[] = [
    { value: 'CA660', label: 'Sysmex CA-660' },
    { value: 'EASYLITE', label: 'Easylite' },
    { value: 'ONCALL1', label: 'On Call Sure 1' },
    { value: 'ONCALL2', label: 'On Call Sure 2' },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Konfigurasi Lot</h1>
        <p className="text-sm text-muted-foreground">Atur mean & SD untuk setiap lot kontrol</p>
      </div>

      {/* Instrument selector */}
      <div className="flex items-center gap-3">
        <Label className="text-sm font-semibold">Instrumen:</Label>
        <select
          value={selectedInstrument}
          onChange={(e) => setSelectedInstrument(e.target.value as InstrumentType)}
          className="flex h-9 w-full max-w-xs rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {instrumentOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Lot cards */}
      <div className="space-y-4">
        {/* CA660 */}
        {selectedInstrument === 'CA660' &&
          localConfig.CA660.map((lot, i) => (
            <LotCard
              key={i}
              instrument="CA660"
              lotNumber={lot.lot}
              expDate={lot.exp}
              onLotChange={(v) => updateLot('CA660', i, { ...lot, lot: v })}
              onExpChange={(v) => updateLot('CA660', i, { ...lot, exp: v })}
              onDelete={() => deleteLot('CA660', i)}
            >
              <ParamTable label="Kontrol">
                <ParamRow label="PT" config={lot.Kontrol.PT} onChange={(c) => updateLot('CA660', i, { ...lot, Kontrol: { ...lot.Kontrol, PT: c } })} />
                <ParamRow label="APTT" config={lot.Kontrol.APTT} onChange={(c) => updateLot('CA660', i, { ...lot, Kontrol: { ...lot.Kontrol, APTT: c } })} />
                <ParamRow label="INR" config={lot.Kontrol.INR} onChange={(c) => updateLot('CA660', i, { ...lot, Kontrol: { ...lot.Kontrol, INR: c } })} />
              </ParamTable>
            </LotCard>
          ))}

        {/* EASYLITE */}
        {selectedInstrument === 'EASYLITE' &&
          (['NORMAL', 'HIGH'] as const).map((level) => (
            <div key={level} className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">EasyLite {level === 'NORMAL' ? 'Normal' : 'High'}</h2>
                <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => addEasyliteLevelLot(level)}>
                  <Plus size={14} /> Tambah {level === 'NORMAL' ? 'Normal' : 'High'}
                </Button>
              </div>
              {localConfig.EASYLITE[level].map((lot, i) => (
                <LotCard
                  key={`${level}-${i}`}
                  instrument="EASYLITE"
                  lotNumber={lot.lot}
                  expDate={lot.exp}
                  onLotChange={(v) => updateEasyliteLot(level, i, { ...lot, lot: v })}
                  onExpChange={(v) => updateEasyliteLot(level, i, { ...lot, exp: v })}
                  onDelete={() => deleteEasyliteLot(level, i)}
                >
                  <ParamTable label={level}>
                    {(['Na', 'K', 'Cl'] as const).map((p) => (
                      <ParamRow
                        key={p}
                        label={p}
                        config={lot.params[p]}
                        onChange={(c) => updateEasyliteLot(level, i, { ...lot, params: { ...lot.params, [p]: c } })}
                      />
                    ))}
                  </ParamTable>
                </LotCard>
              ))}
            </div>
          ))}

        {/* ONCALL1 / ONCALL2 */}
        {(selectedInstrument === 'ONCALL1' || selectedInstrument === 'ONCALL2') &&
          localConfig[selectedInstrument].map((lot, i) => (
            <LotCard
              key={i}
              instrument={selectedInstrument}
              lotNumber={lot.lot}
              expDate={lot.exp}
              onLotChange={(v) => updateLot(selectedInstrument, i, { ...lot, lot: v })}
              onExpChange={(v) => updateLot(selectedInstrument, i, { ...lot, exp: v })}
              onDelete={() => deleteLot(selectedInstrument, i)}
            >
              {(['CTRL0', 'CTRL1', 'CTRL2'] as const).map((ctrl) => (
                <ParamTable key={ctrl} label={ctrl.replace('CTRL', 'CTRL ')}>
                  <ParamRow
                    label="GDA (mg/dL)"
                    config={lot[ctrl].GDA}
                    onChange={(c) => updateLot(selectedInstrument, i, { ...lot, [ctrl]: { GDA: c } })}
                  />
                </ParamTable>
              ))}
            </LotCard>
          ))}

        {/* Add lot button */}
        {selectedInstrument !== 'EASYLITE' && (
        <button
          onClick={() => {
            if (selectedInstrument === 'CA660') addCA660Lot();
            else addOnCallLot(selectedInstrument);
          }}
          className={cn(
            'w-full py-4 rounded-xl border-2 border-dashed border-border',
            'text-sm font-medium text-muted-foreground',
            'hover:border-primary hover:text-primary transition-all',
            'flex items-center justify-center gap-2',
          )}
        >
          <Plus size={16} /> Tambah Lot Baru
        </button>
        )}
      </div>

      {/* Save */}
      <Button onClick={handleSave} disabled={saving} className="w-full h-11 gap-2">
        {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
        {saving ? 'Menyimpan...' : 'Simpan Konfigurasi'}
      </Button>
    </div>
  );
}
