import { useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { type SuhuEntry } from '@/hooks/use-suhu-store';

export const ROOMS = [
  { id: 'ruang_proses', label: 'Ruang Proses', icon: '🔬', hasHumidity: true, type: 'room' as const, code: 'RP-01' },
  { id: 'ruang_mikrobio', label: 'Ruang Mikrobiologi', icon: '🧫', hasHumidity: true, type: 'room' as const, code: 'RM-02' },
  { id: 'ruang_reagen', label: 'Ruang Reagen', icon: '⚗️', hasHumidity: true, type: 'room' as const, code: 'RR-03' },
  { id: 'kulkas_gea', label: 'Kulkas GEA', icon: '❄️', hasHumidity: false, type: 'fridge' as const, code: 'KG-04' },
  { id: 'kulkas_polytron', label: 'Kulkas Polytron', icon: '❄️', hasHumidity: false, type: 'fridge' as const, code: 'KP-05' },
  { id: 'kulkas_sharp', label: 'Kulkas Sharp', icon: '❄️', hasHumidity: false, type: 'fridge' as const, code: 'KS-06' },
];

export function parseRange(s: string) {
  const [min, max] = s.split('-').map(Number);
  return { min: min || 0, max: max || 100 };
}

export function isNormal(suhu: number, type: 'room' | 'fridge') {
  const batasRuang = localStorage.getItem('suhu_batas_ruang') || '18-28';
  const batasKulkas = localStorage.getItem('suhu_batas_kulkas') || '2-8';
  const { min, max } = parseRange(type === 'fridge' ? batasKulkas : batasRuang);
  return suhu >= min && suhu <= max;
}

interface InputTabProps {
  sessionData: Record<string, SuhuEntry>;
  sessionLog: Array<{ roomId: string; roomLabel: string; suhu: number; rh: number | null; timestamp: string }>;
  petugas: string;
  setPetugas: (v: string) => void;
  loadingRoom: string | null;
  doneCount: number;
  onCardClick: (room: typeof ROOMS[0]) => void;
  onFileChange: (room: typeof ROOMS[0], e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearSession: () => void;
  fileRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>;
}

export function InputTab({
  sessionData, sessionLog, petugas, setPetugas,
  loadingRoom, doneCount, onCardClick, onFileChange, onClearSession, fileRefs,
}: InputTabProps) {
  const renderRoomCard = (room: typeof ROOMS[0]) => {
    const d = sessionData[room.id];
    const loading = loadingRoom === room.id;
    const isRoom = room.type === 'room';
    const accentColor = isRoom ? 'emerald' : 'blue';

    return (
      <Card
        key={room.id}
        className={`cursor-pointer transition-all hover:shadow-md border-t-[3px] ${isRoom ? 'border-t-emerald-500' : 'border-t-blue-500'} ${d ? (isRoom ? 'bg-emerald-500/5' : 'bg-blue-500/5') : ''}`}
        onClick={() => onCardClick(room)}
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
              <Badge className={`text-[10px] bg-${accentColor}-500/20 text-${accentColor}-700 dark:text-${accentColor}-400 border-0`}>✓ Done</Badge>
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
          onChange={e => onFileChange(room, e)}
        />
      </Card>
    );
  };

  return (
    <div className="space-y-4">
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

      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Ruangan</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {ROOMS.filter(r => r.type === 'room').map(renderRoomCard)}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Kulkas</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {ROOMS.filter(r => r.type === 'fridge').map(renderRoomCard)}
        </div>
      </div>

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
        <Button variant="outline" size="sm" className="text-destructive" onClick={onClearSession}>
          🗑 Reset Sesi
        </Button>
      )}
    </div>
  );
}
