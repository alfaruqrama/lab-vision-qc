import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { InstrumentType, ControlLevel, ParamName, ParamConfig, QCRecord, EasyliteLotConfig } from '@/lib/types';
import { getParamsForInstrument, PARAM_UNITS } from '@/lib/types';
import { evaluateWestgard } from '@/lib/westgard';
import * as api from '@/lib/api';
import { useQCStore } from '@/hooks/use-qc-store';
import { useAuth } from '@/hooks/use-auth';
import { useAIExtraction } from '@/features/qc/hooks';
import { ParamValueCard } from '@/features/qc/components';
import { INSTRUMENT_LABELS } from '@/features/qc/lib/constants';
import { PhotoCapture } from './PhotoCapture';
import { AIResultPanel } from './AIResultPanel';
import { checkLotExpiry, formatExpiryMessage } from '@/lib/lot-expiry';

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

export function StepForm({ instrument, level, onBack }: StepFormProps) {
  const navigate = useNavigate();
  const { config, addRecord, connected, records } = useQCStore();
  const { user } = useAuth();

  // Form state
  const [lotNumber, setLotNumber] = useState('');
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
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
    if (instrument === 'CA660') return config.CA660;
    if (instrument === 'ONCALL1') return config.ONCALL1;
    if (instrument === 'ONCALL2') return config.ONCALL2;
    if (instrument === 'CLEVER1') return config.CLEVER1;
    if (instrument === 'CLEVER2') return config.CLEVER2;
    // EASYLITE: return NORMAL lots for the main selector
    return config.EASYLITE.NORMAL || [];
  }, [instrument, config]);

  const highLots = useMemo(() => {
    if (!isEasylite) return [];
    return config.EASYLITE.HIGH || [];
  }, [isEasylite, config]);

  // Auto-select first lot
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
    ): { params: Partial<Record<ParamName, number>>; statuses: Partial<Record<ParamName, string>> } {
      const parsedParams: Partial<Record<ParamName, number>> = {};
      const statuses: Partial<Record<ParamName, string>> = {};
      params.forEach((p) => {
        if (vals[p]) {
          const num = parseFloat(vals[p]!);
          if (!isNaN(num)) {
            parsedParams[p] = num;
            const cfg = lvl ? getParamConfig(p, lvl) : getParamConfig(p);
            statuses[p] = cfg ? evaluateWestgard(num, cfg).status : 'ok';
          }
        }
      });
      return { params: parsedParams, statuses };
    }

    function makeRecord(lvl: ControlLevel, p: ReturnType<typeof parseParams>): QCRecord {
      return {
        id: `qc-${Date.now()}-${lvl.toLowerCase()}`,
        timestamp: new Date().toISOString(),
        tanggal,
        alat: instrument,
        level: lvl,
        lot: lvl === 'HIGH' ? highLotNumber : lotNumber,
        params: p.params,
        status: p.statuses as QCRecord['status'],
        analis: user?.nama || 'Unknown',
        catatan,
      };
    }

    try {
      if (isEasylite) {
        const normal = parseParams(values, 'NORMAL');
        const high = parseParams(highValues, 'HIGH');
        await Promise.all([addRecord(makeRecord('NORMAL', normal)), addRecord(makeRecord('HIGH', high))]);
      } else {
        const single = parseParams(values);
        await addRecord(makeRecord(level, single));
      }
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
                {l.lot}
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
                  {l.lot}
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
