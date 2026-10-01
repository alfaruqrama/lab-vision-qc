import { describe, it, expect } from 'vitest';
import {
  applyScanFilter,
  enhanceContrast,
  toGrayscale,
  toBlackAndWhite,
  SCAN_FILTERS,
  DEFAULT_SCAN_FILTER,
} from '../scan/applyScanFilter';

function solid(r: number, g: number, b: number, w = 4, h = 4): ImageData {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = 255;
  }
  return new ImageData(data, w, h);
}

function px(img: ImageData, index = 0): [number, number, number, number] {
  const i = index * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]];
}

describe('applyScanFilter', () => {
  it('mode original mengembalikan gambar apa adanya', () => {
    const img = solid(120, 130, 140);
    expect(applyScanFilter(img, 'original')).toBe(img);
  });

  it('mengembalikan dimensi yang sama untuk tiap mode', () => {
    const img = solid(100, 100, 100, 6, 5);
    for (const f of SCAN_FILTERS) {
      const out = applyScanFilter(img, f.value);
      expect(out.width).toBe(6);
      expect(out.height).toBe(5);
    }
  });

  it('default filter adalah enhance', () => {
    expect(DEFAULT_SCAN_FILTER).toBe('enhance');
  });
});

describe('toGrayscale', () => {
  it('menyamakan kanal R, G, B dengan luminance', () => {
    const out = toGrayscale(solid(255, 0, 0));
    const [r, g, b] = px(out);
    expect(r).toBe(g);
    expect(g).toBe(b);
    // Luminance merah ≈ 0.299*255 ≈ 76
    expect(r).toBeGreaterThan(70);
    expect(r).toBeLessThan(82);
  });

  it('mempertahankan alpha', () => {
    const out = toGrayscale(solid(10, 20, 30));
    expect(px(out)[3]).toBe(255);
  });
});

describe('enhanceContrast', () => {
  it('meregangkan rentang gelap→0 dan terang→255', () => {
    // Gambar 2x1: satu piksel 100, satu piksel 200 (rentang sempit).
    const data = new Uint8ClampedArray([
      100, 100, 100, 255,
      200, 200, 200, 255,
    ]);
    const out = enhanceContrast(new ImageData(data, 2, 1));
    expect(px(out, 0)[0]).toBe(0);
    expect(px(out, 1)[0]).toBe(255);
  });

  it('tidak mengubah gambar yang sudah kontras penuh', () => {
    const data = new Uint8ClampedArray([
      0, 0, 0, 255,
      255, 255, 255, 255,
    ]);
    const img = new ImageData(data, 2, 1);
    const out = enhanceContrast(img);
    expect(Array.from(out.data)).toEqual(Array.from(img.data));
  });

  it('tidak mengubah gambar seragam (rentang nol)', () => {
    const img = solid(128, 128, 128);
    expect(enhanceContrast(img)).toBe(img);
  });
});

describe('toBlackAndWhite', () => {
  it('hanya menghasilkan piksel 0 atau 255', () => {
    // Gradien sederhana
    const w = 8;
    const data = new Uint8ClampedArray(w * 4);
    for (let i = 0; i < w; i++) {
      const v = i * 32;
      data[i * 4] = v;
      data[i * 4 + 1] = v;
      data[i * 4 + 2] = v;
      data[i * 4 + 3] = 255;
    }
    const out = toBlackAndWhite(new ImageData(data, w, 1));
    for (let i = 0; i < out.data.length; i += 4) {
      const v = out.data[i];
      expect(v === 0 || v === 255).toBe(true);
    }
  });

  it('mempertahankan dimensi', () => {
    const out = toBlackAndWhite(solid(128, 128, 128, 5, 7));
    expect(out.width).toBe(5);
    expect(out.height).toBe(7);
  });
});

describe('SCAN_FILTERS', () => {
  it('memuat keempat mode', () => {
    expect(SCAN_FILTERS.map((f) => f.value)).toEqual([
      'original',
      'enhance',
      'grayscale',
      'bw',
    ]);
  });
});
