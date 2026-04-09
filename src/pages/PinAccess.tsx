import { useState, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Shield, Loader2, AlertCircle } from 'lucide-react'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Halaman PIN — ditampilkan saat akses dari luar jaringan RS
 *
 * Flow:
 * 1. User memasukkan PIN 6 digit
 * 2. POST ke /api/verify-pin
 * 3. Jika benar → cookie lab_access diset (4 jam) → redirect ke app
 * 4. Jika salah → tampilkan error + shake animation
 */
export default function PinAccess() {
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shake, setShake] = useState(false)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const submitRef = useRef<HTMLButtonElement>(null)

  const redirectTarget = searchParams.get('redirect') || '/'

  // Auto-submit saat PIN sudah 6 digit
  useEffect(() => {
    if (pin.length === 6) {
      handleSubmit()
    }
  }, [pin])

  async function handleSubmit() {
    if (pin.length !== 6 || loading) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })

      const data = await res.json()

      if (res.ok && data.ok) {
        // Berhasil — redirect ke halaman tujuan dan hapus history /pin
        window.location.replace(redirectTarget)
      } else {
        triggerError(data.error || 'PIN salah. Coba lagi.')
      }
    } catch {
      triggerError('Gagal terhubung ke server. Periksa koneksi internet.')
    } finally {
      setLoading(false)
    }
  }

  function triggerError(msg: string) {
    setError(msg)
    setPin('')
    setShake(true)
    setTimeout(() => setShake(false), 600)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4">
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-sm">
          {/* Header / Branding */}
          <div className="mb-8 flex flex-col items-center gap-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/20 ring-1 ring-blue-400/30">
              <Shield className="h-7 w-7 text-blue-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">Akses Terbatas</h1>
              <p className="mt-1 text-sm text-slate-400">RS Petrokimia Gresik</p>
            </div>
          </div>

          {/* Instruksi */}
          <p className="mb-6 text-center text-sm text-slate-400">
            Anda mengakses dari luar jaringan RS.
            <br />
            Masukkan PIN 6 digit untuk melanjutkan.
          </p>

          {/* OTP Input */}
          <div
            className={cn(
              'flex justify-center transition-transform',
              shake && 'animate-[shake_0.5s_ease-in-out]',
            )}
          >
            <InputOTP
              maxLength={6}
              value={pin}
              onChange={setPin}
              disabled={loading}
              inputMode="numeric"
              pattern="[0-9]*"
              autoFocus
            >
              <InputOTPGroup>
                {Array.from({ length: 6 }).map((_, i) => (
                  <InputOTPSlot
                    key={i}
                    index={i}
                    className="h-12 w-10 border-white/20 bg-white/10 text-white text-base"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-500/10 p-3 text-sm text-red-400 ring-1 ring-red-500/20">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit Button */}
          <Button
            ref={submitRef}
            onClick={handleSubmit}
            disabled={pin.length !== 6 || loading}
            className="mt-6 w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Memverifikasi…
              </>
            ) : (
              'Masuk'
            )}
          </Button>

          {/* Footer */}
          <p className="mt-6 text-center text-xs text-slate-600">
            Hubungi admin lab jika lupa PIN
          </p>
        </div>
      </div>

      {/* Shake keyframe via style tag */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-8px); }
          40%       { transform: translateX(8px); }
          60%       { transform: translateX(-6px); }
          80%       { transform: translateX(6px); }
        }
      `}</style>
    </div>
  )
}
