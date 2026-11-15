import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { InstrumentType, ControlLevel, ParamName, ParamConfig, QCRecord } from '@/lib/types';
import { getParamsForInstrument, PARAM_UNITS } from '@/lib/types';
import { parseParamValues } from '@/lib/param-parse';
import * as api from '@/lib/api';
import { useQCStore } from '@/features/qc/hooks/useQCStore';
import { useAuth } from '@/hooks/use-auth';
import { useAIExtraction } from '@/features/qc/hooks';
import { ParamValueCard } from '@/features/qc/components';
import { INSTRUMENT_LABELS } from '@/features/qc/lib/constants';
import { PhotoCapture } from './PhotoCapture';
import { AIResultPanel } from './AIResultPanel';
import { checkLotExpiry, formatExpiryMessage } from '@/lib/lot-expiry';
import { lotHasTarget } from '@/lib/lot-target';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Loader2, Wifi, WifiOff, AlertTriangle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface StepFormProps {
  instrument: InstrumentType;
  level: ControlLevel;
  onBack: () => void;
}

interface LotLike {
  lot: string;
  exp: string;
}

/**
 * Order lot options for the input form: usable lots first (soonest expiry first,
 * which is the lot currently in use), then expired/incomplete ones.
 *
 * The array order in lot_config is whatever order the config page happened to
 * save — a demo lot or a half-filled new row can sit first. Auto-selecting
 * `lots[0]` blindly then records runs against the wrong target (that is how two
 * CLEVER runs ended up on the demo lot with mean 100 ± 5 and read as OOS).
 */
function orderLotsForInput<T extends LotLike>(lots: T[]): T[] {
  const rank = (lot: T) => {
    const { status } = checkLotExpiry(lot.exp);
    // Usable lots first; a lot with no target or a past expiry goes last so it
    // is never the one auto-selected.
    if (status === 'expired' || status === 'unknown' || !lotHasTarget(lot)) return 1;
    return 0;
  };
  return [...lots].sort((a, b) => {
    const byRank = rank(a) - rank(b);
    if (byRank !== 0) return byRank;
    return a.exp.localeCompare(b.exp);
  });
}

/**
 * Suffix shown in the lot dropdown so a lot with no usable target (or one that
 * has already expired) can never be picked by accident.
 */
function lotOptionLabel(lot: LotLike, hasTarget: boolean): string {
  const notes: string[] = [];
  const { status } = checkLotExpiry(lot.exp);
  if (status === 'expired') notes.push('kedaluwarsa');
  else if (status === 'unknown') notes.push('tanpa tanggal ED');
  if (!hasTarget) notes.push('target belum diisi');
  return notes.length > 0 ? `${lot.lot} — ${notes.join(', ')}` : lot.lot;
}


