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

    // Extract JSON (handle markdown code blocks and extra text)
    let jsonText = text.trim();
    
    // Try to extract from markdown code block first
    const codeBlockMatch = text.match(/```(?:json|\w*)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1].trim();
    }
    
    // Use balanced brace counter to find the real JSON object boundary.
    // Solves: nested params {}, trailing text, markdown fragments on extra lines
    const firstBrace = jsonText.indexOf('{');
    if (firstBrace === -1) {
      throw new Error('No JSON object found in Gemini response');
    }
    
    let braceCount = 0;
    let endPos = -1;
    for (let i = firstBrace; i < jsonText.length; i++) {
      if (jsonText[i] === '{') braceCount++;
      else if (jsonText[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
          endPos = i + 1;
          break;
        }
      }
    }
    
    if (endPos === -1) {
      throw new Error('Unbalanced braces in Gemini response');
    }
    
    jsonText = jsonText.substring(firstBrace, endPos);

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
    // For EASYLITE dual-level: params may be sparse; NORMAL/HIGH carry the real data
    const hasDualLevel = data.alat === 'EASYLITE' && data.NORMAL && data.HIGH;
    if (!data.params || Object.keys(data.params).length === 0) {
      if (!hasDualLevel) {
        throw new Error('Missing required field: params (must have at least 1 parameter)');
      }
      // Fill params from NORMAL level for backward compatibility
      data.params = { ...data.NORMAL };
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

    // Validate NORMAL/HIGH params for EASYLITE dual-level
    if (hasDualLevel) {
      for (const level of ['NORMAL', 'HIGH'] as const) {
        const levelParams = data[level];
        if (!levelParams) continue;
        for (const key of Object.keys(levelParams)) {
          if (!VALID_PARAMS.includes(key)) {
            throw new Error(`Invalid parameter in ${level}: ${key}`);
          }
          const value = levelParams[key as keyof QCParams];
          if (value !== undefined && value !== null && (typeof value !== 'number' || isNaN(value))) {
            throw new Error(`Invalid parameter value for ${level}.${key}: ${value} (must be a number)`);
          }
        }
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
