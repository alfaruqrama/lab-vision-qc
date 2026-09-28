import { describe, it, expect } from 'vitest';
import { fitWithin, formatTanggalID, MAX_IMAGE_DIMENSION } from '../hooks/usePdfBuilder';

describe('fitWithin', () => {
  it('tidak mengubah gambar yang sudah di bawah batas', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it('tidak mengubah gambar tepat di batas', () => {
    expect(fitWithin(1600, 1200, 1600)).toEqual({ width: 1600, height: 1200 });
  });

  it('memperkecil foto landscape 4000x3000 ke sisi terpanjang 1600', () => {
    const result = fitWithin(4000, 3000, MAX_IMAGE_DIMENSION);
    expect(Math.max(result.width, result.height)).toBe(1600);
    expect(result).toEqual({ width: 1600, height: 1200 });
  });

  it('memperkecil foto portrait 3000x4000 ke sisi terpanjang 1600', () => {
    const result = fitWithin(3000, 4000, MAX_IMAGE_DIMENSION);
    expect(Math.max(result.width, result.height)).toBe(1600);
    expect(result).toEqual({ width: 1200, height: 1600 });
  });

  it('mempertahankan rasio aspek', () => {
    const result = fitWithin(4032, 3024, 1600);
    const originalRatio = 4032 / 3024;
    const resultRatio = result.width / result.height;
    // Toleransi pembulatan pixel
    expect(Math.abs(resultRatio - originalRatio)).toBeLessThan(0.01);
  });

  it('tidak pernah memperbesar gambar kecil', () => {
    const result = fitWithin(400, 300, 1600);
    expect(result.width).toBe(400);
    expect(result.height).toBe(300);
  });

  it('menangani dimensi nol tanpa membagi nol', () => {
    expect(fitWithin(0, 0, 1600)).toEqual({ width: 0, height: 0 });
  });

  it('tidak pernah menghasilkan dimensi 0 pada gambar ekstrem', () => {
    const result = fitWithin(10000, 3, 1600);
    expect(result.width).toBe(1600);
    expect(result.height).toBeGreaterThanOrEqual(1);
  });

  it('menghasilkan bilangan bulat', () => {
    const result = fitWithin(3999, 2999, 1600);
    expect(Number.isInteger(result.width)).toBe(true);
    expect(Number.isInteger(result.height)).toBe(true);
  });
});

describe('formatTanggalID', () => {
  it('memformat ISO date jadi tanggal Indonesia', () => {
    // 26 September 2026 adalah hari Sabtu
    expect(formatTanggalID('2026-09-26')).toBe('Sabtu, 26 September 2026');
  });

  it('tidak bergeser satu hari karena zona waktu', () => {
    // Kalau di-parse sebagai UTC, di zona WIB (+7) tanggal 1 bisa jadi 31 bulan lalu
    expect(formatTanggalID('2026-01-01')).toContain('1 Januari 2026');
    expect(formatTanggalID('2026-12-31')).toContain('31 Desember 2026');
  });

  it('mengembalikan em dash untuk input kosong', () => {
    expect(formatTanggalID('')).toBe('—');
  });

  it('mengembalikan input apa adanya bila tidak bisa di-parse', () => {
    expect(formatTanggalID('bukan-tanggal')).toBe('bukan-tanggal');
  });
});
