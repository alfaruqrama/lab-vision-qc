import { useState, useRef, useCallback } from 'react';
import { Camera, X, Loader2, AlertCircle, ScanLine } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { usePdfBuilder } from '@/features/transfusi/hooks/usePdfBuilder';
import { useUploadTransfusi } from '@/features/transfusi/hooks/useTransfusiRecords';
import {
  DocumentScanner,
  type ScanOutcome,
} from '@/features/transfusi/components/DocumentScanner';
import type { ScanFilter } from '@/features/transfusi/scan/applyScanFilter';
import type { Point } from '@/features/transfusi/scan/cornerGeometry';
import {
  BLOOD_PRODUCTS,
  BLOOD_TYPES_RH,
  BLOOD_ORIGINS,
  type BloodOrigin,
  type BloodProduct,
  type BloodTypeRh,
} from '@/lib/transfusi-types';
import { toast } from 'sonner';

/** Batas jumlah halaman foto per dokumen — menjaga ukuran PDF. */
const MAX_PHOTOS = 10;

/**
 * Satu foto dokumen yang sudah (atau akan) dipindai.
 * `file` yang masuk PDF selalu yang sudah dipotong & difilter.
 */
interface ScannedPhoto {
  file: File;
  previewUrl: string;
  corners?: Point[];
  filter?: ScanFilter;
}


const DOKUMEN_WAJIB = [
  { key: 'informConcern' as const, label: 'Inform Concern' },
  { key: 'suratPermintaan' as const, label: 'Surat Permintaan Darah' },
  { key: 'formReaksi' as const, label: 'Form Reaksi Transfusi' },
];

