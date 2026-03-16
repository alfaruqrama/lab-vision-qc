import type { ParamConfig, WestgardStatus } from './types';

export interface WestgardResult {
  status: WestgardStatus;
  zScore: number;
  rules: string[];
}

export function evaluateWestgard(value: number, config: ParamConfig): WestgardResult {
  const { mean, sd } = config;
  if (sd === 0) return { status: 'ok', zScore: 0, rules: [] };

  const zScore = (value - mean) / sd;
  const absZ = Math.abs(zScore);
  const rules: string[] = [];
  let status: WestgardStatus = 'ok';

  if (absZ > 3) {
    status = 'oos';
    rules.push('1-3s');
  } else if (absZ > 2) {
    status = 'warning';
    rules.push('1-2s');
  }

  return { status, zScore, rules };
}

export function evaluateR4s(
  value1: number, config1: ParamConfig,
  value2: number, config2: ParamConfig
): boolean {
  const z1 = (value1 - config1.mean) / config1.sd;
  const z2 = (value2 - config2.mean) / config2.sd;
  return Math.abs(z1 - z2) >= 4;
}

export function getStatusLabel(status: WestgardStatus): string {
  switch (status) {
    case 'ok': return 'OK';
    case 'warning': return 'Peringatan';
    case 'oos': return 'Diluar Kendali';
  }
}

export function getOverallStatus(statuses: WestgardStatus[]): WestgardStatus {
  if (statuses.some(s => s === 'oos')) return 'oos';
  if (statuses.some(s => s === 'warning')) return 'warning';
  return 'ok';
}
