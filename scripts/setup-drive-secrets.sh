#!/usr/bin/env bash
#
# setup-drive-secrets.sh — pasang secret OAuth Google Drive + Google Sheet untuk
# modul Transfusi, lalu deploy Edge Function-nya.
#
# Dibuat karena `supabase secrets set` tetap melaporkan "Finished" walaupun
# nilainya kosong — jadi kegagalan `cat` tidak pernah kelihatan.
#
# Pemakaian (jalan A — OAuth akun Gmail):
#   bash scripts/setup-drive-secrets.sh <path-ke-gdrive-oauth.env> <folder-id-drive> [sheet-id]
#
# File .env dihasilkan oleh:
#   bash scripts/mint-gdrive-oauth.sh <oauth-client.json>
#
# Contoh:
#   bash scripts/setup-drive-secrets.sh \
#     ~/.config/lab-vision-qc/gdrive-oauth.env \
#     1zIG5k1CnGhjj6Sz3x6DMstM1_pIWLmEg \
#     1Jb_OnAaZte-BHYEkh2ZJUtHqG7MmiDucUPCgYCBcUYA
#
# sheet-id opsional: kalau diberikan, baris arsip ikut dicatat otomatis ke
# Google Sheet (tab "Arsip Transfusi"). Ambil hanya bagian di antara
# /spreadsheets/d/ dan /edit pada URL.

set -euo pipefail

ENV_FILE="${1:-}"
FOLDER_ID="${2:-}"
SHEET_ID="${3:-}"

if [[ -z "$ENV_FILE" || -z "$FOLDER_ID" ]]; then
  cat <<'USAGE'
Pemakaian:
  bash scripts/setup-drive-secrets.sh <path-ke-gdrive-oauth.env> <folder-id-drive> [sheet-id]

Contoh:
  bash scripts/setup-drive-secrets.sh \
    ~/.config/lab-vision-qc/gdrive-oauth.env \
    1zIG5k1CnGhjj6Sz3x6DMstM1_pIWLmEg \
    1Jb_OnAaZte-BHYEkh2ZJUtHqG7MmiDucUPCgYCBcUYA

File .env belum ada?
  1. Buat OAuth client (Desktop app) di Google Cloud Console
  2. Publish consent screen ke **In production** (bukan Testing)
  3. bash scripts/mint-gdrive-oauth.sh ~/Downloads/client.json

Catatan: untuk Folder ID, ambil HANYA bagian setelah /folders/ —
tanpa "?usp=drive_link" di belakangnya.

Catatan: untuk Sheet ID, ambil HANYA bagian di antara /spreadsheets/d/
dan /edit pada URL, contoh:
  https://docs.google.com/spreadsheets/d/1Jb_OnAaZte-BHYEkh2ZJUtHqG7MmiDucUPCgYCBcUYA/edit
                                        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ ini saja
USAGE
  exit 1
fi

if [[ "$FOLDER_ID" == *"?"* || "$FOLDER_ID" == *" "* ]]; then
  echo "✗ Folder ID mengandung '?' atau spasi."
  echo "  Ambil hanya bagian setelah /folders/ , contoh:"
  echo "  https://drive.google.com/drive/folders/1zIG5k1CnGhjj6Sz3x6DMstM1_pIWLmEg?usp=drive_link"
  echo "                                          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ ini saja"
  exit 1
fi

if [[ -n "$SHEET_ID" && ( "$SHEET_ID" == *"/"* || "$SHEET_ID" == *"?"* || "$SHEET_ID" == *" "* ) ]]; then
  echo "✗ Sheet ID tampak seperti URL utuh, bukan ID."
  echo "  Ambil hanya bagian di antara /spreadsheets/d/ dan /edit."
  exit 1
fi

if [[ ! -f "supabase/config.toml" ]]; then
  echo "✗ Jalankan dari folder root project (yang ada supabase/config.toml)."
  echo "  Sekarang di: $(pwd)"
  echo "  Coba: cd ~/ramscl_workspace/lab-vision-qc"
  exit 1
fi

if [[ ! -f "supabase/functions/upload-transfusi/index.ts" ]]; then
  echo "✗ supabase/functions/upload-transfusi/index.ts tidak ditemukan."
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "✗ File tidak ditemukan: $ENV_FILE"
  echo
  echo "  Hasil mint biasanya di ~/.config/lab-vision-qc/gdrive-oauth.env"
  echo "  Mint dulu: bash scripts/mint-gdrive-oauth.sh <oauth-client.json>"
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "✗ python3 tidak tersedia — dipakai untuk memvalidasi file env."
  exit 1
fi

echo "▸ Memeriksa $ENV_FILE ..."

# Tolak JSON service account lama — auth sudah pindah ke OAuth user.
if python3 - "$ENV_FILE" <<'PY'
import json, sys
path = sys.argv[1]
try:
    with open(path) as fh:
        data = json.load(fh)
except (json.JSONDecodeError, UnicodeDecodeError, OSError):
    sys.exit(0)
if isinstance(data, dict) and data.get("type") == "service_account":
    sys.exit(2)
