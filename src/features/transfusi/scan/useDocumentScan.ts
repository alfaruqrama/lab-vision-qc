/**
 * Hook orkestrasi pemindaian: File mentah → deteksi → warp → filter → File hasil.
 *
 * Memisahkan alur ini dari komponen UI supaya bisa dipakai baik untuk proses
 * awal (saat foto diambil) maupun untuk "Terapkan" ulang setelah sudut diubah.
 */
import { useCallback, useState } from 'react';
import { loadImage, imageDataToFile, imageDataToCanvas, fitToMax } from './imageUtils';
import { detectDocumentCorners } from './detectDocument';
import { warpDocument } from './perspectiveCorrect';
import { applyScanFilter, DEFAULT_SCAN_FILTER, type ScanFilter } from './applyScanFilter';
import { defaultCorners, type Point } from './cornerGeometry';
import { loadOpenCv } from './opencvLoader';

/** Ukuran gambar kerja untuk deteksi & pratinjau. */
export const WORK_MAX_DIMENSION = 2000;

export interface AnalyzeResult {
  /** Sudut yang terdeteksi (atau default bila gagal), dalam ruang kerja. */
  corners: Point[];
  /** Dimensi gambar kerja (untuk memetakan koordinat sudut di UI). */
  width: number;
  height: number;
  /** true bila deteksi otomatis berhasil. */
  detected: boolean;
  /** ImageData gambar kerja, disimpan untuk warp tanpa memuat ulang. */
  imageData: ImageData;
}

export interface ScanResult {
  file: File;
  corners: Point[];
  filter: ScanFilter;
  width: number;
  height: number;
}

export function useDocumentScan() {
  const [opencvFailed, setOpencvFailed] = useState(false);

  /**
   * Muat gambar & coba deteksi otomatis. Tidak pernah melempar karena masalah
   * OpenCV — bila gagal, kembalikan sudut default agar operator bisa atur manual.
   */
  const analyze = useCallback(async (file: File): Promise<AnalyzeResult> => {
    const loaded = await loadImage(file, WORK_MAX_DIMENSION);

    let corners: Point[] = defaultCorners(loaded.width, loaded.height);
    let detected = false;

    try {
      await loadOpenCv();
      const found = await detectDocumentCorners(loaded.imageData);
      if (found) {
        corners = found;
        detected = true;
      }
    } catch (err) {
      // OpenCV tidak tersedia atau deteksi gagal — lanjut dengan sudut default.
      console.warn('[Scan] Deteksi otomatis tidak tersedia, memakai bingkai default:', err);
      setOpencvFailed(true);
    }

    return {
      corners,
      width: loaded.width,
      height: loaded.height,
      detected,
      imageData: loaded.imageData,
    };
  }, []);

  /**
   * Terapkan sudut + filter yang dipilih menjadi File JPEG.
   *
   * Bila warp lewat OpenCV gagal (mis. WASM bermasalah), jatuh ke pemotongan
   * bounding-box sederhana via canvas, supaya operator tetap bisa menyimpan.
   */
  const apply = useCallback(
    async (
      imageData: ImageData,
      corners: Point[],
      filter: ScanFilter,
      sourceName = 'scan.jpg',
    ): Promise<ScanResult> => {
      let warped: ImageData;
      try {
        warped = await warpDocument(imageData, corners, WORK_MAX_DIMENSION);
      } catch (err) {
        console.warn('[Scan] Warp OpenCV gagal, memakai pemotongan biasa:', err);
        warped = simpleCrop(imageData, corners);
      }

      const filtered = applyScanFilter(warped, filter);
      const file = await imageDataToFile(filtered, sourceName);

      return {
        file,
        corners,
        filter,
        width: filtered.width,
        height: filtered.height,
      };
    },
    [],
  );

  return { analyze, apply, opencvFailed, defaultFilter: DEFAULT_SCAN_FILTER };
}

/** Pemotongan cadangan tanpa OpenCV: ambil kotak pembungkus sudut. */
function simpleCrop(image: ImageData, corners: Point[]): ImageData {
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const minX = Math.max(0, Math.floor(Math.min(...xs)));
  const minY = Math.max(0, Math.floor(Math.min(...ys)));
  const maxX = Math.min(image.width, Math.ceil(Math.max(...xs)));
  const maxY = Math.min(image.height, Math.ceil(Math.max(...ys)));

  const { width, height } = fitToMax(maxX - minX, maxY - minY, WORK_MAX_DIMENSION);

  const src = imageDataToCanvas(image);
  const dst = document.createElement('canvas');
  dst.width = width;
  dst.height = height;
  const ctx = dst.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D context tidak tersedia');

  ctx.drawImage(src, minX, minY, maxX - minX, maxY - minY, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}
