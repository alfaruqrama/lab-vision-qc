/**
 * Deteksi tepi dokumen dengan OpenCV.js.
 *
 * Pipeline klasik (sama seperti yang dipakai CamScanner/Adobe Scan secara
 * sederhana): turunkan resolusi → abu-abu → blur → Canny → dilate → cari
 * kontur → cari kuadrilateral terbesar → kembalikan 4 sudutnya.
 *
 * Fungsi di sini menerima `ImageData` dan mengembalikan koordinat dalam ruang
 * gambar yang diberikan (kalau caller memberi gambar yang sudah diperkecil,
 * hasilnya juga dalam ruang itu — pemanggil yang menskalakan kembali).
 */
import {
  loadOpenCv,
  type OpenCv,
  type CvMat,
  type CvMatVector,
} from './opencvLoader';
import { orderCorners, isPlausibleQuad, type Point } from './cornerGeometry';

export interface DetectOptions {
  /** Ambang bawah Canny. */
  cannyLow?: number;
  /** Ambang atas Canny. */
  cannyHigh?: number;
}

const DEFAULTS: Required<DetectOptions> = {
  cannyLow: 75,
  cannyHigh: 200,
};

/**
 * Deteksi 4 sudut dokumen dalam sebuah ImageData.
 *
 * @returns Titik sudut terurut TL, TR, BR, BL, atau `null` bila tidak ada
 *          kuadrilateral yang cukup meyakinkan (pemanggil lalu memakai
 *          `defaultCorners` dan menyerahkan ke pengaturan manual).
 */
export async function detectDocumentCorners(
  imageData: ImageData,
  options: DetectOptions = {},
): Promise<Point[] | null> {
  const opt = { ...DEFAULTS, ...options };
  const cv = await loadOpenCv();
  if (typeof cv.matFromImageData !== 'function') {
    console.warn('[Scan] cv.matFromImageData tidak tersedia, lewati deteksi otomatis');
    return null;
  }

  // Semua Mat yang dibuat dicatat agar bisa dibersihkan di akhir — WASM tidak
  // punya garbage collector untuk objek native.
  const garbage: CvMat[] = [];
  const vectors: CvMatVector[] = [];
  const track = <T extends CvMat>(m: T): T => {
    garbage.push(m);
    return m;
  };

  try {
    const src = track(cv.matFromImageData(imageData));

    const gray = track(new cv.Mat());
    toGray(cv, src, gray);

    const blurred = track(new cv.Mat());
    cv.GaussianBlur(gray, blurred, { width: 5, height: 5 }, 0);

    const edges = track(new cv.Mat());
    cv.Canny(blurred, edges, opt.cannyLow, opt.cannyHigh);

    // Dilate menutup celah pada tepi sehingga kontur lebih utuh.
    const kernel = track(cv.getStructuringElement(cv.MORPH_RECT, { width: 5, height: 5 }));
    cv.dilate(edges, edges, kernel, { x: -1, y: -1 }, 1);

    const contours = new cv.MatVector();
    vectors.push(contours);
    const hierarchy = track(new cv.Mat());

    // URUTAN ARGUMEN PENTING: findContours(image, contours, hierarchy, mode, method).
    // Membalik `edges` dan `contours` membuat OpenCV melempar
    // "Expected null or instance of Mat, got an instance of MatVector".
    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    const best = findBestQuad(cv, contours, imageData.width, imageData.height);
    
    // Fallback: jika tidak ada quad yang valid, kembalikan seluruh batas gambar
    // Ini mencegah crop persegi dan memastikan gambar ditampilkan utuh
    if (!best) {
      return [
        { x: 0, y: 0 },
        { x: imageData.width, y: 0 },
        { x: imageData.width, y: imageData.height },
        { x: 0, y: imageData.height },
      ];
    }
    
    return best;
  } catch (err) {
    console.error('[Scan] Deteksi tepi gagal:', err);
    return null;
  } finally {
    vectors.forEach((v) => safeDelete(v));
    garbage.forEach((m) => safeDelete(m));
  }
}

function toGray(cv: OpenCv, src: CvMat, dst: CvMat): void {
  // matFromImageData menghasilkan RGBA (4 kanal).
  cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY);
}

/**
 * Gabungkan 2 titik terdekat dari 5 titik menjadi 1 (midpoint).
 * Digunakan ketika approxPolyDP menghasilkan 5 titik karena satu sudut terdeteksi ganda.
 */
