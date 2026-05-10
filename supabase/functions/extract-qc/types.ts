// TypeScript interfaces for AI QC extraction

export interface ExtractQCRequest {
  imageBase64: string;
}

export interface ExtractQCResponse {
  success: boolean;
  data?: QCData;
  error?: string;
  remaining_scans?: number;
}

export interface QCData {
  tanggal: string;      // ISO format: YYYY-MM-DD
  alat: InstrumentType;
  level: LevelType;
  lot: string;
  params: QCParams;
}

export type InstrumentType = 'CA660' | 'EASYLITE' | 'ONCALL1' | 'ONCALL2';
export type LevelType = 'Kontrol' | 'NORMAL' | 'HIGH' | 'CTRL0' | 'CTRL1' | 'CTRL2';

export interface QCParams {
  PT?: number;
  APTT?: number;
  INR?: number;
  Na?: number;
  K?: number;
  Cl?: number;
  GDA?: number;
}

export interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}
