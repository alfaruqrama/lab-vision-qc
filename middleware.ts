/**
 * Vercel Edge Middleware — Network-Based Access Control
 *
 * Rules:
 * 1. Jika IP client cocok dengan ALLOWED_IPS → langsung izinkan (jaringan RS)
 * 2. Jika cookie lab_access valid → izinkan (sudah PIN dari luar RS)
 * 3. Selain itu → redirect ke /pin
 *
 * Env vars yang dibutuhkan (set di Vercel Dashboard):
 *   ALLOWED_IPS    = comma-separated IP publik RS, misal: 180.1.2.3,36.74.5.6
 *   COOKIE_SECRET  = string acak panjang sebagai nilai token cookie
 */

export const config = {
  matcher: [
    /*
     * Match semua path KECUALI:
     * - /pin (halaman PIN itu sendiri — hindari infinite redirect)
     * - /api/ (serverless functions — termasuk /api/verify-pin)
     * - /_next/ (Vite/Next internal assets)
     * - /assets/ (static assets Vite build)
     * - File-file statis umum
     */
    '/((?!pin|login|api|assets|_next/static|_next/image|favicon\\.ico|manifest\\.json|robots\\.txt|.*\\.png|.*\\.svg|.*\\.ico|.*\\.webp|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.woff2?|.*\\.ttf).*)',
  ],
}

export default function middleware(request: Request): Response | undefined {
  const url = new URL(request.url)
  const pathname = url.pathname

  // Double-check: jangan redirect /pin dan /login (matcher sudah handle, ini safety net)
  if (pathname === '/pin' || pathname === '/login' || pathname.startsWith('/api/')) {
    return undefined
  }

  // --- 1. Cek IP RS ---
  const rawAllowedIPs = process.env.ALLOWED_IPS || ''
  const allowedIPs = rawAllowedIPs
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean)

  // x-forwarded-for bisa berisi beberapa IP (proxy chain) — ambil yang pertama (client asli)
  const forwardedFor = request.headers.get('x-forwarded-for') || ''
  const clientIP = forwardedFor.split(',')[0]?.trim() || ''

  // Jika ALLOWED_IPS sudah diset dan IP cocok → izinkan langsung
  if (allowedIPs.length > 0 && clientIP && allowedIPs.includes(clientIP)) {
    return undefined // pass through
  }

  // --- 2. Cek Cookie PIN ---
  const cookieHeader = request.headers.get('cookie') || ''
  const labAccessCookie = parseCookie(cookieHeader, 'lab_access')
  const expectedToken = process.env.COOKIE_SECRET || ''

  if (expectedToken && labAccessCookie && labAccessCookie === expectedToken) {
    return undefined // pass through — cookie valid
  }

  // --- 3. Redirect ke halaman PIN ---
  const pinUrl = new URL('/pin', request.url)
  // Simpan halaman tujuan asal agar setelah PIN bisa redirect balik
  if (pathname !== '/') {
    pinUrl.searchParams.set('redirect', pathname)
  }

  return Response.redirect(pinUrl, 302)
}

/** Parse nilai cookie berdasarkan nama */
function parseCookie(cookieHeader: string, name: string): string | undefined {
  const cookies = cookieHeader.split(';')
  for (const cookie of cookies) {
    const [key, ...rest] = cookie.trim().split('=')
    if (key.trim() === name) {
      return rest.join('=').trim()
    }
  }
  return undefined
}