sys.exit(0)
PY
then
  :
else
  status=$?
  if [[ "$status" -eq 2 ]]; then
    echo "✗ File ini JSON service account. Auth Drive sudah pindah ke OAuth Gmail."
    echo "  Service account tidak punya kuota penyimpanan (HTTP 403)."
    echo "  Mint token dulu:"
    echo "    bash scripts/mint-gdrive-oauth.sh <oauth-client.json>"
    exit 1
  fi
fi

eval "$(python3 - "$ENV_FILE" <<'PY'
import shlex, sys
path = sys.argv[1]
wanted = (
    "GOOGLE_OAUTH_CLIENT_ID",
    "GOOGLE_OAUTH_CLIENT_SECRET",
    "GOOGLE_OAUTH_REFRESH_TOKEN",
)
found = {}
with open(path) as fh:
    for raw in fh:
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip("'").strip('"')
        if key in wanted:
            found[key] = value
missing = [k for k in wanted if not found.get(k)]
if missing:
    sys.exit("✗ Field wajib kosong/tidak ada: " + ", ".join(missing))
for k in wanted:
    print(f"{k}=" + shlex.quote(found[k]))
print("CLIENT_ID_PREFIX=" + shlex.quote(found["GOOGLE_OAUTH_CLIENT_ID"][:20]))
print("REFRESH_LEN=" + shlex.quote(str(len(found["GOOGLE_OAUTH_REFRESH_TOKEN"]))))
print("REFRESH_SUFFIX=" + shlex.quote(found["GOOGLE_OAUTH_REFRESH_TOKEN"][-6:]))
PY
)"

echo "  client_id     : ${CLIENT_ID_PREFIX}…"
echo "  refresh_token : ada (${REFRESH_LEN} karakter, …${REFRESH_SUFFIX})"
echo "  folder_id     : $FOLDER_ID"
echo "  sheet_id      : ${SHEET_ID:-(tidak di-set — auto-isi Sheet dilewati)}"

echo
echo "▸ Memasang GOOGLE_OAUTH_CLIENT_ID ..."
supabase secrets set GOOGLE_OAUTH_CLIENT_ID="$GOOGLE_OAUTH_CLIENT_ID"

echo "▸ Memasang GOOGLE_OAUTH_CLIENT_SECRET ..."
supabase secrets set GOOGLE_OAUTH_CLIENT_SECRET="$GOOGLE_OAUTH_CLIENT_SECRET"

echo "▸ Memasang GOOGLE_OAUTH_REFRESH_TOKEN ..."
supabase secrets set GOOGLE_OAUTH_REFRESH_TOKEN="$GOOGLE_OAUTH_REFRESH_TOKEN"

echo "▸ Memasang GDRIVE_TRANSFUSI_FOLDER_ID ..."
supabase secrets set GDRIVE_TRANSFUSI_FOLDER_ID="$FOLDER_ID"

if [[ -n "$SHEET_ID" ]]; then
  echo "▸ Memasang GTRANSFUSI_SHEET_ID ..."
  supabase secrets set GTRANSFUSI_SHEET_ID="$SHEET_ID"
else
  echo "▸ GTRANSFUSI_SHEET_ID dilewati (Sheet ID tidak diberikan)."
fi

echo
echo "▸ Memverifikasi ..."
LIST_OUTPUT="$(supabase secrets list)"

ok=1
for name in \
  GOOGLE_OAUTH_CLIENT_ID \
  GOOGLE_OAUTH_CLIENT_SECRET \
  GOOGLE_OAUTH_REFRESH_TOKEN \
  GDRIVE_TRANSFUSI_FOLDER_ID
do
  if grep -q "$name" <<<"$LIST_OUTPUT"; then
    echo "  ✓ $name"
  else
    echo "  ✗ $name TIDAK terpasang"
    ok=0
  fi
done

if [[ -n "$SHEET_ID" ]]; then
  if grep -q "GTRANSFUSI_SHEET_ID" <<<"$LIST_OUTPUT"; then
    echo "  ✓ GTRANSFUSI_SHEET_ID"
  else
    echo "  ✗ GTRANSFUSI_SHEET_ID TIDAK terpasang"
    ok=0
  fi
fi

if [[ "$ok" -ne 1 ]]; then
  echo
  echo "✗ Ada secret yang gagal terpasang. Deploy dibatalkan."
  exit 1
fi

echo
echo "▸ Deploy Edge Function ..."
supabase functions deploy upload-transfusi --no-verify-jwt

cat <<'NEXT'

────────────────────────────────────────────────────────────
✓ Selesai.

Langkah terakhir — jalankan dua migrasi di Supabase Dashboard
→ SQL Editor, urut (kalau belum):
  1. supabase/migrations/004_transfusi_documents.sql
  2. supabase/migrations/009_transfusi_scan_fields.sql

Lalu uji dari HP: Transfusi → Scan Baru.
PDF harus muncul di Drive: Berkas Transfusi → YYYY → MM
Baris arsip harus muncul di Google Sheet (tab "Arsip Transfusi").
────────────────────────────────────────────────────────────
NEXT
