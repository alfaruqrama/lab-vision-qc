import { useState, useRef, useMemo } from 'react';
import { Settings, Thermometer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useSuhuStore, type SuhuEntry } from '@/hooks/use-suhu-store';
import { toast } from 'sonner';
import { InputTab, GrafikTab, LaporanTab, ROOMS } from '@/features/suhu/components';

export default function MonitorSuhu() {
  const store = useSuhuStore();
  const { sessionData, sessionLog, petugas, setPetugas, saveEntry, clearSession } = store;

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [activeRoom, setActiveRoom] = useState<typeof ROOMS[0] | null>(null);
  const [previewImg, setPreviewImg] = useState('');
  const [aiResult, setAiResult] = useState<{ suhu: number; rh: number | null; confidence: number } | null>(null);
  const [confirmSuhu, setConfirmSuhu] = useState('');
  const [confirmRh, setConfirmRh] = useState('');
  const [confirmCatatan, setConfirmCatatan] = useState('');
  const [loadingRoom, setLoadingRoom] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<'suhu' | 'rh'>('suhu');

  const [sGasAi, setSGasAi] = useState(() => localStorage.getItem('suhu_gas_ai') || '');
  const [sGasSave, setSGasSave] = useState(() => localStorage.getItem('suhu_gas_save') || '');
  const [sBatasRuang, setSBatasRuang] = useState(() => localStorage.getItem('suhu_batas_ruang') || '18-28');
  const [sBatasKulkas, setSBatasKulkas] = useState(() => localStorage.getItem('suhu_batas_kulkas') || '2-8');

  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const doneCount = useMemo(() => Object.keys(sessionData).length, [sessionData]);

  const handleCardClick = (room: typeof ROOMS[0]) => {
    const ref = fileRefs.current[room.id];
    if (ref) ref.click();
  };

  const handleFileChange = async (room: typeof ROOMS[0], e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      setPreviewImg(dataUrl);
      setActiveRoom(room);

      const gasUrl = localStorage.getItem('suhu_gas_ai') || '';
      if (!gasUrl) {
        setAiResult(null);
        setConfirmSuhu('');
        setConfirmRh('');
        setConfirmCatatan('');
        setConfirmOpen(true);
        toast.error('GAS URL AI belum diset — input manual');
        return;
      }

      setLoadingRoom(room.id);
      toast.loading('Membaca foto...', { id: 'ai-read' });

      try {
        const response = await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'readThermometer',
            image: dataUrl,
            hasHumidity: room.hasHumidity,
            roomLabel: room.label,
          }),
        });
        const text = await response.text();
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) throw new Error('Response bukan JSON');
        const result = JSON.parse(match[0]);
        if (result.error) throw new Error(result.error);

        setAiResult({ suhu: result.suhu ?? result.temperature ?? 0, rh: result.rh ?? result.humidity ?? null, confidence: result.confidence ?? 0.8 });
        setConfirmSuhu(String(result.suhu ?? result.temperature ?? ''));
        setConfirmRh(room.hasHumidity ? String(result.rh ?? result.humidity ?? '') : '');
        setConfirmCatatan('');
        toast.dismiss('ai-read');
        toast.success('Foto terbaca AI');
      } catch (err: any) {
        toast.dismiss('ai-read');
        toast.error('Gagal baca AI: ' + (err.message || 'Unknown'));
        setAiResult(null);
        setConfirmSuhu('');
        setConfirmRh('');
        setConfirmCatatan('');
      } finally {
        setLoadingRoom(null);
        setConfirmOpen(true);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmSave = async () => {
    if (!activeRoom) return;
    const suhu = parseFloat(confirmSuhu);
    if (isNaN(suhu)) { toast.error('Suhu wajib diisi'); return; }
    const rh = activeRoom.hasHumidity && confirmRh ? parseFloat(confirmRh) : null;
    const entry: SuhuEntry = { suhu, rh, timestamp: new Date().toISOString(), catatan: confirmCatatan };

    const gasSaveUrl = localStorage.getItem('suhu_gas_save') || '';
    if (gasSaveUrl) {
      try {
        await fetch(gasSaveUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'saveData', roomId: activeRoom.id, roomLabel: activeRoom.label, code: activeRoom.code, suhu, rh, petugas, catatan: confirmCatatan }),
        });
      } catch { /* no-cors won't throw normally */ }
      toast.success(`✓ ${activeRoom.label} tersimpan`);
    } else {
      toast.warning('✓ Lokal · GAS Save URL belum diset');
    }

    saveEntry(activeRoom.id, entry, activeRoom.label, activeRoom.code);
    setConfirmOpen(false);
  };

  const saveSettings = () => {
    localStorage.setItem('suhu_gas_ai', sGasAi);
    localStorage.setItem('suhu_gas_save', sGasSave);
    localStorage.setItem('suhu_batas_ruang', sBatasRuang);
    localStorage.setItem('suhu_batas_kulkas', sBatasKulkas);
    toast.success('Pengaturan disimpan ✓');
    setSettingsOpen(false);
  };

  const chartData = useMemo(() => {
    return ROOMS.map(r => {
      const d = sessionData[r.id];
      const shortLabel = r.type === 'room' ? r.label.replace('Ruang ', 'R. ') : r.label.replace('Kulkas ', 'K. ');
      return { name: shortLabel, suhu: d?.suhu ?? null, rh: d?.rh ?? null, type: r.type };
    });
  }, [sessionData]);

  const avgSuhu = useMemo(() => {
    const vals = Object.values(sessionData).map(d => d.suhu);
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : '—';
  }, [sessionData]);

  const avgRh = useMemo(() => {
    const vals = ROOMS.filter(r => r.hasHumidity && sessionData[r.id]?.rh != null).map(r => sessionData[r.id].rh!);
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : '—';
  }, [sessionData]);

  const noGasAi = !localStorage.getItem('suhu_gas_ai');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Thermometer size={22} className="text-accent2" /> Monitor Suhu Lab</h1>
          <p className="text-sm text-muted-foreground">Pantau suhu ruang lab, kulkas reagen, freezer</p>
        </div>
        <Button variant="outline" size="icon" onClick={() => setSettingsOpen(true)}><Settings size={18} /></Button>
      </div>

      {noGasAi && (
        <div className="rounded-lg border border-warning/50 bg-warning/10 px-4 py-2 text-sm text-warning flex items-center gap-2">
          ⚠ GAS URL AI belum diset — buka ⚙ Pengaturan untuk konfigurasi.
        </div>
      )}

      <Tabs defaultValue="input">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="input">📷 Input</TabsTrigger>
          <TabsTrigger value="grafik">📊 Grafik</TabsTrigger>
          <TabsTrigger value="laporan">📄 Laporan</TabsTrigger>
        </TabsList>

        <TabsContent value="input" className="space-y-4">
          <InputTab
            sessionData={sessionData}
            sessionLog={sessionLog}
            petugas={petugas}
            setPetugas={setPetugas}
            loadingRoom={loadingRoom}
            doneCount={doneCount}
            onCardClick={handleCardClick}
            onFileChange={handleFileChange}
            onClearSession={() => { clearSession(); toast.success('Sesi direset'); }}
            fileRefs={fileRefs}
          />
        </TabsContent>

        <TabsContent value="grafik" className="space-y-4">
          <GrafikTab
            sessionData={sessionData}
            doneCount={doneCount}
            avgSuhu={avgSuhu}
            avgRh={avgRh}
            chartMode={chartMode}
            setChartMode={setChartMode}
            chartData={chartData}
          />
        </TabsContent>

        <TabsContent value="laporan" className="space-y-4">
          <LaporanTab
            sessionData={sessionData}
            petugas={petugas}
            doneCount={doneCount}
          />
        </TabsContent>
      </Tabs>

      {/* CONFIRM DIALOG */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">{activeRoom?.icon} {activeRoom?.label}</DialogTitle>
            <DialogDescription className="text-xs">Konfirmasi hasil pembacaan</DialogDescription>
          </DialogHeader>
          {previewImg && <img src={previewImg} alt="preview" className="rounded-lg max-h-[200px] w-full object-contain bg-muted" />}
          {aiResult && (
            <Badge className={`text-[10px] w-fit ${aiResult.confidence >= 0.7 ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-0' : 'bg-amber-500/20 text-amber-600 border-0'}`}>
              {aiResult.confidence >= 0.7 ? '✦ Terbaca AI — periksa sebelum simpan' : '⚠ Kepercayaan rendah'}
            </Badge>
          )}
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Suhu (°C) *</Label>
              <Input type="number" inputMode="decimal" step="0.1" value={confirmSuhu} onChange={e => setConfirmSuhu(e.target.value)} placeholder="Contoh: 24.5" className="font-mono mt-1" />
            </div>
            {activeRoom?.hasHumidity && (
              <div>
                <Label className="text-xs">Kelembapan / RH (%)</Label>
                <Input type="number" inputMode="decimal" step="0.1" value={confirmRh} onChange={e => setConfirmRh(e.target.value)} placeholder="Contoh: 55" className="font-mono mt-1" />
              </div>
            )}
            <div>
              <Label className="text-xs">Catatan (opsional)</Label>
              <Textarea value={confirmCatatan} onChange={e => setConfirmCatatan(e.target.value)} placeholder="Catatan tambahan..." className="mt-1" rows={2} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Batal</Button>
            <Button onClick={handleConfirmSave}>Simpan ✓</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SETTINGS DIALOG */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">⚙ Pengaturan Suhu</DialogTitle>
            <DialogDescription className="text-xs">Konfigurasi endpoint dan batas normal</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">GAS URL — AI Vision</Label>
              <Input value={sGasAi} onChange={e => setSGasAi(e.target.value)} placeholder="https://script.google.com/macros/s/.../exec" className="mt-1 text-xs" />
              <p className="text-[10px] text-muted-foreground mt-1">Endpoint GAS foto → Gemini Flash 2.5</p>
            </div>
            <div>
              <Label className="text-xs">GAS URL — Simpan Data</Label>
              <Input value={sGasSave} onChange={e => setSGasSave(e.target.value)} placeholder="https://script.google.com/macros/s/.../exec" className="mt-1 text-xs" />
              <p className="text-[10px] text-muted-foreground mt-1">Endpoint GAS doPost simpan ke Sheets</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Batas Ruangan (°C)</Label>
                <Input value={sBatasRuang} onChange={e => setSBatasRuang(e.target.value)} placeholder="18-28" className="mt-1 font-mono" />
              </div>
              <div>
                <Label className="text-xs">Batas Kulkas (°C)</Label>
                <Input value={sBatasKulkas} onChange={e => setSBatasKulkas(e.target.value)} placeholder="2-8" className="mt-1 font-mono" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveSettings}>Simpan Pengaturan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style>{`
        @media print {
          nav, header, [role="tablist"], button, .no-print { display: none !important; }
          body { background: white !important; }
          * { color: black !important; border-color: #ccc !important; }
          table { width: 100% !important; }
        }
      `}</style>
    </div>
  );
}
