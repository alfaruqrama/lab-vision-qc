/**
 * Whether a lot config row carries a usable target.
 *
 * Adding a lot from the configuration page writes `{ mean: 0, sd: 0 }` as a
 * placeholder (see `addCleverLot` and friends in `src/pages/LotConfig.tsx`).
 * A lot left at that state produces nonsense Z-scores: `evaluateWestgard`
 * returns `ok` for sd 0, while a lot saved with a demo target such as
 * mean 100 / sd 5 makes every real result read as out of control.
 *
 * Used by the input form (to keep such lots out of the auto-selected spot and
 * label them) and by the configuration page (to flag them before use).
 */
type ParamTarget = { mean?: number; sd?: number } | undefined;

export function lotHasTarget(lot: unknown): boolean {
  if (!lot || typeof lot !== 'object') return false;
  const l = lot as Record<string, unknown>;

  const groups: unknown[] = [];
  if (l.params) groups.push(l.params);
  if (l.Kontrol) groups.push(l.Kontrol);
  for (const level of ['NORMAL', 'HIGH', 'CTRL0', 'CTRL1', 'CTRL2']) {
    if (l[level]) groups.push(l[level]);
  }

  return groups.some((group) =>
    Object.values((group ?? {}) as Record<string, ParamTarget>).some(
      (cfg) => !!cfg && typeof cfg.mean === 'number' && typeof cfg.sd === 'number' && cfg.mean !== 0 && cfg.sd !== 0,
    ),
  );
}
