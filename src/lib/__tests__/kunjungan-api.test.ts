import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchSummary } from '../kunjungan-api';
import { pickDefaultMonth, resolveTabMonths, monthTabKey } from '../kunjungan-types';

const SUMMARY_URL = 'https://script.google.com/macros/s/DASHBOARD_TEST/exec';

function mockJson(payload: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => payload,
  }));
}

describe('fetchSummary response contract', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_GAS_KUNJUNGAN_URL', SUMMARY_URL);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('menolak respons skrip Input Harian (bukan {error}, tapi juga bukan kontrak dashboard)', async () => {
    mockJson({ status: 'ok', service: 'inputHarian', message: 'Use POST to submit data' });
    await expect(fetchSummary()).rejects.toThrow(/inputHarian/);
  });

  it('menolak payload tanpa allOmzet sama sekali', async () => {
    mockJson({ status: 'ok' });
    await expect(fetchSummary()).rejects.toThrow(/bukan dari skrip Dashboard/);
  });

  it('menolak array pada field summary yang harus berupa map bulan', async () => {
    mockJson({ allOmzet: [], allKunjungan: [], allMcu: [] });
    await expect(fetchSummary()).rejects.toThrow(/object berisi array rows/);
  });

  it('menolak nilai bulan yang bukan array rows', async () => {
    mockJson({ allOmzet: { NOV: {} }, allKunjungan: {}, allMcu: {} });
    await expect(fetchSummary()).rejects.toThrow(/object berisi array rows/);
  });

  it('menerima nilai bulan null (dashboard aman karena pakai `|| []`)', async () => {
    mockJson({ allOmzet: { NOV: null }, allKunjungan: {}, allMcu: {} });
    const result = await fetchSummary();
    expect(result.omzet.NOVEMBER).toBeNull();
  });

  it('menerima bulan yang belum berisi data (allOmzet kosong itu sah)', async () => {
    mockJson({
      lastUpdated: '2026-11-13T00:00:00.000Z',
      currentMonth: 'NOVEMBER',
      allOmzet: {},
      allKunjungan: {},
      allMcu: {},
    });

    const result = await fetchSummary();

    expect(result.omzet).toEqual({});
    expect(result.kunjungan).toEqual({});
    expect(result.currentMonth).toBe('NOVEMBER');
  });

  it('menormalkan key bulan pendek dari GAS ke nama bulan penuh', async () => {
    mockJson({
      lastUpdated: '2026-11-13T00:00:00.000Z',
      currentMonth: 'NOVEMBER',
      allOmzet: { NOV: [{ d: 1, total: 1000 }] },
      allKunjungan: { NOV: [] },
      allMcu: {},
    });

    const result = await fetchSummary();

    expect(result.omzet.NOVEMBER).toEqual([{ d: 1, total: 1000 }]);
  });

  it('menyertakan URL endpoint di pesan error supaya salah konfigurasi terbaca', async () => {
    mockJson({ status: 'ok', service: 'inputHarian' });
    await expect(fetchSummary()).rejects.toThrow(SUMMARY_URL);
  });
});

describe('pickDefaultMonth', () => {
  const rows = { JANUARI: [{ d: 1 }], OKTOBER: [{ d: 1 }, { d: 2 }] };

  it('memakai bulan dari GAS bila bulan itu berisi data', () => {
    expect(pickDefaultMonth(rows, 'JANUARI')).toBe('JANUARI');
  });

  it('jatuh ke bulan terakhir yang berisi data saat bulan dari GAS tidak ada datanya', () => {
    // Kasus produksi: GAS bilang NOVEMBER, tapi sheet November belum ada isinya.
    expect(pickDefaultMonth(rows, 'NOVEMBER')).toBe('OKTOBER');
  });

  it('jatuh ke bulan berisi data saat GAS tidak mengirim currentMonth', () => {
    expect(pickDefaultMonth(rows, null)).toBe('OKTOBER');
  });

  it('memakai bulan kalender saat tidak ada data sama sekali', () => {
    const expected = ['JANUARI','FEBRUARI','MARET','APRIL','MEI','JUNI','JULI','AGUSTUS','SEPTEMBER','OKTOBER','NOVEMBER','DESEMBER'][new Date().getMonth()];
    expect(pickDefaultMonth({}, null)).toBe(expected);
  });
});

describe('resolveTabMonths', () => {
  const base = { omzet: 'NOVEMBER', kunjungan: 'NOVEMBER', mcu: 'NOVEMBER' };

  it('mengisi bulan default tab dari data tab itu sendiri', () => {
    const result = resolveTabMonths(base, new Set(), 'omzet', { OKTOBER: [{ d: 1 }] }, 'NOVEMBER');
    expect(result.omzet).toBe('OKTOBER');
  });

  it('pilihan user di satu tab tidak menimpa tab lain', () => {
    const prev = { ...base, omzet: 'AGUSTUS' };
    const touched = new Set(['omzet' as const]);
    const result = resolveTabMonths(prev, touched, 'omzet', { OKTOBER: [{ d: 1 }] }, 'NOVEMBER');
    expect(result.omzet).toBe('AGUSTUS');
  });

  it('tab yang belum disentuh tetap dapat default sendiri walau tab lain disentuh', () => {
    const prev = { ...base, omzet: 'AGUSTUS' };
    const touched = new Set(['omzet' as const]);
    const result = resolveTabMonths(prev, touched, 'mcu', { OKTOBER: [{ d: 1 }] }, 'NOVEMBER');
    expect(result.mcu).toBe('OKTOBER');
    expect(result.omzet).toBe('AGUSTUS');
  });

  it('mengembalikan objek yang sama bila tidak ada perubahan', () => {
    const prev = { ...base, omzet: 'OKTOBER' };
    const result = resolveTabMonths(prev, new Set(), 'omzet', { OKTOBER: [{ d: 1 }] }, 'NOVEMBER');
    expect(result).toBe(prev);
  });

  it('memetakan tab laporan dan input ke daftar omzet', () => {
    expect(monthTabKey('laporan')).toBe('omzet');
    expect(monthTabKey('input')).toBe('omzet');
    expect(monthTabKey('kunjungan')).toBe('kunjungan');
    expect(monthTabKey('mcu')).toBe('mcu');
  });
});