export function StepForm({ instrument, level, onBack }: StepFormProps) {
  const navigate = useNavigate();
  const { config, addRecord, connected, records } = useQCStore();
  const { user } = useAuth();

  // Helper to get current date in WIB (UTC+7)
  const getWIBDate = () => {
    const now = new Date();
    const wibOffset = 7 * 60 * 60 * 1000;
    const wibDate = new Date(now.getTime() + wibOffset);
    return wibDate.toISOString().slice(0, 10);
  };

  // Form state
  const [lotNumber, setLotNumber] = useState('');
  const [tanggal, setTanggal] = useState(getWIBDate());
  const [values, setValues] = useState<Partial<Record<ParamName, string>>>({});
  const [catatan, setCatatan] = useState('');
  const [saving, setSaving] = useState(false);

  const params = getParamsForInstrument(instrument);
  const isEasylite = instrument === 'EASYLITE';

  // EASYLITE: separate state for HIGH level values & lot
  const [highValues, setHighValues] = useState<Partial<Record<ParamName, string>>>({});
  const [highLotNumber, setHighLotNumber] = useState('');

  // Lot options (non-EasyLite: single list; EasyLite: separate NORMAL/HIGH lists)
  const lots = useMemo(() => {
    if (instrument === 'CA660') return orderLotsForInput(config.CA660);
    if (instrument === 'ONCALL1') return orderLotsForInput(config.ONCALL1);
    if (instrument === 'ONCALL2') return orderLotsForInput(config.ONCALL2);
    if (instrument === 'CLEVER1') return orderLotsForInput(config.CLEVER1);
    if (instrument === 'CLEVER2') return orderLotsForInput(config.CLEVER2);
    // EASYLITE: return NORMAL lots for the main selector
    return orderLotsForInput(config.EASYLITE.NORMAL || []);
  }, [instrument, config]);

  const highLots = useMemo(() => {
    if (!isEasylite) return [];
    return orderLotsForInput(config.EASYLITE.HIGH || []);
  }, [isEasylite, config]);

  // Auto-select the first *usable* lot (soonest expiring, not expired, with a
  // filled-in target) rather than whatever happens to be first in the array.
  useEffect(() => {
    if (lots.length > 0 && (!lotNumber || !lots.some((lot) => lot.lot === lotNumber))) {
      setLotNumber(lots[0].lot);
    }
  }, [lots, lotNumber]);

  useEffect(() => {
    if (highLots.length > 0 && (!highLotNumber || !highLots.some((lot) => lot.lot === highLotNumber))) {
      setHighLotNumber(highLots[0].lot);
    }
  }, [highLots, highLotNumber]);

  const selectedLot = useMemo(() => {
    return lots.find((l) => l.lot === lotNumber) || null;
  }, [lots, lotNumber]);

  const selectedHighLot = useMemo(() => {
    if (!isEasylite) return null;
    return highLots.find((l) => l.lot === highLotNumber) || null;
  }, [isEasylite, highLots, highLotNumber]);

  const lotExpiry = useMemo(() => {
    if (!selectedLot) return null;
    return checkLotExpiry((selectedLot as { exp: string }).exp);
  }, [selectedLot]);

  const highLotExpiry = useMemo(() => {
    if (!selectedHighLot) return null;
    return checkLotExpiry((selectedHighLot as { exp: string }).exp);
  }, [selectedHighLot]);

  // Duplicate detection
  const duplicateRecords = useMemo(() => {
    const dups: QCRecord[] = [];

    if (isEasylite) {
      const hasNormal = params.some((p) => values[p] && values[p]!.trim());
      const hasHigh = params.some((p) => highValues[p] && highValues[p]!.trim());

      if (hasNormal) {
        const existing = records.find(
          (r) => r.alat === instrument && r.level === 'NORMAL' && r.tanggal === tanggal,
        );
        if (existing) dups.push(existing);
      }
      if (hasHigh) {
        const existing = records.find(
          (r) => r.alat === instrument && r.level === 'HIGH' && r.tanggal === tanggal,
        );
        if (existing) dups.push(existing);
      }
    } else {
      const existing = records.find(
        (r) => r.alat === instrument && r.level === level && r.tanggal === tanggal,
      );
      if (existing) dups.push(existing);
    }

    return dups;
  }, [records, instrument, level, tanggal, values, highValues, isEasylite, params]);

  // Get param config for a specific parameter
  const getParamConfig = useCallback(
    (param: ParamName, overrideLevel?: ControlLevel): ParamConfig | null => {
      const effectiveLevel = overrideLevel || level;
      if (!selectedLot || !effectiveLevel) return null;
      if (instrument === 'CA660' || instrument === 'CLEVER1' || instrument === 'CLEVER2') {
        const lot = selectedLot as { Kontrol: Record<string, ParamConfig> };
        return lot.Kontrol?.[param] || null;
      }
      if (instrument === 'ONCALL1' || instrument === 'ONCALL2') {
        const lot = selectedLot as Record<string, Record<string, ParamConfig>>;
        return lot[effectiveLevel]?.[param] || null;
      }
      // EASYLITE: look up from config by level array, using correct lot per level
      if (effectiveLevel === 'NORMAL' || effectiveLevel === 'HIGH') {
        const levelLots = config.EASYLITE[effectiveLevel] || [];
        const searchLot = effectiveLevel === 'HIGH' ? highLotNumber : lotNumber;
        const match = levelLots.find((l) => l.lot === searchLot);
        return match?.params?.[param] || null;
      }
      return null;
    },
    [selectedLot, level, instrument, config, lotNumber, highLotNumber],
  );

  // AI Extraction hook
  const ai = useAIExtraction({
    instrument,
    getParamConfig,
    onExtracted: (extractedValues, meta) => {
      setValues(extractedValues);
      if (meta?.lot) setLotNumber(meta.lot);
      if (meta?.tanggal) setTanggal(meta.tanggal);
    },
  });

  // When AI extracts EASYLITE data, also fill HIGH level values
  useEffect(() => {
    if (isEasylite && ai.easyliteData) {
      const highVals = ai.getEasyliteLevelValues('HIGH');
      if (highVals) {
        setHighValues(highVals);
      }
    }
  }, [isEasylite, ai.easyliteData]);

  function handleValueChange(param: ParamName, val: string) {
    setValues((prev) => ({ ...prev, [param]: val }));
  }

  function handleHighValueChange(param: ParamName, val: string) {
    setHighValues((prev) => ({ ...prev, [param]: val }));
  }

  async function handleSave() {
    if (!lotNumber) {
      toast.error('Pilih nomor lot');
      return;
    }

    if (isEasylite) {
      const hasNormal = params.some((p) => values[p] && values[p]!.trim());
      const hasHigh = params.some((p) => highValues[p] && highValues[p]!.trim());
      if (!hasNormal && !hasHigh) {
        toast.error('Isi minimal satu nilai parameter');
        return;
      }
    } else {
      const hasValues = params.some((p) => values[p] && values[p]!.trim());
      if (!hasValues) {
        toast.error('Isi minimal satu nilai parameter');
        return;
      }
    }

    setSaving(true);

    function parseParams(
      vals: Partial<Record<ParamName, string>>,
      lvl?: ControlLevel,
    ): ReturnType<typeof parseParamValues> {
      return parseParamValues(vals, params, (p) => getParamConfig(p, lvl));
    }

    function makeRecord(lvl: ControlLevel, p: ReturnType<typeof parseParams>): QCRecord {
      return {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        tanggal,
        alat: instrument,
        level: lvl,
        lot: lvl === 'HIGH' ? highLotNumber : lotNumber,
        params: p.params,
        status: p.statuses,
        analis: user?.nama || 'Unknown',
        catatan,
      };
    }

    try {
      let recordsToSave: QCRecord[] = [];
      if (isEasylite) {
        const normal = parseParams(values, 'NORMAL');
        const high = parseParams(highValues, 'HIGH');
        if (Object.keys(normal.params).length > 0) recordsToSave.push(makeRecord('NORMAL', normal));
        if (Object.keys(high.params).length > 0) recordsToSave.push(makeRecord('HIGH', high));
      } else {
        const single = parseParams(values);
        recordsToSave.push(makeRecord(level, single));
      }

      // Gross Error Validation: warn when any value sits more than 10SD from
      // its target — almost always a typo, not a real run.
      const grossErrors = recordsToSave.flatMap((r) =>
        Object.entries(r.params).filter(([param, value]) => {
          const cfg = getParamConfig(param as ParamName, r.level);
          return cfg && cfg.sd !== 0 && Math.abs((value - cfg.mean) / cfg.sd) > 10;
        }),
      );
      if (grossErrors.length > 0) {
        toast.warning(`Deteksi Gross Error: Beberapa nilai terlalu jauh dari target (>10SD). Pastikan input sudah benar.`);
      }

      // Per-parameter status is already on each record; the per-run verdict is
      // derived from it by the readers (getOverallStatus), so there is nothing
      // extra to store — qc_records has no overall_status column.
      await Promise.all(recordsToSave.map((r) => addRecord(r)));
      navigate('/qc');
    } catch {
      toast.error('Gagal menyimpan data');
    } finally {
      setSaving(false);
    }
  }

  const showPhotoCapture = instrument !== 'ONCALL1' && instrument !== 'ONCALL2' && instrument !== 'CLEVER1' && instrument !== 'CLEVER2';

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 -ml-2 text-muted-foreground">
        <ArrowLeft size={16} /> Kembali
      </Button>

      <div>
        <h1 className="text-xl font-bold">Input QC — {INSTRUMENT_LABELS[instrument]}</h1>
        <p className="text-sm text-muted-foreground">
          Level: {isEasylite ? 'Normal & High' : level}
        </p>
      </div>

      {/* Photo capture (CA660 & Easylite only) */}
      {showPhotoCapture && (
        <PhotoCapture
          photoPreview={ai.photoPreview}
          isLoading={ai.isLoading}
          confidence={ai.confidence}
          onCapture={ai.processPhoto}
          onRetake={ai.reset}
        />
      )}

      {/* AI Result Panel */}
      {ai.result && (
        <AIResultPanel
          result={ai.result}
          instrument={instrument}
          confidence={ai.confidence}
        />
      )}

      {/* Meta fields */}
      <div className={cn('grid gap-3', isEasylite ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2')}>
        <div className="space-y-1.5">
          <Label className="text-xs">{isEasylite ? 'No. Lot (Normal)' : 'No. Lot'}</Label>
          <select
            value={lotNumber}
            onChange={(e) => setLotNumber(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {lots.map((l) => (
              <option key={l.lot} value={l.lot}>
                {lotOptionLabel(l, lotHasTarget(l))}
              </option>
            ))}
          </select>
        </div>
        {isEasylite && (
          <div className="space-y-1.5">
            <Label className="text-xs">No. Lot (High)</Label>
            <select
              value={highLotNumber}
              onChange={(e) => setHighLotNumber(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {highLots.map((l) => (
                <option key={l.lot} value={l.lot}>
                  {lotOptionLabel(l, lotHasTarget(l))}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="space-y-1.5">
          <Label className="text-xs">Tanggal</Label>
          <Input
            type="date"
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
            className="font-mono-data"
          />
        </div>
      </div>

      {/* Lot expiry warning */}
      {[lotExpiry && { ...lotExpiry, label: isEasylite ? 'Lot Normal' : 'Lot' },
        isEasylite && highLotExpiry && { ...highLotExpiry, label: 'Lot High' }]
        .filter(Boolean)
        .map((exp, idx) => (
          <React.Fragment key={idx}>
            {exp!.status === 'expired' && (
              <Alert variant="destructive" className="animate-in slide-in-from-top-1 duration-200">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  <span className="font-semibold">{exp!.label} sudah expired</span> —{' '}
                  {formatExpiryMessage(exp!.daysRemaining)}. Sebaiknya gunakan lot baru atau update
                  tanggal expiry di{' '}
                  <button type="button" onClick={() => navigate('/qc/config')} className="underline font-semibold hover:no-underline">
                    Konfigurasi Lot
                  </button>.
                </AlertDescription>
              </Alert>
            )}
            {exp!.status === 'expiring-soon' && (
              <Alert variant="warning" className="animate-in slide-in-from-top-1 duration-200">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <span className="font-semibold">{exp!.label} akan expired</span> —{' '}
                  {formatExpiryMessage(exp!.daysRemaining)}. Siapkan lot baru segera.
                </AlertDescription>
              </Alert>
            )}
            {exp!.status === 'unknown' && (
              <Alert className="animate-in slide-in-from-top-1 duration-200">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Tanggal expiry {exp!.label.toLowerCase()} belum diset. Update di{' '}
                  <button type="button" onClick={() => navigate('/qc/config')} className="underline font-semibold hover:no-underline">
                    Konfigurasi Lot
                  </button>.
                </AlertDescription>
              </Alert>
            )}
          </React.Fragment>
        ))}

      {/* Parameter inputs */}
      {isEasylite ? (
        <div className="space-y-3">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_1fr] gap-3">
            <h3 className="text-sm font-semibold">NORMAL</h3>
            <h3 className="text-sm font-semibold">HIGH</h3>
          </div>
          {/* One row per parameter — keeps NORMAL & HIGH cards aligned */}
          {params.map((param) => (
            <div key={param} className="grid grid-cols-[1fr_1fr] gap-3">
              <ParamValueCard
                param={param}
                value={values[param] || ''}
                onChange={(val) => handleValueChange(param, val)}
                config={getParamConfig(param, 'NORMAL')}
              />
              <ParamValueCard
                param={param}
                value={highValues[param] || ''}
                onChange={(val) => handleHighValueChange(param, val)}
                config={getParamConfig(param, 'HIGH')}
              />
            </div>
          ))}
        </div>
      ) : (
        <div>
          <h3 className="text-sm font-semibold mb-2">Nilai Parameter</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {params.map((param) => (
              <ParamValueCard
                key={param}
                param={param}
                value={values[param] || ''}
                onChange={(val) => handleValueChange(param, val)}
                config={getParamConfig(param)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Duplicate warning */}
      {duplicateRecords.length > 0 && (
        <Alert variant="warning" className="animate-in slide-in-from-top-1 duration-200">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <span className="font-semibold">Peringatan: Data sudah pernah diinput</span>
            <br />
            {duplicateRecords.map((r) => (
              <span key={r.id} className="text-xs">
                {r.alat} — Level: {r.level} — {r.tanggal} (oleh {r.analis || '?'})
              </span>
            ))}
            <br />
            <span className="text-xs">Data dengan kombinasi alat, level, dan tanggal yang sama akan tetap tersimpan jika dilanjutkan.</span>
          </AlertDescription>
        </Alert>
      )}

      {/* Notes */}
      <div className="space-y-1.5">
        <Label className="text-xs">Catatan / Tindakan Korektif</Label>
        <textarea
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          rows={2}
          placeholder="Opsional"
          className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
        />
      </div>

      {/* Connection indicator */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {connected ? (
          <>
            <Wifi size={12} className="text-success" />
            Data tersimpan ke Supabase
          </>
        ) : (
          <>
            <WifiOff size={12} />
            Mode demo — data tersimpan lokal
          </>
        )}
      </div>

      {/* Save button */}
      <Button onClick={handleSave} disabled={saving} className="w-full h-11 text-sm font-semibold">
        {saving && <Loader2 className="animate-spin" size={16} />}
        {saving ? 'Menyimpan...' : 'Simpan Data QC'}
      </Button>
    </div>
  );
}
