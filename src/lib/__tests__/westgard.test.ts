import { describe, it, expect } from 'vitest';
import {
  evaluateWestgard,
  evaluateR4s,
  getStatusLabel,
  getOverallStatus,
} from '../westgard';
import type { ParamConfig, WestgardStatus } from '../types';

describe('Westgard Rules', () => {
  const mockConfig: ParamConfig = {
    mean: 100,
    sd: 5,
  };

  describe('evaluateWestgard', () => {
    describe('1-3s Rule (Out of Control)', () => {
      it('should flag values > 3 SD above mean as oos', () => {
        const result = evaluateWestgard(116, mockConfig); // 3.2 SD
        expect(result.status).toBe('oos');
        expect(result.rules).toContain('1-3s');
        expect(result.zScore).toBeCloseTo(3.2, 1);
      });

      it('should flag values > 3 SD below mean as oos', () => {
        const result = evaluateWestgard(84, mockConfig); // -3.2 SD
        expect(result.status).toBe('oos');
        expect(result.rules).toContain('1-3s');
        expect(result.zScore).toBeCloseTo(-3.2, 1);
      });

      it('should flag exactly 3.01 SD as oos', () => {
        const result = evaluateWestgard(115.05, mockConfig);
        expect(result.status).toBe('oos');
      });
    });

    describe('1-2s Rule (Warning)', () => {
      it('should flag values between 2-3 SD above mean as warning', () => {
        const result = evaluateWestgard(112, mockConfig); // 2.4 SD
        expect(result.status).toBe('warning');
        expect(result.rules).toContain('1-2s');
        expect(result.zScore).toBeCloseTo(2.4, 1);
      });

      it('should flag values between 2-3 SD below mean as warning', () => {
        const result = evaluateWestgard(88, mockConfig); // -2.4 SD
        expect(result.status).toBe('warning');
        expect(result.rules).toContain('1-2s');
        expect(result.zScore).toBeCloseTo(-2.4, 1);
      });

      it('should flag exactly 2.01 SD as warning', () => {
        const result = evaluateWestgard(110.05, mockConfig);
        expect(result.status).toBe('warning');
      });

      it('should flag exactly 2.99 SD as warning', () => {
        const result = evaluateWestgard(114.95, mockConfig);
        expect(result.status).toBe('warning');
      });
    });

    describe('In Control (OK)', () => {
      it('should mark values within 2 SD as ok', () => {
        const result = evaluateWestgard(105, mockConfig); // 1 SD
        expect(result.status).toBe('ok');
        expect(result.rules).toHaveLength(0);
        expect(result.zScore).toBeCloseTo(1, 1);
      });

      it('should mark mean value as ok', () => {
        const result = evaluateWestgard(100, mockConfig); // 0 SD
        expect(result.status).toBe('ok');
        expect(result.zScore).toBe(0);
      });

      it('should mark exactly 2 SD as ok', () => {
        const result = evaluateWestgard(110, mockConfig); // exactly 2 SD
        expect(result.status).toBe('ok');
      });

      it('should mark 1.99 SD as ok', () => {
        const result = evaluateWestgard(109.95, mockConfig);
        expect(result.status).toBe('ok');
      });
    });

    describe('Edge Cases', () => {
      it('should handle zero SD gracefully', () => {
        const zeroSdConfig: ParamConfig = { mean: 100, sd: 0 };
        const result = evaluateWestgard(100, zeroSdConfig);
        expect(result.status).toBe('ok');
        expect(result.zScore).toBe(0);
        expect(result.rules).toHaveLength(0);
      });

      it('should handle very small SD', () => {
        const smallSdConfig: ParamConfig = { mean: 100, sd: 0.1 };
        const result = evaluateWestgard(100.5, smallSdConfig); // 5 SD
        expect(result.status).toBe('oos');
      });

      it('should handle very large SD', () => {
        const largeSdConfig: ParamConfig = { mean: 100, sd: 50 };
        const result = evaluateWestgard(200, largeSdConfig); // 2 SD
        expect(result.status).toBe('ok');
      });

      it('should handle negative mean', () => {
        const negMeanConfig: ParamConfig = { mean: -100, sd: 5 };
        const result = evaluateWestgard(-116, negMeanConfig); // -3.2 SD
        expect(result.status).toBe('oos');
      });

      it('should handle decimal values', () => {
        const decimalConfig: ParamConfig = { mean: 1.5, sd: 0.1 };
        const result = evaluateWestgard(1.82, decimalConfig); // 3.2 SD
        expect(result.status).toBe('oos');
      });
    });

    describe('Z-Score Calculation', () => {
      it('should calculate positive z-score correctly', () => {
        const result = evaluateWestgard(110, mockConfig);
        expect(result.zScore).toBe(2);
      });

      it('should calculate negative z-score correctly', () => {
        const result = evaluateWestgard(90, mockConfig);
        expect(result.zScore).toBe(-2);
      });

      it('should calculate fractional z-score correctly', () => {
        const result = evaluateWestgard(107.5, mockConfig);
        expect(result.zScore).toBe(1.5);
      });
    });
  });

  describe('evaluateR4s (Range Rule)', () => {
    const config1: ParamConfig = { mean: 100, sd: 5 };
    const config2: ParamConfig = { mean: 200, sd: 10 };

    it('should detect R-4s violation when range >= 4 SD', () => {
      // value1 at +2 SD, value2 at -2 SD = 4 SD range
      const result = evaluateR4s(110, config1, 180, config2);
      expect(result).toBe(true);
    });

    it('should not flag when range < 4 SD', () => {
      // value1 at +1 SD, value2 at -1 SD = 2 SD range
      const result = evaluateR4s(105, config1, 190, config2);
      expect(result).toBe(false);
    });

    it('should handle same parameter different runs', () => {
      const result = evaluateR4s(120, config1, 80, config1); // 8 SD range
      expect(result).toBe(true);
    });

    it('should handle exactly 4 SD range', () => {
      const result = evaluateR4s(110, config1, 180, config2);
      expect(result).toBe(true);
    });

    it('should handle 3.99 SD range', () => {
      const result = evaluateR4s(109.95, config1, 180.05, config2);
      expect(result).toBe(false);
    });
  });

  describe('getStatusLabel', () => {
    it('should return correct label for ok status', () => {
      expect(getStatusLabel('ok')).toBe('OK');
    });

    it('should return correct label for warning status', () => {
      expect(getStatusLabel('warning')).toBe('Peringatan');
    });

    it('should return correct label for oos status', () => {
      expect(getStatusLabel('oos')).toBe('Diluar Kendali');
    });
  });

  describe('getOverallStatus', () => {
    it('should return oos if any status is oos', () => {
      const statuses: WestgardStatus[] = ['ok', 'warning', 'oos'];
      expect(getOverallStatus(statuses)).toBe('oos');
    });

    it('should return warning if any status is warning and none are oos', () => {
      const statuses: WestgardStatus[] = ['ok', 'warning', 'ok'];
      expect(getOverallStatus(statuses)).toBe('warning');
    });

    it('should return ok if all statuses are ok', () => {
      const statuses: WestgardStatus[] = ['ok', 'ok', 'ok'];
      expect(getOverallStatus(statuses)).toBe('ok');
    });

    it('should handle single status', () => {
      expect(getOverallStatus(['ok'])).toBe('ok');
      expect(getOverallStatus(['warning'])).toBe('warning');
      expect(getOverallStatus(['oos'])).toBe('oos');
    });

    it('should handle empty array', () => {
      expect(getOverallStatus([])).toBe('ok');
    });

    it('should prioritize oos over warning', () => {
      const statuses: WestgardStatus[] = ['warning', 'oos', 'warning'];
      expect(getOverallStatus(statuses)).toBe('oos');
    });
  });

  describe('Real-world QC Scenarios', () => {
    describe('PT (Prothrombin Time)', () => {
      const ptConfig: ParamConfig = { mean: 12.5, sd: 0.5 };

      it('should accept normal PT value', () => {
        const result = evaluateWestgard(12.3, ptConfig);
        expect(result.status).toBe('ok');
      });

      it('should warn on borderline PT', () => {
        const result = evaluateWestgard(13.7, ptConfig); // 2.4 SD
        expect(result.status).toBe('warning');
      });

      it('should flag critically high PT', () => {
        const result = evaluateWestgard(14.1, ptConfig); // 3.2 SD
        expect(result.status).toBe('oos');
      });
    });

    describe('Na (Sodium)', () => {
      const naConfig: ParamConfig = { mean: 140, sd: 2 };

      it('should accept normal Na value', () => {
        const result = evaluateWestgard(141, naConfig);
        expect(result.status).toBe('ok');
      });

      it('should warn on borderline Na', () => {
        const result = evaluateWestgard(145, naConfig); // 2.5 SD
        expect(result.status).toBe('warning');
      });

      it('should flag critically low Na', () => {
        const result = evaluateWestgard(133, naConfig); // -3.5 SD
        expect(result.status).toBe('oos');
      });
    });

    describe('GDA (Glucose)', () => {
      const gdaConfig: ParamConfig = { mean: 100, sd: 10 };

      it('should accept normal glucose', () => {
        const result = evaluateWestgard(105, gdaConfig);
        expect(result.status).toBe('ok');
      });

      it('should warn on elevated glucose', () => {
        const result = evaluateWestgard(125, gdaConfig); // 2.5 SD
        expect(result.status).toBe('warning');
      });

      it('should flag critically high glucose', () => {
        const result = evaluateWestgard(135, gdaConfig); // 3.5 SD
        expect(result.status).toBe('oos');
      });
    });
  });
});
