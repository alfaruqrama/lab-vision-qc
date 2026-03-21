import { useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQCStore } from '@/hooks/use-qc-store';
import { evaluateWestgard } from '@/lib/westgard';
import type { InstrumentType, ControlLevel, ParamName, ParamConfig, QCRecord } from '@/lib/types';
import { getParamsForInstrument, PARAM_UNITS } from '@/lib/types';
import * as api from '@/lib/api';
import { Camera, ArrowLeft, Loader2, Sparkles, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

export default function InputQC() {
  const navigate = useNavigate();
  const { config, addRecord, connected } = useQCStore();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [alat, setAlat] = useState<InstrumentType | null>(null);
  const [level, setLevel] = useState<ControlLevel | null>(null);
  const [lotNumber, setLotNumber] = useState('');
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [analis, setAnalis] = useState('');
  const [values, setValues] = useState<Partial<Record<ParamName, string>>>({});
  const [catatan, setCatatan] = useState('');
  const [saving, setSaving] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<api.ReadStrukResult | null>(null);
  const [aiConfidence, setAiConfidence] = useState<number | null>(null);
  // Store full Easylite AI data for switching levels without re-photo
  const [easyliteAIData, setEasyliteAIData] = useState<api.ReadStrukResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const lots = useMemo(() => {
    if (!alat) return [];
    return alat === 'CA660' ? config.CA660 : config.EASYLITE;
  }, [alat, config]);

  const selectedLot = useMemo(() => {
    if (!alat || !lotNumber) return null;
    return lots.find((l: any) => l.lot === lotNumber) || null;
  }, [alat, lotNumber, lots]);

  function getParamConfig(param: ParamName): ParamConfig | null {
    if (!selectedLot || !level) return null;
    if (alat === 'CA660') {
      const lot = selectedLot as any;
      return lot.Kontrol?.[param] || null;
    } else {
      const lot = selectedLot as any;
      return lot[level]?.[param] || null;
    }
  }

  function handleInstrumentSelect(instrument: InstrumentType) {
    setAlat(instrument);
    setValues({});
    setPhotoPreview(null);
    setAiConfidence(null);
    setAiResult(null);
    setEasyliteAIData(null);
    if (instrument === 'CA660') {
      setLevel('Kontrol');
      setStep(3);
    } else {
      setLevel(null);
      setStep(2);
    }
    const firstLot = instrument === 'CA660' ? config.CA660[0] : config.EASYLITE[0];
    setLotNumber(firstLot?.lot || '');
  }

  function handleLevelSelect(lvl: ControlLevel) {
    setLevel(lvl);
    setStep(3);
    // If we have Easylite AI data from photo, auto-fill the selected level
    if (easyliteAIData && easyliteAIData[lvl as 'NORMAL' | 'HIGH']) {
      setTimeout(() => {
        const levelData = easyliteAIData[lvl as 'NORMAL' | 'HIGH'] as any;
        if (levelData) {
          const newValues: Partial<Record<ParamName, string>> = {};
          (['Na', 'K', 'Cl'] as ParamName[]).forEach(p => {
            if (levelData[p] !== null && levelData[p] !== undefined) {
              newValues[p] = String(levelData[p]);
            }
          });
          setValues(newValues);
          toast.success(`Data ${lvl} dari foto sudah terisi`);
        }
      }, 100);
    }
  }

  function handlePhotoCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setPhotoPreview(dataUrl);
      sendToAI(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  async function sendToAI(dataUrl: string) {
    if (!alat) return;
    setAiLoading(true);
    setAiConfidence(null);
    setAiResult(null);

    try {
      const [meta, base64Data] = dataUrl.split(',');
      const mediaType = meta.match(/:(.*?);/)?.[1] || 'image/jpeg';

      if (!connected) {
        // Demo mode: simulate
        simulateAIExtraction();
        return;
      }

      const response = await api.readStruk(base64Data, mediaType, alat);

      if (response.status === 'ok' && response.data && !response.data.parseError) {
        applyAIResult(response.data);
      } else {
        toast.error('AI gagal baca otomatis, isi manual ya');
        setAiLoading(false);
      }
    } catch (err) {
      console.error('AI extraction error:', err);
      toast.error('Koneksi ke Apps Script gagal');
      setAiLoading(false);
    }
  }

  function applyAIResult(data: api.ReadStrukResult) {
    setAiResult(data);
    const params = getParamsForInstrument(alat!);

    // For Easylite: AI returns both NORMAL and HIGH in one response
    let values_to_set = data;
    if (alat === 'EASYLITE' && data.NORMAL && data.HIGH) {
      setEasyliteAIData(data);
      // Use current level's data
      const levelData = data[level as 'NORMAL' | 'HIGH'];
      if (levelData) {
        values_to_set = { ...data, ...levelData };
      }
    }

    // Calculate accuracy
    const filled = params.filter(p => {
      const val = (values_to_set as any)[p];
      return val !== null && val !== undefined;
    }).length;
    const acc = Math.round((filled / params.length) * 100);
    setAiConfidence(acc);

    // Auto-fill form
    const newValues: Partial<Record<ParamName, string>> = {};
    params.forEach(p => {
      const val = (values_to_set as any)[p];
      if (val !== null && val !== undefined) {
        newValues[p] = String(val);
      }
    });
    setValues(newValues);

    // Auto-fill lot and tanggal if available
    if (data.lot) setLotNumber(data.lot);
    if (data.tanggal) setTanggal(data.tanggal);

    setAiLoading(false);

    if (alat === 'EASYLITE' && data.NORMAL && data.HIGH) {
      toast.success('AI baca kedua level sekaligus! Switch Normal/High untuk isi level lainnya.');
    } else {
      toast.success('AI berhasil baca struk! Periksa sebelum simpan.');
    }
  }

  function simulateAIExtraction() {
    const params = getParamsForInstrument(alat!);
    setTimeout(() => {
      const extracted: Partial<Record<ParamName, string>> = {};
      params.forEach(p => {
        const cfg = getParamConfig(p);
        if (cfg) {
          const val = cfg.mean + (Math.random() - 0.5) * cfg.sd * 2;
          extracted[p] = val.toFixed(p === 'INR' ? 2 : 1);
        }
      });
      setValues(extracted);
      setAiConfidence(Math.round(85 + Math.random() * 12));
      setAiLoading(false);
      toast.success('Nilai berhasil diekstrak dari foto (demo)');
    }, 2000);
  }

  function handleRetakePhoto() {
    setPhotoPreview(null);
    setAiConfidence(null);
    setAiResult(null);
    setEasyliteAIData(null);
    fileRef.current?.click();
  }

  function handleValueChange(param: ParamName, val: string) {
    setValues(prev => ({ ...prev, [param]: val }));
  }

  async function handleSave() {
    if (!alat || !level || !lotNumber || !analis.trim()) {
      toast.error('Lengkapi semua field yang wajib');
      return;
    }
    const params = getParamsForInstrument(alat);
    const hasValues = params.some(p => values[p] && values[p]!.trim());
    if (!hasValues) { toast.error('Isi minimal satu nilai parameter'); return; }

    setSaving(true);
    const parsedParams: Partial<Record<ParamName, number>> = {};
    const statuses: Partial<Record<ParamName, any>> = {};
    params.forEach(p => {
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
      alat,
      level,
      lot: lotNumber,
      params: parsedParams,
      status: statuses,
      analis: analis.trim(),
      catatan,
    };

    try {
      await addRecord(record);
      toast.success('Data QC berhasil disimpan!');
      navigate('/qc');
    } catch {
      toast.error('Gagal menyimpan data');
    } finally {
      setSaving(false);
    }
  }

  const params = alat ? getParamsForInstrument(alat) : [];

  // Step 1: Select instrument
  if (step === 1) {
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-bold">Input QC Harian</h1>
        <p className="text-sm text-muted-foreground">Pilih instrumen</p>
        <div className="grid grid-cols-1 gap-3">
          <button onClick={() => handleInstrumentSelect('CA660')} className="card-clinical p-6 text-left hover:border-primary transition-colors">
            <h3 className="font-bold text-lg">Sysmex CA-660</h3>
            <p className="text-sm text-muted-foreground mt-1">Koagulasi — PT, APTT, INR</p>
            <p className="text-xs text-muted-foreground mt-0.5">1 level kontrol</p>
          </button>
          <button onClick={() => handleInstrumentSelect('EASYLITE')} className="card-clinical p-6 text-left hover:border-primary transition-colors">
            <h3 className="font-bold text-lg">Easylite</h3>
            <p className="text-sm text-muted-foreground mt-1">Elektrolit — Na⁺, K⁺, Cl⁻</p>
            <p className="text-xs text-muted-foreground mt-0.5">2 level kontrol (Normal & High)</p>
          </button>
        </div>
      </div>
    );
  }

  // Step 2: Select level (Easylite only)
  if (step === 2) {
    return (
      <div className="space-y-5">
        <button onClick={() => setStep(1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={16} /> Kembali
        </button>
        <h1 className="text-xl font-bold">Pilih Level Kontrol</h1>
        <p className="text-sm text-muted-foreground">Easylite</p>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => handleLevelSelect('NORMAL')} className="card-clinical p-6 text-center hover:border-primary transition-colors">
            <h3 className="font-bold">Normal</h3>
          </button>
          <button onClick={() => handleLevelSelect('HIGH')} className="card-clinical p-6 text-center hover:border-primary transition-colors">
            <h3 className="font-bold">High</h3>
          </button>
        </div>
      </div>
    );
  }

  // Step 3: Form
  return (
    <div className="space-y-5">
      <button onClick={() => alat === 'EASYLITE' ? setStep(2) : setStep(1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={16} /> Kembali
      </button>
      <div>
        <h1 className="text-xl font-bold">Input QC — {alat === 'CA660' ? 'Sysmex CA-660' : 'Easylite'}</h1>
        <p className="text-sm text-muted-foreground">Level: {level}</p>
      </div>

      {/* Photo upload */}
      <div>
        <label className="text-xs font-medium text-muted-foreground">Foto Struk</label>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} className="hidden" />
        {photoPreview ? (
          <div className="mt-1 relative">
            <img src={photoPreview} alt="Preview struk" className="w-full max-h-48 object-contain rounded-md border border-border" />
            {aiLoading && (
              <div className="absolute inset-0 bg-card/80 flex flex-col items-center justify-center rounded-md">
                <Loader2 className="animate-spin text-primary" size={32} />
                <p className="text-xs text-muted-foreground mt-2">AI membaca struk... (3–8 detik)</p>
              </div>
            )}
            {aiConfidence !== null && (
              <div className="absolute top-2 right-2 flex items-center gap-1 bg-card/90 px-2 py-1 rounded-full text-xs font-medium">
                <Sparkles size={12} className="text-primary" />
                {aiConfidence}% akurasi
              </div>
            )}
            <button
              onClick={handleRetakePhoto}
              className="absolute bottom-2 right-2 flex items-center gap-1 bg-card/90 px-2 py-1 rounded-full text-xs font-medium hover:bg-card transition-colors"
            >
              <RotateCcw size={12} /> Ulang
            </button>
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()} className="w-full mt-1 border-2 border-dashed border-border rounded-md p-8 flex flex-col items-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors">
            <Camera size={32} />
            <span className="text-sm">Tap untuk foto struk</span>
            <span className="text-xs">Semua parameter terbaca sekaligus</span>
          </button>
        )}
      </div>

      {/* AI Result Panel (Easylite both levels) */}
      {aiResult && alat === 'EASYLITE' && aiResult.NORMAL && aiResult.HIGH && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">🤖 AI Vision</span>
            <span className="text-xs text-muted-foreground">Akurasi: <b className="text-green-600">{aiConfidence}%</b></span>
          </div>
          <div className="grid grid-cols-1 gap-2">
            <div className="bg-green-50 dark:bg-green-950/30 rounded-md p-2 border border-green-200 dark:border-green-800">
              <div className="text-[10px] font-bold text-green-700 dark:text-green-400 uppercase">NORMAL — Na / K / Cl</div>
              <div className="text-sm font-mono font-bold">
                {aiResult.NORMAL.Na} / {aiResult.NORMAL.K} / {aiResult.NORMAL.Cl} <span className="text-xs text-muted-foreground">mmol/L</span>
              </div>
            </div>
            <div className="bg-orange-50 dark:bg-orange-950/30 rounded-md p-2 border border-orange-200 dark:border-orange-800">
              <div className="text-[10px] font-bold text-orange-700 dark:text-orange-400 uppercase">HIGH — Na / K / Cl</div>
              <div className="text-sm font-mono font-bold">
                {aiResult.HIGH.Na} / {aiResult.HIGH.K} / {aiResult.HIGH.Cl} <span className="text-xs text-muted-foreground">mmol/L</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Result Panel (CA660 single) */}
      {aiResult && alat === 'CA660' && !aiResult.parseError && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">🤖 AI Vision</span>
            <span className="text-xs text-muted-foreground">Akurasi: <b className="text-green-600">{aiConfidence}%</b></span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(['PT', 'APTT', 'INR'] as ParamName[]).map(p => (
              <div key={p} className="bg-card rounded-md p-2 border border-border">
                <div className="text-[10px] font-bold text-muted-foreground uppercase">{p}</div>
                <div className="text-sm font-mono font-bold">
                  {(aiResult as any)[p] ?? '—'} <span className="text-xs text-muted-foreground">{PARAM_UNITS[p]}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Meta fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">No. Lot</label>
          <select value={lotNumber} onChange={e => setLotNumber(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-card text-sm">
            {lots.map((l: any) => <option key={l.lot} value={l.lot}>{l.lot}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Tanggal</label>
          <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-card text-sm font-mono-data" />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs font-medium text-muted-foreground">Nama Analis</label>
          <input type="text" value={analis} onChange={e => setAnalis(e.target.value)} placeholder="Masukkan nama analis" className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-card text-sm" />
        </div>
      </div>

      {/* Parameter inputs */}
      <div>
        <h3 className="text-sm font-semibold mb-2">Nilai Parameter</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {params.map(param => {
            const cfg = getParamConfig(param);
            const val = values[param] || '';
            const numVal = parseFloat(val);
            let dotClass = 'status-dot-empty';
            let westgardChips: string[] = [];
            if (val && !isNaN(numVal) && cfg) {
              const result = evaluateWestgard(numVal, cfg);
              dotClass = result.status === 'ok' ? 'status-dot-ok' : result.status === 'warning' ? 'status-dot-warning' : 'status-dot-oos';
              westgardChips = result.rules;
            }
            return (
              <div key={param} className="card-clinical p-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${dotClass} transition-colors`} />
                    <span className="text-sm font-semibold">{param}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{PARAM_UNITS[param]}</span>
                </div>
                {cfg && (
                  <p className="text-[10px] text-muted-foreground mb-1.5">
                    Ref: {cfg.mean} ± {cfg.sd}
                  </p>
                )}
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="any"
                    inputMode="decimal"
                    value={val}
                    onChange={e => handleValueChange(param, e.target.value)}
                    placeholder="0.0"
                    className="flex-1 px-2 py-1.5 rounded-md border border-border bg-background text-base font-mono-data text-center"
                  />
                </div>
                {westgardChips.length > 0 && (
                  <div className="flex gap-1 mt-1.5">
                    {westgardChips.map(rule => (
                      <span key={rule} className="text-[10px] px-1.5 py-0.5 rounded-full status-oos font-semibold">{rule}</span>
                    ))}
                  </div>
                )}
                {val && !isNaN(numVal) && cfg && evaluateWestgard(numVal, cfg).status === 'warning' && (
                  <div className="flex gap-1 mt-1.5">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full status-warning font-semibold">1-2s</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="text-xs font-medium text-muted-foreground">Catatan / Tindakan Korektif</label>
        <textarea value={catatan} onChange={e => setCatatan(e.target.value)} rows={2} placeholder="Opsional" className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-card text-sm resize-none" />
      </div>

      {/* Connection indicator */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground'}`} />
        {connected ? 'Data tersimpan ke Google Sheets' : 'Mode demo — data tersimpan lokal'}
      </div>

      {/* Save */}
      <button onClick={handleSave} disabled={saving} className="w-full py-3 rounded-md bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
        {saving && <Loader2 className="animate-spin" size={16} />}
        {saving ? 'Menyimpan...' : '💾 Simpan Data QC'}
      </button>
    </div>
  );
}
