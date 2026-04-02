export type InstrumentType = 'CA660' | 'EASYLITE' | 'ONCALL';

export type ControlLevel = 'Kontrol' | 'NORMAL' | 'HIGH' | 'CTRL0' | 'CTRL1' | 'CTRL2';

export type WestgardStatus = 'ok' | 'warning' | 'oos';

export interface ParamConfig {
  mean: number;
  sd: number;
}

export interface CA660LotConfig {
  lot: string;
  exp: string;
  Kontrol: {
    PT: ParamConfig;
    APTT: ParamConfig;
    INR: ParamConfig;
  };
}

export interface EasyliteLotConfig {
  lot: string;
  exp: string;
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
  CTRL0: { GDA: ParamConfig };
  CTRL1: { GDA: ParamConfig };
  CTRL2: { GDA: ParamConfig };
}

export interface LotConfig {
  CA660: CA660LotConfig[];
  EASYLITE: EasyliteLotConfig[];
  ONCALL: OnCallLotConfig[];
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
  analis: string;
  catatan: string;
}

export const CA660_PARAMS: ParamName[] = ['PT', 'APTT', 'INR'];
export const EASYLITE_PARAMS: ParamName[] = ['Na', 'K', 'Cl'];
export const ONCALL_PARAMS: ParamName[] = ['GDA'];

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
  if (alat === 'ONCALL') return ONCALL_PARAMS;
  return EASYLITE_PARAMS;
}
