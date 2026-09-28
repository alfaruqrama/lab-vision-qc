import { jsPDF } from 'jspdf';
import {
  bloodProductLabel,
  formatBytes,
  PDF_TARGET_BYTES,
  type BloodOrigin,
  type BloodProduct,
  type BloodTypeRh,
} from '@/lib/transfusi-types';

/** Sisi terpanjang maksimum gambar setelah kompresi (~190 DPI untuk A4). */
export const MAX_IMAGE_DIMENSION = 1600;
/** Kualitas JPEG hasil kompresi. */
export const JPEG_QUALITY = 0.75;

/**
 * Tingkat kompresi cadangan, dipakai berurutan kalau PDF masih kelebihan
 * ukuran. Tujuannya: operator tidak perlu tahu soal ukuran berkas — sistem
 * mengecilkan sendiri sampai muat, dan baru menyerah kalau benar-benar tidak bisa.
 *
 * Catatan: menurunkan kualitas JPEG membuat berkas lebih kecil, tapi
 * menurunkan resolusi membuatnya jauh lebih kecil — karena itu resolusi
 * diturunkan lebih dulu dan lebih agresif.
 */
const COMPRESSION_LADDER: { maxDim: number; quality: number }[] = [
  { maxDim: MAX_IMAGE_DIMENSION, quality: JPEG_QUALITY }, // 1600px q0.75
  { maxDim: 1400, quality: 0.68 },
  { maxDim: 1200, quality: 0.62 },
  { maxDim: 1000, quality: 0.55 },
  { maxDim: 850, quality: 0.5 },
];

export interface PdfMetadata {
  patientName: string;
  medicalRecordNumber: string;
  bloodProduct: BloodProduct;
  bagCount: number;
  bloodTypeRh: BloodTypeRh;
  bagNumber: string;
  origin: BloodOrigin;
  requestDate: string;
  petugas: string;
  informConcern?: boolean;
  suratPermintaan?: boolean;
  formReaksi?: boolean;
}

export const ORIGIN_LABELS: Record<BloodOrigin, string> = {
  GRESIK: 'Gresik',
  SURABAYA: 'Surabaya',
};

/**
 * Skalakan dimensi gambar agar sisi terpanjang ≤ maxDim, dengan
 * mempertahankan rasio aspek. Tidak pernah memperbesar gambar.
 *
 * Fungsi murni — dipisah agar bisa diuji tanpa canvas/DOM.
 */
export function fitWithin(
  width: number,
  height: number,
  maxDim: number = MAX_IMAGE_DIMENSION,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxDim || longest === 0) {
    return { width, height };
  }
  const scale = maxDim / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Kompres foto kamera sebelum dirangkai jadi PDF.
 *
 * Kamera smartphone menghasilkan 5–15 MB per jepretan. Tanpa langkah ini,
 * PDF 5 halaman bisa mencapai 75 MB dan base64-nya membengkak 33% lagi —
 * unggahan akan menggantung atau ditolak.
 *
 * @returns dataURL JPEG yang sudah diperkecil
 */
export async function compressImage(
  file: File,
  maxDim: number = MAX_IMAGE_DIMENSION,
  quality: number = JPEG_QUALITY,
): Promise<string> {
  const source = await loadImageSource(file);
  const { width, height } = fitWithin(source.width, source.height, maxDim);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context tidak tersedia');

  // Latar putih — JPEG tidak mendukung transparansi; tanpa ini area
  // transparan akan jadi hitam saat dikonversi.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source.image as CanvasImageSource, 0, 0, width, height);

  if (source.release) source.release();

  return canvas.toDataURL('image/jpeg', quality);
}

// ─── Helper internal ────────────────────────────────────────────────────────

interface ImageSource {
  image: ImageBitmap | HTMLImageElement;
  width: number;
  height: number;
  release?: () => void;
}

/**
 * Muat gambar jadi sumber yang bisa digambar ke canvas.
 * Utamakan createImageBitmap (lebih efisien, menghormati orientasi EXIF);
 * jatuh ke HTMLImageElement untuk browser yang tidak mendukungnya.
 */
/**
 * Format yang tidak bisa digambar ke canvas di browser non-Safari.
 * Safari bisa decode .heic; Chrome/Firefox/Edge tidak.
 */
const UNSUPPORTED_IMAGE_TYPES = ['image/heic', 'image/heif'];

