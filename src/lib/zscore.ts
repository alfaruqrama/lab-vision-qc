import type { QCRecord, LotConfig, ParamName, ControlLevel, ParamConfig, InstrumentType } from './types';
import { evaluateWestgard } from './westgard';

export interface ZScorePoint {
  tanggal: string;
  level: ControlLevel;
  zScore: number;
  rawValue: number;
  status: 'ok' | 'warning' | 'oos';
}

/**
 * Convert QC records into Z-scores for multi-level overlay chart.
 * Handles lot config lookup per date — uses the lot active at that time.
 *
 * @param records - QC records filtered by alat & param already
 * @param config - LotConfig from database
 * @param alat - Instrument type
 * @param param - Parameter name to compute Z-scores for
 * @param levels - Control levels to compute (e.g. ['NORMAL','HIGH'] or ['CTRL0','CTRL1','CTRL2'])
 */
export function computeZScores(
  records: QCRecord[],
  config: LotConfig,
  alat: InstrumentType,
  param: ParamName,
  levels: ControlLevel[],
): Record<ControlLevel, ZScorePoint[]> {
  const result: Record<string, ZScorePoint[]> = {};

  for (const level of levels) {
    const levelLots = getLotArrayForLevel(config, alat, level);
    if (!levelLots || levelLots.length === 0) {
      result[level] = [];
      continue;
    }

    const points = records
      .filter((r) => r.level === level)
      .map((r) => {
        const rawValue = r.params[param];
        if (rawValue == null) return null;

        // Find lot config active at this record's date
        const lot = findActiveLot(levelLots, r.tanggal);
        if (!lot) return null;

        const paramCfg = getParamConfigFromLot(lot, alat, level, param);
        if (!paramCfg || paramCfg.sd === 0) return null;

        const zScore = (rawValue - paramCfg.mean) / paramCfg.sd;
        const status = evaluateWestgard(rawValue, paramCfg).status;

        return {
          tanggal: r.tanggal,
          level,
          zScore: Math.round(zScore * 100) / 100,
          rawValue,
          status,
        };
      })
      .filter(Boolean) as ZScorePoint[];

    // Sort by date
    points.sort((a, b) => a.tanggal.localeCompare(b.tanggal));
    result[level] = points;
  }

  return result;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

interface LotLike {
  lot: string;
  exp: string;
  [key: string]: any;
}

/** Get the lot array for a given instrument + level combination. */
function getLotArrayForLevel(
  config: LotConfig,
  alat: InstrumentType,
  level: ControlLevel,
): LotLike[] {
  if (alat === 'EASYLITE') {
    return (config.EASYLITE as any)[level] || [];
  }
  // ONCALL1, ONCALL2, CLEVER1, CLEVER2, CA660 — all flat arrays on config[alat]
  return (config as any)[alat] || [];
}

/** Extract ParamConfig from a lot based on instrument structure. */
function getParamConfigFromLot(
  lot: LotLike,
  alat: InstrumentType,
  level: ControlLevel,
  param: ParamName,
): ParamConfig | null {
  if (alat === 'EASYLITE') {
    return lot?.params?.[param] || null;
  }
  if (alat === 'CA660' || alat === 'CLEVER1' || alat === 'CLEVER2') {
    return lot?.Kontrol?.[param] || null;
  }
  // ONCALL1, ONCALL2 — config is nested under the level key (e.g. lot.CTRL1.GDA)
  return lot?.[level]?.[param] || null;
}

/**
 * Find the lot config active on a given date.
 * Strategy: find the lot with the closest expiry date that is >= record date.
 * If none active, use the lot with the latest expiry date (most recent).
 */
function findActiveLot(
  lots: LotLike[],
  recordDate: string,
): LotLike | null {
  // Filter lots that were not expired on this date
  const active = lots.filter((l) => l.exp >= recordDate);
  if (active.length > 0) {
    // Pick the one that expires soonest (most specific match)
    active.sort((a, b) => a.exp.localeCompare(b.exp));
    return active[0];
  }

  // No active lot: use the latest exp date
  const sorted = [...lots].sort((a, b) => b.exp.localeCompare(a.exp));
  return sorted[0] || null;
}
