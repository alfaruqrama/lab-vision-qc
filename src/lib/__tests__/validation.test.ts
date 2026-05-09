import { describe, it, expect } from 'vitest';
import {
  validateParamValue,
  validateQCRecord,
  validateLotConfig,
  safeJSONParse,
  sanitizeString,
  formatValidationErrors,
  QCRecordSchema,
  CA660LotConfigSchema,
} from '../validation';

describe('Parameter Value Validation', () => {
  describe('PT (Prothrombin Time)', () => {
    it('should accept valid PT values', () => {
      expect(validateParamValue('PT', 12.5).valid).toBe(true);
      expect(validateParamValue('PT', 10).valid).toBe(true);
      expect(validateParamValue('PT', 30).valid).toBe(true);
    });

    it('should reject PT values below 5', () => {
      const result = validateParamValue('PT', 2);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('≥ 5');
    });

    it('should reject PT values above 60', () => {
      const result = validateParamValue('PT', 70);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('≤ 60');
    });

    it('should reject NaN and Infinity', () => {
      expect(validateParamValue('PT', NaN).valid).toBe(false);
      expect(validateParamValue('PT', Infinity).valid).toBe(false);
    });
  });

  describe('Na (Sodium)', () => {
    it('should accept valid Na values', () => {
      expect(validateParamValue('Na', 135).valid).toBe(true);
      expect(validateParamValue('Na', 145).valid).toBe(true);
    });

    it('should reject Na values below 100', () => {
      const result = validateParamValue('Na', 50);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('≥ 100');
    });

    it('should reject Na values above 200', () => {
      const result = validateParamValue('Na', 250);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('≤ 200');
    });
  });

  describe('GDA (Glucose)', () => {
    it('should accept valid GDA values', () => {
      expect(validateParamValue('GDA', 100).valid).toBe(true);
      expect(validateParamValue('GDA', 300).valid).toBe(true);
    });

    it('should reject GDA values below 20', () => {
      const result = validateParamValue('GDA', 10);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('≥ 20');
    });

    it('should reject GDA values above 600', () => {
      const result = validateParamValue('GDA', 700);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('≤ 600');
    });
  });
});

describe('QC Record Validation', () => {
  const validRecord = {
    id: 'qc-123',
    timestamp: '2026-05-09T10:30:00',
    tanggal: '2026-05-09',
    alat: 'CA660',
    level: 'Kontrol',
    lot: 'LOT-2024-001',
    params: { PT: 12.5, APTT: 30.2, INR: 1.1 },
    status: { PT: 'ok', APTT: 'ok', INR: 'ok' },
    analis: 'Dr. John Doe',
    catatan: 'Normal QC run',
  };

  it('should accept valid QC record', () => {
    const result = validateQCRecord(validRecord);
    expect(result.valid).toBe(true);
    expect(result.data).toBeDefined();
  });

  it('should reject record with missing required fields', () => {
    const invalidRecord = { ...validRecord, id: '' };
    const result = validateQCRecord(invalidRecord);
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject record with invalid timestamp format', () => {
    const invalidRecord = { ...validRecord, timestamp: '2026-05-09' };
    const result = validateQCRecord(invalidRecord);
    expect(result.valid).toBe(false);
  });

  it('should reject record with invalid instrument type', () => {
    const invalidRecord = { ...validRecord, alat: 'INVALID' };
    const result = validateQCRecord(invalidRecord);
    expect(result.valid).toBe(false);
  });

  it('should reject record with invalid analis name (contains numbers)', () => {
    const invalidRecord = { ...validRecord, analis: 'Dr. John123' };
    const result = validateQCRecord(invalidRecord);
    expect(result.valid).toBe(false);
  });

  it('should reject record with catatan exceeding 500 characters', () => {
    const invalidRecord = { ...validRecord, catatan: 'a'.repeat(501) };
    const result = validateQCRecord(invalidRecord);
    expect(result.valid).toBe(false);
  });
});

