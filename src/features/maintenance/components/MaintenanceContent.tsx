import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, User, Printer, Save, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StatusCard } from './StatusCard';
import { PrintPreview } from './PrintPreview';
import { ChecklistForm } from './ChecklistForm';
import type { ActivityItem } from './ChecklistForm';
import { UjiFungsiForm } from './UjiFungsiForm';
import type { UjiFungsiRow } from './UjiFungsiForm';
import { MAINTENANCE_TEMPLATES, ALAT_LABELS, TIPE_LABELS } from '../lib/constants';
import { useUjiFungsiRecords, useSaveUjiFungsi } from '../hooks/useMaintenanceRecords';
import type { MaintenanceAlat, MaintenanceTipe, MaintenanceRecord } from '@/lib/maintenance-types';
import { useMaintenanceStore } from '@/hooks/use-maintenance-store';
import { toast } from 'sonner';

interface MaintenanceContentProps {
  alat: string;
}

type TabType = 'harian' | 'mingguan' | 'bulanan' | 'uji_fungsi';

const TABS: { value: TabType; label: string }[] = [
  { value: 'harian', label: 'Harian' },
  { value: 'mingguan', label: 'Mingguan' },
  { value: 'bulanan', label: 'Bulanan' },
  { value: 'uji_fungsi', label: 'Uji Fungsi' },
];

const TAB_TIPE: Record<Exclude<TabType, 'uji_fungsi'>, MaintenanceTipe> = {
  harian: 'daily',
  mingguan: 'weekly',
  bulanan: 'monthly',
};

const ALAT_OPTIONS: MaintenanceAlat[] = ['BC6800', 'BC760', 'CA500600', 'EasyLyte'];

function getToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getThisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function generateId(): string {
  return `maint-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function MaintenanceContent({ alat }: MaintenanceContentProps) {
  const navigate = useNavigate();
  const { addRecord } = useMaintenanceStore();

  const [activeTab, setActiveTab] = useState<TabType>('harian');
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [petugas, setPetugas] = useState('');
  const [statusKondisi, setStatusKondisi] = useState<'baik' | 'rusak'>('baik');
  const [checklistItems, setChecklistItems] = useState<ActivityItem[]>([]);
  const [catatanUmum, setCatatanUmum] = useState('');
  const [saving, setSaving] = useState(false);
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);

  // Uji fungsi state
  const [bulan, setBulan] = useState(getThisMonth());
  const [ujiRows, setUjiRows] = useState<UjiFungsiRow[]>([]);
  const { data: ujiRecords = [] } = useUjiFungsiRecords(alat, bulan);
  const saveUjiFungsi = useSaveUjiFungsi();

  const currentTemplate = useMemo(
    () =>
      MAINTENANCE_TEMPLATES.find(
        (t) => t.alat === (alat as MaintenanceAlat) && t.tipe === TAB_TIPE[activeTab as Exclude<TabType, 'uji_fungsi'>],
      ),
    [alat, activeTab],
  );

  const initialUjiData = useMemo(() => {
    const map: Record<string, { fungsi: 'baik' | 'rusak' | null; petugas: string; keterangan: string }> = {};
    ujiRecords.forEach((r) => {
      map[r.tanggal] = { fungsi: r.fungsi, petugas: r.petugas, keterangan: r.keterangan };
    });
    return map;
  }, [ujiRecords]);

  const resetChecklist = () => {
    setChecklistItems([]);
    setStatusKondisi('baik');
    setCatatanUmum('');
  };

  const handleSaveChecklist = async () => {
    if (!petugas.trim()) {
      toast.error('Nama petugas harus diisi');
      return;
    }
    if (!currentTemplate) {
      toast.error('Template tidak ditemukan');
      return;
    }
    if (!checklistItems.some((i) => i.checked)) {
      toast.error('Centang minimal satu aktivitas');
      return;
    }

    setSaving(true);
    try {
      const aktivitas: Record<string, boolean> = {};
      const catatan: Record<string, string> = {};
      checklistItems.forEach((i) => {
        aktivitas[i.nama] = i.checked;
        if (i.catatan) catatan[i.nama] = i.catatan;
      });

      const record: MaintenanceRecord = {
        id: generateId(),
        alat: alat as MaintenanceAlat,
        tipe: TAB_TIPE[activeTab as Exclude<TabType, 'uji_fungsi'>],
        tanggal: selectedDate,
        aktivitas,
        catatan,
        catatan_umum: `${statusKondisi === 'rusak' ? '[RUSAK] ' : ''}${catatanUmum}`.trim(),
        petugas: petugas.trim(),
      };

      await addRecord(record);
      toast.success('Checklist tersimpan');
      resetChecklist();
    } catch (err) {
      console.error(err);
      toast.error('Gagal menyimpan checklist');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveUjiFungsi = async () => {
    if (!petugas.trim()) {
      toast.error('Nama petugas harus diisi');
      return;
    }
    const data = ujiRows
      .filter((r) => r.fungsi !== null)
      .map((r) => ({
        id: `uf-${alat}-${r.date}`,
        tanggal: r.date,
        fungsi: r.fungsi as 'baik' | 'rusak',
        petugas: r.petugas || petugas.trim(),
        keterangan: r.keterangan || '',
      }));

    if (data.length === 0) {
      toast.error('Isi minimal satu status uji fungsi');
      return;
    }

    try {
      await saveUjiFungsi.mutateAsync({ alat, bulan, data });
    } catch {
      // toast handled by mutation
    }
  };

  const handlePrint = () => {
    if (activeTab === 'uji_fungsi') {
      toast.error('Pratinjau cetak tersedia untuk checklist periodik');
      return;
    }
    if (!currentTemplate) {
      toast.error('Tidak ada data untuk dicetak');
      return;
    }
    setIsPrintPreviewOpen(true);
  };

  const printItems = currentTemplate?.aktivitas ?? [];
  const printAktivitas = checklistItems.reduce<Record<string, boolean>>((acc, i) => {
    acc[i.nama] = i.checked;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Header: selector alat */}
      <div className="flex items-center gap-2">
        <div>
          <h1 className="text-xl font-bold font-display">Checklist Maintenance</h1>
          <p className="text-sm text-muted-foreground">Pemeliharaan alat laboratorium</p>
        </div>
      </div>

      {/* Control bar: alat, tanggal, petugas, cetak */}
      <Card className="p-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Alat</Label>
            <select
              value={alat}
              onChange={(e) => navigate(`/maintenance/${e.target.value}`)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {ALAT_OPTIONS.map((a) => (
                <option key={a} value={a}>
                  {ALAT_LABELS[a]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1">
              <Calendar size={12} /> Tanggal
            </Label>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1">
              <User size={12} /> Petugas
            </Label>
            <Input
              placeholder="Nama petugas..."
              value={petugas}
              onChange={(e) => setPetugas(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-3 flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={handlePrint}>
            <Printer size={14} className="mr-1" />
            Preview &amp; Cetak
          </Button>
        </div>
      </Card>

      {/* Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => {
              setActiveTab(t.value);
              resetChecklist();
            }}
            className={
              activeTab === t.value
                ? 'rounded-md border border-primary bg-primary/10 px-3 py-2 text-xs font-semibold text-primary'
                : 'rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:border-primary/50'
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Body */}
      {activeTab === 'uji_fungsi' ? (
        <Card className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold">Uji Fungsi Bulanan</h3>
              <p className="text-xs text-muted-foreground">{ALAT_LABELS[alat as MaintenanceAlat]}</p>
            </div>
            <Input
              type="month"
              value={bulan}
              onChange={(e) => setBulan(e.target.value)}
              className="h-9 w-full sm:w-44"
            />
          </div>

          <UjiFungsiForm
            key={`${alat}-${bulan}`}
            month={bulan}
            initialData={initialUjiData}
            defaultPetugas={petugas}
            onChange={setUjiRows}
          />

          <div className="flex justify-end">
            <Button onClick={handleSaveUjiFungsi} disabled={saveUjiFungsi.isPending} size="sm">
              <Save size={14} className="mr-1" />
              {saveUjiFungsi.isPending ? 'Menyimpan...' : 'Simpan Uji Fungsi'}
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <StatusCard status={statusKondisi} onChange={setStatusKondisi} />

          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold">
                {TIPE_LABELS[TAB_TIPE[activeTab as Exclude<TabType, 'uji_fungsi'>]]} — {currentTemplate?.nama ?? ALAT_LABELS[alat as MaintenanceAlat]}
              </h3>
            </div>

            {currentTemplate ? (
              <ChecklistForm
                key={`${alat}-${activeTab}`}
                aktivitas={currentTemplate.aktivitas}
                onChange={setChecklistItems}
              />
            ) : (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Tidak ada template {TABS.find((t) => t.value === activeTab)?.label} untuk alat ini.
              </p>
            )}
          </Card>

          <Card className="p-4">
            <Label className="text-xs">Catatan Umum (opsional)</Label>
            <Textarea
              placeholder="Tambahkan catatan atau keterangan tambahan..."
              value={catatanUmum}
              onChange={(e) => setCatatanUmum(e.target.value)}
              rows={2}
              className="resize-none mt-1"
            />
          </Card>

          <div className="flex items-center gap-2">
            <Button onClick={handleSaveChecklist} disabled={saving}>
              <Save size={16} className="mr-1" />
              {saving ? 'Menyimpan...' : 'Simpan Checklist'}
            </Button>
            <Button variant="outline" onClick={resetChecklist} disabled={saving}>
              <RotateCcw size={16} className="mr-1" />
              Reset
            </Button>
          </div>
        </>
      )}

      <PrintPreview
        isOpen={isPrintPreviewOpen}
        onClose={() => setIsPrintPreviewOpen(false)}
        data={{
          alat: ALAT_LABELS[alat as MaintenanceAlat] ?? alat,
          tanggal: selectedDate,
          petugas,
          periode: activeTab,
          status: statusKondisi,
          items: printItems,
          aktivitas: printAktivitas,
          keterangan: catatanUmum,
        }}
      />
    </div>
  );
}
