/**
 * Koreksi perspektif: ubah kuadrilateral dokumen jadi persegi panjang rata.
 *
 * Inilah yang membuat foto miring terlihat seperti hasil scan datar. Memakai
 * `getPerspectiveTransform` + `warpPerspective` dari OpenCV.
 */
import { loadOpenCv, type OpenCv, type CvMat } from './opencvLoader';
import { orderCorners, computeOutputSize, type Point } from './cornerGeometry';

/**
 * Ratakan area dokumen yang ditentukan oleh 4 sudut menjadi ImageData persegi.
 *
 * @param imageData  Gambar sumber (resolusi penuh disarankan, agar tajam).
 * @param corners    4 sudut dokumen (urutan apa pun; akan diseragamkan).
 * @param maxDimension Batas sisi terpanjang hasil, untuk menghemat memori.
 */
export async function warpDocument(
  imageData: ImageData,
  corners: Point[],
  maxDimension = 2400,
): Promise<ImageData> {
  const cv = await loadOpenCv();
  const ordered = orderCorners(corners);
  let { width, height } = computeOutputSize(ordered);

  // Batasi ukuran keluaran agar warp tidak meledak di HP memori kecil.
  const longest = Math.max(width, height);
  if (longest > maxDimension) {
    const scale = maxDimension / longest;
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
  }

  const garbage: CvMat[] = [];
  const track = <T extends CvMat>(m: T): T => {
    garbage.push(m);
    return m;
  };

  try {
    const src = track(cv.matFromImageData(imageData));

    const srcTri: Point[] = ordered;
    const dstTri: Point[] = [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
    ];

    const srcMat = track(pointsToMat(cv, srcTri));
    const dstMat = track(pointsToMat(cv, dstTri));
    const transform = track(cv.getPerspectiveTransform(srcMat, dstMat));

    const dst = track(new cv.Mat());
    cv.warpPerspective(src, dst, transform, { width, height });

    return matToImageData(dst);
  } finally {
    garbage.forEach((m) => safeDelete(m));
  }
}

/** Bangun Mat 4x1 CV_32FC2 dari daftar titik. */
function pointsToMat(cv: OpenCv, points: Point[]): CvMat {
  const flat: number[] = [];
  points.forEach((p) => {
    flat.push(p.x, p.y);
  });
  return cv.matFromArray(points.length, 1, cv.CV_32FC2, flat);
}

/** Konversi Mat RGBA kembali ke ImageData (untuk digambar ke canvas). */
function matToImageData(mat: CvMat): ImageData {
  const width = mat.cols;
  const height = mat.rows;
  // data Mat RGBA adalah Uint8ClampedArray-compatible.
  const data = new Uint8ClampedArray(mat.data);
  return new ImageData(data, width, height);
}

function safeDelete(obj: { delete?: () => void } | undefined | null): void {
  try {
    obj?.delete?.();
  } catch {
    // abaikan
  }
}
