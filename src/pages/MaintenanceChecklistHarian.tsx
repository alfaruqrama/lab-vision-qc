import { useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ChecklistForm } from '@/features/maintenance/components/ChecklistForm';
import type { ActivityItem } from '@/features/maintenance/components/ChecklistForm';
import { MAINTENANCE_TEMPLATES, ALAT_LABELS } from '@/features/maintenance/lib/constants';
import { useMaintenanceStore } from '@/hooks/use-maintenance-store';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { Save, RotateCcw, ChevronLeft } from 'lucide-react';
import type { MaintenanceAlat, MaintenanceRecord } from '@/lib/maintenance-types';

function getToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function generateId(): string {
  return `maint-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function MaintenanceChecklistHarian() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { records, addRecord } = useMaintenanceStore();

  const alatParam = (searchParams.get('alat') as MaintenanceAlat) || 'BC6800';
  const [selectedAlat, setSelectedAlat] = useState<MaintenanceAlat>(alatParam);
  const [tanggal, setTanggal] = useState(getToday());
  const [catatanUmum, setCatatanUmum] = useState('');
  const [saving, setSaving] = useState(false);

  // Find daily template for the selected instrument
  const template = useMemo(
    () => MAINTENANCE_TEMPLATES.find((t) => t.alat === selectedAlat && t.tipe === 'daily'),
    [selectedAlat],
  );

  // Check for existing record today
  const existing = useMemo(
    () => records.find((r) => r.alat === selectedAlat && r.tanggal === tanggal && r.tipe === 'daily'),
    [records, selectedAlat, tanggal],
  );

  const [activityItems, setActivityItems] = useState<ActivityItem[]>([]);
  const isExisting = !!existing;

  const handleSave = async () => {
    if (!activityItems.some((a) => a.checked)) {
      toast.error('Centang minimal satu aktivitas');
      return;
    }

    setSaving(true);

    const aktivitas: Record<string, boolean> = {};
    const catatan: Record<string, string> = {};
    activityItems.forEach((a) => {
      aktivitas[a.nama] = a.checked;
      if (a.catatan) catatan[a.nama] = a.catatan;
    });

    const record: MaintenanceRecord = {
      id: existing?.id || generateId(),
      alat: selectedAlat,
      tipe: 'daily',
      tanggal,
      aktivitas,
      catatan,
      catatan_umum: catatanUmum,
      petugas: user?.nama || user?.username || 'Unknown',
    };

    try {
      await addRecord(record);
      navigate('/maintenance');
    } catch {
      // error already toasted by hook
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!confirm('Reset semua centang dan catatan?')) return;
    setActivityItems([]);
    setCatatanUmum('');
  };

  if (!template) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">Checklist Harian</h1>
        <Card className="p-8 text-center text-muted-foreground">
          <p>Tidak ada template harian untuk alat ini.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/maintenance')}>
          <ChevronLeft size={18} />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Checklist Harian</h1>
          <p className="text-sm text-muted-foreground">{template.nama}</p>
        </div>
      </div>

      {/* Selektor alat */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Alat</label>
          <select
            value={selectedAlat}
            onChange={(e) => {
              setSelectedAlat(e.target.value as MaintenanceAlat);
              setActivityItems([]);
            }}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            {(['BC6800', 'BC760', 'CA500600'] as MaintenanceAlat[]).map((a) => (
              <option key={a} value={a}>
                {ALAT_LABELS[a]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Tanggal</label>
          <input
            type="date"
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>
      </div>

      {isExisting && (
        <Card className="p-3 bg-amber-50 border-amber-200 text-sm text-amber-800">
          Data sudah ada untuk {selectedAlat} — {tanggal}. Menyimpan ulang akan ditambahkan sebagai record baru.
        </Card>
      )}

      {/* Checklist form */}
      <Card className="p-4">
        <ChecklistForm
          key={`${selectedAlat}-${tanggal}`}
          aktivitas={template.aktivitas}
          initial={existing?.aktivitas}
          initialCatatan={existing?.catatan}
          onChange={setActivityItems}
        />
      </Card>

      {/* Catatan umum */}
      <div>
        <label className="text-sm font-medium mb-1 block">Catatan Umum (opsional)</label>
        <Textarea
          placeholder="Tambahkan catatan atau keterangan tambahan..."
          value={catatanUmum}
          onChange={(e) => setCatatanUmum(e.target.value)}
          rows={2}
          className="resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save size={16} />
          {saving ? 'Menyimpan...' : 'Simpan Checklist'}
        </Button>
        <Button variant="outline" onClick={handleReset} disabled={saving} className="gap-2">
          <RotateCcw size={16} />
          Reset
        </Button>
      </div>
    </div>
  );
}
