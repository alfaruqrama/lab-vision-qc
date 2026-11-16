import { describe, it, expect } from 'vitest';
import { parseParamValues } from '../param-parse';
import type { ParamName, ParamConfig } from '../types';

/** The CLEVER GDA target that produced the 13 mis-stored records in 2026. */
const CLEVER: ParamConfig = { mean: 135, sd: 6.67 };

/** Round numbers, so the ±2SD / ±3SD boundaries land exactly. */
const ROUND: ParamConfig = { mean: 100, sd: 5 };

function parse(values: Partial<Record<ParamName, string>>, target: ParamConfig | null = CLEVER) {
  return parseParamValues(values, ['GDA'], () => target);
}

describe('saved parameter status reflects the lot target', () => {
  it('marks a value beyond ±2SD as warning, not ok', () => {
    // 120 is 2.25SD below 135/6.67. The input form used to write 'ok' for
    // every value, so the Dashboard and the monthly report showed this run as
    // in control while the L-J chart drew it as a warning.
    expect(parse({ GDA: '120' }).statuses.GDA).toBe('warning');
  });

  it('marks a value beyond ±3SD as oos', () => {
    // 114 is 3.15SD below target.
    expect(parse({ GDA: '114' }).statuses.GDA).toBe('oos');
  });

  it('keeps in-range values ok', () => {
    expect(parse({ GDA: '135' }).statuses.GDA).toBe('ok');
    expect(parse({ GDA: '142' }).statuses.GDA).toBe('ok');
  });

  it('agrees with the L-J chart at the exact boundaries', () => {
    // evaluateWestgard uses strict inequalities: |z| > 2, |z| > 3, so a point
    // sitting exactly on a limit stays in the milder band.
    expect(parse({ GDA: '110' }, ROUND).statuses.GDA).toBe('ok');
    expect(parse({ GDA: '110.1' }, ROUND).statuses.GDA).toBe('warning');
    expect(parse({ GDA: '115' }, ROUND).statuses.GDA).toBe('warning');
    expect(parse({ GDA: '115.1' }, ROUND).statuses.GDA).toBe('oos');
    expect(parse({ GDA: '85' }, ROUND).statuses.GDA).toBe('warning');
    expect(parse({ GDA: '84.9' }, ROUND).statuses.GDA).toBe('oos');
  });

  it('keeps ok when the lot has no usable target', () => {
    // No reference line means nothing to judge against; the chart drops these
    // points too, so 'ok' never contradicts it.
    expect(parse({ GDA: '999' }, null).statuses.GDA).toBe('ok');
    expect(parse({ GDA: '999' }, { mean: 0, sd: 0 }).statuses.GDA).toBe('ok');
  });

  it('parses numbers the same way the form always did', () => {
    expect(parse({ GDA: '120 mg/dL' }).params.GDA).toBe(120);
    expect(parse({ GDA: '-5' }).params.GDA).toBe(-5);
    expect(parse({ GDA: '' }).params.GDA).toBeUndefined();
    expect(parse({ GDA: 'abc' }).params.GDA).toBeUndefined();
    // Pre-existing behaviour, kept as-is: a comma is dropped rather than read
    // as a decimal separator, so "120,5" becomes 1205. The >10SD gross-error
    // warning in the form is what catches a slip like that.
    expect(parse({ GDA: '120,5' }).params.GDA).toBe(1205);
  });
});
