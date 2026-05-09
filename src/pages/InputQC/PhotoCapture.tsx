import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Camera, Loader2, Sparkles, RotateCcw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { processFile, formatFileSize, getCompressionRatio } from '@/lib/file-validation';
import { toast } from 'sonner';

interface PhotoCaptureProps {
  photoPreview: string | null;
  isLoading: boolean;
  confidence: number | null;
  onCapture: (dataUrl: string) => void;
  onRetake: () => void;
  className?: string;
}

export function PhotoCapture({
  photoPreview,
  isLoading,
  confidence,
  onCapture,
  onRetake,
  className,
}: PhotoCaptureProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState<{ stage: string; progress: number } | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Process file with validation and compression
      const processed = await processFile(file, {
        compress: true,
        onProgress: (stage, progress) => {
          setUploadProgress({ stage, progress });
        },
      });

      // Show compression info if file was compressed
      if (processed.compressed) {
        const ratio = getCompressionRatio(processed.originalSize, processed.processedSize);
        toast.success(
          `Gambar dikompres ${ratio}% (${formatFileSize(processed.originalSize)} → ${formatFileSize(processed.processedSize)})`
        );
      }

      // Clear progress
      setUploadProgress(null);

      // Pass data URL to parent
      onCapture(processed.dataURL);
    } catch (error) {
      setUploadProgress(null);
      const message = error instanceof Error ? error.message : 'Gagal memproses file';
      toast.error(message);
      
      // Reset file input
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function handleRetake() {
    onRetake();
    // Reset file input so same file can be re-selected
    if (fileRef.current) fileRef.current.value = '';
    fileRef.current?.click();
  }

  return (
    <div className={className}>
      <label className="text-xs font-medium text-muted-foreground">Foto Struk</label>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Ambil foto struk"
      />

      {photoPreview ? (
        <div className="mt-1.5 relative rounded-xl overflow-hidden border border-border">
          <img
            src={photoPreview}
            alt="Preview struk"
            className="w-full max-h-48 object-contain bg-muted/30"
          />

          {/* Upload Progress overlay */}
          {uploadProgress && (
            <div className="absolute inset-0 bg-card/90 backdrop-blur-sm flex flex-col items-center justify-center">
              <Loader2 className="animate-spin text-primary" size={32} />
              <p className="text-xs text-muted-foreground mt-2">
                {uploadProgress.stage}... {Math.round(uploadProgress.progress)}%
              </p>
              <div className="w-3/4 h-1 bg-muted rounded-full mt-2 overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${uploadProgress.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* AI Loading overlay */}
          {isLoading && !uploadProgress && (
            <div className="absolute inset-0 bg-card/80 backdrop-blur-sm flex flex-col items-center justify-center">
              <Loader2 className="animate-spin text-primary" size={32} />
              <p className="text-xs text-muted-foreground mt-2">AI membaca struk... (3-8 detik)</p>
            </div>
          )}

          {/* Confidence badge */}
          {confidence !== null && !isLoading && (
            <div className="absolute top-2 right-2 flex items-center gap-1 bg-card/90 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs font-semibold border border-border/50 shadow-sm">
              <Sparkles size={12} className="text-primary" />
              {confidence}% akurasi
            </div>
          )}

          {/* Retake button */}
          {!isLoading && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRetake}
              className="absolute bottom-2 right-2 gap-1 h-7 text-xs shadow-sm"
            >
              <RotateCcw size={12} /> Ulang
            </Button>
          )}
        </div>
      ) : (
        <button
          onClick={() => fileRef.current?.click()}
          className={cn(
            'w-full mt-1.5 border-2 border-dashed border-border rounded-xl p-8',
            'flex flex-col items-center gap-2 text-muted-foreground',
            'hover:border-primary hover:text-primary transition-all duration-200',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          )}
        >
          <Camera size={32} />
          <span className="text-sm font-medium">Tap untuk foto struk</span>
          <span className="text-xs">Semua parameter terbaca sekaligus</span>
        </button>
      )}
    </div>
  );
}
