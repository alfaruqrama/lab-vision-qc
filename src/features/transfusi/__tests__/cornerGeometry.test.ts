import { describe, it, expect } from 'vitest';
import {
  orderCorners,
  computeOutputSize,
  quadArea,
  clampPoint,
  translateQuad,
  quadCenter,
  quadBounds,
  imageToDisplay,
  displayToImage,
  defaultCorners,
  isPlausibleQuad,
  distance,
  type Point,
} from '../scan/cornerGeometry';

describe('orderCorners', () => {
  it('mengurutkan titik acak jadi TL, TR, BR, BL', () => {
    // Titik diberikan dalam urutan berantakan
    const scrambled: Point[] = [
      { x: 90, y: 80 }, // BR
      { x: 10, y: 10 }, // TL
      { x: 10, y: 80 }, // BL
      { x: 90, y: 10 }, // TR
    ];
    const [tl, tr, br, bl] = orderCorners(scrambled);
    expect(tl).toEqual({ x: 10, y: 10 });
    expect(tr).toEqual({ x: 90, y: 10 });
    expect(br).toEqual({ x: 90, y: 80 });
    expect(bl).toEqual({ x: 10, y: 80 });
  });

  it('tetap benar meski urutan masukan sudah benar', () => {
    const ordered: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 200 },
      { x: 0, y: 200 },
    ];
    expect(orderCorners(ordered)).toEqual(ordered);
  });

  it('menangani kuadrilateral miring (perspektif)', () => {
    const skewed: Point[] = [
      { x: 120, y: 60 },
      { x: 20, y: 20 },
      { x: 30, y: 180 },
      { x: 140, y: 150 },
    ];
    const [tl, tr, br, bl] = orderCorners(skewed);
    expect(tl).toEqual({ x: 20, y: 20 });
    expect(tr).toEqual({ x: 120, y: 60 });
    expect(bl).toEqual({ x: 30, y: 180 });
    expect(br).toEqual({ x: 140, y: 150 });
  });

  it('melempar bila jumlah titik bukan 4', () => {
    expect(() => orderCorners([{ x: 0, y: 0 }])).toThrow();
    expect(() => orderCorners([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toThrow();
  });
});

describe('distance', () => {
  it('menghitung jarak Euclidean', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});

describe('computeOutputSize', () => {
  it('memakai sisi terpanjang untuk lebar & tinggi', () => {
    const corners: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 200 },
      { x: 0, y: 200 },
    ];
    expect(computeOutputSize(corners)).toEqual({ width: 100, height: 200 });
  });

  it('menangani trapesium (lebar atas berbeda dengan bawah)', () => {
    const corners: Point[] = [
      { x: 20, y: 0 },
      { x: 180, y: 0 },
      { x: 200, y: 300 },
      { x: 0, y: 300 },
    ];
    const { width, height } = computeOutputSize(corners);
    // Lebar = max(sisi atas 160, sisi bawah 200) = 200
    expect(width).toBe(200);
    // Tinggi = max(sisi kiri & kanan). Sisi miring sedikit lebih panjang dari
    // 300 karena trapesium, jadi dibulatkan ke atas.
    expect(height).toBeGreaterThanOrEqual(300);
  });

  it('selalu memberi minimal 1 piksel', () => {
    const degenerate: Point[] = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ];
    expect(computeOutputSize(degenerate)).toEqual({ width: 1, height: 1 });
  });

  it('melempar bila bukan 4 titik', () => {
    expect(() => computeOutputSize([{ x: 0, y: 0 }])).toThrow();
  });
});

describe('quadArea', () => {
  it('menghitung luas persegi panjang', () => {
    const rect: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 20 },
      { x: 0, y: 20 },
    ];
    expect(quadArea(rect)).toBe(200);
  });

  it('urutan titik siklik tidak memengaruhi luas', () => {
    const a: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    // Rotasi siklik (bukan bowtie) — poligon tetap sama.
    const b: Point[] = [a[2], a[3], a[0], a[1]];
    expect(quadArea(a)).toBe(quadArea(b));
    expect(quadArea(a)).toBe(100);
  });

  it('urutan terbalik (searah vs berlawanan jarum jam) sama luasnya', () => {
    const cw: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const ccw: Point[] = [...cw].reverse();
    expect(quadArea(cw)).toBe(quadArea(ccw));
  });

  it('menghitung segitiga (poligon 3 titik)', () => {
    const tri: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 10 },
    ];
    expect(quadArea(tri)).toBe(50);
  });

  it('mengembalikan 0 untuk kurang dari 3 titik', () => {
    expect(quadArea([])).toBe(0);
    expect(quadArea([{ x: 0, y: 0 }])).toBe(0);
  });
});

