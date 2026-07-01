import type { ZScorePoint } from './zscore';
import type { ControlLevel } from './types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RuleStatus = 'ok' | 'warning' | 'oos';

export interface RuleViolation {
  rule: string;
  level: string;
  status: RuleStatus;
  affectedDays: string[];
  description: string;
}

export interface PatternResult {
  type: 'shift' | 'trend_up' | 'trend_down' | 'bias_high' | 'bias_low' | 'random_error' | 'none';
  level: string;
  description: string;
  days: string[];
}

export interface CrossLevelResult {
  type: 'systematic' | 'specific' | 'stable' | 'insufficient_data';
  summary: string;
  details: string[];
}

export interface MultiLevelAnalysis {
  rules: RuleViolation[];
  patterns: PatternResult[];
  crossLevel: CrossLevelResult;
  recommendation: string;
  timestamp: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SHIFT_THRESHOLD = 6;  // consecutive points on one side → shift
const TREND_THRESHOLD = 7;  // monotonic points → trend
const BIAS_TOTAL = 10;      // min total points for bias detection
const BIAS_RATIO = 0.8;     // 8+ out of 10 on one side → bias

// ─── Core Analysis ────────────────────────────────────────────────────────────

/**
 * Full multi-level QC analysis — generalized for 2 or 3 levels.
 *
 * @param levelPoints - Map of control level → Z-score points
 */
export function analyzeMultiLevel(
  levelPoints: Record<ControlLevel, ZScorePoint[]>,
): MultiLevelAnalysis {
  const levels = Object.keys(levelPoints) as ControlLevel[];
  const ruleViolations: RuleViolation[] = [];

  // Per-level rule scanning
  for (const level of levels) {
    const levelRules = scanRules(levelPoints[level], level);
    ruleViolations.push(...levelRules);
  }

  // R-4s cross-level: check all pairs
  const r4sViolations = detectR4s(levelPoints);
  ruleViolations.push(...r4sViolations);

  // Pattern detection per level
  const allPatterns: PatternResult[] = [];
  for (const level of levels) {
    allPatterns.push(...detectPatterns(levelPoints[level], level));
  }

  // Cross-level analysis
  const crossLevel = analyzeCrossLevel(levelPoints);

  // Generate recommendation
  const recommendation = generateRecommendation(
    ruleViolations,
    allPatterns.filter((p) => p.type !== 'none'),
    crossLevel,
  );

  return {
    rules: ruleViolations,
    patterns: allPatterns.filter((p) => p.type !== 'none'),
    crossLevel,
    recommendation,
    timestamp: new Date().toISOString(),
  };
}

// ─── Rule Scanning ────────────────────────────────────────────────────────────

function scanRules(points: ZScorePoint[], level: string): RuleViolation[] {
  const rules: RuleViolation[] = [];
  if (points.length < 2) return rules;

  const scores = points.map((p) => p.zScore);

  // 1-3s: single point > |3|
  const oos13s = points.filter((p) => Math.abs(p.zScore) > 3);
  if (oos13s.length > 0) {
    rules.push({
      rule: '1-3s',
      level,
      status: 'oos',
      affectedDays: oos13s.map((p) => p.tanggal),
      description: `${oos13s.length} titik melampaui ±3SD — investigasi segera`,
    });
  }

  // 1-2s: single point > |2|
  const warn12s = points.filter((p) => Math.abs(p.zScore) > 2 && Math.abs(p.zScore) <= 3);
  if (warn12s.length > 0) {
    rules.push({
      rule: '1-2s',
      level,
      status: 'warning',
      affectedDays: warn12s.map((p) => p.tanggal),
      description: `${warn12s.length} titik melampaui ±2SD — pantau ketat`,
    });
  }

  // 2-2s: 2 consecutive > |2| same direction
  const days22s: string[] = [];
  for (let i = 1; i < scores.length; i++) {
    if (
      Math.abs(scores[i]) > 2 && Math.abs(scores[i - 1]) > 2 &&
      Math.sign(scores[i]) === Math.sign(scores[i - 1])
    ) {
      days22s.push(points[i].tanggal);
    }
  }
  if (days22s.length > 0) {
    rules.push({
      rule: '2-2s',
      level,
      status: 'oos',
      affectedDays: days22s,
      description: '2 titik berturut-turut > ±2SD di sisi yang sama — indikasi systematic error',
    });
  }

  // 4-1s: 4 consecutive > |1| same direction
  let streak1s = 1;
  const days41s: string[] = [];
  for (let i = 1; i < scores.length; i++) {
    if (Math.abs(scores[i]) > 1 && Math.abs(scores[i - 1]) > 1 && Math.sign(scores[i]) === Math.sign(scores[i - 1])) {
      streak1s++;
      if (streak1s >= 4) days41s.push(points[i].tanggal);
    } else {
      streak1s = 1;
    }
  }
  if (days41s.length > 0) {
    rules.push({
      rule: '4-1s',
      level,
      status: 'warning',
      affectedDays: [...new Set(days41s)],
      description: '4+ titik berturut-turut > ±1SD — potensi shift sistematik',
    });
  }

  // 10x: 10 consecutive on same side of mean
  let streak10x = 1;
  const days10x: string[] = [];
  for (let i = 1; i < scores.length; i++) {
    if (Math.sign(scores[i]) === Math.sign(scores[i - 1]) && scores[i] !== 0) {
      streak10x++;
      if (streak10x >= 10) days10x.push(points[i].tanggal);
    } else {
      streak10x = 1;
    }
  }
  if (days10x.length > 0) {
    rules.push({
      rule: '10x',
      level,
      status: 'oos',
      affectedDays: [...new Set(days10x)],
      description: '10+ titik berturut-turut di satu sisi mean — indikasi bias sistematik',
    });
  }

  return rules;
}

// ─── R-4s Cross-Level Rule (generalized for N levels) ─────────────────────────

export function detectR4s(levelPoints: Record<ControlLevel, ZScorePoint[]>): RuleViolation[] {
  const levels = Object.keys(levelPoints) as ControlLevel[];
  const violations: RuleViolation[] = [];

  // Check all pairs of levels
  for (let i = 0; i < levels.length; i++) {
    for (let j = i + 1; j < levels.length; j++) {
      const levelA = levels[i];
      const levelB = levels[j];
      const mapA = new Map(levelPoints[levelA].map((p) => [p.tanggal, p]));
      const mapB = new Map(levelPoints[levelB].map((p) => [p.tanggal, p]));

      const commonDates = [...mapA.keys()].filter((d) => mapB.has(d));
      const affectedDays: string[] = [];

      for (const date of commonDates) {
        const a = mapA.get(date)!;
        const b = mapB.get(date)!;
        // R-4s: difference in Z-scores between levels > 4
        if (Math.abs(a.zScore - b.zScore) > 4) {
          affectedDays.push(date);
        }
      }

      if (affectedDays.length > 0) {
        violations.push({
          rule: 'R-4s',
          level: `${levelA}-${levelB}`,
          status: 'oos',
          affectedDays,
          description: `Selisih Z-score ${levelA} vs ${levelB} > 4 — perbedaan signifikan antar level`,
        });
      }
    }
  }

  return violations;
}

// ─── Pattern Detection ────────────────────────────────────────────────────────

function detectPatterns(points: ZScorePoint[], level: string): PatternResult[] {
  const patterns: PatternResult[] = [];
  const scores = points.map((p) => p.zScore);
  if (scores.length < SHIFT_THRESHOLD) return [{ type: 'none', level, description: '', days: [] }];

  // Shift detection: ≥6 consecutive on one side
  let sideStreak = 1;
  let shiftStart = 0;
  for (let i = 1; i < scores.length; i++) {
    if (Math.sign(scores[i]) === Math.sign(scores[i - 1]) && scores[i] !== 0) {
      sideStreak++;
      if (sideStreak >= SHIFT_THRESHOLD) {
        const shiftDays = points.slice(shiftStart, i + 1).map((p) => p.tanggal);
        patterns.push({
          type: 'shift',
          level,
          description: `Shift terdeteksi: ${shiftDays.length} titik di sisi ${scores[i] > 0 ? 'atas' : 'bawah'} mean`,
          days: shiftDays,
        });
        break;
      }
    } else {
      sideStreak = 1;
      shiftStart = i;
    }
  }

  // Trend detection: ≥7 monotonic increasing or decreasing
  let trendUp = 1, trendDown = 1;
  let trendStart = 0;
  for (let i = 1; i < scores.length; i++) {
    if (scores[i] > scores[i - 1]) {
      trendUp++;
      trendDown = 1;
    } else if (scores[i] < scores[i - 1]) {
      trendDown++;
      trendUp = 1;
    } else {
      trendUp = 1;
      trendDown = 1;
    }
    if (trendUp >= TREND_THRESHOLD || trendDown >= TREND_THRESHOLD) {
      const trendDays = points.slice(trendStart, i + 1).map((p) => p.tanggal);
      patterns.push({
        type: trendUp >= TREND_THRESHOLD ? 'trend_up' : 'trend_down',
        level,
        description: `Trend ${trendUp >= TREND_THRESHOLD ? 'naik' : 'turun'}: ${trendDays.length} titik berturut — kemungkinan degradasi reagen atau kalibrasi`,
        days: trendDays,
      });
      break;
    }
    if (trendUp === 1 && trendDown === 1) trendStart = i;
  }

  // Bias detection: ≥BIAS_TOTAL total points, >BIAS_RATIO on one side
  if (scores.length >= BIAS_TOTAL) {
    const above = scores.filter((s) => s > 0).length;
    const below = scores.filter((s) => s < 0).length;
    const total = above + below;
    if (total >= BIAS_TOTAL && (above / total > BIAS_RATIO || below / total > BIAS_RATIO)) {
      patterns.push({
        type: above > below ? 'bias_high' : 'bias_low',
        level,
        description: `Bias sistematik: ${above > below ? above : below}/${total} titik di sisi ${above > below ? 'atas' : 'bawah'} mean`,
        days: points.map((p) => p.tanggal),
      });
    }
  }

  // Random error: sporadic oos/warning without patterns
  const oosCount = points.filter((p) => p.status === 'oos').length;
  const warnCount = points.filter((p) => p.status === 'warning').length;
  if ((oosCount > 0 || warnCount > 1) && !patterns.some((p) => p.type === 'shift' || p.type === 'trend_up' || p.type === 'trend_down')) {
    patterns.push({
      type: 'random_error',
      level,
      description: `${oosCount} oos + ${warnCount} warning — pola acak tanpa shift/trend jelas`,
      days: points.filter((p) => p.status !== 'ok').map((p) => p.tanggal),
    });
  }

  if (patterns.length === 0) {
    patterns.push({ type: 'none', level, description: '', days: [] });
  }

  return patterns;
}

// ─── Cross-Level Analysis (generalized for N levels) ──────────────────────────

function analyzeCrossLevel(
  levelPoints: Record<ControlLevel, ZScorePoint[]>,
): CrossLevelResult {
  const levels = Object.keys(levelPoints) as ControlLevel[];
  const levelData = levels.map((lvl) => ({
    name: lvl,
    points: levelPoints[lvl],
    zScores: levelPoints[lvl].map((p) => p.zScore),
    oosCount: levelPoints[lvl].filter((p) => p.status === 'oos').length,
    warnCount: levelPoints[lvl].filter((p) => p.status === 'warning').length,
    avgZ: levelPoints[lvl].length > 0
      ? levelPoints[lvl].reduce((a, p) => a + p.zScore, 0) / levelPoints[lvl].length
      : 0,
  }));

  const minPoints = Math.min(...levelData.map((d) => d.points.length));
  if (minPoints < 5) {
    return {
      type: 'insufficient_data',
      summary: 'Data tidak cukup untuk analisis cross-level (min 5 titik per level)',
      details: [],
    };
  }

  // Correlation: average same-direction agreement across all level pairs
  let totalPairs = 0;
  let sameDirectionPairs = 0;
  for (let i = 0; i < levels.length; i++) {
    for (let j = i + 1; j < levels.length; j++) {
      const a = levelData[i].zScores;
      const b = levelData[j].zScores;
      const commonCount = Math.min(a.length, b.length);
      for (let k = 1; k < commonCount; k++) {
        const aDir = a[k] > a[k - 1] ? 1 : a[k] < a[k - 1] ? -1 : 0;
        const bDir = b[k] > b[k - 1] ? 1 : b[k] < b[k - 1] ? -1 : 0;
        if (aDir !== 0 && bDir !== 0) {
          totalPairs++;
          if (aDir === bDir) sameDirectionPairs++;
        }
      }
    }
  }

  const correlation = totalPairs > 0 ? sameDirectionPairs / totalPairs : 0;

  const totalOos = levelData.reduce((s, d) => s + d.oosCount, 0);
  const totalWarn = levelData.reduce((s, d) => s + d.warnCount, 0);
  const levelsWithIssues = levelData.filter((d) => d.oosCount + d.warnCount > 0);

  const details: string[] = [];
  let type: CrossLevelResult['type'];
  let summary: string;

  // All or most levels have issues & correlated → systematic
  if (levelsWithIssues.length >= levels.length * 0.5 && correlation > 0.5 && totalOos + totalWarn > 0) {
    type = 'systematic';
    summary = 'Systematic Error — multiple level menunjukkan pola serupa';
    details.push(`Korelasi arah pergerakan: ${Math.round(correlation * 100)}%`);
    for (const d of levelData) {
      details.push(`${d.name}: ${d.oosCount} oos, ${d.warnCount} warning (avg Z=${d.avgZ.toFixed(2)})`);
    }
    details.push('Kemungkinan penyebab: degradasi reagen, masalah kalibrasi, atau suhu penyimpanan');
  } else if (levelsWithIssues.length === 1 && totalOos + totalWarn > 3) {
    type = 'specific';
    const problemLevel = levelsWithIssues[0].name;
    summary = `Masalah Spesifik — hanya level ${problemLevel} yang bermasalah`;
    details.push(`Level ${problemLevel} menunjukkan penyimpangan tanpa diikuti level lainnya`);
    details.push('Kemungkinan: lot kontrol rusak, kontaminasi spesifik, atau kesalahan preparasi');
  } else {
    type = 'stable';
    summary = 'Stabil — semua level terkendali';
    const allClose = levelData.every((d) => Math.abs(d.avgZ) < 0.3);
    if (allClose) {
      details.push('Semua level dekat dengan mean (bias minimal)');
    }
    for (const d of levelData) {
      details.push(`Rata-rata Z ${d.name}: ${d.avgZ.toFixed(2)}`);
    }
    details.push(`Korelasi pergerakan: ${Math.round(correlation * 100)}%`);
  }

  return { type, summary, details };
}

// ─── Recommendation Generator ─────────────────────────────────────────────────

function generateRecommendation(
  rules: RuleViolation[],
  allPatterns: PatternResult[],
  crossLevel: CrossLevelResult,
): string {
  const oosRules = rules.filter((r) => r.status === 'oos');
  const warnRules = rules.filter((r) => r.status === 'warning');
  const hasShift = allPatterns.some((p) => p.type === 'shift');
  const hasTrend = allPatterns.some((p) => p.type === 'trend_up' || p.type === 'trend_down');
  const hasBias = allPatterns.some((p) => p.type === 'bias_high' || p.type === 'bias_low');

  // Critical: OOS + systematic cross-level
  if (oosRules.length > 0 && crossLevel.type === 'systematic') {
    return 'Segera hentikan pelaporan hasil pasien untuk parameter ini.\n' +
      '1. Periksa kondisi reagen (tanggal kadaluarsa, penyimpanan, kontaminasi)\n' +
      '2. Lakukan kalibrasi ulang instrumen\n' +
      '3. Jalankan QC dengan lot kontrol baru\n' +
      '4. Dokumentasikan semua tindakan korektif';
  }

  // OOS without systematic pattern
  if (oosRules.length > 0) {
    const actions = ['Investigasi penyebab out-of-control:',
      '• Periksa lot kontrol (expired? kontaminasi?)'];
    if (crossLevel.type === 'specific') {
      actions.push('• Cek preparasi dan penyimpanan material QC spesifik');
    }
    actions.push('• Ulangi pengukuran QC setelah tindakan korektif');
    actions.push('• Jangan laporkan hasil pasien sampai QC kembali in-control');
    return actions.join('\n');
  }

  // Warning with patterns
  if (warnRules.length > 0 && (hasShift || hasTrend)) {
    return 'Pantau ketat parameter ini dalam 2-3 hari ke depan.\n' +
      (hasShift ? '• Ada indikasi shift — periksa stabilitas reagen\n' : '') +
      (hasTrend ? '• Ada indikasi trend — jadwalkan kalibrasi ulang segera\n' : '') +
      '• Periksa suhu penyimpanan reagen dan kontrol\n' +
      '• Lakukan preventive maintenance instrumen';
  }

  // Bias detection
  if (hasBias) {
    return 'Bias sistematik terdeteksi — nilai cenderung condong ke satu arah.\n' +
      '• Periksa proses rekonstitusi material QC (volume pipet, suhu)\n' +
      '• Verifikasi lot kontrol baru terhadap lot sebelumnya\n' +
      '• Pertimbangkan kalibrasi ulang';
  }

  // Warning only
  if (warnRules.length > 0) {
    return 'Beberapa warning terdeteksi — pantau secara berkala.\n' +
      '• Periksa tren dalam beberapa hari ke depan\n' +
      '• Jika warning menetap > 5 hari, lakukan kalibrasi ulang';
  }

  // Stable
  if (crossLevel.type === 'stable') {
    return '✅ Semua parameter terkendali. Lanjutkan QC rutin sesuai jadwal.';
  }

  return 'Lanjutkan pemantauan QC rutin sesuai protokol laboratorium.';
}
