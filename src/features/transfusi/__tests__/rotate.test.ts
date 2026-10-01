import { describe, it, expect } from 'vitest';
import { rotate90 } from '../scan/rotate';

/** Buat ImageData 2x2 dengan 4 piksel berbeda untuk melacak perpindahan. */
function makeImage(): ImageData {
  // Piksel: TL merah, TR hijau, BL biru, BR putih
  const data = new Uint8ClampedArray([
    255, 0, 0, 255, // TL
    0, 255, 0, 255, // TR
    0, 0, 255, 255, // BL
    255, 255, 255, 255, // BR
  ]);
  return new ImageData(data, 2, 2);
}

describe('rotate90', () => {
  it('menukar lebar dan tinggi', () => {
    const img = new ImageData(new Uint8ClampedArray(3 * 2 * 4), 3, 2);
    const out = rotate90(img);
    expect(out.width).toBe(2);
    expect(out.height).toBe(3);
  });

  it('memindahkan TL ke TR (rotasi searah jarum jam)', () => {
    const out = rotate90(makeImage());
    // Setelah rotasi CW, piksel TL asli ada di kanan-atas.
    const trIdx = (0 * out.width + (out.width - 1)) * 4;
    expect(out.data[trIdx]).toBe(255); // merah
    expect(out.data[trIdx + 1]).toBe(0);
    expect(out.data[trIdx + 2]).toBe(0);
  });

  it('memindahkan TR ke BR', () => {
    const out = rotate90(makeImage());
    const brIdx = ((out.height - 1) * out.width + (out.width - 1)) * 4;
    expect(out.data[brIdx]).toBe(0); // hijau
    expect(out.data[brIdx + 1]).toBe(255);
  });

  it('empat kali rotasi mengembalikan gambar semula', () => {
    const original = makeImage();
    let img = original;
    for (let i = 0; i < 4; i++) img = rotate90(img);
    expect(img.width).toBe(original.width);
    expect(img.height).toBe(original.height);
    expect(Array.from(img.data)).toEqual(Array.from(original.data));
  });
});
