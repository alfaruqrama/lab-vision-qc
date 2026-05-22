import type { ControlLevel, LotConfig, InstrumentType } from './types';

export type ExpiryStatus = 'expired' | 'expiring-soon' | 'ok' | 'unknown';

export interface LotExpiryInfo {
  instrument: InstrumentType;
  lotNumber: string;
  expDate: string;
  status: ExpiryStatus;
  daysRemaining: number;
  level?: ControlLevel;
}

const EXPIRY_WARNING_DAYS = 7;
const INSTRUMENTS: InstrumentType[] = ['CA660', 'EASYLITE', 'ONCALL1', 'ONCALL2'];

export function checkLotExpiry(expDate: string): { status: ExpiryStatus; daysRemaining: number } {
  if (!expDate || expDate.trim() === '') {
    return { status: 'unknown', daysRemaining: 0 };
  }

  const exp = new Date(expDate);
  if (isNaN(exp.getTime())) {
    return { status: 'unknown', daysRemaining: 0 };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  exp.setHours(0, 0, 0, 0);

  const diffMs = exp.getTime() - today.getTime();
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  let status: ExpiryStatus;
  if (daysRemaining < 0) {
    status = 'expired';
  } else if (daysRemaining <= EXPIRY_WARNING_DAYS) {
    status = 'expiring-soon';
  } else {
    status = 'ok';
  }

  return { status, daysRemaining };
}

export function formatExpiryMessage(daysRemaining: number): string {
  if (daysRemaining < 0) {
    const days = Math.abs(daysRemaining);
    return `Expired ${days} hari lalu`;
  }
  if (daysRemaining === 0) return 'Expired hari ini';
  if (daysRemaining === 1) return 'Expired besok';
  return `${daysRemaining} hari lagi`;
}

export function getAllLotExpiryInfo(config: LotConfig): LotExpiryInfo[] {
  const results: LotExpiryInfo[] = [];

  INSTRUMENTS.forEach((instrument) => {
    if (instrument === 'EASYLITE') {
      (['NORMAL', 'HIGH'] as const).forEach((level) => {
        config.EASYLITE[level].forEach((lot) => {
          const { status, daysRemaining } = checkLotExpiry(lot.exp);
          results.push({
            instrument,
            lotNumber: lot.lot,
            expDate: lot.exp,
            status,
            daysRemaining,
            level,
          });
        });
      });
      return;
    }

    const lots = config[instrument] as Array<{ lot: string; exp: string }>;
    if (!Array.isArray(lots)) return;

    lots.forEach((lot) => {
      const { status, daysRemaining } = checkLotExpiry(lot.exp);
      results.push({
        instrument,
        lotNumber: lot.lot,
        expDate: lot.exp,
        status,
        daysRemaining,
      });
    });
  });

  return results;
}

/**
 * localStorage key for banner dismissal.
 * Stores a hash of the config so banner reappears when config changes.
 * Recommendation: prefix `qc:` to namespace app keys.
 */
export const LOT_EXPIRY_BANNER_KEY = 'qc:lot-expiry-dismissed';

export function getLotConfigHash(config: LotConfig): string {
  return JSON.stringify(
    INSTRUMENTS.map((inst) => {
      if (inst === 'EASYLITE') {
        return (['NORMAL', 'HIGH'] as const)
          .map((level) => config.EASYLITE[level].map((l) => `${level}|${l.lot}|${l.exp}`).join(','))
          .join(',');
      }
      const lots = config[inst] as Array<{ lot: string; exp: string }>;
      return lots.map((l) => `${l.lot}|${l.exp}`).join(',');
    }),
  );
}
