
import { describe, it, expect } from 'vitest';
import { computeZScores, findActiveLot } from '../zscore';
import type { LotConfig, QCRecord } from '../types';

describe('zscore', () => {
  const mockConfig: LotConfig = {
    CA660: [{ lot: 'LOT1', exp: '2099-01-01', Kontrol: { PT: { mean: 10, sd: 1 }, APTT: { mean: 30, sd: 2 }, INR: { mean: 1, sd: 0.1 } } }],
    EASYLITE: { 
      NORMAL: [{ lot: 'N1', exp: '2099-01-01', params: { Na: { mean: 140, sd: 2 }, K: { mean: 4, sd: 0.2 }, Cl: { mean: 100, sd: 3 } } }],
      HIGH: [{ lot: 'H1', exp: '2099-01-01', params: { Na: { mean: 150, sd: 2 }, K: { mean: 5, sd: 0.2 }, Cl: { mean: 110, sd: 3 } } }]
    },
    ONCALL1: [], ONCALL2: [], CLEVER1: [], CLEVER2: []
  };

  it('should calculate correct Z-score (val - mean) / sd', () => {
    const records: QCRecord[] = [{
      id: '1', timestamp: '', tanggal: '2024-01-01', alat: 'CA660', level: 'Kontrol', lot: 'LOT1',
      params: { PT: 12 }, status: {}, analis: '', catatan: ''
    }];
    
    const results = computeZScores(records, mockConfig);
    // PT: (12 - 10) / 1 = 2
    expect(results[0].params.PT).toBe(2);
  });

  it('should handle findActiveLot priority: record lot > expiry date', () => {
    const lots = [
      { lot: 'LOT_OLD', exp: '2023-01-01' },
      { lot: 'LOT_NEW', exp: '2025-01-01' }
    ];
    
    // Record says LOT_OLD even if current date is 2024
    const lot = findActiveLot(lots, '2024-01-01', 'LOT_OLD');
    expect(lot?.lot).toBe('LOT_OLD');
  });

  it('should fallback to nearest active lot if record lot is missing', () => {
    const lots = [
      { lot: 'LOT_OLD', exp: '2023-01-01' },
      { lot: 'LOT_NEW', exp: '2025-01-01' }
    ];
    const lot = findActiveLot(lots, '2024-01-01');
    expect(lot?.lot).toBe('LOT_NEW');
  });
});