function mergeClosestPair(points: Point[]): Point[] {
  if (points.length !== 5) return points;

  let minDist = Infinity;
  let mergeIdx = -1;

  // Cek jarak antara titik berurutan (termasuk wrap-around)
  for (let i = 0; i < 5; i++) {
    const j = (i + 1) % 5;
    const dx = points[i].x - points[j].x;
    const dy = points[i].y - points[j].y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < minDist) {
      minDist = dist;
      mergeIdx = i;
    }
  }

  // Gabungkan titik mergeIdx dan mergeIdx+1 menjadi midpoint
  const j = (mergeIdx + 1) % 5;
  const merged: Point = {
    x: (points[mergeIdx].x + points[j].x) / 2,
    y: (points[mergeIdx].y + points[j].y) / 2,
  };

  // Ambil 3 titik lainnya (yang tidak digabungkan)
  const result: Point[] = [];
  for (let i = 0; i < 5; i++) {
    if (i === mergeIdx || i === j) continue;
    result.push(points[i]);
  }

  // Sisipkan merged point di posisi yang tepat (setelah mergeIdx)
  result.splice(mergeIdx % 3, 0, merged);

  return result;
}

/** Iterasi kontur, cari kuadrilateral terbaik dengan multi-pass epsilon. */
function findBestQuad(
  cv: OpenCv,
  contours: CvMatVector,
  width: number,
  height: number,
): Point[] | null {
  // Multi-pass dengan epsilon berbeda untuk fleksibilitas
  const epsilonRatios = [0.02, 0.04, 0.06];
  let best: Point[] | null = null;
  let bestArea = 0;

  // Ambil top 5 kontur terbesar (doc-skanner approach)
  const contourData: Array<{ index: number; area: number }> = [];
  const count = contours.size();
  for (let i = 0; i < count; i++) {
    const contour = contours.get(i);
    const area = cv.contourArea(contour);
    contourData.push({ index: i, area });
  }
  contourData.sort((a, b) => b.area - a.area);
  const topContours = contourData.slice(0, 5);

  for (const epsilonRatio of epsilonRatios) {
    for (const { index: i } of topContours) {
      // `contours.get(i)` mengembalikan referensi yang dimiliki MatVector —
      // JANGAN di-delete manual; MatVector-nya yang dibersihkan di akhir.
      const contour = contours.get(i);
      const perimeter = cv.arcLength(contour, true);
      if (perimeter <= 0) continue;

      const approx = new cv.Mat();
      try {
        cv.approxPolyDP(contour, approx, epsilonRatio * perimeter, true);

        let corners: Point[] | null = null;

        // Handle 4 titik (ideal)
        if (approx.rows === 4) {
          corners = matToPoints(approx);
        }
        // Handle 5 titik (satu sudut terdeteksi ganda)
        else if (approx.rows === 5) {
          const fivePoints = matToPoints(approx);
          corners = mergeClosestPair(fivePoints);
        }

        if (!corners) continue;

        const ordered = orderCorners(corners);

        if (!isPlausibleQuad(ordered, width, height)) continue;

        const area = Math.abs(quadAreaLocal(ordered));
        if (area > bestArea) {
          bestArea = area;
          best = ordered;
        }
      } finally {
        safeDelete(approx);
      }
    }
    
    // Jika sudah dapat hasil yang bagus, tidak perlu lanjut ke epsilon berikutnya
    if (best && bestArea > width * height * 0.3) {
      break;
    }
  }

  return best;
}

/**
 * Ambil koordinat titik dari Mat 4x1.
 *
 * `approxPolyDP` atas hasil `findContours` menghasilkan Mat bertipe CV_32SC2
 * (integer). Membaca `data32F` pada Mat itu hanya menafsirkan ulang byte yang
 * sama dan memberi nilai ngawur — jadi utamakan `data32S`.
 */
function matToPoints(mat: CvMat): Point[] {
  const ints = mat.data32S;
  if (ints && ints.length >= 8) {
    const points: Point[] = [];
    for (let i = 0; i < 4; i++) {
      points.push({ x: ints[i * 2], y: ints[i * 2 + 1] });
    }
    return points;
  }

  const floats = mat.data32F;
  if (floats && floats.length >= 8) {
    const points: Point[] = [];
    for (let i = 0; i < 4; i++) {
      points.push({ x: floats[i * 2], y: floats[i * 2 + 1] });
    }
    return points;
  }

  throw new Error('Mat sudut tidak berisi koordinat yang diharapkan');
}

/** Luas shoelace lokal (hindari impor sirkular dengan cornerGeometry). */
function quadAreaLocal(corners: Point[]): number {
  let area = 0;
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

function safeDelete(obj: { delete?: () => void } | undefined | null): void {
  try {
    obj?.delete?.();
  } catch {
    // Sudah dihapus atau belum terinisialisasi — abaikan.
  }
}
