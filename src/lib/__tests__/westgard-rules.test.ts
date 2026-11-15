import { describe, it, expect } from 'vitest';
import { ruleStatus, ruleSeverity, isRejectionRule } from '../westgard-rules';
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
    zScore: p.z,
    rawValue: p.z,
    status: 'ok',
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
