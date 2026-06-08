import { useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { UjiFungsiForm } from '@/features/maintenance/components/UjiFungsiForm';
import type { UjiFungsiRow } from '@/features/maintenance/components/UjiFungsiForm';
import { ALAT_LABELS } from '@/features/maintenance/lib/constants';
import { useMaintenanceStore } from '@/hooks/use-maintenance-store';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { Save, RotateCcw, ChevronLeft } from 'lucide-react';
import type { MaintenanceAlat, MaintenanceRecord } from '@/lib/maintenance-types';

function getMonthOptions() {
  const now = new Date();
  const options: { value: string; label: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('id-ID', { year: 'numeric', month: 'long' }),
    });
  }
  return options;
}

function generateId(): string {
  return `maint-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const ALAT_OPTIONS: MaintenanceAlat[] = ['BC6800', 'BC760', 'CA500600', 'EasyLyte'];

export default function MaintenanceUjiFungsi() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { records, addRecord } = useMaintenanceStore();
  const monthOptions = useMemo(() => getMonthOptions(), []);

  const alatParam = (searchParams.get('alat') as MaintenanceAlat) || 'BC6800';
  const [selectedAlat, setSelectedAlat] = useState<MaintenanceAlat>(alatParam);
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0]?.value || '2026-06');
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<UjiFungsiRow[]>([]);

  // Load existing records for this alat + month
  const existingMap = useMemo(() => {
    const map: Record<string, { fungsi: 'baik' | 'rusak' | null; petugas: string; keterangan: string }> = {};
    records
      .filter(
        (r) => r.alat === selectedAlat && r.tipe === 'uji_fungsi' && r.tanggal.startsWith(selectedMonth),
      )
      .forEach((r) => {
        map[r.tanggal] = {
          fungsi: r.aktivitas['fungsi_baik'] === true ? 'baik' : r.aktivitas['fungsi_baik'] === false ? 'rusak' : null,
          petugas: r.petugas || '',
          keterangan: r.catatan['keterangan'] || '',
        };
      });
    return map;
  }, [records, selectedAlat, selectedMonth]);

  const handleSave = async () => {
    const filled = formData.filter((r) => r.fungsi !== null);
    if (filled.length === 0) {
      toast.error('Isi minimal satu hari');
      return;
    }

    setSaving(true);

    try {
      for (const row of filled) {
        const record: MaintenanceRecord = {
          id: generateId(),
          alat: selectedAlat,
          tipe: 'uji_fungsi',
          tanggal: row.date,
          aktivitas: { fungsi_baik: row.fungsi === 'baik' },
          catatan: row.keterangan ? { keterangan: row.keterangan } : {},
          catatan_umum: '',
          petugas: row.petugas || user?.nama || user?.username || 'Unknown',
        };
        await addRecord(record);
      }
      toast.success(`${filled.length} hari tersimpan — ${ALAT_LABELS[selectedAlat]}`);
      navigate('/maintenance');
    } catch {
      // error already toasted by hook
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/maintenance')}>
          <ChevronLeft size={18} />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Uji Fungsi Alat Medis</h1>
          <p className="text-sm text-muted-foreground">{ALAT_LABELS[selectedAlat]}</p>
        </div>
      </div>

      {/* Selectors */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Alat</label>
          <select
            value={selectedAlat}
            onChange={(e) => {
              setSelectedAlat(e.target.value as MaintenanceAlat);
              setFormData([]);
            }}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            {ALAT_OPTIONS.map((a) => (
              <option key={a} value={a}>
                {ALAT_LABELS[a]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Bulan</label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            {monthOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Form */}
      <Card className="p-4">
        <UjiFungsiForm
          key={`${selectedAlat}-${selectedMonth}`}
          month={selectedMonth}
          initialData={existingMap}
          onChange={setFormData}
        />
      </Card>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save size={16} />
          {saving ? 'Menyimpan...' : 'Simpan Uji Fungsi'}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            if (!confirm('Reset semua data?')) return;
            setFormData([]);
          }}
          disabled={saving}
          className="gap-2"
        >
          <RotateCcw size={16} />
          Reset
        </Button>
      </div>
    </div>
  );
}
