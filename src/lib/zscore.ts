import type { QCRecord, LotConfig, ParamName, ControlLevel, ParamConfig, EasyliteLotConfig } from './types';
import { evaluateWestgard } from './westgard';

export interface ZScorePoint {
  tanggal: string;
  level: ControlLevel;
  zScore: number;
  rawValue: number;
  status: 'ok' | 'warning' | 'oos';
}

interface LevelZScoreResult {
  points: ZScorePoint[];
  /** Per-parameter mean/SD lookup; key = param name */
  paramConfig: ParamConfig | null;
}

/**
 * Convert QC records into Z-scores for multi-level overlay chart.
 * Handles lot config lookup per date — uses the lot active at that time.
 *
 * @param records - QC records filtered by alat & param already
 * @param config - LotConfig from database
 * @param alat - Instrument type (EASYLITE only for multi-level)
 * @param param - Parameter name to compute Z-scores for
 */
export function computeZScores(
  records: QCRecord[],
  config: LotConfig,
  alat: 'EASYLITE',
  param: ParamName,
): Record<ControlLevel, ZScorePoint[]> {
  const result: Record<string, ZScorePoint[]> = {};

  // Easylite has NORMAL and HIGH levels
  const levels = ['NORMAL', 'HIGH'] as const;

  for (const level of levels) {
    const levelLots = config[alat]?.[level];
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
        if (!lot || !lot.params) return null;

        const paramCfg = lot.params[param];
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

/**
 * Find the lot config active on a given date.
 * Strategy: find the lot with the closest expiry date that is >= record date.
 * If none active, use the lot with the latest expiry date (most recent).
 */
function findActiveLot(
  lots: EasyliteLotConfig[],
  recordDate: string,
): EasyliteLotConfig | null {
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
