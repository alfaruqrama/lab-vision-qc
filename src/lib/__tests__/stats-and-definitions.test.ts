import { describe, it, expect } from 'vitest';
import { sampleStats } from '../stats';
import { calculateStatsFromRecords } from '../stats-util';
import { levelsForInstrument, levelLabel, ALL_INSTRUMENTS, INSTRUMENTS, emptyLotConfig } from '../types';
import type { QCRecord } from '../types';

/**
 * Finding 4.5 — one SD convention.
 *
 * The configuration page used population SD while every reading surface used
 * sample SD, so a target computed from a month of results never matched the
 * "SD Terukur" printed for the same runs.
 */
describe('sampleStats — the app-wide SD convention', () => {
  it('divides by n − 1, not n', () => {
    // 10, 12, 14 → mean 12, deviations 2/0/2 → Σd² = 8.
    // Sample SD  = √(8/2) = 2      (what the L-J page and the sheet show)
    // Population = √(8/3) ≈ 1.632  (what the config page used to compute)
    const s = sampleStats([10, 12, 14]);
    expect(s.n).toBe(3);
    expect(s.mean).toBe(12);
    expect(s.sd).toBeCloseTo(2, 10);
    expect(s.cv).toBeCloseTo((2 / 12) * 100, 10);
  });

  it('has no spread to report for a single run', () => {
    const s = sampleStats([100]);
    expect(s).toEqual({ n: 1, mean: 100, sd: 0, cv: 0 });
  });

  it('returns zeroes for an empty series', () => {
    expect(sampleStats([])).toEqual({ n: 0, mean: 0, sd: 0, cv: 0 });
  });

  it('keeps CV at 0 when the mean is 0', () => {
    expect(sampleStats([-1, 1]).cv).toBe(0);
  });

  it('gives the configuration page the same SD as the L-J page', () => {
    // "Hitung dari data lab" on LotConfig runs through this function; it must
    // agree with sampleStats over the same values.
    const records: QCRecord[] = [10, 12, 14].map((value, i) => ({
      id: String(i),
      timestamp: '',
      tanggal: `2026-01-0${i + 1}`,
      alat: 'CLEVER1',
      level: 'Kontrol',
      lot: 'L1',
      params: { GDA: value },
      status: {},
      analis: '',
      catatan: '',
    }));

    const fromConfig = calculateStatsFromRecords(records, 'GDA');
    expect(fromConfig.sd).toBe(2);
    expect(fromConfig.mean).toBe(12);
  });

  it('ignores excluded records, like every other reading surface', () => {
    const records: QCRecord[] = [
      { id: 'a', timestamp: '', tanggal: '2026-01-01', alat: 'CLEVER1', level: 'Kontrol', lot: 'L1', params: { GDA: 100 }, status: {}, analis: '', catatan: '' },
      { id: 'b', timestamp: '', tanggal: '2026-01-02', alat: 'CLEVER1', level: 'Kontrol', lot: 'L1', params: { GDA: 200 }, status: {}, analis: '', catatan: '', excluded: true },
    ];

    expect(calculateStatsFromRecords(records, 'GDA').mean).toBe(100);
  });
});

/**
 * Finding 4.6 — one definition per concept.
 */
describe('shared instrument and level definitions', () => {
  it('derives the instrument list from the display table', () => {
    expect(ALL_INSTRUMENTS).toEqual(INSTRUMENTS.map((i) => i.value));
    expect(ALL_INSTRUMENTS).toHaveLength(6);
  });

  it('gives every instrument the levels its records actually use', () => {
    expect(levelsForInstrument('EASYLITE')).toEqual(['NORMAL', 'HIGH']);
    expect(levelsForInstrument('ONCALL1')).toEqual(['CTRL0', 'CTRL1', 'CTRL2']);
    expect(levelsForInstrument('ONCALL2')).toEqual(['CTRL0', 'CTRL1', 'CTRL2']);
    expect(levelsForInstrument('CA660')).toEqual(['Kontrol']);
    expect(levelsForInstrument('CLEVER1')).toEqual(['Kontrol']);
    expect(levelsForInstrument('CLEVER2')).toEqual(['Kontrol']);
  });

  it('labels levels for display without changing the stored identifier', () => {
    expect(levelLabel('Kontrol')).toBe('Kontrol');
    expect(levelLabel('CTRL0')).toBe('CTRL 0');
    expect(levelLabel('HIGH')).toBe('High');
  });
});

/**
 * Finding 4.7 — no demo lots outside demo mode.
 */
describe('emptyLotConfig', () => {
  it('carries no lots at all', () => {
    const empty = emptyLotConfig();
    expect(empty.CA660).toEqual([]);
    expect(empty.EASYLITE).toEqual({ NORMAL: [], HIGH: [] });
    expect(empty.ONCALL1).toEqual([]);
    expect(empty.ONCALL2).toEqual([]);
    expect(empty.CLEVER1).toEqual([]);
    expect(empty.CLEVER2).toEqual([]);
  });

  it('never contains the demo CLEVER lot that caused the false OOS runs', () => {
    const empty = emptyLotConfig();
    expect(empty.CLEVER1.some((l) => l.lot === 'CC1-2024-001')).toBe(false);
    expect(empty.CLEVER2.some((l) => l.lot === 'CC2-2024-001')).toBe(false);
  });

  it('returns a fresh object each call, so callers cannot mutate a shared one', () => {
    const a = emptyLotConfig();
    a.CA660.push({ lot: 'X', exp: '2026-01-01', Kontrol: { PT: { mean: 1, sd: 1 }, APTT: { mean: 1, sd: 1 }, INR: { mean: 1, sd: 1 } } });
    expect(emptyLotConfig().CA660).toEqual([]);
  });
});
