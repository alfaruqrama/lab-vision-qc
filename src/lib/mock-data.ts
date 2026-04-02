import type { LotConfig, QCRecord, ParamName } from './types';
import { evaluateWestgard } from './westgard';

export const DEFAULT_LOT_CONFIG: LotConfig = {
  CA660: [
    {
      lot: 'CA-2024-001',
      exp: '2026-12-31',
      Kontrol: {
        PT: { mean: 12.5, sd: 0.3 },
        APTT: { mean: 32.0, sd: 1.5 },
        INR: { mean: 1.0, sd: 0.05 },
      },
    },
  ],
  EASYLITE: [
    {
      lot: 'EL-2024-001',
      exp: '2026-09-30',
      NORMAL: {
        Na: { mean: 140, sd: 2 },
        K: { mean: 4.0, sd: 0.2 },
        Cl: { mean: 100, sd: 2 },
      },
      HIGH: {
        Na: { mean: 155, sd: 2 },
        K: { mean: 6.5, sd: 0.3 },
        Cl: { mean: 115, sd: 2 },
      },
    },
  ],
  ONCALL: [
    {
      lot: '1790338',
      exp: '2026-05-28',
      CTRL0: { GDA: { mean: 47, sd: 7.5 } },
      CTRL1: { GDA: { mean: 134, sd: 13.5 } },
      CTRL2: { GDA: { mean: 364, sd: 36.5 } },
    },
  ],
};

function generateValue(mean: number, sd: number, bias: number = 0): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return parseFloat((mean + (z + bias) * sd).toFixed(2));
}

export function generateMockRecords(): QCRecord[] {
  const records: QCRecord[] = [];
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const analysts = ['Dewi S.', 'Rina A.', 'Budi P.', 'Sari K.'];
  const ca660Lot = DEFAULT_LOT_CONFIG.CA660[0];
  const elLot = DEFAULT_LOT_CONFIG.EASYLITE[0];
  const ocLot = DEFAULT_LOT_CONFIG.ONCALL[0];

  for (let day = 1; day <= Math.min(now.getDate(), 28); day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const analis = analysts[day % analysts.length];

    // CA-660
    const caParams: Partial<Record<ParamName, number>> = {
      PT: generateValue(ca660Lot.Kontrol.PT.mean, ca660Lot.Kontrol.PT.sd, day === 5 ? 4 : 0),
      APTT: generateValue(ca660Lot.Kontrol.APTT.mean, ca660Lot.Kontrol.APTT.sd, day === 12 ? 3 : 0),
      INR: generateValue(ca660Lot.Kontrol.INR.mean, ca660Lot.Kontrol.INR.sd),
    };
    const caStatus: Partial<Record<ParamName, any>> = {};
    for (const p of ['PT', 'APTT', 'INR'] as ParamName[]) {
      caStatus[p] = evaluateWestgard(caParams[p]!, ca660Lot.Kontrol[p as 'PT' | 'APTT' | 'INR']).status;
    }
    records.push({
      id: `mock-ca-${day}`,
      timestamp: new Date(year, month, day, 7, 30).toISOString(),
      tanggal: dateStr,
      alat: 'CA660',
      level: 'Kontrol',
      lot: ca660Lot.lot,
      params: caParams,
      status: caStatus,
      analis,
      catatan: '',
    });

    // Easylite Normal
    const elNParams: Partial<Record<ParamName, number>> = {
      Na: generateValue(elLot.NORMAL.Na.mean, elLot.NORMAL.Na.sd, day === 8 ? 3.5 : 0),
      K: generateValue(elLot.NORMAL.K.mean, elLot.NORMAL.K.sd),
      Cl: generateValue(elLot.NORMAL.Cl.mean, elLot.NORMAL.Cl.sd),
    };
    const elNStatus: Partial<Record<ParamName, any>> = {};
    for (const p of ['Na', 'K', 'Cl'] as ParamName[]) {
      elNStatus[p] = evaluateWestgard(elNParams[p]!, elLot.NORMAL[p as 'Na' | 'K' | 'Cl']).status;
    }
    records.push({
      id: `mock-eln-${day}`,
      timestamp: new Date(year, month, day, 7, 45).toISOString(),
      tanggal: dateStr,
      alat: 'EASYLITE',
      level: 'NORMAL',
      lot: elLot.lot,
      params: elNParams,
      status: elNStatus,
      analis,
      catatan: '',
    });

    // Easylite High (every other day)
    if (day % 2 === 0) {
      const elHParams: Partial<Record<ParamName, number>> = {
        Na: generateValue(elLot.HIGH.Na.mean, elLot.HIGH.Na.sd),
        K: generateValue(elLot.HIGH.K.mean, elLot.HIGH.K.sd, day === 10 ? -3 : 0),
        Cl: generateValue(elLot.HIGH.Cl.mean, elLot.HIGH.Cl.sd),
      };
      const elHStatus: Partial<Record<ParamName, any>> = {};
      for (const p of ['Na', 'K', 'Cl'] as ParamName[]) {
        elHStatus[p] = evaluateWestgard(elHParams[p]!, elLot.HIGH[p as 'Na' | 'K' | 'Cl']).status;
      }
      records.push({
        id: `mock-elh-${day}`,
        timestamp: new Date(year, month, day, 8, 0).toISOString(),
        tanggal: dateStr,
        alat: 'EASYLITE',
        level: 'HIGH',
        lot: elLot.lot,
        params: elHParams,
        status: elHStatus,
        analis,
        catatan: '',
      });
    }

    // On Call Sure - CTRL1 daily
    const ocCtrl1: Partial<Record<ParamName, number>> = {
      GDA: generateValue(ocLot.CTRL1.GDA.mean, ocLot.CTRL1.GDA.sd, day === 15 ? 3 : 0),
    };
    const ocCtrl1Status: Partial<Record<ParamName, any>> = {};
    ocCtrl1Status.GDA = evaluateWestgard(ocCtrl1.GDA!, ocLot.CTRL1.GDA).status;
    records.push({
      id: `mock-oc1-${day}`,
      timestamp: new Date(year, month, day, 8, 15).toISOString(),
      tanggal: dateStr,
      alat: 'ONCALL',
      level: 'CTRL1',
      lot: ocLot.lot,
      params: ocCtrl1,
      status: ocCtrl1Status,
      analis,
      catatan: '',
    });

    // On Call Sure - CTRL2 every 3 days
    if (day % 3 === 0) {
      const ocCtrl2: Partial<Record<ParamName, number>> = {
        GDA: generateValue(ocLot.CTRL2.GDA.mean, ocLot.CTRL2.GDA.sd),
      };
      const ocCtrl2Status: Partial<Record<ParamName, any>> = {};
      ocCtrl2Status.GDA = evaluateWestgard(ocCtrl2.GDA!, ocLot.CTRL2.GDA).status;
      records.push({
        id: `mock-oc2-${day}`,
        timestamp: new Date(year, month, day, 8, 30).toISOString(),
        tanggal: dateStr,
        alat: 'ONCALL',
        level: 'CTRL2',
        lot: ocLot.lot,
        params: ocCtrl2,
        status: ocCtrl2Status,
        analis,
        catatan: '',
      });
    }
  }

  return records;
}
