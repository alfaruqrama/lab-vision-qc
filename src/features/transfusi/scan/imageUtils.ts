/**
 * Utilitas gambar untuk alur pemindaian: memuat File jadi ImageData/canvas,
 * dan mengubah hasil olahan kembali jadi File yang bisa masuk PDF builder.
 */

export interface LoadedImage {
  canvas: HTMLCanvasElement;
  imageData: ImageData;
  width: number;
  height: number;
  /** Lepaskan sumber daya bila memakai ImageBitmap. */
  release?: () => void;
}

/**
 * Muat File gambar ke canvas pada resolusi (maksimum) tertentu.
 *
 * Untuk foto kamera beresolusi besar, kita memperkecil ke `maxDimension`
 * SEBELUM deteksi/warp. Ini menjaga dua hal: kecepatan deteksi di HP, dan
 * ukuran memori. PDF builder tetap menerima hasil yang sudah layak.
 */
export async function loadImage(
  file: File,
  maxDimension = 2400,
): Promise<LoadedImage> {
  const source = await loadSource(file);
  try {
    const { width, height } = fitToMax(source.width, source.height, maxDimension);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas 2D context tidak tersedia');

    ctx.drawImage(source.image as CanvasImageSource, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);

    return { canvas, imageData, width, height };
  } finally {
    source.release?.();
  }
}

/** Gambar ImageData ke canvas baru (memakai ukuran pikselnya). */
export function imageDataToCanvas(imageData: ImageData): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context tidak tersedia');
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Ubah ImageData jadi File JPEG siap masuk jsPDF.
 * JPEG dipilih karena PDF builder menandai halaman sebagai 'JPEG'.
 */
export async function imageDataToFile(
  imageData: ImageData,
  name: string,
  quality = 0.85,
): Promise<File> {
  const canvas = imageDataToCanvas(imageData);
  const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
  return new File([blob], ensureJpegName(name), { type: 'image/jpeg' });
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type = 'image/jpeg',
  quality = 0.85,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Gagal membuat blob gambar'));
      },
      type,
      quality,
    );
  });
}

/** Dimensi setelah diperkecil agar sisi terpanjang ≤ maxDimension. */
export function fitToMax(
  width: number,
  height: number,
  maxDimension: number,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxDimension || longest === 0) return { width, height };
  const scale = maxDimension / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

// ─── Helper internal ────────────────────────────────────────────────────────

interface ImageSource {
  image: ImageBitmap | HTMLImageElement;
  width: number;
  height: number;
  release?: () => void;
}

async function loadSource(file: File): Promise<ImageSource> {
  // Utamakan createImageBitmap: menghormati orientasi EXIF & efisien.
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        image: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      // lanjut ke fallback
    }
  }

  const dataUrl = await fileToDataUrl(file);
  const img = await loadHtmlImage(dataUrl);
  return { image: img, width: img.naturalWidth, height: img.naturalHeight };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Gagal membaca file gambar'));
    reader.readAsDataURL(file);
  });
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Gagal memuat gambar'));
    img.src = src;
  });
}

function ensureJpegName(name: string): string {
  const base = name.replace(/\.[^.]+$/, '');
  return `${base}.jpg`;
}