function isUnsupportedImage(file: File): boolean {
  const type = (file.type || '').toLowerCase();
  if (UNSUPPORTED_IMAGE_TYPES.includes(type)) return true;
  // Sebagian browser tidak mengisi file.type untuk .heic
  return /\.(heic|heif)$/i.test(file.name);
}

async function loadImageSource(file: File): Promise<ImageSource> {
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
      // Lanjut ke fallback di bawah
    }
  }

  const dataUrl = await fileToDataUrl(file);
  const img = await loadHtmlImage(dataUrl).catch(() => {
    // Gagal memuat hampir selalu karena formatnya tidak didukung browser ini,
    // dan penyebab tersering adalah foto .heic dari Galeri iPhone.
    if (isUnsupportedImage(file)) {
      throw new Error(
        'Foto format HEIC tidak bisa diproses di browser ini. ' +
          'Gunakan tombol "Ambil Foto Dokumen" (kamera langsung) — hasilnya otomatis JPEG. ' +
          'Kalau memilih dari Galeri, ubah dulu: iPhone → Pengaturan → Kamera → Format → "Paling Kompatibel".',
      );
    }
    throw new Error(`Gagal memuat foto "${file.name}". Pastikan file gambarnya tidak rusak.`);
  });

  return { image: img, width: img.naturalWidth, height: img.naturalHeight };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Gagal membaca file foto'));
    reader.readAsDataURL(file);
  });
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Gagal memuat foto'));
    img.src = src;
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).replace(/^data:.*?;base64,/, ''));
    reader.onerror = () => reject(new Error('Gagal mengonversi PDF ke base64'));
    reader.readAsDataURL(blob);
  });
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function usePdfBuilder() {
  /**
   * Rakit PDF dengan satu tingkat kompresi tertentu.
   * Tidak dipakai langsung — selalu lewat buildPdf yang menangani ukuran.
   */
  const buildOnce = async (
    photos: File[],
    metadata: PdfMetadata,
    level: { maxDim: number; quality: number },
  ): Promise<{ blob: Blob; base64: string }> => {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const centerX = pageWidth / 2;

    // ── Cover Page ──
    const tanggalLabel = formatTanggalID(metadata.requestDate);

    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('DOKUMEN TRANSFUSI DARAH', centerX, 24, { align: 'center' });

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(110);
    pdf.text('RS Petrokimia Gresik', centerX, 31, { align: 'center' });

    pdf.setDrawColor(180);
    pdf.line(20, 36, pageWidth - 20, 36);

    pdf.setTextColor(0);
    let y = 48;

    const pasienRows: [string, string][] = [
      ['Nama Pasien', metadata.patientName],
      ['No. Rekam Medis', metadata.medicalRecordNumber],
      ['Tanggal Permintaan', tanggalLabel],
    ];

    const darahRows: [string, string][] = [
      ['Produk Darah', bloodProductLabel(metadata.bloodProduct)],
      ['Jumlah Kantong', `${metadata.bagCount} kantong`],
      ['Golongan Darah / Rh', metadata.bloodTypeRh],
      ['Nomor Kantong', metadata.bagNumber],
      ['Asal Kantong', ORIGIN_LABELS[metadata.origin]],
    ];

    y = drawSection(pdf, 'DATA PASIEN', pasienRows, y, pageWidth);
    y = drawSection(pdf, 'DATA KANTONG DARAH', darahRows, y, pageWidth);

    // Checklist kelengkapan berkas
    const docs: [string, boolean | undefined][] = [
      ['Inform Concern', metadata.informConcern],
      ['Surat Permintaan Darah', metadata.suratPermintaan],
      ['Form Reaksi Transfusi', metadata.formReaksi],
    ];
    const checked = docs.filter(([, v]) => v).length;

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0);
    pdf.text(`KELENGKAPAN BERKAS (${checked}/${docs.length})`, 20, y);
    y += 6;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    docs.forEach(([label, present]) => {
      pdf.setTextColor(present ? 0 : 150);
      pdf.text(`${present ? '[v]' : '[  ]'}  ${label}`, 24, y);
      y += 5.5;
    });

    pdf.setFontSize(8);
    pdf.setTextColor(140);
    pdf.text(
      `Dipindai oleh: ${metadata.petugas}  ·  ${photos.length} halaman foto  ·  Dibuat otomatis oleh Portal Lab Internal`,
      centerX,
      pageHeight - 12,
      { align: 'center' },
    );

    // ── Photo pages ──
    for (let i = 0; i < photos.length; i++) {
      pdf.addPage();

      const dataUrl = await compressImage(photos[i], level.maxDim, level.quality);
      const imgProps = pdf.getImageProperties(dataUrl);
      const maxWidth = pageWidth - 20;
      const maxHeight = pageHeight - 26;

      // Skalakan agar muat di area konten (contain), arahkan berdasarkan
      // rasio asli supaya orientasi tidak terbalik.
      let drawWidth = maxWidth;
      let drawHeight = (imgProps.height / imgProps.width) * maxWidth;
      if (drawHeight > maxHeight) {
        drawHeight = maxHeight;
        drawWidth = (imgProps.width / imgProps.height) * maxHeight;
      }

      const x = (pageWidth - drawWidth) / 2;
      pdf.addImage(dataUrl, 'JPEG', x, 12, drawWidth, drawHeight);

      pdf.setFontSize(8);
      pdf.setTextColor(120);
      pdf.text(
        `Halaman ${i + 2} — Foto ${i + 1} dari ${photos.length}`,
        centerX,
        pageHeight - 7,
        { align: 'center' },
      );
    }

    const arrayBuffer = pdf.output('arraybuffer');
    const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
    const base64 = await blobToBase64(blob);
    return { blob, base64 };
  };

  /**
   * Rakit PDF yang dijamin muat dikirim.
   *
   * Coba tingkat kompresi pertama; kalau hasilnya masih di atas target,
   * turun satu tingkat dan ulangi. Operator tidak perlu mengatur apa pun —
   * sistem mengecilkan sendiri sampai muat.
   */
  const buildPdf = async (
    photos: File[],
    metadata: PdfMetadata,
  ): Promise<{ blob: Blob; base64: string }> => {
    let result = await buildOnce(photos, metadata, COMPRESSION_LADDER[0]);

    for (let i = 1; i < COMPRESSION_LADDER.length; i++) {
      if (result.base64.length <= PDF_TARGET_BYTES) break;

      const level = COMPRESSION_LADDER[i];
      console.warn(
        `[Transfusi] PDF ${formatBytes(result.base64.length)} melebihi target ` +
          `${formatBytes(PDF_TARGET_BYTES)} — mengulang pada ${level.maxDim}px q${level.quality}`,
      );
      result = await buildOnce(photos, metadata, level);
    }

    console.log(
      `[Transfusi] PDF selesai: ${formatBytes(result.base64.length)} ` +
        `(${photos.length} halaman, target ${formatBytes(PDF_TARGET_BYTES)})`,
    );

    return result;
  };

  return { buildPdf };
}

