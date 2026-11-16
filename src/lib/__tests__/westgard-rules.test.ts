import { describe, it, expect } from 'vitest';
import { ruleStatus, ruleSeverity, isRejectionRule, violatesR4s } from '../westgard-rules';
import { evaluateWestgard } from '../westgard';
import { evaluateSeries } from '../westgard-engine';
import { analyzeMultiLevel } from '../westgard-multi';
import type { ZPoint } from '../westgard-engine';
import type { ZScorePoint } from '../zscore';

/** Four consecutive points just above +1SD — a 4-1s violation. */
function streak41s(): ZPoint[] {
  return [1.1, 1.2, 1.3, 1.4].map((z, i) => ({
    runKey: `run${i}`,
    timestamp: `2026-01-0${i + 1}T00:00:00Z`,
    date: `2026-01-0${i + 1}`,
    level: 'Kontrol' as const,
    lot: 'LOT1',
    z,
  }));
}

function asZScorePoints(points: ZPoint[]): ZScorePoint[] {
  return points.map((p) => ({
    tanggal: p.date,
    level: p.level,
    zScore: p.z,
    rawValue: p.z,
    status: 'ok',
    lot: p.lot,
  })) as ZScorePoint[];
}

describe('westgard rule severity is defined once', () => {
  it('treats 4-1s as a rejection rule, per Westgard multirule', () => {
    expect(ruleStatus('4-1s')).toBe('oos');
    expect(ruleSeverity('4-1s')).toBe('reject');
    expect(isRejectionRule('4-1s')).toBe(true);
  });

  it('keeps 1-2s as the only warning rule', () => {
    for (const rule of ['1-3s', '1-2s', '2-2s', '4-1s', '10x', 'R-4s'] as const) {
      expect(isRejectionRule(rule)).toBe(rule !== '1-2s');
    }
  });
});

/** One run holding both control levels, so R-4s can be evaluated. */
function runWithLevels(normalZ: number, highZ: number): ZPoint[] {
  return [
    { runKey: 'run1', timestamp: '2026-01-01T00:00:00Z', date: '2026-01-01', level: 'NORMAL', lot: 'LOT1', z: normalZ },
    { runKey: 'run1', timestamp: '2026-01-01T00:00:00Z', date: '2026-01-01', level: 'HIGH', lot: 'LOT1', z: highZ },
  ];
}

function r4sFromEngine(points: ZPoint[]): boolean {
  const result = evaluateSeries(points, { levelsCount: 2 });
  return result.violations.some((v) => v.rule === 'R-4s');
}

function r4sFromMulti(normalZ: number, highZ: number): boolean {
  const result = analyzeMultiLevel({
    NORMAL: asZScorePoints(runWithLevels(normalZ, highZ).filter((p) => p.level === 'NORMAL')),
    HIGH: asZScorePoints(runWithLevels(normalZ, highZ).filter((p) => p.level === 'HIGH')),
  } as never);
  return result.rules.some((r) => r.rule === 'R-4s');
}

/** `n` consecutive points on one side of the mean, all on `lot`. */
function sideStreak(n: number, sign: 1 | -1, lot: string, startDay = 1): ZScorePoint[] {
  return Array.from({ length: n }, (_, i) => {
    const day = String(startDay + i).padStart(2, '0');
    return {
      tanggal: `2026-01-${day}`,
      level: 'NORMAL' as const,
      zScore: sign * 0.4,
      rawValue: sign * 0.4,
      status: 'ok' as const,
      lot,
    };
  });
}

function tenXFrom(points: ZScorePoint[]): boolean {
  const result = analyzeMultiLevel({ NORMAL: points } as never);
  return result.rules.some((r) => r.rule === '10x');
}

