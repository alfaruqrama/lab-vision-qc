import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ChecklistForm } from '@/features/maintenance/components/ChecklistForm';
import type { ActivityItem } from '@/features/maintenance/components/ChecklistForm';
import { MAINTENANCE_TEMPLATES, ALAT_LABELS, TIPE_LABELS } from '@/features/maintenance/lib/constants';
import { useMaintenanceStore } from '@/hooks/use-maintenance-store';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { Save, RotateCcw, ChevronLeft } from 'lucide-react';
import type { MaintenanceAlat, MaintenanceTipe, MaintenanceRecord } from '@/lib/maintenance-types';

const TIPE_OPTIONS: MaintenanceTipe[] = ['weekly', 'monthly'];

function getMonthOptions() {
  const now = new Date();
  const options: { value: string; label: string }[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('id-ID', { year: 'numeric', month: 'long' }),
    });
  }
  return options;
}

function getWeekOptions() {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 8; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - d.getDay() + 1 - i * 7); // Monday
    const end = new Date(d);
    end.setDate(d.getDate() + 6); // Sunday
    options.push({
      value: d.toISOString().slice(0, 10),
      label: `${d.getDate()}/${d.getMonth() + 1} – ${end.getDate()}/${end.getMonth() + 1}/${end.getFullYear()}`,
    });
  }
  return options;
}

function generateId(): string {
  return `maint-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function MaintenanceChecklistBerkala() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { records, addRecord } = useMaintenanceStore();

  const [selectedAlat, setSelectedAlat] = useState<MaintenanceAlat>('BC6800');
  const [selectedTipe, setSelectedTipe] = useState<MaintenanceTipe>('weekly');
  const [selectedPeriod, setSelectedPeriod] = useState(getMonthOptions()[0].value);
  const [catatanUmum, setCatatanUmum] = useState('');
  const [saving, setSaving] = useState(false);
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([]);

  const template = useMemo(
    () => MAINTENANCE_TEMPLATES.find((t) => t.alat === selectedAlat && t.tipe === selectedTipe),
    [selectedAlat, selectedTipe],
  );

  const availableTipes = useMemo(
    () => TIPE_OPTIONS.filter((tipe) =>
      MAINTENANCE_TEMPLATES.some((t) => t.alat === selectedAlat && t.tipe === tipe),
    ),
    [selectedAlat],
  );

  const monthOptions = useMemo(() => getMonthOptions(), []);
  const weekOptions = useMemo(() => getWeekOptions(), []);

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
      id: generateId(),
      alat: selectedAlat,
      tipe: selectedTipe,
      tanggal: selectedPeriod,
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

  const periodOptions = selectedTipe === 'weekly' ? weekOptions : monthOptions;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/maintenance')}>
          <ChevronLeft size={18} />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Checklist Berkala</h1>
          <p className="text-sm text-muted-foreground">Maintenance mingguan & bulanan</p>
        </div>
      </div>

      {/* Selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Alat</label>
          <select
            value={selectedAlat}
            onChange={(e) => {
              setSelectedAlat(e.target.value as MaintenanceAlat);
              setActivityItems([]);
            }}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            {(['BC6800', 'BC760', 'CA500600', 'EasyLyte'] as MaintenanceAlat[]).map((a) => (
              <option key={a} value={a}>
                {ALAT_LABELS[a]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipe</label>
          <select
            value={selectedTipe}
            onChange={(e) => {
              setSelectedTipe(e.target.value as MaintenanceTipe);
              setActivityItems([]);
            }}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            disabled={availableTipes.length <= 1}
          >
            {availableTipes.map((tipe) => (
              <option key={tipe} value={tipe}>
                {TIPE_LABELS[tipe]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            {selectedTipe === 'weekly' ? 'Minggu Ke-' : 'Bulan'}
          </label>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            {periodOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!template && (
        <Card className="p-8 text-center text-muted-foreground">
          <p>Tidak ada template {TIPE_LABELS[selectedTipe]} untuk {ALAT_LABELS[selectedAlat]}.</p>
        </Card>
      )}

      {template && (
        <>
          <Card className="p-4">
            <h3 className="font-semibold text-sm mb-3">
              {TIPE_LABELS[selectedTipe]} — {template.nama}
            </h3>
            <ChecklistForm
              key={`${selectedAlat}-${selectedTipe}-${selectedPeriod}`}
              aktivitas={template.aktivitas}
              onChange={setActivityItems}
            />
          </Card>

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

          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              <Save size={16} />
              {saving ? 'Menyimpan...' : 'Simpan Checklist'}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (!confirm('Reset semua centang dan catatan?')) return;
                setActivityItems([]);
                setCatatanUmum('');
              }}
              disabled={saving}
              className="gap-2"
            >
              <RotateCcw size={16} />
              Reset
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