describe('Lot Configuration Validation', () => {
  const validCA660Config = {
    lot: 'LOT-2024-001',
    exp: '2027-12-31',
    Kontrol: {
      PT: { mean: 12.5, sd: 0.5 },
      APTT: { mean: 30.0, sd: 1.5 },
      INR: { mean: 1.0, sd: 0.1 },
    },
  };

  it('should accept valid CA660 lot config', () => {
    const result = validateLotConfig('CA660', validCA660Config);
    expect(result.valid).toBe(true);
    expect(result.data).toBeDefined();
  });

  it('should reject lot config with zero SD', () => {
    const invalidConfig = {
      ...validCA660Config,
      Kontrol: {
        ...validCA660Config.Kontrol,
        PT: { mean: 12.5, sd: 0 },
      },
    };
    const result = validateLotConfig('CA660', invalidConfig);
    expect(result.valid).toBe(false);
  });

  it('should reject lot config with negative mean', () => {
    const invalidConfig = {
      ...validCA660Config,
      Kontrol: {
        ...validCA660Config.Kontrol,
        PT: { mean: -12.5, sd: 0.5 },
      },
    };
    const result = validateLotConfig('CA660', invalidConfig);
    expect(result.valid).toBe(false);
  });

  it('should reject lot config with SD >= mean', () => {
    const invalidConfig = {
      ...validCA660Config,
      Kontrol: {
        ...validCA660Config.Kontrol,
        PT: { mean: 12.5, sd: 15.0 },
      },
    };
    const result = validateLotConfig('CA660', invalidConfig);
    expect(result.valid).toBe(false);
  });

  it('should reject lot config with past expiry date', () => {
    const invalidConfig = {
      ...validCA660Config,
      exp: '2020-01-01',
    };
    const result = validateLotConfig('CA660', invalidConfig);
    expect(result.valid).toBe(false);
  });

  it('should reject lot config with invalid lot number format', () => {
    const invalidConfig = {
      ...validCA660Config,
      lot: 'LOT@2024#001',
    };
    const result = validateLotConfig('CA660', invalidConfig);
    expect(result.valid).toBe(false);
  });
});

describe('Safe JSON Parse', () => {
  it('should parse valid JSON with schema validation', () => {
    const json = JSON.stringify({ mean: 12.5, sd: 0.5 });
    const result = safeJSONParse(json, CA660LotConfigSchema.shape.Kontrol.shape.PT);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ mean: 12.5, sd: 0.5 });
  });

  it('should reject invalid JSON syntax', () => {
    const json = '{ invalid json }';
    const result = safeJSONParse(json, CA660LotConfigSchema);
    expect(result.success).toBe(false);
    expect(result.error).toContain('JSON');
  });

  it('should reject valid JSON that fails schema validation', () => {
    const json = JSON.stringify({ mean: -12.5, sd: 0.5 });
    const result = safeJSONParse(json, CA660LotConfigSchema.shape.Kontrol.shape.PT);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe('String Sanitization', () => {
  it('should remove HTML tags', () => {
    expect(sanitizeString('<script>alert("xss")</script>')).toBe('scriptalert("xss")/script');
    expect(sanitizeString('Hello <b>World</b>')).toBe('Hello bWorld/b');
  });

  it('should remove javascript: protocol', () => {
    expect(sanitizeString('javascript:alert(1)')).toBe('alert(1)');
    expect(sanitizeString('JAVASCRIPT:alert(1)')).toBe('alert(1)');
  });

  it('should remove event handlers', () => {
    expect(sanitizeString('onclick=alert(1)')).toBe('alert(1)');
    expect(sanitizeString('onload=malicious()')).toBe('malicious()');
  });

  it('should trim whitespace', () => {
    expect(sanitizeString('  hello  ')).toBe('hello');
  });

  it('should preserve safe strings', () => {
    expect(sanitizeString('Dr. John Doe')).toBe('Dr. John Doe');
    expect(sanitizeString('LOT-2024-001')).toBe('LOT-2024-001');
  });
});

describe('Format Validation Errors', () => {
  it('should format Zod errors into readable messages', () => {
    const result = QCRecordSchema.safeParse({
      id: '',
      timestamp: 'invalid',
      tanggal: 'invalid',
      alat: 'INVALID',
      level: 'Kontrol',
      lot: 'LOT-001',
      params: {},
      status: {},
      analis: '',
      catatan: '',
    });

    if (!result.success) {
      const errors = formatValidationErrors(result.error);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.includes('id'))).toBe(true);
      expect(errors.some(e => e.includes('timestamp'))).toBe(true);
    }
  });
});