describe('sequence rules restart at a control lot change', () => {
  it('counts a 10x streak inside one lot', () => {
    expect(tenXFrom(sideStreak(10, 1, 'LOT_A'))).toBe(true);
  });

  it('does not chain a streak across two lots', () => {
    // 6 runs on the old lot followed by 4 on the new one: ten same-side points
    // in a row chronologically, but each lot has its own mean and SD, so the
    // sequence is 6 + 4 and neither half reaches 10.
    const points = [...sideStreak(6, 1, 'LOT_A'), ...sideStreak(4, 1, 'LOT_B', 7)];
    expect(tenXFrom(points)).toBe(false);
  });

  it('still fires on the new lot once it has ten of its own', () => {
    const points = [...sideStreak(6, 1, 'LOT_A'), ...sideStreak(10, 1, 'LOT_B', 7)];
    const result = analyzeMultiLevel({ NORMAL: points } as never);
    const rule = result.rules.find((r) => r.rule === '10x');
    expect(rule).toBeDefined();
    // Every reported day belongs to the new lot, not to the chained prefix.
    expect(rule!.affectedDays.every((d) => d >= '2026-01-13')).toBe(true);
  });

  it('restarts the 4-1s streak at the boundary too', () => {
    const above = (n: number, lot: string, startDay: number): ZScorePoint[] =>
      sideStreak(n, 1, lot, startDay).map((p) => ({ ...p, zScore: 1.5 }));
    // 3 points above +1s on the old lot, 3 on the new one: six in a row, but
    // no run of four on a single reference line.
    const result = analyzeMultiLevel({
      NORMAL: [...above(3, 'LOT_A', 1), ...above(3, 'LOT_B', 4)],
    } as never);
    expect(result.rules.some((r) => r.rule === '4-1s')).toBe(false);
  });
});

describe('R-4s uses the Westgard formulation', () => {
  it('fires when one level is above +2s and the other below −2s', () => {
    expect(violatesR4s([2.5, -2.1])).toBe(true);
    expect(violatesR4s([-2.5, 2.1])).toBe(true);
  });

  it('does not fire on a wide spread that never crosses −2s', () => {
    // Range is 6.1s, so a "difference > 4s" check would fire; Westgard's rule
    // does not, because the second point is inside ±2s. This is a 1-3s event.
    expect(violatesR4s([5.0, -1.1])).toBe(false);
    expect(violatesR4s([6.6, 0.2])).toBe(false);
  });

  it('does not fire when points are above +2s on both levels', () => {
    expect(violatesR4s([2.5, 3.5])).toBe(false);
  });

  it('needs to strictly exceed the limits, not land on them', () => {
    expect(violatesR4s([2, -2])).toBe(false);
  });

  it('engine and multi-level panel reach the same verdict', () => {
    const cases: Array<[number, number, boolean]> = [
      [2.5, -2.1, true],
      [-2.5, 2.1, true],
      [5.0, -1.1, false],
      [6.6, 0.2, false],
      [2.5, 3.5, false],
    ];
    for (const [normalZ, highZ, expected] of cases) {
      expect(r4sFromEngine(runWithLevels(normalZ, highZ))).toBe(expected);
      expect(r4sFromMulti(normalZ, highZ)).toBe(expected);
    }
  });
});

describe('the three engines agree on 4-1s severity', () => {
  it('westgard-engine reports 4-1s as reject', () => {
    const result = evaluateSeries(streak41s(), { levelsCount: 1 });
    const rule = result.violations.find((v) => v.rule === '4-1s');
    expect(rule?.severity).toBe('reject');
  });

  it('westgard-multi reports 4-1s as oos', () => {
    const result = analyzeMultiLevel({
      Kontrol: asZScorePoints(streak41s()),
    } as never);
    const rule = result.rules.find((r) => r.rule === '4-1s');
    expect(rule?.status).toBe('oos');
  });

  it('westgard single-point check stays on 1-3s / 1-2s only', () => {
    expect(evaluateWestgard(1.5, { mean: 0, sd: 1 }).status).toBe('ok');
    expect(evaluateWestgard(2.5, { mean: 0, sd: 1 }).status).toBe('warning');
    expect(evaluateWestgard(3.5, { mean: 0, sd: 1 }).status).toBe('oos');
  });
});
