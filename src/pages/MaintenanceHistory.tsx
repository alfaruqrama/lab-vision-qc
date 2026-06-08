import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { HistoryTable } from '@/features/maintenance/components/HistoryTable';
import { ChecklistForm } from '@/features/maintenance/components/ChecklistForm';
import { ALAT_LABELS, TIPE_LABELS, MAINTENANCE_TEMPLATES } from '@/features/maintenance/lib/constants';
import { useMaintenanceStore } from '@/hooks/use-maintenance-store';
import { ChevronLeft, X } from 'lucide-react';
import type { MaintenanceAlat, MaintenanceRecord } from '@/lib/maintenance-types';

export default function MaintenanceHistory() {
  const [searchParams] = useSearchParams();
  const { records, deleteRecord } = useMaintenanceStore();

  const [filterAlat, setFilterAlat] = useState<string>(
    searchParams.get('alat') || '',
  );
  const [filterTipe, setFilterTipe] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<MaintenanceRecord | null>(null);

  const filtered = useMemo(() => {
    let result = records;
    if (filterAlat) result = result.filter((r) => r.alat === filterAlat);
    if (filterTipe) result = result.filter((r) => r.tipe === filterTipe);
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      result = result.filter(
        (r) =>
          r.petugas.toLowerCase().includes(q) ||
          r.catatan_umum.toLowerCase().includes(q) ||
          (r.tanggal && r.tanggal.includes(q)),
      );
    }
    return result;
  }, [records, filterAlat, filterTipe, filterSearch]);

  const selectedTemplate = selectedRecord
    ? MAINTENANCE_TEMPLATES.find(
        (t) => t.alat === selectedRecord.alat && t.tipe === selectedRecord.tipe,
      )
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.history.back()}>
          <ChevronLeft size={18} />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Riwayat Maintenance</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} record ditemukan</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Label className="text-xs text-muted-foreground mb-1 block">Alat</Label>
          <select
            value={filterAlat}
            onChange={(e) => setFilterAlat(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Semua alat</option>
            {(['BC6800', 'BC760', 'CA500600', 'EasyLyte', 'ALAT_UMUM'] as MaintenanceAlat[]).map((a) => (
              <option key={a} value={a}>
                {ALAT_LABELS[a]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <Label className="text-xs text-muted-foreground mb-1 block">Tipe</Label>
          <select
            value={filterTipe}
            onChange={(e) => setFilterTipe(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Semua tipe</option>
            <option value="daily">Harian</option>
            <option value="weekly">Mingguan</option>
            <option value="monthly">Bulanan</option>
            <option value="as_needed">Insidental</option>
            <option value="uji_fungsi">Uji Fungsi</option>
          </select>
        </div>
        <div className="flex-1">
          <Label className="text-xs text-muted-foreground mb-1 block">Cari</Label>
          <Input
            placeholder="Nama, tanggal, catatan..."
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            className="h-9 text-sm"
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <HistoryTable
          records={filtered}
          onDelete={(id) => deleteRecord(id)}
          onViewDetail={setSelectedRecord}
        />
      </Card>

      {/* Detail dialog */}
      {selectedRecord && selectedTemplate && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-sm">
                {ALAT_LABELS[selectedRecord.alat]} — {TIPE_LABELS[selectedRecord.tipe]}
              </h3>
              <p className="text-xs text-muted-foreground">
                {new Date(selectedRecord.tanggal).toLocaleDateString('id-ID', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
                {' · '}
                Petugas: {selectedRecord.petugas}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSelectedRecord(null)}
            >
              <X size={16} />
            </Button>
          </div>

          <ChecklistForm
            aktivitas={selectedTemplate.aktivitas}
            initial={selectedRecord.aktivitas}
            initialCatatan={selectedRecord.catatan}
            readOnly
          />

          {selectedRecord.catatan_umum && (
            <div className="mt-3 p-3 bg-muted rounded-md">
              <p className="text-xs font-medium text-muted-foreground mb-0.5">Catatan Umum:</p>
              <p className="text-sm">{selectedRecord.catatan_umum}</p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
