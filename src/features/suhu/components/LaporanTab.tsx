import { Printer, Download } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { type SuhuEntry } from '@/hooks/use-suhu-store';
import { ROOMS, isNormal } from './InputTab';
import { toast } from 'sonner';

const HARI_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

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

interface LaporanTabProps {
  sessionData: Record<string, SuhuEntry>;
  petugas: string;
  doneCount: number;
}

export function LaporanTab({ sessionData, petugas, doneCount }: LaporanTabProps) {
  const today = new Date();
  const todayStr = `${HARI_ID[today.getDay()]}, ${today.getDate()} ${BULAN_ID[today.getMonth()]} ${today.getFullYear()}`;

  return (
    <div className="space-y-4">
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

      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => window.print()}>
          <Printer size={14} className="mr-1" /> Export PDF
        </Button>
        <Button size="sm" variant="outline" onClick={() => exportCSV(sessionData, petugas)}>
          <Download size={14} className="mr-1" /> Export CSV
        </Button>
      </div>

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
    </div>
  );
}