describe('clampPoint', () => {
  it('menjepit titik yang keluar batas', () => {
    expect(clampPoint({ x: -5, y: 50 }, 100, 100)).toEqual({ x: 0, y: 50 });
    expect(clampPoint({ x: 150, y: 200 }, 100, 100)).toEqual({ x: 100, y: 100 });
  });

  it('membiarkan titik di dalam', () => {
    expect(clampPoint({ x: 30, y: 40 }, 100, 100)).toEqual({ x: 30, y: 40 });
  });
});

describe('translateQuad', () => {
  it('menggeser semua titik', () => {
    const quad: Point[] = [
      { x: 10, y: 10 },
      { x: 50, y: 10 },
      { x: 50, y: 50 },
      { x: 10, y: 50 },
    ];
    const moved = translateQuad(quad, 5, -5, 100, 100);
    expect(moved[0]).toEqual({ x: 15, y: 5 });
  });

  it('menjepit saat geser melewati tepi', () => {
    const quad: Point[] = [
      { x: 90, y: 90 },
      { x: 95, y: 90 },
      { x: 95, y: 95 },
      { x: 90, y: 95 },
    ];
    const moved = translateQuad(quad, 50, 50, 100, 100);
    moved.forEach((p) => {
      expect(p.x).toBeLessThanOrEqual(100);
      expect(p.y).toBeLessThanOrEqual(100);
    });
  });
});

describe('quadCenter', () => {
  it('menghitung titik tengah', () => {
    const quad: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    expect(quadCenter(quad)).toEqual({ x: 50, y: 50 });
  });
});

describe('quadBounds', () => {
  it('menghitung kotak pembungkus', () => {
    const quad: Point[] = [
      { x: 20, y: 30 },
      { x: 80, y: 10 },
      { x: 90, y: 70 },
      { x: 10, y: 50 },
    ];
    expect(quadBounds(quad)).toEqual({ minX: 10, minY: 10, maxX: 90, maxY: 70 });
  });
});

describe('konversi koordinat display', () => {
  it('imageToDisplay mengembalikan persentase', () => {
    expect(imageToDisplay({ x: 50, y: 25 }, 100, 100)).toEqual({ xPct: 0.5, yPct: 0.25 });
  });

  it('imageToDisplay aman saat lebar 0', () => {
    expect(imageToDisplay({ x: 50, y: 25 }, 0, 0)).toEqual({ xPct: 0, yPct: 0 });
  });

  it('displayToImage mengembalikan piksel', () => {
    expect(displayToImage(0.5, 0.25, 200, 400)).toEqual({ x: 100, y: 100 });
  });

  it('displayToImage menjepit ke batas gambar', () => {
    expect(displayToImage(1.5, -0.5, 100, 100)).toEqual({ x: 100, y: 0 });
  });

  it('round-trip konsisten', () => {
    const original: Point = { x: 123, y: 456 };
    const { xPct, yPct } = imageToDisplay(original, 1000, 1000);
    const back = displayToImage(xPct, yPct, 1000, 1000);
    expect(back).toEqual(original);
  });
});

describe('defaultCorners', () => {
  it('membuat bingkai di dalam tepi gambar', () => {
    const corners = defaultCorners(1000, 500);
    expect(corners).toHaveLength(4);
    expect(corners[0]).toEqual({ x: 40, y: 20 });
    expect(corners[2]).toEqual({ x: 960, y: 480 });
  });

  it('menerima inset kustom', () => {
    const corners = defaultCorners(100, 100, 0.1);
    expect(corners[0]).toEqual({ x: 10, y: 10 });
  });
});

describe('isPlausibleQuad', () => {
  it('menerima kuadrilateral besar & di dalam gambar', () => {
    const quad: Point[] = [
      { x: 50, y: 50 },
      { x: 450, y: 50 },
      { x: 450, y: 450 },
      { x: 50, y: 450 },
    ];
    expect(isPlausibleQuad(quad, 500, 500)).toBe(true);
  });

  it('menolak kuadrilateral yang terlalu kecil', () => {
    const tiny: Point[] = [
      { x: 10, y: 10 },
      { x: 40, y: 10 },
      { x: 40, y: 40 },
      { x: 10, y: 40 },
    ];
    expect(isPlausibleQuad(tiny, 500, 500)).toBe(false);
  });

  it('menolak sudut yang keluar gambar', () => {
    const outside: Point[] = [
      { x: -100, y: 50 },
      { x: 450, y: 50 },
      { x: 450, y: 450 },
      { x: 50, y: 450 },
    ];
    expect(isPlausibleQuad(outside, 500, 500)).toBe(false);
  });

  it('menolak jumlah titik yang salah', () => {
    expect(isPlausibleQuad([{ x: 0, y: 0 }], 500, 500)).toBe(false);
  });

  it('menolak gambar ber-dimensi nol', () => {
    const quad: Point[] = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ];
    expect(isPlausibleQuad(quad, 0, 0)).toBe(false);
  });
});
