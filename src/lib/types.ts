export type InstrumentType = 'CA660' | 'EASYLITE' | 'ONCALL1' | 'ONCALL2' | 'CLEVER1' | 'CLEVER2';

export type ControlLevel = 'Kontrol' | 'NORMAL' | 'HIGH' | 'CTRL0' | 'CTRL1' | 'CTRL2';

export type WestgardStatus = 'ok' | 'warning' | 'oos';

export interface ParamConfig {
  mean: number;
  sd: number;
}

export interface CA660LotConfig {
  lot: string;
  exp: string;
  sdSource?: 'manufacturer' | 'lab';
  rangeMultiplier?: number;
  Kontrol: {
    PT: ParamConfig;
    APTT: ParamConfig;
    INR: ParamConfig;
  };
}

export interface EasyliteLotConfig {
  lot: string;
  exp: string;
  sdSource?: 'manufacturer' | 'lab';
  rangeMultiplier?: number;
  params: {
    Na: ParamConfig;
    K: ParamConfig;
    Cl: ParamConfig;
  };
}

export interface LegacyEasyliteLotConfig {
  lot: string;
  exp: string;
  sdSource?: 'manufacturer' | 'lab';
  rangeMultiplier?: number;
  NORMAL: {
    Na: ParamConfig;
    K: ParamConfig;
    Cl: ParamConfig;
  };
  HIGH: {
    Na: ParamConfig;
    K: ParamConfig;
    Cl: ParamConfig;
  };
}

export interface OnCallLotConfig {
  lot: string;
  exp: string;
  sdSource?: 'manufacturer' | 'lab';
  rangeMultiplier?: number;
  CTRL0: { GDA: ParamConfig };
  CTRL1: { GDA: ParamConfig };
  CTRL2: { GDA: ParamConfig };
}

export interface CleverLotConfig {
  lot: string;
  exp: string;
  sdSource?: 'manufacturer' | 'lab';
  rangeMultiplier?: number;
  Kontrol: {
    GDA: ParamConfig;
  };
}

export interface LotConfig {
  CA660: CA660LotConfig[];
  EASYLITE: {
    NORMAL: EasyliteLotConfig[];
    HIGH: EasyliteLotConfig[];
  };
  ONCALL1: OnCallLotConfig[];
  ONCALL2: OnCallLotConfig[];
  CLEVER1: CleverLotConfig[];
  CLEVER2: CleverLotConfig[];
}

export type ParamName = 'PT' | 'APTT' | 'INR' | 'Na' | 'K' | 'Cl' | 'GDA';

export interface QCRecord {
  id: string;
  timestamp: string;
  tanggal: string;
  alat: InstrumentType;
  level: ControlLevel;
  lot: string;
  params: Partial<Record<ParamName, number>>;
  status: Partial<Record<ParamName, WestgardStatus>>;
  overall_status?: WestgardStatus;
  analis: string;
  catatan: string;
  excluded?: boolean;
}

export const CA660_PARAMS: ParamName[] = ['PT', 'APTT', 'INR'];
export const EASYLITE_PARAMS: ParamName[] = ['Na', 'K', 'Cl'];
export const ONCALL1_PARAMS: ParamName[] = ['GDA'];
export const ONCALL2_PARAMS: ParamName[] = ['GDA'];
export const CLEVER1_PARAMS: ParamName[] = ['GDA'];
export const CLEVER2_PARAMS: ParamName[] = ['GDA'];

/** Display labels for the instrument dropdowns (identifiers stay unchanged). */
export const INSTRUMENTS: { value: InstrumentType; label: string }[] = [
  { value: 'CA660', label: 'CA-660' },
  { value: 'EASYLITE', label: 'Easylite' },
  { value: 'ONCALL1', label: 'ONCALL 1' },
  { value: 'ONCALL2', label: 'ONCALL 2' },
  { value: 'CLEVER1', label: 'CLEVER 1' },
  { value: 'CLEVER2', label: 'CLEVER 2' },
];

/**
 * Every instrument, in display order — derived from `INSTRUMENTS` so a new
 * analyser only has to be added in one place.
 */
export const ALL_INSTRUMENTS: InstrumentType[] = INSTRUMENTS.map((i) => i.value);

/**
 * Control levels each instrument actually records.
 *
 * CA-660 and CLEVER store a single flat run under the level `Kontrol`; ONCALL
 * stores three separate controls; EASYLITE stores its two pack levels. Using
 * CTRL0/1/2 for CA-660 (as the L-J page once did) matches no record at all and
 * the chart comes out empty.
 */
export function levelsForInstrument(alat: InstrumentType): ControlLevel[] {
  if (alat === 'EASYLITE') return ['NORMAL', 'HIGH'];
  if (alat === 'ONCALL1' || alat === 'ONCALL2') return ['CTRL0', 'CTRL1', 'CTRL2'];
  return ['Kontrol'];
}

/** Display label for a control level (the stored identifier never changes). */
export const LEVEL_LABELS: Record<ControlLevel, string> = {
  Kontrol: 'Kontrol',
  NORMAL: 'Normal',
  HIGH: 'High',
  CTRL0: 'CTRL 0',
  CTRL1: 'CTRL 1',
  CTRL2: 'CTRL 2',
};

export function levelLabel(level: ControlLevel | string): string {
  return LEVEL_LABELS[level as ControlLevel] ?? level;
}

export const PARAM_UNITS: Record<ParamName, string> = {
  PT: 'detik',
  APTT: 'detik',
  INR: 'rasio',
  Na: 'mmol/L',
  K: 'mmol/L',
  Cl: 'mmol/L',
  GDA: 'mg/dL',
};

export function getParamsForInstrument(alat: InstrumentType): ParamName[] {
  if (alat === 'CA660') return CA660_PARAMS;
  if (alat === 'ONCALL1') return ONCALL1_PARAMS;
  if (alat === 'ONCALL2') return ONCALL2_PARAMS;
  if (alat === 'CLEVER1') return CLEVER1_PARAMS;
  if (alat === 'CLEVER2') return CLEVER2_PARAMS;
  return EASYLITE_PARAMS;
}

export function getEasyliteLots(
  config: LotConfig,
  level: ControlLevel,
): EasyliteLotConfig[] {
  if (level === 'HIGH') return config.EASYLITE.HIGH;
  return config.EASYLITE.NORMAL;
}

/**
 * A configuration with no lots at all.
 *
 * Used when the database has no saved configuration (or nobody is signed in):
 * every instrument shows an empty list and the configuration page invites the
 * operator to add a real lot. It must never carry demo lots — a fabricated lot
 * that reaches the input form records runs against a target the lab never set
 * (see finding 4.7 in docs/WESTGARD_RULES.md).
 */
export function emptyLotConfig(): LotConfig {
  return {
    CA660: [],
    EASYLITE: { NORMAL: [], HIGH: [] },
    ONCALL1: [],
    ONCALL2: [],
    CLEVER1: [],
    CLEVER2: [],
  };
}
