import { GeminiResponse } from './types.ts';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const EXTRACTION_PROMPT = `
Ekstrak data QC dari gambar struk laboratorium ini.

INSTRUKSI:
1. Cari tanggal (format: YYYY-MM-DD atau DD/MM/YYYY, konversi ke ISO YYYY-MM-DD)
2. Identifikasi alat berdasarkan parameter yang ada:
   - CA660: jika ada PT, APTT, INR (alat koagulasi Sysmex CA-660)
   - EASYLITE: jika ada Na, K, Cl (alat elektrolit)
   - ONCALL1 atau ONCALL2: jika ada GDA (alat glukosa)
3. Identifikasi level kontrol:
   - "Kontrol" jika ada tulisan QC, Control, atau nomor QC seperti QC01/QC02/QC04
   - "NORMAL" jika ada tulisan Normal atau Level 1
   - "HIGH" jika ada tulisan High atau Level 2
   - "CTRL0", "CTRL1", "CTRL2" untuk level glukosa
4. Cari nomor LOT (biasanya format seperti CA-2024-001 atau angka saja)
5. Ekstrak nilai parameter numerik (PT dalam detik, APTT dalam detik, INR tanpa satuan)

OUTPUT FORMAT (JSON only, no explanation, no markdown):
{"tanggal":"YYYY-MM-DD","alat":"CA660|EASYLITE|ONCALL1|ONCALL2","level":"Kontrol|NORMAL|HIGH|CTRL0|CTRL1|CTRL2","lot":"string","params":{"PT":number,"APTT":number,"INR":number}}

ATURAN PENTING:
- Return ONLY the JSON object, nothing else, no markdown, no code blocks
- Untuk alat: jika ada PT/APTT/INR maka alat = "CA660"
- Untuk level: jika ada QC atau Control maka level = "Kontrol"
- Params: hanya include parameter yang terdeteksi, nilai harus angka
- Tanggal harus format YYYY-MM-DD
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
