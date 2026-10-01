import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock OpenCV ─────────────────────────────────────────────────────────────
//
// Kita tidak memuat WASM asli di jsdom. Sebagai gantinya, `cv` palsu merekam
// argumen yang diterima tiap fungsi. Tujuannya: mengunci KONTRAK pemanggilan
// OpenCV — khususnya urutan argumen findContours(image, contours, ...) — supaya
// bug "Expected null or instance of Mat, got an instance of MatVector" tidak
// terulang.

interface FakeMat {
  rows: number;
  cols: number;
  data32S?: Int32Array;
  data32F?: Float32Array;
  deleted: boolean;
  delete: () => void;
  type?: () => number;
}

const calls: Record<string, unknown[][]> = {};
function record(name: string, args: unknown[]) {
  (calls[name] ??= []).push(args);
}

// Kontur palsu: satu kontur segi empat dengan 4 sudut.
const QUAD_COORDS = [10, 10, 90, 10, 90, 90, 10, 90];

function makeFakeMat(opts: Partial<FakeMat> = {}): FakeMat {
  const mat: FakeMat = {
    rows: 0,
    cols: 0,
    deleted: false,
    delete() {
      mat.deleted = true;
    },
    ...opts,
  };
  return mat;
}

const fakeCv = {
  Mat: class {
    rows = 0;
    cols = 0;
    deleted = false;
    delete() {
      this.deleted = true;
    }
  },
  MatVector: class {
    private items: FakeMat[] = [makeFakeMat({ rows: 4, cols: 1, data32S: new Int32Array(QUAD_COORDS) })];
    size() {
      return this.items.length;
    }
    get(i: number) {
      return this.items[i];
    }
    delete() {
      /* noop */
    }
  },
  matFromImageData: (img: ImageData) => {
    record('matFromImageData', [img]);
    return makeFakeMat({ rows: img.height, cols: img.width });
  },
  cvtColor: (...args: unknown[]) => record('cvtColor', args),
  GaussianBlur: (...args: unknown[]) => record('GaussianBlur', args),
  Canny: (...args: unknown[]) => record('Canny', args),
  getStructuringElement: (...args: unknown[]) => record('getStructuringElement', args),
  dilate: (...args: unknown[]) => record('dilate', args),
  findContours: (...args: unknown[]) => record('findContours', args),
  arcLength: (...args: unknown[]) => {
    record('arcLength', args);
    return 320;
  },
  approxPolyDP: (...args: unknown[]) => {
    record('approxPolyDP', args);
    // Isi `approx` (argumen kedua) dengan 4 titik.
    const approx = args[1] as FakeMat;
    approx.rows = 4;
    approx.data32S = new Int32Array(QUAD_COORDS);
    approx.data32F = new Float32Array(QUAD_COORDS);
  },
  contourArea: () => 6400,
  COLOR_RGBA2GRAY: 11,
  RETR_EXTERNAL: 0,
  CHAIN_APPROX_SIMPLE: 2,
  MORPH_RECT: 0,
  CV_32FC2: 37,
  CV_8UC1: 0,
  CV_8UC4: 24,
};

vi.mock('../scan/opencvLoader', () => ({
  loadOpenCv: vi.fn(async () => fakeCv),
  isOpenCvReady: vi.fn(() => true),
  __resetOpenCvLoader: vi.fn(),
}));

import { detectDocumentCorners } from '../scan/detectDocument';

function makeImage(w = 100, h = 100): ImageData {
  return new ImageData(new Uint8ClampedArray(w * h * 4), w, h);
}

describe('detectDocumentCorners', () => {
  beforeEach(() => {
    for (const key of Object.keys(calls)) delete calls[key];
  });

  it('memanggil findContours dengan gambar (bukan MatVector) sebagai argumen pertama', async () => {
    await detectDocumentCorners(makeImage());

    expect(calls.findContours).toBeDefined();
    const args = calls.findContours[0];

    // Argumen 1 = gambar edges (Mat), BUKAN contours (MatVector).
    // Ini yang mencegah error "Expected null or instance of Mat, got MatVector".
    const first = args[0] as { items?: unknown; rows?: number };
    expect(first).toBeDefined();
    // Mat palsu punya properti `rows`; MatVector punya `items`.
    expect('rows' in first).toBe(true);
    expect('items' in first).toBe(false);

    // Argumen 2 = wadah kontur (MatVector), punya method size().
    const second = args[1] as { size?: unknown };
    expect(typeof second.size).toBe('function');
  });

  it('memakai mode RETR_EXTERNAL & CHAIN_APPROX_SIMPLE', async () => {
    await detectDocumentCorners(makeImage());
    const args = calls.findContours[0];
    expect(args[3]).toBe(fakeCv.RETR_EXTERNAL);
    expect(args[4]).toBe(fakeCv.CHAIN_APPROX_SIMPLE);
  });

  it('mengembalikan 4 sudut terurut saat kuadrilateral terdeteksi', async () => {
    const result = await detectDocumentCorners(makeImage());
    expect(result).toHaveLength(4);
    // Sudut dari QUAD_COORDS (10,10)-(90,90) → TL, TR, BR, BL
    expect(result![0]).toEqual({ x: 10, y: 10 });
    expect(result![2]).toEqual({ x: 90, y: 90 });
  });

  it('menjalankan pipeline lengkap (gray → blur → canny → dilate → contours)', async () => {
    await detectDocumentCorners(makeImage());
    for (const step of ['cvtColor', 'GaussianBlur', 'Canny', 'dilate', 'findContours', 'approxPolyDP']) {
      expect(calls[step], `langkah "${step}" tidak dipanggil`).toBeDefined();
    }
  });

  it('mengembalikan null bila matFromImageData tidak tersedia', async () => {
    const original = fakeCv.matFromImageData;
    // @ts-expect-error sengaja hapus untuk pengujian
    fakeCv.matFromImageData = undefined;
    try {
      const result = await detectDocumentCorners(makeImage());
      expect(result).toBeNull();
    } finally {
      fakeCv.matFromImageData = original;
    }
  });
});
