import type { ParamName, ParamConfig, WestgardStatus } from './types';
import { evaluateWestgard } from './westgard';

export interface ParsedParamValues {
  params: Partial<Record<ParamName, number>>;
  statuses: Partial<Record<ParamName, WestgardStatus>>;
}

/**
 * Turn the raw text fields of the input form into a record's `params` and
 * per-parameter `status`.
 *
 * The status is evaluated here, at save time, against the same lot target the
 * Levey-Jennings chart will later use, and with the same single-point rule
 * (`evaluateWestgard`: 1-3s → oos, 1-2s → warning). The Dashboard, Portal home
 * and the monthly report read the stored status instead of recomputing, so a
 * value written as `ok` unconditionally makes every run look in control
 * regardless of how far it sits from its target.
 *
 * A parameter with no usable target keeps `ok`: with no reference line there
 * is nothing to judge it against, and the chart drops such points too.
 */
export function parseParamValues(
  vals: Partial<Record<ParamName, string>>,
  paramList: readonly ParamName[],
  getConfig: (param: ParamName) => ParamConfig | null,
): ParsedParamValues {
  const parsed: ParsedParamValues = { params: {}, statuses: {} };

  for (const p of paramList) {
    const raw = vals[p];
    if (!raw) continue;

    // Numeric normalization: keep digits, dot and minus only.
    const num = parseFloat(raw.replace(/[^0-9.\-]/g, ''));
    if (isNaN(num)) continue;

    parsed.params[p] = num;
    const cfg = getConfig(p);
    parsed.statuses[p] = cfg ? evaluateWestgard(num, cfg).status : 'ok';
  }

  return parsed;
}
