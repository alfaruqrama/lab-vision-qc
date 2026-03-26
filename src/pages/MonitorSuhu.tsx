import { useState, useRef, useMemo } from 'react';
import { Settings, Camera, Download, Printer, BarChart3, FileText, Thermometer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useSuhuStore, type SuhuEntry } from '@/hooks/use-suhu-store';
import { toast } from 'sonner';

const ROOMS = [
  { id: 'ruang_proses', label: 'Ruang Proses', icon: '🔬', hasHumidity: true, type: 'room' as const, code: 'RP-01' },
  { id: 'ruang_mikrobio', label: 'Ruang Mikrobiologi', icon: '🧫', hasHumidity: true, type: 'room' as const, code: 'RM-02' },
  { id: 'ruang_reagen', label: 'Ruang Reagen', icon: '⚗️', hasHumidity: true, type: 'room' as const, code: 'RR-03' },
  { id: 'kulkas_gea', label: 'Kulkas GEA', icon: '❄️', hasHumidity: false, type: 'fridge' as const, code: 'KG-04' },
  { id: 'kulkas_polytron', label: 'Kulkas Polytron', icon: '❄️', hasHumidity: false, type: 'fridge' as const, code: 'KP-05' },
  { id: 'kulkas_sharp', label: 'Kulkas Sharp', icon: '❄️', hasHumidity: false, type: 'fridge' as const, code: 'KS-06' },
];

function parseRange(s: string) {
  const [min, max] = s.split('-').map(Number);
  return { min: min || 0, max: max || 100 };
}

function isNormal(suhu: number, type: 'room' | 'fridge') {
  const batasRuang = localStorage.getItem('suhu_batas_ruang') || '18-28';
  const batasKulkas = localStorage.getItem('suhu_batas_kulkas') || '2-8';
  const { min, max } = parseRange(type === 'fridge' ? batasKulkas : batasRuang);
  return suhu >= min && suhu <= max;
}

function exportCSV(sessionData: Record<string, SuhuEntry>, petugas: string) {
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, '0');
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const yyyy = today.getFullYear();
  let csv = 'No,Ruangan,Kode,Suhu (°C),Kelembapan (%),Waktu,Petugas,Status,Catatan\n';
  ROOMS.forEach((room, i) => {
    const d = sessionData[room.id];
    if (!d) {
      csv += `${i + 1},"${room.label}","${room.code}",,,,,Belum Diinput,\n`;
      return;
    }
    const t = new Date(d.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const ok = isNormal(d.suhu, room.type);
    csv += `${i + 1},"${room.label}","${room.code}",${d.suhu},${d.rh ?? ''},"${t}","${petugas}","${ok ? 'Normal' : 'Periksa'}","${(d.catatan || '').replace(/"/g, '""')}"\n`;
  });
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: `Suhu_${dd}-${mm}-${yyyy}.csv` });
  a.click();
  URL.revokeObjectURL(url);
  toast.success('CSV berhasil diunduh ✓');
}

