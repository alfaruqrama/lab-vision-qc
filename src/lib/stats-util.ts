import { QCRecord, ParamConfig } from './types';
import { sampleStats } from './stats';

/**
 * Mean/SD of a parameter's results, for the "hitung dari data lab" button on
 * the configuration page.
 *
 * Uses the app-wide sample SD (`sampleStats`) so a target derived here matches
 * the "SD Terukur" shown on the L-J page and in the monthly report for the same
 * set of runs.
 */
export function calculateStatsFromRecords(records: QCRecord[], paramName: string): ParamConfig {
  const values = records
    .filter(r => !r.excluded && r.params[paramName] !== undefined)
    .map(r => r.params[paramName] as number);

  if (values.length === 0) {
    return { mean: 0, sd: 0, rangeMin: 0, rangeMax: 0 };
  }

  const { mean, sd } = sampleStats(values);

  // Standard range is typically Mean +/- 3SD
  return {
    mean: Number(mean.toFixed(2)),
    sd: Number(sd.toFixed(2)),
    rangeMin: Number((mean - 3 * sd).toFixed(2)),
    rangeMax: Number((mean + 3 * sd).toFixed(2)),
  };
}
