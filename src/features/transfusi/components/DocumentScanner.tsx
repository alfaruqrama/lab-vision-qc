import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Loader2,
  RotateCw,
  ScanLine,
  Sparkles,
  Check,
  AlertTriangle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CornerEditor } from './CornerEditor';
import { useDocumentScan } from '../scan/useDocumentScan';
import {
  SCAN_FILTERS,
  DEFAULT_SCAN_FILTER,
  applyScanFilter,
  type ScanFilter,
} from '../scan/applyScanFilter';
import { imageDataToCanvas, canvasToBlob } from '../scan/imageUtils';
import { warpDocument } from '../scan/perspectiveCorrect';
import { rotate90 } from '../scan/rotate';
import { defaultCorners, type Point } from '../scan/cornerGeometry';

export interface ScanOutcome {
  file: File;
  /** Data URL pratinjau hasil akhir. */
  previewUrl: string;
  corners: Point[];
  filter: ScanFilter;
}

interface DocumentScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** File mentah yang akan dipindai. */
  file: File | null;
  onApply: (result: ScanOutcome) => void;
}

/**
 * Layar pemindai dokumen: deteksi tepi otomatis, penyetelan sudut, filter, dan
 * pratinjau sebelum disimpan.
 */
export function DocumentScanner({ open, onOpenChange, file, onApply }: DocumentScannerProps) {
  const { analyze, apply, opencvFailed } = useDocumentScan();

  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detected, setDetected] = useState(false);

  const [corners, setCorners] = useState<Point[]>([]);
  const [filter, setFilter] = useState<ScanFilter>(DEFAULT_SCAN_FILTER);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dims, setDims] = useState({ width: 0, height: 0 });

  // Simpan ImageData kerja di ref (bukan state) — objeknya besar.
  const imageDataRef = useRef<ImageData | null>(null);

  const reset = useCallback(() => {
    setLoading(false);
    setApplying(false);
    setError(null);
    setDetected(false);
    setCorners([]);
    setFilter(DEFAULT_SCAN_FILTER);
    setPreviewUrl(null);
    setDims({ width: 0, height: 0 });
    imageDataRef.current = null;
  }, []);

  // Jalankan analisis saat dialog dibuka dengan file baru.
  useEffect(() => {
    if (!open || !file) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await analyze(file);
        if (cancelled) return;

        imageDataRef.current = result.imageData;
        setCorners(result.corners);
        setDetected(result.detected);
        setDims({ width: result.width, height: result.height });
        setPreviewUrl(imageDataToCanvas(result.imageData).toDataURL('image/jpeg', 0.75));
      } catch (err) {
        if (cancelled) return;
        console.error('[Scan] Gagal menganalisis foto:', err);
        setError(
          err instanceof Error
            ? err.message
            : 'Gagal membuka foto. Format mungkin tidak didukung (mis. HEIC).',
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, file, analyze]);

  // Tutup → bersihkan state agar file berikutnya mulai dari nol.
  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const handleRotate = () => {
    const img = imageDataRef.current;
    if (!img) return;
    const rotated = rotate90(img);
    imageDataRef.current = rotated;
    setDims({ width: rotated.width, height: rotated.height });
    // Sudut lama tidak berlaku lagi setelah rotasi — pakai bingkai default.
    setCorners(defaultCorners(rotated.width, rotated.height));
    setDetected(false);
    setPreviewUrl(imageDataToCanvas(rotated).toDataURL('image/jpeg', 0.75));
  };

  const handleReDetect = async () => {
    const img = imageDataRef.current;
    if (!img || !file) return;
    setLoading(true);
    try {
      const result = await analyze(file);
      imageDataRef.current = result.imageData;
      setCorners(result.corners);
      setDetected(result.detected);
      setDims({ width: result.width, height: result.height });
      setPreviewUrl(imageDataToCanvas(result.imageData).toDataURL('image/jpeg', 0.75));
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    const img = imageDataRef.current;
    if (!img || corners.length !== 4) return;
    setApplying(true);
    setError(null);
    try {
      const result = await apply(img, corners, filter, file?.name ?? 'scan.jpg');
      const previewBlob = await imageDataToBlobForPreview(img, corners, filter);
      const preview = previewBlob ? URL.createObjectURL(previewBlob) : '';
      // Pemanggil (induk) yang menentukan langkah berikutnya — entah membuka
      // file berikutnya dari antrean atau menutup dialog. Jangan panggil
      // onOpenChange di sini agar tidak membatalkan antrean yang tersisa.
      onApply({
        file: result.file,
        previewUrl: preview,
        corners,
        filter,
      });
    } catch (err) {
      console.error('[Scan] Gagal menerapkan pindaian:', err);
      setError(err instanceof Error ? err.message : 'Gagal memproses pindaian.');
    } finally {
      setApplying(false);
    }
  };

  const busy = loading || applying;

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 pt-4 pb-2 border-b">
          <DialogTitle className="text-base flex items-center gap-2">
            <ScanLine size={18} className="text-primary" />
            Pindai Dokumen
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-auto px-4 py-3 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Loader2 size={32} className="animate-spin text-primary" />
              <p className="mt-3 text-sm">Menyiapkan pemindai & mendeteksi tepi dokumen…</p>
              <p className="text-xs">Pertama kali bisa agak lama (memuat mesin pemindai).</p>
            </div>
          ) : error ? (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : previewUrl ? (
            <>
              <CornerEditor
                src={previewUrl}
                imageWidth={dims.width}
                imageHeight={dims.height}
                corners={corners}
                onCornersChange={setCorners}
                className="max-h-[52vh] mx-auto"
              />

              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                {detected ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600">
                    <Sparkles size={12} /> Tepi dokumen terdeteksi otomatis
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-600">
                    <AlertTriangle size={12} /> Tepi tidak terdeteksi — geser sudut manual
                  </span>
                )}
              </div>

              {/* Filter */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Filter</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {SCAN_FILTERS.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setFilter(f.value)}
                      className={cn(
                        'rounded-lg border px-2 py-2 text-xs transition-colors',
                        filter === f.value
                          ? 'border-primary bg-primary/10 text-primary font-medium'
                          : 'border-border hover:border-primary/60',
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {opencvFailed && (
                <p className="text-[11px] text-amber-600">
                  Deteksi otomatis tidak tersedia (mesin pemindai gagal dimuat). Anda masih bisa
                  memotong foto secara manual dengan menggeser sudut.
                </p>
              )}
            </>
          ) : null}
        </div>

        {/* Footer aksi */}
        <div className="border-t px-4 py-3 flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReDetect}
            disabled={busy || !previewUrl}
          >
            <Sparkles size={14} className="mr-1" /> Deteksi Ulang
          </Button>
          <Button variant="outline" size="sm" onClick={handleRotate} disabled={busy || !previewUrl}>
            <RotateCw size={14} className="mr-1" /> Putar
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={busy}>
            Batal
          </Button>
          <Button size="sm" onClick={handleApply} disabled={busy || !previewUrl}>
            {applying ? (
              <>
                <Loader2 size={14} className="mr-1 animate-spin" /> Memproses…
              </>
            ) : (
              <>
                <Check size={14} className="mr-1" /> Terapkan
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Blob JPEG pratinjau hasil akhir (untuk thumbnail di form). */
async function imageDataToBlobForPreview(
  image: ImageData,
  corners: Point[],
  filter: ScanFilter,
): Promise<Blob | null> {
  try {
    const warped = await warpDocument(image, corners, 800);
    const filtered = applyScanFilter(warped, filter);
    return await canvasToBlob(imageDataToCanvas(filtered), 'image/jpeg', 0.7);
  } catch {
    return null;
  }
}