/** Gambar satu blok label/nilai dua kolom, kembalikan Y berikutnya. */
function drawSection(
  pdf: jsPDF,
  title: string,
  rows: [string, string][],
  startY: number,
  pageWidth: number,
): number {
  let y = startY;

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(0);
  pdf.text(title, 20, y);
  pdf.setDrawColor(220);
  pdf.line(20, y + 2, pageWidth - 20, y + 2);
  y += 9;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  for (const [label, value] of rows) {
    pdf.setTextColor(110);
    pdf.text(label, 20, y);
    pdf.setTextColor(0);
    pdf.text(':', 62, y);
    pdf.text(truncate(value, 60), 66, y);
    y += 6.5;
  }

  return y + 4;
}

/** jsPDF tidak membungkus teks otomatis di posisi absolut — potong manual. */
function truncate(value: string, max: number): string {
  if (!value) return '—';
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

const HARI_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/** '2026-09-26' → 'Sabtu, 26 September 2026'. Tahan input tak valid. */
export function formatTanggalID(isoDate: string): string {
  if (!isoDate) return '—';

  // Tangani format YYYY-MM-DD sebagai tanggal lokal (hindari pergeseran
  // zona waktu yang terjadi bila di-parse sebagai UTC).
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  const d = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(isoDate);

  if (Number.isNaN(d.getTime())) return isoDate;
  return `${HARI_ID[d.getDay()]}, ${d.getDate()} ${BULAN_ID[d.getMonth()]} ${d.getFullYear()}`;
}
