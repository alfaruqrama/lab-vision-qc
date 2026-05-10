import { GeminiResponse, QCData, InstrumentType, LevelType } from './types.ts';

const VALID_INSTRUMENTS: InstrumentType[] = ['CA660', 'EASYLITE', 'ONCALL1', 'ONCALL2'];
const VALID_LEVELS: LevelType[] = ['Kontrol', 'NORMAL', 'HIGH', 'CTRL0', 'CTRL1', 'CTRL2'];
const VALID_PARAMS = ['PT', 'APTT', 'INR', 'Na', 'K', 'Cl', 'GDA'];

export function parseGeminiResponse(geminiResponse: GeminiResponse): {
  success: boolean;
  data?: QCData;
  error?: string;
  tokensUsed?: number;
} {
  try {
    // Extract text from response
    const text = geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('No text content in Gemini response');
    }

    // Extract JSON (handle markdown code blocks)
    let jsonText = text.trim();
    const jsonMatch = text.match(/```json\s*\n([\s\S]*?)\n```/) || text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[1] || jsonMatch[0];
    }

    // Parse JSON
    const data = JSON.parse(jsonText) as QCData;

    // Validate required fields
    if (!data.tanggal) {
      throw new Error('Missing required field: tanggal');
    }
    if (!data.alat) {
      throw new Error('Missing required field: alat');
    }
    if (!data.level) {
      throw new Error('Missing required field: level');
    }
    if (!data.lot) {
      throw new Error('Missing required field: lot');
    }
    if (!data.params || Object.keys(data.params).length === 0) {
      throw new Error('Missing required field: params (must have at least 1 parameter)');
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(data.tanggal)) {
      throw new Error(`Invalid date format: ${data.tanggal} (expected YYYY-MM-DD)`);
    }

    // Validate date is valid
    const dateObj = new Date(data.tanggal);
    if (isNaN(dateObj.getTime())) {
      throw new Error(`Invalid date: ${data.tanggal}`);
    }

    // Validate instrument enum
    if (!VALID_INSTRUMENTS.includes(data.alat)) {
      throw new Error(`Invalid alat: ${data.alat} (must be one of: ${VALID_INSTRUMENTS.join(', ')})`);
    }

    // Validate level enum
    if (!VALID_LEVELS.includes(data.level)) {
      throw new Error(`Invalid level: ${data.level} (must be one of: ${VALID_LEVELS.join(', ')})`);
    }

    // Validate params (only allow known parameters)
    for (const key of Object.keys(data.params)) {
      if (!VALID_PARAMS.includes(key)) {
        throw new Error(`Invalid parameter: ${key} (must be one of: ${VALID_PARAMS.join(', ')})`);
      }
      const value = data.params[key as keyof typeof data.params];
      if (typeof value !== 'number' || isNaN(value)) {
        throw new Error(`Invalid parameter value for ${key}: ${value} (must be a number)`);
      }
    }

    // Extract token usage
    const tokensUsed = geminiResponse.usageMetadata?.totalTokenCount;

    return {
      success: true,
      data,
      tokensUsed
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse Gemini response'
    };
  }
}
