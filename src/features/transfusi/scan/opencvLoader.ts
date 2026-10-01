/**
 * Pemuat OpenCV.js yang lambat (lazy).
 *
 * OpenCV.js versi WASM berukuran ~12 MB. Karena scanner hanya dipakai sesekali,
 * pustaka itu TIDAK boleh ikut bundle utama — kalau ikut, setiap halaman portal
 * membayar ongkos unduhnya. Modul ini baru mengunduh saat `loadOpenCv()` pertama
 * kali dipanggil, yaitu ketika operator benar-benar membuka layar scan.
 *
 * Kegagalan memuat (jaringan RS lambat, WASM diblokir, kuota habis) TIDAK boleh
 * mematikan fitur. Pemanggil harus menyiapkan jalur cadangan; lihat pesan error
 * di bawah dan penanganan di DocumentScanner.
 */

// Tipe minimal yang kita pakai — cukup untuk menghindari `any`, tanpa
// bergantung penuh pada deklarasi internal paket yang belum stabil.
export interface CvMat {
  rows: number;
  cols: number;
  data: Uint8Array | Uint8ClampedArray | Int32Array | Float32Array;
  data32S?: Int32Array;
  data32F?: Float32Array;
  ucharPtr?: unknown;
  delete(): void;
  roi(rect: { x: number; y: number; width: number; height: number }): CvMat;
  clone(): CvMat;
}

export interface CvMatVector {
  size(): number;
  get(index: number): CvMat;
  delete(): void;
}

export interface CvRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Bagian dari API OpenCV yang benar-benar kami pakai. */
export interface OpenCv {
  Mat: new () => CvMat;
  MatVector: new () => CvMatVector;
  matFromArray(
    rows: number,
    cols: number,
    type: number,
    array: number[] | ArrayBufferView,
  ): CvMat;
  imread(el: HTMLElement | string): CvMat;
  cvtColor(src: CvMat, dst: CvMat, code: number): void;
  GaussianBlur(src: CvMat, dst: CvMat, ksize: { width: number; height: number }, sigma: number): void;
  Canny(src: CvMat, dst: CvMat, t1: number, t2: number, aperture?: number): void;
  dilate(
    src: CvMat,
    dst: CvMat,
    kernel: CvMat,
    anchor: { x: number; y: number },
    iterations: number,
  ): void;
  getStructuringElement(shape: number, ksize: { width: number; height: number }): CvMat;
  findContours(
    src: CvMat,
    contours: CvMatVector,
    hierarchy: CvMat,
    mode: number,
    method: number,
  ): void;
  contourArea(contour: CvMat): number;
  arcLength(contour: CvMat, closed: boolean): number;
  approxPolyDP(contour: CvMat, approx: CvMat, epsilon: number, closed: boolean): void;
  getPerspectiveTransform(src: CvMat, dst: CvMat): CvMat;
  warpPerspective(
    src: CvMat,
    dst: CvMat,
    m: CvMat,
    dsize: { width: number; height: number },
  ): void;
  matFromImageData(imageData: ImageData): CvMat;
  imshow(canvas: HTMLElement | string, mat: CvMat): void;
  // Konstanta enum
  COLOR_RGBA2GRAY: number;
  COLOR_RGBA2RGB: number;
  RETR_EXTERNAL: number;
  CHAIN_APPROX_SIMPLE: number;
  MORPH_RECT: number;
  CV_32FC2: number;
  CV_8UC1: number;
  CV_8UC4: number;
  onRuntimeInitialized?: () => void;
}

let cvPromise: Promise<OpenCv> | null = null;

/** Ambil status kesiapan OpenCV.js (dipakai untuk menampilkan indikator). */
export function isOpenCvReady(): boolean {
  const mod = (globalThis as { cv?: Partial<OpenCv> }).cv;
  return Boolean(mod && typeof (mod as OpenCv).Mat === 'function');
}

/**
 * Muat OpenCV.js sekali saja. Panggilan berikutnya memakai promise yang sama,
 * jadi WASM tidak diunduh berulang kali.
 *
 * @throws Error dengan pesan berbahasa Indonesia yang bisa ditampilkan langsung.
 */
export function loadOpenCv(): Promise<OpenCv> {
  if (cvPromise) return cvPromise;

  cvPromise = (async () => {
    try {
      // Import dinamis: inilah kunci agar OpenCV.js masuk chunk terpisah.
      const mod: unknown = await import('@techstark/opencv-js');

      // Bentuk modul bisa berbeda antar-bundler: kadang promise, kadang objek
      // dengan `onRuntimeInitialized`, kadang sudah siap.
      const resolved = await resolveModule(mod);
      if (resolved && typeof (resolved as OpenCv).Mat === 'function') {
        return resolved as OpenCv;
      }

      throw new Error('Modul OpenCV.js tidak memuat API yang diharapkan');
    } catch (err) {
      // Reset supaya percobaan berikutnya mencoba lagi (mis. setelah jaringan pulih).
      cvPromise = null;
      console.error('[Scan] Gagal memuat OpenCV.js:', err);
      throw new Error(
        'Gagal menyiapkan mesin pemindai (OpenCV). Periksa koneksi internet lalu coba lagi. ' +
          'Sementara itu Anda tetap bisa memotong foto secara manual.',
      );
    }
  })();

  return cvPromise;
}

async function resolveModule(mod: unknown): Promise<Partial<OpenCv> | null> {
  const candidate = extractCandidate(mod);
  if (!candidate) return null;

  // Kasus 1: API sudah siap (Mat ada) — dipakai apa adanya.
  if (typeof candidate.Mat === 'function') return candidate;

  // Kasus 2: modul berupa promise (beberapa bundler membungkus Emscripten
  // sebagai promise). Await lalu periksa lagi.
  const maybeThenable = candidate as unknown as { then?: unknown };
  if (typeof maybeThenable.then === 'function') {
    try {
      const awaited = await (candidate as unknown as Promise<Partial<OpenCv>>);
      const resolved = extractCandidate(awaited) ?? (awaited as Partial<OpenCv>);
      if (resolved && typeof resolved.Mat === 'function') return resolved;
      if (resolved) return waitForRuntime(resolved);
    } catch {
      // Lanjut ke jalur onRuntimeInitialized.
    }
  }

  // Kasus 3: WASM belum selesai inisialisasi.
  return waitForRuntime(candidate);
}

/** Tunggu callback onRuntimeInitialized milik Emscripten. */
function waitForRuntime(candidate: Partial<OpenCv>): Promise<Partial<OpenCv>> {
  return new Promise<Partial<OpenCv>>((resolve) => {
    const previous = candidate.onRuntimeInitialized;
    candidate.onRuntimeInitialized = () => {
      previous?.();
      resolve(candidate);
    };
  });
}

/** Ambil objek API dari namespace modul (default/named/namespace langsung). */
function extractCandidate(mod: unknown): Partial<OpenCv> | null {
  if (!mod || typeof mod !== 'object') return null;
  const m = mod as Record<string, unknown>;
  const preferred = (m.default ?? m.cv ?? m) as Partial<OpenCv>;
  return preferred && typeof preferred === 'object' ? preferred : null;
}

/** Hanya untuk pengujian: buang cache loader. */
export function __resetOpenCvLoader(): void {
  cvPromise = null;
}
