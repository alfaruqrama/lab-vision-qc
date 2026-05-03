import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { InstrumentType, ControlLevel, ParamName, ParamConfig, QCRecord } from '@/lib/types';
import { getParamsForInstrument, PARAM_UNITS } from '@/lib/types';
import { evaluateWestgard } from '@/lib/westgard';
import * as api from '@/lib/api';
import { useQCStore } from '@/hooks/use-qc-store';
import { useAIExtraction } from '@/features/qc/hooks';
import { ParamValueCard } from '@/features/qc/components';
import { INSTRUMENT_LABELS } from '@/features/qc/lib/constants';
import { PhotoCapture } from './PhotoCapture';
import { AIResultPanel } from './AIResultPanel';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';

interface StepFormProps {
  instrument: InstrumentType;
  level: ControlLevel;
  onBack: () => void;
}

export function StepForm({ instrument, level, onBack }: StepFormProps) {
  const navigate = useNavigate();
  const { config, addRecord, connected } = useQCStore();

  // Form state
  const [lotNumber, setLotNumber] = useState('');
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [analis, setAnalis] = useState('');
  const [values, setValues] = useState<Partial<Record<ParamName, string>>>({});
  const [catatan, setCatatan] = useState('');
  const [saving, setSaving] = useState(false);

  const params = getParamsForInstrument(instrument);

  // Lot options
  const lots = useMemo(() => {
    if (instrument === 'CA660') return config.CA660;
    if (instrument === 'ONCALL1') return config.ONCALL1;
    if (instrument === 'ONCALL2') return config.ONCALL2;
    return config.EASYLITE;
  }, [instrument, config]);

  // Auto-select first lot
  useMemo(() => {
    if (lots.length > 0 && !lotNumber) {
      setLotNumber(lots[0].lot);
    }
  }, [lots]);

  const selectedLot = useMemo(() => {
    return lots.find((l) => l.lot === lotNumber) || null;
  }, [lots, lotNumber]);

  // Get param config for a specific parameter
  const getParamConfig = useCallback(
    (param: ParamName): ParamConfig | null => {
      if (!selectedLot || !level) return null;
      if (instrument === 'CA660') {
        const lot = selectedLot as { Kontrol: Record<string, ParamConfig> };
        return lot.Kontrol?.[param] || null;
      }
      if (instrument === 'ONCALL1' || instrument === 'ONCALL2') {
        const lot = selectedLot as Record<string, Record<string, ParamConfig>>;
        return lot[level]?.[param] || null;
      }
      // EASYLITE
      const lot = selectedLot as Record<string, Record<string, ParamConfig>>;
      return lot[level]?.[param] || null;
    },
    [selectedLot, level, instrument],
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

  function handleValueChange(param: ParamName, val: string) {
    setValues((prev) => ({ ...prev, [param]: val }));
  }

  async function handleSave() {
    if (!lotNumber || !analis.trim()) {
      toast.error('Lengkapi semua field yang wajib');
      return;
    }
    const hasValues = params.some((p) => values[p] && values[p]!.trim());
    if (!hasValues) {
      toast.error('Isi minimal satu nilai parameter');
      return;
    }

    setSaving(true);
    const parsedParams: Partial<Record<ParamName, number>> = {};
    const statuses: Partial<Record<ParamName, string>> = {};
    params.forEach((p) => {
      if (values[p]) {
        const num = parseFloat(values[p]!);
        if (!isNaN(num)) {
          parsedParams[p] = num;
          const cfg = getParamConfig(p);
          statuses[p] = cfg ? evaluateWestgard(num, cfg).status : 'ok';
        }
      }
    });

    const record: QCRecord = {
      id: `qc-${Date.now()}`,
      timestamp: new Date().toISOString(),
      tanggal,
      alat: instrument,
      level,
      lot: lotNumber,
      params: parsedParams,
      status: statuses as QCRecord['status'],
      analis: analis.trim(),
      catatan,
    };

    try {
      await addRecord(record);
      navigate('/qc');
    } catch {
      toast.error('Gagal menyimpan data');
    } finally {
      setSaving(false);
    }
  }

  const showPhotoCapture = instrument !== 'ONCALL1' && instrument !== 'ONCALL2';

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 -ml-2 text-muted-foreground">
        <ArrowLeft size={16} /> Kembali
      </Button>

      <div>
        <h1 className="text-xl font-bold">Input QC — {INSTRUMENT_LABELS[instrument]}</h1>
        <p className="text-sm text-muted-foreground">Level: {level}</p>
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">No. Lot</Label>
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
        <div className="space-y-1.5">
          <Label className="text-xs">Tanggal</Label>
          <Input
            type="date"
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
            className="font-mono-data"
          />
        </div>
        <div className="md:col-span-2 space-y-1.5">
          <Label className="text-xs">Nama Analis</Label>
          <Input
            type="text"
            value={analis}
            onChange={(e) => setAnalis(e.target.value)}
            placeholder="Masukkan nama analis"
          />
        </div>
      </div>

      {/* Parameter inputs */}
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
            Data tersimpan ke Google Sheets
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