export default function TransfusiForm({ onSuccess }: { onSuccess?: () => void }) {
  const { user } = useAuth();
  const { buildPdf } = usePdfBuilder();
  const uploadMutation = useUploadTransfusi();

  const [patientName, setPatientName] = useState('');
  const [medicalRecordNumber, setMedicalRecordNumber] = useState('');
  const [requestDate, setRequestDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [petugas, setPetugas] = useState(user?.nama ?? '');
  const [notes, setNotes] = useState('');

  const [bloodProduct, setBloodProduct] = useState<BloodProduct | ''>('');
  const [bagCount, setBagCount] = useState('1');
  const [bloodTypeRh, setBloodTypeRh] = useState<BloodTypeRh | ''>('');
  const [bagNumber, setBagNumber] = useState('');
  const [origin, setOrigin] = useState<BloodOrigin | ''>('');

  const [informConcern, setInformConcern] = useState(true);
  const [suratPermintaan, setSuratPermintaan] = useState(true);
  const [formReaksi, setFormReaksi] = useState(true);

  const [photos, setPhotos] = useState<ScannedPhoto[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Antrean pemindaian ──
  // Saat operator memilih beberapa foto sekaligus, kita proses satu per satu
  // lewat DocumentScanner. `scanQueue` menyimpan sisa file mentah, `scanFile`
  // adalah yang sedang dibuka, dan `editingIndex` menandai mode edit ulang.
  const [scanQueue, setScanQueue] = useState<File[]>([]);
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const displayPetugas = petugas || (user?.nama ?? '');
  const isUploading = uploadMutation.isPending;

  // ── Validasi ──
  const missing: string[] = [];
  if (!patientName.trim()) missing.push('Nama Pasien');
  if (!medicalRecordNumber.trim()) missing.push('No. Rekam Medis');
  if (!bloodProduct) missing.push('Produk Darah');
  if (!bloodTypeRh) missing.push('Golongan Darah / Rh');
  if (!bagNumber.trim()) missing.push('Nomor Kantong');
  if (!origin) missing.push('Asal Kantong');
  if (!requestDate) missing.push('Tanggal Permintaan');
  if (photos.length === 0) missing.push('Foto Dokumen');

  const canSubmit = missing.length === 0 && !isUploading;
  const dokumenKurang = DOKUMEN_WAJIB.filter((d) => {
    if (d.key === 'informConcern') return !informConcern;
    if (d.key === 'suratPermintaan') return !suratPermintaan;
    return !formReaksi;
  });

  /** Buka pemindai untuk file berikutnya dalam antrean, bila ada. */
  const openNextInQueue = useCallback((queue: File[]) => {
    if (queue.length === 0) {
      setScanFile(null);
      setScanOpen(false);
      return;
    }
    setScanFile(queue[0]);
    setScanQueue(queue.slice(1));
    setScanOpen(true);
  }, []);

  const handleAddPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) {
      toast.error(`Maksimal ${MAX_PHOTOS} foto per dokumen.`);
      return;
    }

    const accepted = files.slice(0, remaining);
    if (files.length > remaining) {
      toast.warning(
        `Hanya ${remaining} foto pertama yang diproses (batas ${MAX_PHOTOS} halaman).`,
      );
    }

    setEditingIndex(null);
    openNextInQueue(accepted);
  };

  /** Simpan hasil pemindaian (baru atau hasil edit ulang). */
  const handleScanApply = (result: ScanOutcome) => {
    setPhotos((prev) => {
      const next: ScannedPhoto = {
        file: result.file,
        previewUrl: result.previewUrl,
        corners: result.corners,
        filter: result.filter,
      };
      if (editingIndex !== null) {
        const copy = [...prev];
        // Bebaskan blob URL lama agar tidak bocor memori.
        if (copy[editingIndex]?.previewUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(copy[editingIndex].previewUrl);
        }
        copy[editingIndex] = next;
        return copy;
      }
      return [...prev, next];
    });
    setEditingIndex(null);

    // Lanjut ke file berikutnya dalam antrean (mode tambah baru).
    if (editingIndex === null) {
      openNextInQueue(scanQueue);
    }
  };

  /** Batalkan sisa antrean saat dialog ditutup manual. */
  const handleScanOpenChange = (open: boolean) => {
    setScanOpen(open);
    if (!open) {
      setScanQueue([]);
      setScanFile(null);
      setEditingIndex(null);
    }
  };

  const handleEditPhoto = (index: number) => {
    const photo = photos[index];
    if (!photo) return;
    setEditingIndex(index);
    setScanFile(photo.file);
    setScanQueue([]);
    setScanOpen(true);
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => {
      const target = prev[index];
      if (target?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = async () => {
    if (missing.length > 0) {
      toast.error(`Lengkapi dulu: ${missing.join(', ')}`);
      return;
    }

    const parsedBagCount = Math.max(1, Number.parseInt(bagCount, 10) || 1);

    const pdfMetadata = {
      patientName: patientName.trim(),
      medicalRecordNumber: medicalRecordNumber.trim(),
      bloodProduct: bloodProduct as BloodProduct,
      bagCount: parsedBagCount,
      bloodTypeRh: bloodTypeRh as BloodTypeRh,
      bagNumber: bagNumber.trim(),
      origin: origin as BloodOrigin,
      requestDate,
      petugas: displayPetugas,
      informConcern,
      suratPermintaan,
      formReaksi,
    };

    // Tahap 1: rakit PDF.
    // Gagal di sini berarti masalah pada fotonya (mis. format HEIC), dan itu
    // tidak terlihat kalau kita hanya menyerahkan ke onError milik mutation.
    let base64: string;
    try {
      ({ base64 } = await buildPdf(
        photos.map((p) => p.file),
        pdfMetadata,
      ));
    } catch (err) {
      console.error('Build PDF error:', err);
      toast.error(
        err instanceof Error ? err.message : 'Gagal merakit PDF dari foto. Coba lagi.',
        { duration: 10_000 },
      );
      return;
    }

    // Tahap 2: unggah. Kegagalan di sini sudah ditangani onError mutation.
    try {
      await uploadMutation.mutateAsync({
        pdfBase64: base64,
        metadata: { ...pdfMetadata, notes: notes.trim() || undefined },
      });
      onSuccess?.();
    } catch (err) {
      console.error('Upload error:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Data Pasien ── */}
      <Card>
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm">Data Pasien</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Nama Pasien *</Label>
              <Input
                placeholder="Nama pasien..."
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                className="mt-1"
                disabled={isUploading}
              />
            </div>
            <div>
              <Label className="text-xs">No. Rekam Medis *</Label>
              <Input
                placeholder="No. RM..."
                value={medicalRecordNumber}
                onChange={(e) => setMedicalRecordNumber(e.target.value)}
                className="mt-1 font-mono"
                disabled={isUploading}
              />
            </div>
            <div>
              <Label className="text-xs">Tanggal Permintaan *</Label>
              <Input
                type="date"
                value={requestDate}
                onChange={(e) => setRequestDate(e.target.value)}
                className="mt-1"
                disabled={isUploading}
              />
            </div>
            <div>
              <Label className="text-xs">Petugas</Label>
              <Input
                placeholder="Nama petugas..."
                value={displayPetugas}
                onChange={(e) => setPetugas(e.target.value)}
                className="mt-1"
                disabled={isUploading}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Data Kantong Darah ── */}
      <Card>
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm">Data Kantong Darah</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Produk Darah *</Label>
              <Select
                value={bloodProduct}
                onValueChange={(v) => setBloodProduct(v as BloodProduct)}
                disabled={isUploading}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Pilih produk..." />
                </SelectTrigger>
                <SelectContent>
                  {BLOOD_PRODUCTS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Jumlah Kantong *</Label>
              <Input
                type="number"
                min={1}
                inputMode="numeric"
                value={bagCount}
                onChange={(e) => setBagCount(e.target.value)}
                className="mt-1"
                disabled={isUploading}
              />
            </div>
            <div>
              <Label className="text-xs">Golongan Darah / Rh *</Label>
              <Select
                value={bloodTypeRh}
                onValueChange={(v) => setBloodTypeRh(v as BloodTypeRh)}
                disabled={isUploading}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Pilih golongan..." />
                </SelectTrigger>
                <SelectContent>
                  {BLOOD_TYPES_RH.map((t) => (
                    <SelectItem key={t} value={t} className="font-mono">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Asal Kantong Darah *</Label>
              <Select
                value={origin}
                onValueChange={(v) => setOrigin(v as BloodOrigin)}
                disabled={isUploading}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Pilih asal..." />
                </SelectTrigger>
                <SelectContent>
                  {BLOOD_ORIGINS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Nomor Kantong *</Label>
            <Input
              placeholder="Nomor kantong. Bila lebih dari satu, pisah dengan koma..."
              value={bagNumber}
              onChange={(e) => setBagNumber(e.target.value)}
              className="mt-1 font-mono"
              disabled={isUploading}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Kelengkapan Berkas ── */}
      <Card>
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm">Kelengkapan Berkas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5">
          <DocumentCheck
            checked={informConcern}
            onChange={setInformConcern}
            label="Inform Concern"
            disabled={isUploading}
          />
          <DocumentCheck
            checked={suratPermintaan}
            onChange={setSuratPermintaan}
            label="Surat Permintaan Darah"
            disabled={isUploading}
          />
          <DocumentCheck
            checked={formReaksi}
            onChange={setFormReaksi}
            label="Form Reaksi Transfusi"
            disabled={isUploading}
          />

          {dokumenKurang.length > 0 && (
            <div className="flex items-start gap-2 pt-1 text-[11px] text-amber-700">
              <AlertCircle size={13} className="mt-0.5 shrink-0" />
              <span>
                Belum dicentang: {dokumenKurang.map((d) => d.label).join(', ')}. Pastikan
                berkasnya memang tidak ada sebelum menyimpan.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Foto ── */}
      <Card>
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm">Scan Dokumen *</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Ambil foto formulir transfusi, kwitansi, dan kantong darah. Kertas
            dideteksi &amp; dipotong otomatis, diputar, dan difilter seperti hasil pemindai.
            Sudut bisa diatur manual setelah foto. Semua foto digabung jadi 1 file PDF
            (maks {MAX_PHOTOS} halaman).
          </p>

          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((photo, i) => (
                <div
                  key={i}
                  className="relative rounded-lg overflow-hidden border bg-muted aspect-square group"
                >
                  <img
                    src={photo.previewUrl}
                    alt={`Dokumen ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => handleRemovePhoto(i)}
                    className="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 text-white hover:bg-black/80"
                    disabled={isUploading}
                    aria-label={`Hapus foto ${i + 1}`}
                  >
                    <X size={14} />
                  </button>
                  <button
                    onClick={() => handleEditPhoto(i)}
                    className="absolute bottom-1 right-1 p-1 rounded-full bg-black/60 text-white hover:bg-black/80"
                    disabled={isUploading}
                    aria-label={`Atur ulang potongan foto ${i + 1}`}
                    title="Atur potongan"
                  >
                    <ScanLine size={13} />
                  </button>
                  <span className="absolute bottom-1 left-1 text-[10px] bg-black/60 text-white px-1 rounded">
                    {i + 1}/{photos.length}
                  </span>
                </div>
              ))}
            </div>
          )}

          <input
            id="transfusi-photo-input"
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="sr-only"
            onChange={handleAddPhotos}
          />
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || photos.length >= MAX_PHOTOS || scanOpen}
          >
            <Camera size={14} className="mr-1" />
            {photos.length > 0 ? `Tambah Foto (${photos.length}/${MAX_PHOTOS})` : 'Ambil Foto Dokumen'}
          </Button>

          {photos.length > 0 && (
            <Badge variant="outline" className="text-[10px]">
              {photos.length} foto siap → 1 PDF
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* ── Pemindai dokumen ── */}
      <DocumentScanner
        open={scanOpen}
        onOpenChange={handleScanOpenChange}
        file={scanFile}
        onApply={handleScanApply}
      />

      {/* ── Catatan ── */}
      <Card>
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm">Catatan</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Opsional..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            disabled={isUploading}
          />
        </CardContent>
      </Card>

      {/* ── Submit ── */}
      <div className="space-y-2">
        {missing.length > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            Belum lengkap: {missing.join(' · ')}
          </p>
        )}
        <Button className="w-full" size="lg" onClick={handleSubmit} disabled={!canSubmit}>
          {isUploading ? (
            <>
              <Loader2 size={16} className="mr-2 animate-spin" /> Mengupload...
            </>
          ) : (
            '📤 Simpan & Unggah ke Drive'
          )}
        </Button>
      </div>
    </div>
  );
}

function DocumentCheck({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  const id = `dok-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className="flex items-center gap-2.5">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        disabled={disabled}
      />
      <Label htmlFor={id} className="text-xs cursor-pointer">
        {label}
      </Label>
    </div>
  );
}
