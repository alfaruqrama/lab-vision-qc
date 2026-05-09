import { z } from 'zod';
import type { InstrumentType, ControlLevel, WestgardStatus, ParamName } from './types';

// ============================================
// Base Schemas
// ============================================

export const InstrumentTypeSchema = z.enum(['CA660', 'EASYLITE', 'ONCALL1', 'ONCALL2']);

export const ControlLevelSchema = z.enum(['Kontrol', 'NORMAL', 'HIGH', 'CTRL0', 'CTRL1', 'CTRL2']);

export const WestgardStatusSchema = z.enum(['ok', 'warning', 'oos']);

export const ParamNameSchema = z.enum(['PT', 'APTT', 'INR', 'Na', 'K', 'Cl', 'GDA']);

// ============================================
// Parameter Value Ranges (Clinical Boundaries)
// ============================================

// CA660 Parameters (Coagulation)
export const PTValueSchema = z.number()
  .min(5, 'PT harus ≥ 5 detik')
  .max(60, 'PT harus ≤ 60 detik')
  .finite('PT harus berupa angka valid');

export const APTTValueSchema = z.number()
  .min(15, 'APTT harus ≥ 15 detik')
  .max(120, 'APTT harus ≤ 120 detik')
  .finite('APTT harus berupa angka valid');

export const INRValueSchema = z.number()
  .min(0.5, 'INR harus ≥ 0.5')
  .max(10, 'INR harus ≤ 10')
  .finite('INR harus berupa angka valid');

// Easylite Parameters (Electrolytes)
export const NaValueSchema = z.number()
  .min(100, 'Na harus ≥ 100 mmol/L')
  .max(200, 'Na harus ≤ 200 mmol/L')
  .finite('Na harus berupa angka valid');

export const KValueSchema = z.number()
  .min(1.0, 'K harus ≥ 1.0 mmol/L')
  .max(10.0, 'K harus ≤ 10.0 mmol/L')
  .finite('K harus berupa angka valid');

export const ClValueSchema = z.number()
  .min(50, 'Cl harus ≥ 50 mmol/L')
  .max(150, 'Cl harus ≤ 150 mmol/L')
  .finite('Cl harus berupa angka valid');

// OnCall Parameters (Glucose)
export const GDAValueSchema = z.number()
  .min(20, 'GDA harus ≥ 20 mg/dL')
  .max(600, 'GDA harus ≤ 600 mg/dL')
  .finite('GDA harus berupa angka valid');

// Map parameter names to their validation schemas
export const PARAM_VALUE_SCHEMAS: Record<ParamName, z.ZodNumber> = {
  PT: PTValueSchema,
  APTT: APTTValueSchema,
  INR: INRValueSchema,
  Na: NaValueSchema,
  K: KValueSchema,
  Cl: ClValueSchema,
  GDA: GDAValueSchema,
};

// ============================================
// Lot Configuration Schemas
// ============================================

export const ParamConfigSchema = z.object({
  mean: z.number()
    .positive('Mean harus > 0')
    .finite('Mean harus berupa angka valid'),
  sd: z.number()
    .positive('SD harus > 0')
    .finite('SD harus berupa angka valid'),
}).refine(
  (data) => data.sd < data.mean,
  { message: 'SD harus lebih kecil dari Mean', path: ['sd'] }
);

export const CA660LotConfigSchema = z.object({
  lot: z.string()
    .min(1, 'Lot number tidak boleh kosong')
    .max(50, 'Lot number terlalu panjang')
    .regex(/^[A-Za-z0-9\-_]+$/, 'Lot number hanya boleh berisi huruf, angka, dash, dan underscore'),
  exp: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')
    .refine(
      (date) => new Date(date) > new Date(),
      { message: 'Tanggal expiry harus di masa depan' }
    ),
  Kontrol: z.object({
    PT: ParamConfigSchema,
    APTT: ParamConfigSchema,
    INR: ParamConfigSchema,
  }),
});

export const EasyliteLotConfigSchema = z.object({
  lot: z.string()
    .min(1, 'Lot number tidak boleh kosong')
    .max(50, 'Lot number terlalu panjang')
    .regex(/^[A-Za-z0-9\-_]+$/, 'Lot number hanya boleh berisi huruf, angka, dash, dan underscore'),
  exp: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')
    .refine(
      (date) => new Date(date) > new Date(),
      { message: 'Tanggal expiry harus di masa depan' }
    ),
  NORMAL: z.object({
    Na: ParamConfigSchema,
    K: ParamConfigSchema,
    Cl: ParamConfigSchema,
  }),
  HIGH: z.object({
    Na: ParamConfigSchema,
    K: ParamConfigSchema,
    Cl: ParamConfigSchema,
  }),
});

