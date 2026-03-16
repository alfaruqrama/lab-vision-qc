export type InstrumentType = 'CA660' | 'EASYLITE';

export type ControlLevel = 'Kontrol' | 'NORMAL' | 'HIGH';

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

export interface LotConfig {
  CA660: CA660LotConfig[];
  EASYLITE: EasyliteLotConfig[];
}

export type ParamName = 'PT' | 'APTT' | 'INR' | 'Na' | 'K' | 'Cl';

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

export const PARAM_UNITS: Record<ParamName, string> = {
  PT: 'detik',
  APTT: 'detik',
  INR: 'rasio',
  Na: 'mmol/L',
  K: 'mmol/L',
  Cl: 'mmol/L',
};

export function getParamsForInstrument(alat: InstrumentType): ParamName[] {
  return alat === 'CA660' ? CA660_PARAMS : EASYLITE_PARAMS;
}
