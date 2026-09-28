#!/usr/bin/env bash
#
# diagnose-drive-upload.sh — cari tahu kenapa upload ke Drive gagal 500.
#
# Supabase tidak pernah menampilkan NILAI secret, jadi kita tidak bisa
# memeriksanya langsung. Skrip ini menguji perilaku Edge Function dengan
# token sesi asli: dari pesan errornya, kita tahu secret mana yang bermasalah.

set -uo pipefail

SUPABASE_URL="https://tpyocjcjoucyymsptbbw.supabase.co"
FN_URL="$SUPABASE_URL/functions/v1/upload-transfusi"
SESSION_TOKEN="${1:-}"

if [[ -z "$SESSION_TOKEN" ]]; then
  cat <<'USAGE'
Pemakaian:
  bash scripts/diagnose-drive-upload.sh <session-token>

Cara ambil session token:
  1. Login ke portal di browser
  2. Buka DevTools → Console
  3. Jalankan:
       JSON.parse(localStorage.getItem('lab-portal-auth')).token
  4. Tempel hasilnya (format UUID) sebagai argumen

Catatan: token ini berlaku 4 jam dan memberi akses atas nama akun Anda.
Sebaiknya logout lalu login lagi setelah selesai mendiagnosis.
USAGE
  exit 1
fi

echo "▸ Menguji $FN_URL"
echo "  token: ${SESSION_TOKEN:0:8}… (${#SESSION_TOKEN} karakter)"
echo

# Payload minimal — cukup kecil untuk dipastikan bukan masalah ukuran.
PAYLOAD=$(python3 -c "
import json
print(json.dumps({
    'pdfBase64': 'JVBERi0xLjQK',
    'sessionToken': '$SESSION_TOKEN',
    'patientName': 'DIAGNOSTIC PROBE',
    'medicalRecordNumber': '0',
    'bloodProduct': 'PRC',
    'bagCount': 1,
    'bloodTypeRh': 'O+',
    'bagNumber': 'PROBE',
    'origin': 'GRESIK',
    'requestDate': '2026-01-01',
    'informConcern': True,
    'suratPermintaan': True,
    'formReaksi': True,
}))
")

echo "▸ Respons server:"
RESP=$(curl -sS -w "\n---HTTP:%{http_code}---" \
  -X POST "$FN_URL" \
  -H "Content-Type: application/json" \
  --data-binary "$PAYLOAD" 2>&1)

HTTP=$(sed -n 's/.*---HTTP:\([0-9]*\)---.*/\1/p' <<<"$RESP")
BODY=$(sed 's/\n*---HTTP:[0-9]*---\n*//' <<<"$RESP")
echo "  HTTP $HTTP"
echo "  $BODY"
echo

# ─── Terjemahkan hasilnya ───────────────────────────────────────────────────

echo "▸ Diagnosis:"
case "$HTTP" in
  200)
    echo "  ✓ BERHASIL — kedua secret sudah benar dan jalur ke Drive utuh."
    echo "    Kalau Anda masih melihat error di browser, coba muat ulang halaman"
    echo "    (Vite mungkin menyajikan bundel lama)."
    ;;
  401)
    echo "  ✗ Token sesi tidak valid atau kedaluwarsa (berlaku 4 jam)."
    echo "    Login ulang, ambil token baru, jalankan lagi."
    ;;
  400)
    if grep -q "wajib" <<<"$BODY"; then
      echo "  ✓ Fungsi berjalan normal — ini penolakan validasi (nama/RM kosong)."
      echo "    Artinya kedua secret SUDAH benar. Masalah Anda ada di tempat lain."
    else
      echo "  ? Respons 400 dari fungsi. Baca pesannya di atas."
    fi
    ;;
  500)
    case "$BODY" in
      *"GOOGLE_OAUTH_REFRESH_TOKEN belum di-set"*|*"GOOGLE_OAUTH_CLIENT_ID belum di-set"*|*"GOOGLE_OAUTH_CLIENT_SECRET belum di-set"*)
        echo "  ✗ Secret OAuth kosong."
        echo "    Mint token lalu pasang:"
        echo "      bash scripts/mint-gdrive-oauth.sh ~/Downloads/gdrive-oauth-client.json"
        echo "      bash scripts/setup-drive-secrets.sh ~/.config/lab-vision-qc/gdrive-oauth.env <FOLDER_ID>"
        ;;
      *"GOOGLE_SERVICE_ACCOUNT_KEY"*)
        echo "  ✗ Fungsi ter-deploy masih versi service account."
        echo "    Deploy ulang setelah ganti ke OAuth:"
        echo "      supabase functions deploy upload-transfusi --no-verify-jwt"
        ;;
      *"invalid_grant"*|*"Refresh token Google tidak valid"*)
        echo "  ✗ Refresh token dicabut / kedaluwarsa / masih dari app Testing."
        echo "    Pastikan consent screen **In production**, cabut grant lama di"
        echo "    https://myaccount.google.com/permissions , lalu mint ulang."
        ;;
      *"storageQuotaExceeded"*|*"do not have storage quota"*)
        echo "  ✗ Masih mengunggah sebagai service account (kuota 0)."
        echo "    Fungsi lama ter-deploy, atau secret OAuth belum terpakai."
        echo "    Deploy ulang upload-transfusi, pastikan 3 secret GOOGLE_OAUTH_* ada."
        ;;
      *"GDRIVE_TRANSFUSI_FOLDER_ID"*)
        echo "  ✗ Secret GDRIVE_TRANSFUSI_FOLDER_ID kosong."
        echo "    Pasang dengan setup-drive-secrets.sh (argumen ke-2 = folder ID)."
        ;;
      *"Folder Drive tidak bisa diakses"*)
        echo "  ✗ Folder tidak terlihat oleh akun Gmail yang diotorisasi."
        echo "    Cek ID folder (bagian setelah /folders/) dan login OAuth pakai"
        echo "    Gmail pemilik folder itu — bukan akun lain."
        ;;
      *)
        echo "  ? Error lain dari dalam fungsi — baca pesan di atas."
        ;;
    esac
    ;;
  546)
    echo "  ✗ Fungsi crash saat boot. Cek Edge Functions → Logs di dashboard."
    ;;
  *)
    echo "  ? Status tak terduga. Cek Edge Functions → Logs di dashboard Supabase."
    ;;
esac
