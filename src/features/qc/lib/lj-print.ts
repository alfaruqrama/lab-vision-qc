/**
 * Print documents for the Levey-Jennings pages.
 *
 * Two shapes come out of here:
 *
 * - `buildLJReportHtml` — the analyser-style sheet used by `/qc/report`: one
 *   page per (instrument, level, parameter), laid out like the printout an
 *   analyser hands out (identity block, Set/Measured table, chart, run table in
 *   three columns, conclusion, footer).
 * - `buildLJChartPrintHtml` — the shorter sheet used by `/qc/chart`: header,
 *   chart, a few summary lines and the two signature blocks.
 *
 * The chart is emitted as inline SVG rather than a screenshot of the on-screen
 * Recharts figure: it stays crisp at printer resolution, needs no async DOM
 * capture, and every page is guaranteed to draw the same way.
 */

import { PARAM_UNITS } from '@/lib/types';
import type { ParamName } from '@/lib/types';

export interface PrintPoint {
  date: string;
  /** Raw result, printed in the run table. */
  value: number;
  /** Z against the target that was in force on that run. */
  z: number;
}

export interface PrintSeries {
  label: string;
  color: string;
  points: PrintPoint[];
}

export interface PrintRow {
  date: string;
  value: number;
  operator: string;
}

export interface LJPrintPage {
  chemistry: string;
  fullName: string;
  dateRange: string;
  unit: string;
  control: string;
  lotNo: string;
  setMean: number;
  setSd: number;
  setCv: number;
  measuredMean: number;
  measuredSd: number;
  measuredCv: number;
  n: number;
  rows: PrintRow[];
  series: PrintSeries[];
  verdict: string;
  verdictOk: boolean;
}

export interface LJChartPrintOptions {
  title: string;
  instrumentLabel: string;
  paramLabel: string;
  levelLabel: string;
  periodLabel: string;
  dateRange: string;
  unit: string;
  series: PrintSeries[];
  lines: { label: string; value: string }[];
  picName: string;
  kaLabName: string;
  printedAt: Date;
}

const KA_LAB_NAME = 'Marlina Setya Dewi, Str.Kes';

/**
 * Trace colour per control level — shared by the on-screen chart and the print
 * sheets so a level keeps its colour between the two.
 */
export const SERIES_COLORS: Record<string, string> = {
  Kontrol: 'hsl(220,79%,48%)',
  NORMAL: 'hsl(220,79%,48%)',
  HIGH: 'hsl(142,69%,40%)',
  CTRL0: 'hsl(220,79%,48%)',
  CTRL1: 'hsl(142,69%,40%)',
  CTRL2: 'hsl(30,85%,50%)',
};

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

