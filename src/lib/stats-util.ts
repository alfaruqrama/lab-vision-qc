
import { QCRecord, ParamConfig } from './types';

export function calculateStatsFromRecords(records: QCRecord[], paramName: string): ParamConfig {
  const values = records
    .filter(r => !r.excluded && r.params[paramName] !== undefined)
    .map(r => r.params[paramName] as number);

  if (values.length === 0) {
    return { mean: 0, sd: 0, rangeMin: 0, rangeMax: 0 };
  }

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  const sd = Math.sqrt(variance);

  // Standard range is typically Mean +/- 3SD
  return {
    mean: Number(mean.toFixed(2)),
    sd: Number(sd.toFixed(2)),
    rangeMin: Number((mean - 3 * sd).toFixed(2)),
    rangeMax: Number((mean + 3 * sd).toFixed(2)),
  };
}
