/**
 * Filter hasil scan ala aplikasi pemindai.
 *
 * Semua mode bekerja pada ImageData dan mengembalikan ImageData baru, sehingga
 * bisa dirangkai dengan mudah dan diuji.
 *
 * - `original` : apa adanya
 * - `enhance`  : perbaiki kontras & pencahayaan (default) — teks lebih tajam
 * - `grayscale`: abu-abu
 * - `bw`       : hitam-putih tegas (adaptive threshold), paling kecil ukurannya
 */

export type ScanFilter = 'original' | 'enhance' | 'grayscale' | 'bw';

export const SCAN_FILTERS: { value: ScanFilter; label: string }[] = [
  { value: 'original', label: 'Asli' },
  { value: 'enhance', label: 'Perbaiki (disarankan)' },
  { value: 'grayscale', label: 'Abu-abu' },
  { value: 'bw', label: 'Hitam-putih' },
];

export const DEFAULT_SCAN_FILTER: ScanFilter = 'enhance';

/** Terapkan filter ke ImageData, mengembalikan salinan baru. */
export function applyScanFilter(image: ImageData, filter: ScanFilter): ImageData {
  switch (filter) {
    case 'enhance':
      return enhanceContrast(image);
    case 'grayscale':
      return toGrayscale(image);
    case 'bw':
      return toBlackAndWhite(image);
    case 'original':
    default:
      return image;
  }
}

/**
 * Regangkan histogram (min–max) per kanal bersamaan pada luminance.
 *
 * Cocok untuk foto dokumen yang tampak pudar/kekuningan karena pencahayaan
 * ruangan: memetakan nilai gelap→0 dan terang→255 membuat kertas putih bersih
 * dan teks lebih tegas.
 */
export function enhanceContrast(image: ImageData): ImageData {
  const { data } = image;
  const out = new Uint8ClampedArray(data);

  let min = 255;
  let max = 0;

  // Sampel luminance untuk menemukan rentang nyata gambar.
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    if (lum < min) min = lum;
    if (lum > max) max = lum;
  }

  const range = max - min;
  // Gambar sudah kontras tinggi — tidak perlu diubah.
  if (range < 16) return image;

  const scale = 255 / range;
  for (let i = 0; i < out.length; i += 4) {
    out[i] = (data[i] - min) * scale;
    out[i + 1] = (data[i + 1] - min) * scale;
    out[i + 2] = (data[i + 2] - min) * scale;
    // alpha dibiarkan
  }

  return new ImageData(out, image.width, image.height);
}

/** Ubah ke abu-abu (kanal R=G=B=luminance). */
export function toGrayscale(image: ImageData): ImageData {
  const { data } = image;
  const out = new Uint8ClampedArray(data);

  for (let i = 0; i < out.length; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    out[i] = lum;
    out[i + 1] = lum;
    out[i + 2] = lum;
  }

  return new ImageData(out, image.width, image.height);
}

/**
 * Ambang adaptif sederhana dengan mean lokal (box blur).
 *
 * Adaptive threshold lebih tahan terhadap bayangan tidak rata dibanding ambang
 * global: area yang gelap tetap menghasilkan teks, bukan blok hitam.
 *
 * @param blocksize ukuran jendela rata-rata (ganjil)
 * @param c         konstanta pengurang; makin besar makin bersih
 */
export function toBlackAndWhite(image: ImageData, blocksize = 15, c = 8): ImageData {
  const { width, height, data } = image;
  const gray = new Float32Array(width * height);

  for (let p = 0, i = 0; i < data.length; i += 4, p++) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  const mean = boxBlur(gray, width, height, blocksize);
  const out = new Uint8ClampedArray(width * height * 4);

  for (let p = 0; p < gray.length; p++) {
    const v = gray[p] > mean[p] - c ? 255 : 0;
    const i = p * 4;
    out[i] = v;
    out[i + 1] = v;
    out[i + 2] = v;
    out[i + 3] = 255;
  }

  return new ImageData(out, width, height);
}

/** Rata-rata lokal memakai integral image (O(n), satu lintasan). */
function boxBlur(src: Float32Array, width: number, height: number, radius: number): Float32Array {
  const r = Math.max(1, Math.floor(radius / 2));
  const integral = new Float64Array((width + 1) * (height + 1));

  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      rowSum += src[y * width + x];
      integral[(y + 1) * (width + 1) + (x + 1)] = integral[y * (width + 1) + (x + 1)] + rowSum;
    }
  }

  const out = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - r);
      const y0 = Math.max(0, y - r);
      const x1 = Math.min(width - 1, x + r);
      const y1 = Math.min(height - 1, y + r);
      const area = (x1 - x0 + 1) * (y1 - y0 + 1);

      const sum =
        integral[(y1 + 1) * (width + 1) + (x1 + 1)] -
        integral[y0 * (width + 1) + (x1 + 1)] -
        integral[(y1 + 1) * (width + 1) + x0] +
        integral[y0 * (width + 1) + x0];

      out[y * width + x] = sum / area;
    }
  }

  return out;
}