const esc = (s: string) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** ISO `yyyy-mm-dd` → `dd/mm/yyyy`, the form printed on the sheet. */
export function formatDMY(iso: string): string {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/** `dd/mm/yyyy hh.mm.ss` — matches the analyser footer. */
export function formatPrintTimestamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}.${p(d.getMinutes())}.${p(d.getSeconds())}`;
}

function fmt(value: number | undefined, digits = 2): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '-';
  return value.toFixed(digits);
}

/** Month → "01/03/2026 - 31/03/2026". */
export function monthDateRange(month: string): string {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m) return '-';
  const last = new Date(y, m, 0).getDate();
  const p = (n: number) => String(n).padStart(2, '0');
  return `01/${p(m)}/${y} - ${p(last)}/${p(m)}/${y}`;
}

/** Population SD of a series — what "Measured SD" means on the sheet. */
export function measuredStats(values: number[]) {
  const n = values.length;
  if (n === 0) return { n: 0, mean: 0, sd: 0, cv: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const sd =
    n > 1 ? Math.sqrt(values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (n - 1)) : 0;
  const cv = mean !== 0 ? (sd / mean) * 100 : 0;
  return { n, mean, sd, cv };
}

export function paramLabel(param: ParamName): string {
  return PARAM_LABELS[param] ?? param;
}

export const PARAM_LABELS: Record<ParamName, string> = {
  PT: 'PT',
  APTT: 'APTT',
  INR: 'INR',
  Na: 'Natrium (Na)',
  K: 'Kalium (K)',
  Cl: 'Klorida (Cl)',
  GDA: 'Glukosa (GDA)',
};

export function paramUnit(param: ParamName): string {
  return PARAM_UNITS[param] ?? '';
}

/* ------------------------------------------------------------------ */
/* Chart                                                               */
/* ------------------------------------------------------------------ */

const BAND_GREEN = '#16a34a';
const BAND_AMBER = '#d97706';
const BAND_RED = '#dc2626';

interface SvgOptions {
  width?: number;
  height?: number;
  showDates?: boolean;
  showLegend?: boolean;
}

/**
 * Draw a Levey-Jennings figure as SVG.
 *
 * Every series is normalised to its own target (z = (value − mean) / sd) and
 * the axis is labelled ±1/2/3SD, so several control levels with different
 * means can share one figure — exactly like the on-screen multi-level chart.
 */
export function renderLJChartSvg(series: PrintSeries[], opts: SvgOptions = {}): string {
  const W = opts.width ?? 720;
  const H = opts.height ?? 300;
  const showDates = opts.showDates !== false;
  const showLegend = opts.showLegend !== false && series.length > 0;

  // Bottom margin holds the rotated dates and then the legend, each with its
  // own reserved band so the two never sit on top of each other.
  const datesBand = showDates ? 46 : 6;
  const legendBand = showLegend ? 16 : 0;
  const margin = { top: 16, right: 18, bottom: datesBand + legendBand + 10, left: 56 };
  const plotW = W - margin.left - margin.right;
  const plotH = H - margin.top - margin.bottom;

  // The frame *is* the ±3SD window, so a run beyond range lands exactly on the
  // ±3SD line — the same clamp the on-screen chart uses, and the reason the
  // axis stays comparable from month to month.
  const zAxis = 3;
  const yAt = (z: number) => margin.top + (1 - (z + zAxis) / (2 * zAxis)) * plotH;

  const dates = Array.from(
    new Set(series.flatMap((s) => s.points.map((p) => p.date))),
  ).sort();
  const xAt = (date: string) => {
    if (dates.length <= 1) return margin.left + plotW / 2;
    const i = dates.indexOf(date);
    return margin.left + (i / (dates.length - 1)) * plotW;
  };

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Helvetica, Arial, sans-serif">`,
  );

  // SD bands: green inside ±1, amber ±1..2, red ±2..3 — the same reading as the
  // on-screen chart, kept faint so the trace stays the strongest mark.
  const bands: [number, number, string][] = [
    [-1, 1, BAND_GREEN],
    [1, 2, BAND_AMBER],
    [-2, -1, BAND_AMBER],
    [2, 3, BAND_RED],
    [-3, -2, BAND_RED],
  ];
  for (const [lo, hi, color] of bands) {
    parts.push(
      `<rect x="${margin.left}" y="${yAt(hi)}" width="${plotW}" height="${yAt(lo) - yAt(hi)}" fill="${color}" fill-opacity="0.05" stroke="none"/>`,
    );
  }

  // Grid + threshold lines.
  const bandsLines: [number, string, string][] = [
    [3, BAND_RED, '3 3'],
    [-3, BAND_RED, '3 3'],
    [2, BAND_AMBER, '3 3'],
    [-2, BAND_AMBER, '3 3'],
    [1, BAND_GREEN, '3 3'],
    [-1, BAND_GREEN, '3 3'],
    [0, '#334155', '5 3'],
  ];
  for (const [z, color, dash] of bandsLines) {
    parts.push(
      `<line x1="${margin.left}" y1="${yAt(z)}" x2="${margin.left + plotW}" y2="${yAt(z)}" stroke="${color}" stroke-width="${z === 0 ? 1 : 0.8}" stroke-dasharray="${dash}" stroke-opacity="${z === 0 ? 0.75 : 0.55}"/>`,
    );
  }

  // Axis frame.
  parts.push(
    `<rect x="${margin.left}" y="${margin.top}" width="${plotW}" height="${plotH}" fill="none" stroke="#94a3b8" stroke-width="0.8"/>`,
  );

  // Y labels.
  const yLabels: [number, string][] = [
    [3, '+3SD'],
    [2, '+2SD'],
    [1, '+1SD'],
    [0, 'X'],
    [-1, '-1SD'],
    [-2, '-2SD'],
    [-3, '-3SD'],
  ];
  for (const [z, label] of yLabels) {
    parts.push(
      `<text x="${margin.left - 8}" y="${yAt(z) + 3}" text-anchor="end" font-size="9" fill="#334155">${label}</text>`,
    );
  }

  // X labels — rotated like the analyser printout, thinned when crowded.
  if (showDates) {
    const maxLabels = Math.max(4, Math.floor(plotW / 34));
    const step = Math.max(1, Math.ceil(dates.length / maxLabels));
    dates.forEach((date, i) => {
      if (i % step !== 0 && i !== dates.length - 1) return;
      const x = xAt(date);
      parts.push(
        `<text x="${x}" y="${margin.top + plotH + 8}" font-size="8" fill="#475569" text-anchor="end" transform="rotate(-90 ${x} ${margin.top + plotH + 8})">${esc(formatDMY(date))}</text>`,
      );
    });
  }

  // Traces. Points beyond ±3SD are pinned to the edge so the axis stays fixed
  // and comparable; the run table carries the real result.
  series.forEach((s) => {
    const pts = s.points
      .filter((p) => typeof p.z === 'number' && !Number.isNaN(p.z))
      .map((p) => ({ x: xAt(p.date), y: yAt(Math.max(-zAxis, Math.min(zAxis, p.z))) }));

    if (pts.length > 1) {
      parts.push(
        `<polyline fill="none" stroke="${s.color}" stroke-width="1.4" stroke-linejoin="round" points="${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}"/>`,
      );
    }
    for (const p of pts) {
      parts.push(`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="${s.color}"/>`);
    }
  });

  // Legend, centred under the date band.
  if (legendBand > 0) {
    const ly = margin.top + plotH + datesBand + 12;
    const entries = series.map((s) => ({ label: s.label, color: s.color, w: 16 + s.label.length * 5.4 }));
    const totalW = entries.reduce((n, e) => n + e.w, 0) + (entries.length - 1) * 12;
    let lx = margin.left + Math.max(0, (plotW - totalW) / 2);
    for (const e of entries) {
      parts.push(`<circle cx="${lx + 4}" cy="${ly - 3}" r="3.5" fill="${e.color}"/>`);
      parts.push(`<text x="${lx + 12}" y="${ly}" font-size="9" fill="#334155">${esc(e.label)}</text>`);
      lx += e.w + 12;
    }
  }

  parts.push('</svg>');
  return parts.join('');
}

