import type { ParamConfig, WestgardStatus } from './types';
import { ruleStatus } from './westgard-rules';

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
    rules.push('1-3s');
    status = ruleStatus('1-3s');
  } else if (absZ > 2) {
    rules.push('1-2s');
    status = ruleStatus('1-2s');
  }

  return { status, zScore, rules };
}

export function getStatusLabel(status: WestgardStatus): string {
  switch (status) {
    case 'ok': return 'OK';
    case 'warning': return 'Peringatan';
    case 'oos': return 'Diluar Kontrol';
  }
}

export function getOverallStatus(statuses: WestgardStatus[]): WestgardStatus {
  if (statuses.some(s => s === 'oos')) return 'oos';
  if (statuses.some(s => s === 'warning')) return 'warning';
  return 'ok';
}
