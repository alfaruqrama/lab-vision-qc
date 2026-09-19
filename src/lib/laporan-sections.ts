/**
 * Dynamic section system untuk Laporan Kunjungan (LaporanTab).
 *
 * Menyediakan:
 * - Type definitions: CustomFieldDef, CustomSectionDef, LaporanLayout
 * - DEFAULT_LAYOUT: layout bawaan 7 section existing (A–G)
 * - parseLaporanLayout(): parse dari module_config.extra → LaporanLayout
 * - buildExtraFromLayout(): serialisasi LaporanLayout → object untuk kolom extra
 */

// ── Types ──────────────────────────────────────────────

export interface CustomFieldDef {
  id: string;       // unique within section, e.g. "f1", "f2"
  label: string;    // display label
  type: 'number' | 'text';
}

export interface CustomSectionDef {
  id: string;               // e.g. "custom-abc123"
  label: string;            // display label
  fields: CustomFieldDef[];
}

export interface LaporanLayout {
  /** Urutan tampil section (existing + custom) */
  sectionOrder: string[];
  /** Override label per section key */
  sectionLabels: Record<string, string>;
  /** Daftar section key yang di-hide */
  sectionHidden: string[];
  /** Definisi section custom (hanya yang ditambah dev) */
  customSections: CustomSectionDef[];
}

// ── Default Layout ─────────────────────────────────────

/** Section existing: key, default label, huruf abjad */
export const EXISTING_SECTIONS = [
  { key: 'a', label: 'Tanggal', letter: 'A' },
  { key: 'b', label: 'Kunjungan', letter: 'B' },
  { key: 'c', label: 'Pasien PG', letter: 'C' },
  { key: 'd', label: 'Promo Lab', letter: 'D' },
  { key: 'e', label: 'Pasien AS Morula', letter: 'E' },
  { key: 'f', label: 'Capaian Harian', letter: 'F' },
  { key: 'g', label: 'Kumulatif Bulan', letter: 'G' },
] as const;

export type ExistingSectionKey = typeof EXISTING_SECTIONS[number]['key'];

export const DEFAULT_LAYOUT: LaporanLayout = {
  sectionOrder: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  sectionLabels: Object.fromEntries(EXISTING_SECTIONS.map(s => [s.key, s.label])),
  sectionHidden: [],
  customSections: [],
};

// ── Helpers ────────────────────────────────────────────

const LAPORAN_CONFIG_KEY = '/kunjungan/laporan';

/**
 * Parse raw `extra` jsonb dari module_config row (key = /kunjungan/laporan)
 * menjadi LaporanLayout. Jika extra null/undefined, kembalikan DEFAULT_LAYOUT.
 */
export function parseLaporanLayout(extra: unknown): LaporanLayout {
  if (!extra || typeof extra !== 'object') return { ...DEFAULT_LAYOUT };
  const o = extra as Record<string, unknown>;

  // Validasi minimal: sectionOrder harus array
  const sectionOrder = Array.isArray(o.sectionOrder)
    ? o.sectionOrder.map(String)
    : DEFAULT_LAYOUT.sectionOrder;

  const sectionLabels = (typeof o.sectionLabels === 'object' && o.sectionLabels !== null)
    ? (o.sectionLabels as Record<string, string>)
    : { ...DEFAULT_LAYOUT.sectionLabels };

  const sectionHidden = Array.isArray(o.sectionHidden)
    ? o.sectionHidden.map(String)
    : [];

  // Parse customSections dengan validasi
  let customSections: CustomSectionDef[] = [];
  if (Array.isArray(o.customSections)) {
    customSections = (o.customSections as unknown[]).map((cs: unknown, idx: number) => {
      if (!cs || typeof cs !== 'object') return null;
      const c = cs as Record<string, unknown>;
      const id = String(c.id ?? `custom-${Date.now()}-${idx}`);
      const label = String(c.label ?? `Section ${String.fromCharCode(72 + idx)}`);
      const fields: CustomFieldDef[] = Array.isArray(c.fields)
        ? (c.fields as unknown[]).map((f: unknown, fIdx: number) => {
            if (!f || typeof f !== 'object') return null;
            const fld = f as Record<string, unknown>;
            return {
              id: String(fld.id ?? `f${fIdx + 1}`),
              label: String(fld.label ?? `Field ${fIdx + 1}`),
              type: (fld.type === 'text' ? 'text' : 'number') as 'number' | 'text',
            };
          }).filter(Boolean) as CustomFieldDef[]
        : [];
      return { id, label, fields } as CustomSectionDef;
    }).filter(Boolean) as CustomSectionDef[];
  }

  return { sectionOrder, sectionLabels, sectionHidden, customSections };
}

/**
 * Serialisasi LaporanLayout → plain object siap simpan ke kolom `extra`.
 */
export function buildExtraFromLayout(layout: LaporanLayout): Record<string, unknown> {
  return {
    sectionOrder: layout.sectionOrder,
    sectionLabels: layout.sectionLabels,
    sectionHidden: layout.sectionHidden,
    customSections: layout.customSections,
  };
}

/** Key yang dipakai di tabel module_config untuk menyimpan config laporan */
export const LAPORAN_EXTRA_KEY = LAPORAN_CONFIG_KEY;

/** Generate ID unik untuk section custom baru */
export function generateCustomSectionId(): string {
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Generate ID unik untuk field dalam section custom */
export function generateCustomFieldId(): string {
  return `f${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
}
