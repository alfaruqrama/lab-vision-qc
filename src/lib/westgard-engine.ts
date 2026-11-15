
import { ControlLevel, WestgardStatus } from './types';
import { ruleSeverity, ruleStatus } from './westgard-rules';

export type RuleId = '1-2s' | '1-3s' | '2-2s' | 'R-4s' | '4-1s' | '10x' | 'shift' | 'trend' | 'bias';
export type Severity = 'warning' | 'reject' | 'advisory';

export interface ZPoint {
  runKey: string;
  timestamp: string;
  date: string;
  level: ControlLevel;
  lot: string;
  z: number;
  excluded?: boolean;
}

export interface RuleViolation {
  rule: RuleId;
  severity: Severity;
  level: ControlLevel | 'cross';
  triggeredAt: string;
  involved: string[];
  zValues: number[];
  message: string;
  action: string;
}

export interface EngineResult {
  violations: RuleViolation[];
  statusByRun: Record<string, WestgardStatus>;
  summary: { total: number; inControl: number; warning: number; reject: number; advisory: number };
}

export function evaluateSeries(
  points: ZPoint[],
  opts: { levelsCount: number },
): EngineResult {
  const statusByRun: Record<string, WestgardStatus> = {};
  const violations: RuleViolation[] = [];
  
  const lots = new Map<string, ZPoint[]>();
  points.forEach(p => {
    if (p.excluded) return;
    const l = lots.get(p.lot) || [];
    l.push(p);
    lots.set(p.lot, l);
  });

  const levels = [...new Set(points.map(p => p.level))];
  
  lots.forEach((lotPoints, lotId) => {
    levels.forEach(level => {
      const levelPoints = lotPoints.filter(p => p.level === level).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      if (levelPoints.length === 0) return;

      const zs = levelPoints.map(p => Number(p.z.toFixed(6)));

      levelPoints.forEach((p, i) => {
        if (Math.abs(zs[i]) > 3) {
          violations.push({
            rule: '1-3s', severity: ruleSeverity('1-3s'), level, triggeredAt: p.runKey,
            involved: [p.runKey], zValues: [zs[i]],
            message: 'Satu titik melampaui ±3SD', action: 'Investigasi segera'
          });
          statusByRun[p.runKey] = ruleStatus('1-3s');
        }
      });

      levelPoints.forEach((p, i) => {
        if (Math.abs(zs[i]) > 2) {
          if (statusByRun[p.runKey] !== 'oos') {
            statusByRun[p.runKey] = 'warning';
          }
          violations.push({
            rule: '1-2s', severity: ruleSeverity('1-2s'), level, triggeredAt: p.runKey,
            involved: [p.runKey], zValues: [zs[i]],
            message: 'Satu titik melampaui ±2SD', action: 'Pantau ketat'
          });
        }
      });

      for (let i = 1; i < zs.length; i++) {
        if ((zs[i] > 2 && zs[i-1] > 2) || (zs[i] < -2 && zs[i-1] < -2)) {
          const p = levelPoints[i];
          statusByRun[p.runKey] = ruleStatus('2-2s');
          violations.push({
            rule: '2-2s', severity: ruleSeverity('2-2s'), level, triggeredAt: p.runKey,
            involved: [levelPoints[i-1].runKey, p.runKey], zValues: [zs[i-1], zs[i]],
            message: 'Dua titik berurutan melampaui ±2SD di sisi yang sama', action: 'Indikasi error sistematik'
          });
        }
      }

      for (let i = 3; i < zs.length; i++) {
        const window = zs.slice(i-3, i+1);
        if ((window.every(z => z > 1) || window.every(z => z < -1))) {
          const p = levelPoints[i];
          statusByRun[p.runKey] = ruleStatus('4-1s');
          violations.push({
            rule: '4-1s', severity: ruleSeverity('4-1s'), level, triggeredAt: p.runKey,
            involved: levelPoints.slice(i-3, i+1).map(x => x.runKey), zValues: window,
            message: 'Empat titik berurutan melampaui ±1SD', action: 'Indikasi shift sistematik'
          });
        }
      }

      let sideStreak = 0;
      let streakStart = 0;
      for (let i = 0; i < zs.length; i++) {
        if (zs[i] === 0) {
          sideStreak = 0;
          continue;
        }
        if (sideStreak === 0 || Math.sign(zs[i]) === Math.sign(zs[i-1])) {
          sideStreak++;
        } else {
          sideStreak = 1;
        }
        streakStart = i - sideStreak + 1;
        if (sideStreak >= 10) {
          const p = levelPoints[i];
          statusByRun[p.runKey] = ruleStatus('10x');
          violations.push({
            rule: '10x', severity: ruleSeverity('10x'), level, triggeredAt: p.runKey,
            involved: levelPoints.slice(streakStart, i+1).map(x => x.runKey), zValues: zs.slice(streakStart, i+1),
            message: 'Sepuluh titik berurutan di satu sisi mean', action: 'Indikasi bias sistematik'
          });
        }
      }
    });

    if (opts.levelsCount >= 2) {
      const runMap = new Map<string, ZPoint[]>();
      points.forEach(p => {
        if (p.excluded) return;
        const r = runMap.get(p.runKey) || [];
        r.push(p);
        runMap.set(p.runKey, r);
      });

      runMap.forEach((runPoints, runKey) => {
        const zs_in_run = runPoints.map(p => p.z);
        const hasHigh = zs_in_run.some(z => z > 2);
        const hasLow = zs_in_run.some(z => z < -2);
        if (hasHigh && hasLow) {
          statusByRun[runKey] = ruleStatus('R-4s');
          violations.push({
            rule: 'R-4s', severity: ruleSeverity('R-4s'), level: 'cross', triggeredAt: runKey,
            involved: [runKey], zValues: zs_in_run,
            message: 'Selisih antar level melampaui 4SD', action: 'Random error besar antar level'
          });
        }

        const highCount = zs_in_run.filter(z => z > 2).length;
        const lowCount = zs_in_run.filter(z => z < -2).length;
        if (highCount >= 2 || lowCount >= 2) {
          statusByRun[runKey] = ruleStatus('2-2s');
          violations.push({
            rule: '2-2s', severity: ruleSeverity('2-2s'), level: 'cross', triggeredAt: runKey,
            involved: [runKey], zValues: zs_in_run,
            message: 'Dua level melampaui ±2SD di sisi yang sama', action: 'Indikasi error sistematik'
          });
        }
      });
    }
  });

  const total = points.length;
  const reject = Object.values(statusByRun).filter(s => s === 'oos').length;
  const warning = Object.values(statusByRun).filter(s => s === 'warning').length;

  return {
    violations,
    statusByRun,
    summary: {
      total,
      inControl: total - reject,
      warning,
      reject,
      advisory: 0
    }
  };
}
