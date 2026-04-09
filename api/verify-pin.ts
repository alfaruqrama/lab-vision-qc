/**
 * Vercel Edge Function — PIN Verification
 *
 * POST /api/verify-pin
 * Body: { pin: string }
 *
 * Response 200: { ok: true }          → set cookie lab_access (4 jam)
 * Response 401: { error: string }     → PIN salah
 * Response 405: Method Not Allowed    → bukan POST
 *
 * Env vars:
 *   PIN_SECRET     = PIN 6 digit yang benar
 *   COOKIE_SECRET  = token yang disimpan di cookie (harus sama dengan yang dicek di middleware.ts)
 */

export const config = { runtime: 'edge' }

export default async function handler(request: Request): Promise<Response> {
  // Hanya terima POST
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  // Parsing body
  let body: { pin?: string }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Request tidak valid' }, 400)
  }

  const { pin } = body
  const PIN_SECRET = process.env.PIN_SECRET || ''
  const COOKIE_SECRET = process.env.COOKIE_SECRET || ''

  // Validasi env vars terkonfigurasi
  if (!PIN_SECRET || !COOKIE_SECRET) {
    console.error('[verify-pin] PIN_SECRET atau COOKIE_SECRET belum diset di environment variables')
    return json({ error: 'Konfigurasi server tidak lengkap' }, 500)
  }

  // Cek PIN (string comparison, trim whitespace)
  if (!pin || String(pin).trim() !== String(PIN_SECRET).trim()) {
    // Delay sedikit untuk mencegah brute-force timing attack
    await new Promise((r) => setTimeout(r, 400))
    return json({ error: 'PIN salah. Coba lagi.' }, 401)
  }

  // PIN benar — set cookie httpOnly selama 4 jam
  const FOUR_HOURS = 4 * 60 * 60 // dalam detik

  const cookieValue = [
    `lab_access=${COOKIE_SECRET}`,
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
    `Max-Age=${FOUR_HOURS}`,
    'Path=/',
  ].join('; ')

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': cookieValue,
    },
  })
}

function json(data: object, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
