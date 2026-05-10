import { GeminiResponse } from './types.ts';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const EXTRACTION_PROMPT = `
Ekstrak data QC dari gambar struk laboratorium ini.

INSTRUKSI:
1. Cari tanggal (format: YYYY-MM-DD atau DD/MM/YYYY, konversi ke ISO YYYY-MM-DD)
2. Identifikasi alat: CA660, EASYLITE, ONCALL1, atau ONCALL2
3. Identifikasi level kontrol: Kontrol, NORMAL, HIGH, CTRL0, CTRL1, atau CTRL2
4. Cari nomor LOT
5. Ekstrak parameter yang terdeteksi (PT, APTT, INR, Na, K, Cl, GDA)

OUTPUT FORMAT (JSON only, no markdown):
{
  "tanggal": "YYYY-MM-DD",
  "alat": "CA660|EASYLITE|ONCALL1|ONCALL2",
  "level": "Kontrol|NORMAL|HIGH|CTRL0|CTRL1|CTRL2",
  "lot": "string",
  "params": {
    "PT": number,
    "APTT": number,
    "INR": number,
    "Na": number,
    "K": number,
    "Cl": number,
    "GDA": number
  }
}

ATURAN:
- Return ONLY valid JSON, no markdown code blocks
- Jika field tidak ditemukan, return null untuk field tersebut
- Params: hanya include yang terdeteksi dengan confidence tinggi
- Tanggal harus valid ISO format (YYYY-MM-DD)
- Alat dan level harus exact match dengan enum values
`;

export async function analyzeImage(base64Image: string): Promise<GeminiResponse> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured. Set it with: supabase secrets set GEMINI_API_KEY=your_key');
  }

  const url = `${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`;
  
  const payload = {
    contents: [{
      parts: [
        { text: EXTRACTION_PROMPT },
        {
          inline_data: {
            mime_type: 'image/jpeg',
            data: base64Image
          }
        }
      ]
    }],
    generationConfig: {
      temperature: 0.1,  // Low temperature for consistent extraction
      topK: 1,
      topP: 1,
      maxOutputTokens: 1024
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}
