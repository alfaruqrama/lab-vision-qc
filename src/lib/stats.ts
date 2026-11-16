/**
 * Measured mean, SD and CV of a set of QC results — one definition for the app.
 *
 * The lab reports a *sample* standard deviation (n − 1). That is what analyser
 * software prints as "Measured SD", what the CLSI C24 control-limit estimate
 * assumes, and what four places in this app already computed inline. The
 * configuration page alone divided by n instead (population SD), so the same
 * month of results gave one SD here and a slightly larger one there — a target
 * derived from that number could never line up with the SD shown on the L-J
 * page.
 *
 * With n = 1 there is no spread to estimate, so SD and CV are 0; callers show
 * "-" for those rather than a fabricated limit.
 */
export interface MeasuredStats {
  /** Number of values. */
  n: number;
  mean: number;
  /** Sample SD (n − 1); 0 when n < 2. */
  sd: number;
  /** Coefficient of variation in percent; 0 when the mean is 0. */
  cv: number;
}

export function sampleStats(values: readonly number[]): MeasuredStats {
  const n = values.length;
  if (n === 0) return { n: 0, mean: 0, sd: 0, cv: 0 };

  const mean = values.reduce((a, b) => a + b, 0) / n;
  const sd =
    n > 1 ? Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)) : 0;
  const cv = mean !== 0 ? (sd / mean) * 100 : 0;

  return { n, mean, sd, cv };
}