/* ------------------------------------------------------------------ */
/* Shared styles                                                       */
/* ------------------------------------------------------------------ */

const BASE_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { background: #fff; }
  body { font-family: Helvetica, Arial, sans-serif; color: #111827; font-size: 10pt; }
  .sheet {
    width: 182mm; margin: 0 auto; padding: 0; page-break-after: always;
  }
  .sheet:last-child { page-break-after: auto; }
  .doc-title { text-align: center; font-size: 12pt; font-weight: 700; letter-spacing: 0.4px; }
  .doc-sub { text-align: center; font-size: 7.5pt; color: #64748b; margin-top: 1mm; }
  .rule { border: none; border-top: 1px solid #111827; margin: 3mm 0; }
  .rule-thin { border: none; border-top: 0.6px solid #94a3b8; margin: 2mm 0; }
  .chart-frame { border: 1px solid #cbd5e1; padding: 2mm; margin: 3mm 0; }
  .chart-frame svg { display: block; width: 100%; height: auto; }
  table { width: 100%; border-collapse: collapse; }
  .kv td { padding: 0.6mm 0; font-size: 9pt; vertical-align: top; }
  .kv td.k { width: 26mm; color: #111827; }
  .kv td.v { font-weight: 600; }
  .stats th, .stats td { font-size: 8.5pt; padding: 1mm 1.5mm; text-align: left; }
  .stats thead th { font-weight: 600; border-bottom: 1px solid #111827; white-space: nowrap; }
  .stats td.num, .stats th.num { text-align: right; }
  .runs { margin-top: 2mm; }
  .runs td { font-size: 8.5pt; padding: 0.9mm 2mm 0.9mm 0; vertical-align: top; }
  .runs td.h { font-weight: 600; border-bottom: 0.6px solid #94a3b8; }
  .runs td.ghost { width: 4mm; }
  .verdict { font-size: 9pt; margin-top: 1mm; font-weight: 600; }
  .verdict.ok { color: #15803d; }
  .verdict.nok { color: #b91c1c; }
  .footer { display: flex; justify-content: space-between; font-size: 8pt; color: #475569; margin-top: 6mm; border-top: 0.6px solid #94a3b8; padding-top: 1.5mm; }
  .signs { display: flex; justify-content: space-between; margin-top: 14mm; }
  .sign { width: 68mm; text-align: center; font-size: 9pt; }
  .sign .role { font-weight: 600; }
  .sign .name { color: #475569; font-size: 8.5pt; margin-top: 0.5mm; }
  .sign .space { height: 18mm; border-bottom: 0.8px solid #111827; margin-top: 1mm; }
  @page { size: A4 portrait; margin: 13mm; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .sheet { width: auto; }
  }
`;

function documentShell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<style>${BASE_CSS}</style>
</head>
<body>
${body}
</body>
</html>`;
}

function signatureBlock(picName: string, kaLabName: string): string {
  return `<div class="signs">
  <div class="sign">
    <p class="role">PIC Alat</p>
    <div class="space"></div>
    <p class="name">${esc(picName || '(.....................................)')}</p>
  </div>
  <div class="sign">
    <p class="role">Ka. Instalasi Lab</p>
    <div class="space"></div>
    <p class="name">${esc(kaLabName)}</p>
  </div>
</div>`;
}

/* ------------------------------------------------------------------ */
/* /qc/report — analyser-style sheet, one page per control             */
/* ------------------------------------------------------------------ */

function reportSheet(page: LJPrintPage, printedAt: Date, index: number, total: number): string {
  const columns = 3;
  const perColumn = Math.max(1, Math.ceil(page.rows.length / columns));

  // One <td> per column holding its own 3-column mini-table keeps the run list
  // in reading order (down each block, then across) like the analyser sheet.
  const runColumns = Array.from({ length: columns }, (_, col) => {
    const chunk = page.rows.slice(col * perColumn, (col + 1) * perColumn);
    const head = `<tr><td class="h">Date</td><td class="h">Result</td><td class="h">Operator</td></tr>`;
    const body = chunk
      .map(
        (r) =>
          `<tr><td>${esc(formatDMY(r.date))}</td><td>${fmt(r.value, 2)}</td><td>${esc(r.operator || '')}</td></tr>`,
      )
      .join('');
    return `<td style="width:33.3%;vertical-align:top;padding-right:3mm"><table class="runs">${head}${body}</table></td>`;
  }).join('');

  return `<div class="sheet">
  <p class="doc-sub">RS PETROKIMIA GRESIK &mdash; Instalasi Laboratorium Klinik</p>
  <p class="doc-title">Levey-Jennings Chart</p>

  <hr class="rule" />

  <table class="kv">
    <tr>
      <td class="k">Chemistry:</td><td class="v" style="width:40mm">${esc(page.chemistry)}</td>
      <td class="k">Date Range:</td><td class="v">${esc(page.dateRange)}</td>
    </tr>
    <tr>
      <td class="k">Full Name:</td><td class="v">${esc(page.fullName)}</td>
      <td class="k">Unit:</td><td class="v">${esc(page.unit)}</td>
    </tr>
  </table>

  <table class="stats" style="margin-top:2mm">
    <thead>
      <tr>
        <th rowspan="2">Control</th>
        <th rowspan="2">Lot No.</th>
        <th rowspan="2" class="num">Mean</th>
        <th colspan="2" style="text-align:center">Set</th>
        <th colspan="3" style="text-align:center">Measured</th>
        <th rowspan="2" class="num">N</th>
      </tr>
      <tr>
        <th class="num">SD</th><th class="num">CV</th>
        <th class="num">Mean</th><th class="num">SD</th><th class="num">CV</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${esc(page.control)}</td>
        <td>${esc(page.lotNo || '-')}</td>
        <td class="num">${fmt(page.setMean, 2)}</td>
        <td class="num">${fmt(page.setSd, 2)}</td>
        <td class="num">${fmt(page.setCv, 2)}%</td>
        <td class="num">${fmt(page.measuredMean, 2)}</td>
        <td class="num">${fmt(page.measuredSd, 2)}</td>
        <td class="num">${fmt(page.measuredCv, 2)}%</td>
        <td class="num">${page.n}</td>
      </tr>
    </tbody>
  </table>

  <hr class="rule" />

  <div class="chart-frame">${renderLJChartSvg(page.series, { width: 720, height: 280 })}</div>

  <hr class="rule-thin" />

  <table>
    <tr>
      <td style="font-size:9pt;padding-bottom:1mm">Control</td>
      <td style="font-size:9pt;padding-bottom:1mm;font-weight:600">${esc(page.control)}</td>
      <td style="font-size:9pt;padding-bottom:1mm;padding-left:8mm">Lot No.</td>
      <td style="font-size:9pt;padding-bottom:1mm;font-weight:600">${esc(page.lotNo || '-')}</td>
    </tr>
    <tr>${runColumns}</tr>
  </table>

  <p style="font-size:9pt;margin-top:4mm">Conclusion:</p>
  <p class="verdict ${page.verdictOk ? 'ok' : 'nok'}">${esc(page.verdict)}</p>

  ${signatureBlock('', KA_LAB_NAME)}

  <div class="footer">
    <span>Print Date/Time: ${formatPrintTimestamp(printedAt)}</span>
    <span>Page ${index + 1} of ${total}</span>
  </div>
</div>`;
}

export function buildLJReportHtml(pages: LJPrintPage[], meta: { printedAt: Date }): string {
  if (pages.length === 0) {
    return documentShell(
      'Levey-Jennings Chart',
      `<div class="sheet"><p class="doc-title">Levey-Jennings Chart</p><hr class="rule" /><p style="font-size:9pt;color:#475569">Tidak ada data untuk periode ini.</p></div>`,
    );
  }
  const body = pages
    .map((p, i) => reportSheet(p, meta.printedAt, i, pages.length))
    .join('\n');
  return documentShell('Levey-Jennings Chart', body);
}

/* ------------------------------------------------------------------ */
/* /qc/chart — chart + short summary + signatures                      */
/* ------------------------------------------------------------------ */

export function buildLJChartPrintHtml(opts: LJChartPrintOptions): string {
  const lines = opts.lines
    .map(
      (l) =>
        `<tr><td style="font-size:9pt;padding:0.7mm 0;color:#475569">${esc(l.label)}</td><td style="font-size:9pt;padding:0.7mm 0;font-weight:600;text-align:right">${esc(l.value)}</td></tr>`,
    )
    .join('');

  const body = `<div class="sheet">
  <p class="doc-sub">RS PETROKIMIA GRESIK &mdash; Instalasi Laboratorium Klinik</p>
  <p class="doc-title">Levey-Jennings Chart</p>

  <hr class="rule" />

  <table class="kv">
    <tr>
      <td class="k">Instrumen:</td><td class="v" style="width:52mm">${esc(opts.instrumentLabel)}</td>
      <td class="k">Periode:</td><td class="v">${esc(opts.periodLabel)}</td>
    </tr>
    <tr>
      <td class="k">Parameter:</td><td class="v">${esc(opts.paramLabel)}</td>
      <td class="k">Unit:</td><td class="v">${esc(opts.unit)}</td>
    </tr>
    <tr>
      <td class="k">Level Kontrol:</td><td class="v">${esc(opts.levelLabel)}</td>
      <td class="k">Rentang:</td><td class="v">${esc(opts.dateRange)}</td>
    </tr>
  </table>

  <div class="chart-frame">${renderLJChartSvg(opts.series, { width: 720, height: 300 })}</div>

  <div style="border:1px solid #cbd5e1;padding:2.5mm 3mm">
    <p style="font-size:8.5pt;font-weight:600;margin-bottom:1mm">Keterangan</p>
    <table>${lines}</table>
  </div>

  ${signatureBlock(opts.picName, opts.kaLabName)}

  <div class="footer">
    <span>Print Date/Time: ${formatPrintTimestamp(opts.printedAt)}</span>
    <span>${esc(opts.instrumentLabel)} &mdash; ${esc(opts.paramLabel)}</span>
  </div>
</div>`;

  return documentShell(`${opts.title}`, body);
}

export { KA_LAB_NAME };

/**
 * Open `html` in a print window and hand it to the printer.
 *
 * Returns false when the browser blocked the popup — the caller shows a toast
 * rather than failing silently.
 */
export function openPrintWindow(html: string, title: string): boolean {
  const win = window.open('', '_blank', 'width=900,height=1000');
  if (!win) return false;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.document.title = title;
  // Give the layout (and any inlined SVG) a frame to settle before printing.
  win.setTimeout(() => {
    win.focus();
    win.print();
  }, 250);
  return true;
}
