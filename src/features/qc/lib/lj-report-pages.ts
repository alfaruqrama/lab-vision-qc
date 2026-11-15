/**
 * Turn QC records into the analyser-style report pages.
 *
 * One page per (instrument, control level, parameter) — the unit an analyser
 * prints. Kept apart from `lj-print.ts` (which only knows how to *render* a
 * page) so the grouping and the measured statistics can be reasoned about and
 * tested without touching markup.
 */

import type { InstrumentType, LotConfig, QCRecord, ControlLevel } from '@/lib/types';
import { getParamsForInstrument } from '@/lib/types';
import { computeZScores, getParamTarget } from '@/lib/zscore';
import { INSTRUMENT_LABELS } from '@/features/qc/lib/constants';
import {
  measuredStats,
  paramLabel,
  paramUnit,
  SERIES_COLORS,
  type LJPrintPage,
} from './lj-print';

/**
 * Control levels an instrument actually records. Mirrors the L-J page — CA-660
 * and CLEVER store one flat `Kontrol` run, EASYLITE two pack levels, ONCALL
 * three separate controls.
 */
export function levelsForInstrument(alat: InstrumentType): ControlLevel[] {
  if (alat === 'EASYLITE') return ['NORMAL', 'HIGH'];
  if (alat === 'ONCALL1' || alat === 'ONCALL2') return ['CTRL0', 'CTRL1', 'CTRL2'];
  return ['Kontrol'];
}

interface BuildOptions {
  records: QCRecord[];
  config: LotConfig;
  month: string;
  /** Instrument filter; `ALL` walks every instrument that has data. */
  instrument: 'ALL' | InstrumentType;
  dateRangeLabel: string;
}

export function buildReportPages({
  records,
  config,
  month,
  instrument,
  dateRangeLabel,
}: BuildOptions): LJPrintPage[] {
  const inMonth = records.filter(
    (r) => r.tanggal.startsWith(month) && !r.excluded && (instrument === 'ALL' || r.alat === instrument),
  );

  const instruments: InstrumentType[] =
    instrument === 'ALL'
      ? (Array.from(new Set(inMonth.map((r) => r.alat))) as InstrumentType[]).sort()
      : [instrument];

  const pages: LJPrintPage[] = [];

  for (const alat of instruments) {
    const alatRecords = inMonth.filter((r) => r.alat === alat);
    if (alatRecords.length === 0) continue;

    const levels = levelsForInstrument(alat);
    const params = getParamsForInstrument(alat);

    for (const level of levels) {
      const levelRecords = alatRecords.filter((r) => r.level === level);
      if (levelRecords.length === 0) continue;

      for (const param of params) {
        // Z-scores come from the same helper the on-screen chart uses, so the
        // points on paper match the points on screen — including a lot change
        // mid-month, where each run is scored against the lot in force that day.
        const scored = computeZScores(levelRecords, config, alat, param, [level])[level] || [];
        if (scored.length === 0) continue;

        const values = scored.map((p) => p.rawValue);
        const measured = measuredStats(values);
        if (measured.n === 0) continue;

        // The printed target is the one in force for the most recent run; a
        // month that spans a lot change is flagged in the table below by lot.
        const latest = scored[scored.length - 1];
        const target = getParamTarget(config, alat, level, param, latest.tanggal);

        // Lot number(s) used this month — shown as-is when a single lot covers
        // every run, joined when the month crosses a lot change.
        const lots = Array.from(new Set(levelRecords.map((r) => r.lot))).filter(Boolean);
        const lotNo = lots.join(' / ');

        const operatorByDate = new Map<string, string>();
        for (const r of levelRecords) {
          if (!operatorByDate.has(r.tanggal) && r.analis) operatorByDate.set(r.tanggal, r.analis);
        }

        const seriesLabel = levels.length > 1 ? `${param} · ${level}` : param;
        const oosCount = scored.filter((p) => Math.abs(p.zScore) > 3).length;
        const inControlPct = ((scored.length - oosCount) / scored.length) * 100;
        // A single run beyond ±3SD is a 1-3s rejection under Westgard, no matter
        // how small it looks as a percentage — so the verdict is decided on the
        // count, not the rate. The rate stays visible in the sentence.
        const accepted = oosCount === 0;

        pages.push({
          chemistry: `${INSTRUMENT_LABELS[alat]} — ${paramLabel(param)}`,
          fullName: `${INSTRUMENT_LABELS[alat]} — ${paramLabel(param)}`,
          dateRange: dateRangeLabel,
          unit: paramUnit(param),
          control: levels.length > 1 ? `${level}` : 'Kontrol',
          lotNo,
          setMean: target?.mean ?? 0,
          setSd: target?.sd ?? 0,
          setCv: target && target.mean !== 0 ? (target.sd / target.mean) * 100 : 0,
          measuredMean: measured.mean,
          measuredSd: measured.sd,
          measuredCv: measured.cv,
          n: measured.n,
          rows: scored.map((p) => ({
            date: p.tanggal,
            value: p.rawValue,
            operator: operatorByDate.get(p.tanggal) || '',
          })),
          series: [
            {
              label: seriesLabel,
              color: SERIES_COLORS[level] || 'hsl(220,79%,48%)',
              points: scored.map((p) => ({ date: p.tanggal, value: p.rawValue, z: p.zScore })),
            },
          ],
          verdict: accepted
            ? `Dalam kendali — ${scored.length}/${scored.length} run in-control (100%)`
            : `Di luar kendali — ${oosCount} dari ${scored.length} run melewati ±3SD (${inControlPct.toFixed(0)}% in-control)`,
          verdictOk: accepted,
        });
      }
    }
  }

  return pages;
}