export const OnCallLotConfigSchema = z.object({
  lot: z.string()
    .min(1, 'Lot number tidak boleh kosong')
    .max(50, 'Lot number terlalu panjang')
    .regex(/^[A-Za-z0-9\-_]+$/, 'Lot number hanya boleh berisi huruf, angka, dash, dan underscore'),
  exp: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')
    .refine(
      (date) => new Date(date) > new Date(),
      { message: 'Tanggal expiry harus di masa depan' }
    ),
  CTRL0: z.object({ GDA: ParamConfigSchema }),
  CTRL1: z.object({ GDA: ParamConfigSchema }),
  CTRL2: z.object({ GDA: ParamConfigSchema }),
});

export const LotConfigSchema = z.object({
  CA660: z.array(CA660LotConfigSchema),
  EASYLITE: z.array(EasyliteLotConfigSchema),
  ONCALL1: z.array(OnCallLotConfigSchema),
  ONCALL2: z.array(OnCallLotConfigSchema),
});

// ============================================
// QC Record Schema
// ============================================

export const QCRecordSchema = z.object({
  id: z.string().min(1, 'ID tidak boleh kosong'),
  timestamp: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, 'Format timestamp tidak valid'),
  tanggal: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  alat: InstrumentTypeSchema,
  level: ControlLevelSchema,
  lot: z.string()
    .min(1, 'Lot number tidak boleh kosong')
    .max(50, 'Lot number terlalu panjang'),
  params: z.record(ParamNameSchema, z.number().finite()),
  status: z.record(ParamNameSchema, WestgardStatusSchema),
  analis: z.string()
    .min(1, 'Nama analis tidak boleh kosong')
    .max(100, 'Nama analis terlalu panjang')
    .regex(/^[A-Za-z\s.]+$/, 'Nama analis hanya boleh berisi huruf, spasi, dan titik'),
  catatan: z.string()
    .max(500, 'Catatan maksimal 500 karakter'),
});

// ============================================
// API Response Schemas
// ============================================

export const APISuccessResponseSchema = z.object({
  status: z.literal('ok'),
  data: z.unknown(),
});

export const APIErrorResponseSchema = z.object({
  status: z.literal('error'),
  error: z.string(),
  message: z.string().optional(),
});

export const APIResponseSchema = z.union([
  APISuccessResponseSchema,
  APIErrorResponseSchema,
]);

// ============================================
// Validation Helper Functions
// ============================================

/**
 * Validate parameter value based on instrument type and parameter name
 */
export function validateParamValue(
  paramName: ParamName,
  value: number
): { valid: boolean; error?: string } {
  const schema = PARAM_VALUE_SCHEMAS[paramName];
  const result = schema.safeParse(value);
  
  if (result.success) {
    return { valid: true };
  }
  
  return {
    valid: false,
    error: result.error.errors[0]?.message || 'Nilai tidak valid',
  };
}

/**
 * Validate QC record before submission
 */
export function validateQCRecord(record: unknown): {
  valid: boolean;
  data?: z.infer<typeof QCRecordSchema>;
  errors?: z.ZodError;
} {
  const result = QCRecordSchema.safeParse(record);
  
  if (result.success) {
    return { valid: true, data: result.data };
  }
  
  return { valid: false, errors: result.error };
}

/**
 * Validate lot configuration before saving
 */
export function validateLotConfig(
  instrument: InstrumentType,
  config: unknown
): {
  valid: boolean;
  data?: any;
  errors?: z.ZodError;
} {
  let schema: z.ZodSchema;
  
  switch (instrument) {
    case 'CA660':
      schema = CA660LotConfigSchema;
      break;
    case 'EASYLITE':
      schema = EasyliteLotConfigSchema;
      break;
    case 'ONCALL1':
    case 'ONCALL2':
      schema = OnCallLotConfigSchema;
      break;
    default:
      return { valid: false, errors: undefined };
  }
  
  const result = schema.safeParse(config);
  
  if (result.success) {
    return { valid: true, data: result.data };
  }
  
  return { valid: false, errors: result.error };
}

/**
 * Safe JSON parse with validation
 */
export function safeJSONParse<T>(
  json: string,
  schema: z.ZodSchema<T>
): { success: boolean; data?: T; error?: string } {
  try {
    const parsed = JSON.parse(json);
    const result = schema.safeParse(parsed);
    
    if (result.success) {
      return { success: true, data: result.data };
    }
    
    return {
      success: false,
      error: result.error.errors[0]?.message || 'Data tidak valid',
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'JSON tidak valid',
    };
  }
}

/**
 * Sanitize string input (basic XSS prevention)
 * For full XSS protection, use DOMPurify in components
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(errors: z.ZodError): string[] {
  return errors.errors.map((err) => {
    const path = err.path.join('.');
    return path ? `${path}: ${err.message}` : err.message;
  });
}