const HARI_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

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

  // Settings state
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
        // No AI URL - open dialog with empty fields
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

    // Save to GAS
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

  // Chart data
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

  const today = new Date();
  const todayStr = `${HARI_ID[today.getDay()]}, ${today.getDate()} ${BULAN_ID[today.getMonth()]} ${today.getFullYear()}`;
  const noGasAi = !localStorage.getItem('suhu_gas_ai');

  return (
    <div className="space-y-4">
      {/* Header */}
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

        {/* TAB INPUT */}
        <TabsContent value="input" className="space-y-4">
          {/* Session bar */}
          <Card>
            <CardContent className="pt-4 pb-4 space-y-3">
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <div className="flex-1 w-full">
                  <Label className="text-xs text-muted-foreground">Nama Petugas</Label>
                  <Input placeholder="Nama petugas..." value={petugas} onChange={e => setPetugas(e.target.value)} className="mt-1" />
                </div>
                <div className="text-right whitespace-nowrap">
                  <span className="text-sm font-semibold">{doneCount} / 6 selesai</span>
                </div>
              </div>
              <Progress value={(doneCount / 6) * 100} className="h-2" />
            </CardContent>
          </Card>

          {/* Room cards */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Ruangan</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {ROOMS.filter(r => r.type === 'room').map(room => {
                const d = sessionData[room.id];
                const loading = loadingRoom === room.id;
                return (
                  <Card
                    key={room.id}
                    className={`cursor-pointer transition-all hover:shadow-md border-t-[3px] border-t-emerald-500 ${d ? 'bg-emerald-500/5' : ''}`}
                    onClick={() => handleCardClick(room)}
                  >
                    <CardContent className="pt-4 pb-4 text-center space-y-1">
                      <div className="text-2xl">{room.icon}</div>
                      <p className="text-[10px] font-mono text-muted-foreground">{room.code}</p>
                      <p className="text-xs font-semibold truncate">{room.label}</p>
                      {loading ? (
                        <Badge variant="outline" className="text-[10px] animate-pulse">Membaca...</Badge>
                      ) : d ? (
                        <>
                          <p className="text-lg font-mono font-bold">{d.suhu}°C</p>
                          {d.rh != null && <p className="text-[10px] text-muted-foreground">RH {d.rh}%</p>}
                          <Badge className="text-[10px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-0">✓ Done</Badge>
                        </>
                      ) : (
                        <>
                          <p className="text-[10px] text-muted-foreground">Tap untuk foto</p>
                          <Badge variant="outline" className="text-[10px]">Belum</Badge>
                        </>
                      )}
                    </CardContent>
                    <input
                      ref={el => { fileRefs.current[room.id] = el; }}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={e => handleFileChange(room, e)}
                    />
                  </Card>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Kulkas</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {ROOMS.filter(r => r.type === 'fridge').map(room => {
                const d = sessionData[room.id];
                const loading = loadingRoom === room.id;
                return (
                  <Card
                    key={room.id}
                    className={`cursor-pointer transition-all hover:shadow-md border-t-[3px] border-t-blue-500 ${d ? 'bg-blue-500/5' : ''}`}
                    onClick={() => handleCardClick(room)}
                  >
                    <CardContent className="pt-4 pb-4 text-center space-y-1">
                      <div className="text-2xl">{room.icon}</div>
                      <p className="text-[10px] font-mono text-muted-foreground">{room.code}</p>
                      <p className="text-xs font-semibold truncate">{room.label}</p>
                      {loading ? (
                        <Badge variant="outline" className="text-[10px] animate-pulse">Membaca...</Badge>
                      ) : d ? (
                        <>
                          <p className="text-lg font-mono font-bold">{d.suhu}°C</p>
                          <Badge className="text-[10px] bg-blue-500/20 text-blue-700 dark:text-blue-400 border-0">✓ Done</Badge>
                        </>
                      ) : (
                        <>
                          <p className="text-[10px] text-muted-foreground">Tap untuk foto</p>
                          <Badge variant="outline" className="text-[10px]">Belum</Badge>
                        </>
                      )}
                    </CardContent>
                    <input
                      ref={el => { fileRefs.current[room.id] = el; }}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={e => handleFileChange(room, e)}
                    />
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Session log */}
          {sessionLog.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm">Log Sesi</CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Waktu</TableHead>
                        <TableHead className="text-xs">Ruangan</TableHead>
                        <TableHead className="text-xs">Suhu</TableHead>
                        <TableHead className="text-xs">RH</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessionLog.map((log, i) => {
                        const room = ROOMS.find(r => r.id === log.roomId);
                        const ok = room ? isNormal(log.suhu, room.type) : true;
                        return (
                          <TableRow key={i}>
                            <TableCell className="text-xs font-mono">{new Date(log.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</TableCell>
                            <TableCell className="text-xs">{log.roomLabel}</TableCell>
                            <TableCell className="text-xs font-mono font-semibold">{log.suhu}°C</TableCell>
                            <TableCell className="text-xs font-mono">{log.rh != null ? `${log.rh}%` : '—'}</TableCell>
                            <TableCell>
                              <Badge variant={ok ? 'default' : 'outline'} className={`text-[10px] ${ok ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-0' : 'border-amber-500 text-amber-600'}`}>
                                {ok ? 'Normal' : '⚠ Cek'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {doneCount > 0 && (
            <Button variant="outline" size="sm" className="text-destructive" onClick={() => { clearSession(); toast.success('Sesi direset'); }}>
              🗑 Reset Sesi
            </Button>
          )}
        </TabsContent>

        {/* TAB GRAFIK */}
        <TabsContent value="grafik" className="space-y-4">
          {doneCount === 0 ? (
            <Card className="p-12 text-center">
              <Camera size={40} className="mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">📷 Input data di tab Input dulu</p>
            </Card>
          ) : (
            <>
              {/* Stat cards */}
              <div className="grid grid-cols-3 gap-3">
                <Card><CardContent className="pt-4 pb-4 text-center"><p className="text-[10px] text-muted-foreground">Lokasi</p><p className="text-xl font-bold">{doneCount}/6</p></CardContent></Card>
                <Card><CardContent className="pt-4 pb-4 text-center"><p className="text-[10px] text-muted-foreground">Rata-rata Suhu</p><p className="text-xl font-bold font-mono">{avgSuhu}°C</p></CardContent></Card>
                <Card><CardContent className="pt-4 pb-4 text-center"><p className="text-[10px] text-muted-foreground">Rata-rata RH</p><p className="text-xl font-bold font-mono">{avgRh}%</p></CardContent></Card>
              </div>

              {/* Toggle */}
              <div className="flex gap-2">
                <Button size="sm" variant={chartMode === 'suhu' ? 'default' : 'outline'} onClick={() => setChartMode('suhu')}>Suhu °C</Button>
                <Button size="sm" variant={chartMode === 'rh' ? 'default' : 'outline'} onClick={() => setChartMode('rh')}>Kelembapan %</Button>
              </div>

              {/* Chart */}
              <Card>
                <CardContent className="pt-4 pb-4">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={chartMode === 'rh' ? chartData.filter(d => d.rh !== null) : chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} domain={chartMode === 'rh' ? [0, 100] : ['auto', 'auto']} />
                      <Tooltip formatter={(val: number) => chartMode === 'rh' ? `${val}%` : `${val}°C`} />
                      <Bar dataKey={chartMode === 'rh' ? 'rh' : 'suhu'} radius={[4, 4, 0, 0]}>
                        {(chartMode === 'rh' ? chartData.filter(d => d.rh !== null) : chartData).map((entry, idx) => (
                          <Cell key={idx} fill={chartMode === 'rh' ? '#3b82f6' : entry.type === 'fridge' ? '#3b82f6' : '#10b981'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Summary list */}
              <div className="space-y-2">
                {ROOMS.map(room => {
                  const d = sessionData[room.id];
                  const ok = d ? isNormal(d.suhu, room.type) : null;
                  return (
                    <div key={room.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                      <span className="text-lg">{room.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{room.label}</p>
                      </div>
                      <span className="font-mono text-sm font-semibold">{d ? `${d.suhu}°C` : '—'}</span>
                      {d?.rh != null && <span className="font-mono text-xs text-muted-foreground">{d.rh}%</span>}
                      {ok !== null && (
                        <Badge variant={ok ? 'default' : 'outline'} className={`text-[10px] ${ok ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-0' : 'border-amber-500 text-amber-600'}`}>
                          {ok ? 'Normal' : '⚠ Cek'}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </TabsContent>

        {/* TAB LAPORAN */}
        <TabsContent value="laporan" className="space-y-4">
          {/* Header */}
          <Card>
            <CardContent className="pt-4 pb-4 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-semibold">{todayStr}</p>
                  <p className="text-xs text-muted-foreground">Petugas: {petugas || '—'}</p>
                  <p className="text-xs text-muted-foreground">Lokasi dicatat: {doneCount} / 6</p>
                </div>
                <Badge variant={doneCount === 6 ? 'default' : 'outline'} className={doneCount === 6 ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-0' : ''}>
                  {doneCount === 6 ? '✓ Lengkap' : `${6 - doneCount} belum`}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Export buttons */}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer size={14} className="mr-1" /> Export PDF
            </Button>
            <Button size="sm" variant="outline" onClick={() => exportCSV(sessionData, petugas)}>
              <Download size={14} className="mr-1" /> Export CSV
            </Button>
          </div>

          {/* Report table */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs w-8">#</TableHead>
                      <TableHead className="text-xs">Ruangan</TableHead>
                      <TableHead className="text-xs">Kode</TableHead>
                      <TableHead className="text-xs">Suhu</TableHead>
                      <TableHead className="text-xs">RH</TableHead>
                      <TableHead className="text-xs">Waktu</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Catatan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ROOMS.map((room, i) => {
                      const d = sessionData[room.id];
                      const ok = d ? isNormal(d.suhu, room.type) : null;
                      return (
                        <TableRow key={room.id} className={ok === false ? 'bg-amber-50 dark:bg-amber-950/20' : ''}>
                          <TableCell className="text-xs">{i + 1}</TableCell>
                          <TableCell className="text-xs font-medium">{room.label}</TableCell>
                          <TableCell className="text-xs font-mono">{room.code}</TableCell>
                          <TableCell className="text-xs font-mono font-semibold">{d ? `${d.suhu}°C` : '—'}</TableCell>
                          <TableCell className="text-xs font-mono">{d?.rh != null ? `${d.rh}%` : '—'}</TableCell>
                          <TableCell className="text-xs font-mono">{d ? new Date(d.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '—'}</TableCell>
                          <TableCell>
                            {ok === null ? <span className="text-xs text-muted-foreground">—</span> : (
                              <Badge variant={ok ? 'default' : 'outline'} className={`text-[10px] ${ok ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-0' : 'border-amber-500 text-amber-600'}`}>
                                {ok ? 'Normal' : 'Periksa'}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs max-w-[100px] truncate">{d?.catatan || '—'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
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

      {/* Print styles */}
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
