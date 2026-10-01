#!/usr/bin/env bash
#
# mint-gdrive-oauth.sh — sekali jalan: buka browser, autorisasi Gmail, simpan
# refresh token ke file lokal (bukan ke git).
#
# WAJIB sebelum ini:
#   1. Google Cloud Console → OAuth consent screen
#      User type: External
#      Publishing status: **In production**  (bukan Testing — Testing = token mati 7 hari)
#   2. Credentials → Create credentials → OAuth client ID → tipe **Desktop app**
#   3. Unduh JSON client, simpan di luar repo (mis. ~/Downloads/gdrive-oauth-client.json)
#
# Pemakaian:
#   bash scripts/mint-gdrive-oauth.sh ~/Downloads/gdrive-oauth-client.json
#
# Hasil:
#   ~/.config/lab-vision-qc/gdrive-oauth.env   (chmod 600)
#   Lanjut: bash scripts/setup-drive-secrets.sh ~/.config/lab-vision-qc/gdrive-oauth.env <FOLDER_ID>

set -euo pipefail

# Dua mode sumber kredensial:
#   1) posisional JSON client (cara lama)   : mint-gdrive-oauth.sh ~/Downloads/client.json
#   2) --from-env <path-env> (tanpa JSON)   : pakai client_id/secret dari file env yang ada
#
# Mode (2) penting sekarang: Google tidak lagi mengizinkan mengunduh JSON client
# secret, jadi kredensial dibaca dari file env yang sudah tersimpan.
FROM_ENV=""
CLIENT_JSON=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --from-env)
      FROM_ENV="${2:-}"
      shift 2
      ;;
    -h|--help)
      CLIENT_JSON=""
      shift
      break
      ;;
    *)
      CLIENT_JSON="$1"
      shift
      ;;
  esac
done

PORT="${GDRIVE_OAUTH_PORT:-8765}"
REDIRECT_URI="http://127.0.0.1:${PORT}/"
# `drive`        → unggah PDF ke folder arsip (modul Transfusi).
# `spreadsheets` → tulis baris arsip ke Google Sheet (auto-isi spreadsheet).
# Keduanya dibutuhkan, jadi mint sekali dengan scope gabungan.
SCOPE="https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets"
OUT_DIR="${HOME}/.config/lab-vision-qc"
OUT_FILE="${OUT_DIR}/gdrive-oauth.env"

if [[ -z "$CLIENT_JSON" && -z "$FROM_ENV" ]]; then
  cat <<'USAGE'
Pemakaian:
  bash scripts/mint-gdrive-oauth.sh <path-ke-oauth-client.json>
  bash scripts/mint-gdrive-oauth.sh --from-env <path-ke-gdrive-oauth.env>

Mode 1 (JSON): unduh dari Google Cloud Console
  APIs & Services → Credentials → OAuth 2.0 Client IDs → Download JSON
  Tipe client: Desktop app  (bukan Web, bukan Service account)
  Catatan: Google kini menyembunyikan tombol download untuk sebagian client.
  Kalau tidak bisa mengunduh JSON, pakai mode --from-env.

Mode 2 (--from-env): baca client_id & client_secret yang sudah ada dari file env
  (mis. ~/.config/lab-vision-qc/gdrive-oauth.env), lalu mint refresh token BARU
  dengan scope lengkap (drive + spreadsheets). Tidak perlu file JSON.
  File env lama otomatis dicadangkan ke *.bak.

Sebelum mint:
  Consent screen harus **In production**, bukan Testing.
  Testing = refresh token mati 7 hari. Arsip RS tidak boleh begitu.
USAGE
  exit 1
fi

if [[ -n "$FROM_ENV" && ! -f "$FROM_ENV" ]]; then
  echo "✗ File env tidak ditemukan: $FROM_ENV"
  exit 1
fi

if [[ -z "$FROM_ENV" && ! -f "$CLIENT_JSON" ]]; then
  echo "✗ File tidak ditemukan: $CLIENT_JSON"
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "✗ python3 tidak tersedia."
  exit 1
fi

# ─── Baca client_id / client_secret ──────────────────────────────────────────
#
# Dari env (mode 2) atau dari JSON Desktop/Web (mode 1).

if [[ -n "$FROM_ENV" ]]; then
  eval "$(python3 - "$FROM_ENV" <<'PY'
import shlex, sys
path = sys.argv[1]
want = {"GOOGLE_OAUTH_CLIENT_ID": "CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET": "CLIENT_SECRET"}
found: dict[str, str] = {}
with open(path) as fh:
    for raw in fh:
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        k = k.strip()
        v = v.strip().strip("'").strip('"')
        if k in want:
            found[want[k]] = v
missing = [k for k in ("CLIENT_ID", "CLIENT_SECRET") if not found.get(k)]
if missing:
    sys.exit("✗ File env tidak punya " + ", ".join(missing) + ". Isi minimal GOOGLE_OAUTH_CLIENT_ID dan GOOGLE_OAUTH_CLIENT_SECRET.")
print("CLIENT_ID=" + shlex.quote(found["CLIENT_ID"]))
print("CLIENT_SECRET=" + shlex.quote(found["CLIENT_SECRET"]))
print("CLIENT_KIND=installed")
PY
  )"
  echo "▸ Sumber kredensial: $FROM_ENV (mode --from-env)"
else
  eval "$(python3 - "$CLIENT_JSON" <<'PY'
import json, shlex, sys
path = sys.argv[1]
with open(path) as fh:
    data = json.load(fh)
block = data.get("installed") or data.get("web")
if not block:
    sys.exit("✗ JSON bukan OAuth client. Harus berisi kunci 'installed' (Desktop) atau 'web'.")
cid = block.get("client_id") or ""
sec = block.get("client_secret") or ""
if not cid or not sec:
    sys.exit("✗ client_id / client_secret kosong di JSON.")
print("CLIENT_ID=" + shlex.quote(cid))
print("CLIENT_SECRET=" + shlex.quote(sec))
print("CLIENT_KIND=" + shlex.quote("installed" if "installed" in data else "web"))
PY
  )"
fi

if [[ "$CLIENT_KIND" == "web" ]]; then
  echo "⚠ JSON ini tipe Web, bukan Desktop."
  echo "  Tambahkan redirect URI ini di Cloud Console sebelum lanjut:"
  echo "    ${REDIRECT_URI}"
  echo
  echo "  Desktop app lebih sederhana (loopback otomatis). Disarankan buat ulang."
  echo
fi

echo "▸ Client ID : ${CLIENT_ID:0:20}…"
echo "▸ Redirect  : $REDIRECT_URI"
echo "▸ Scope     : $SCOPE"
echo
echo "Browser akan terbuka. Login dengan Gmail pemilik folder Drive."
echo "Kalau muncul 'Google hasn't verified this app':"
echo "  Advanced → Go to {nama app} (unsafe) → Allow."
echo
read -r -p "Tekan Enter untuk membuka Google…"

AUTH_URL="https://accounts.google.com/o/oauth2/v2/auth?$(python3 - <<PY
from urllib.parse import urlencode
print(urlencode({
    "client_id": """$CLIENT_ID""",
    "redirect_uri": """$REDIRECT_URI""",
    "response_type": "code",
    "scope": """$SCOPE""",
    "access_type": "offline",
    "prompt": "consent",
}))
PY
)"

# ─── Server callback + tukar code ────────────────────────────────────────────

python3 - "$CLIENT_ID" "$CLIENT_SECRET" "$REDIRECT_URI" "$PORT" "$OUT_DIR" "$OUT_FILE" "$AUTH_URL" <<'PY'
import json, os, sys, time, urllib.parse, urllib.request, webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer

client_id, client_secret, redirect_uri, port_s, out_dir, out_file, auth_url = sys.argv[1:8]
port = int(port_s)
holder: dict[str, str] = {}

class Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        qs = urllib.parse.parse_qs(parsed.query)
        if "code" in qs:
            holder["code"] = qs["code"][0]
            body = (
                "<!doctype html><meta charset=utf-8><title>OAuth OK</title>"
                "<p style='font:16px system-ui;padding:2rem'>Berhasil. Kembali ke terminal.</p>"
            ).encode()
            self.send_response(200)
        elif "error" in qs:
            holder["error"] = qs["error"][0]
            body = (
                "<!doctype html><meta charset=utf-8><title>OAuth gagal</title>"
                f"<p style='font:16px system-ui;padding:2rem'>Gagal: {holder['error']}</p>"
            ).encode()
            self.send_response(400)
        else:
            # favicon / prefetch — jangan dianggap gagal
            self.send_response(204)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_args: object) -> None:
        return

httpd = HTTPServer(("127.0.0.1", port), Handler)
httpd.timeout = 1

webbrowser.open(auth_url)
print(f"▸ Menunggu callback di {redirect_uri}  (timeout 3 menit)")
print(f"  Kalau browser tidak terbuka, tempel URL ini:\n  {auth_url}\n")

deadline = time.time() + 180
while time.time() < deadline and "code" not in holder and "error" not in holder:
    httpd.handle_request()

httpd.server_close()

if "error" in holder:
    sys.exit(f"✗ Google menolak: {holder['error']}")
if "code" not in holder:
    sys.exit("✗ Tidak ada kode otorisasi. Waktu habis atau browser tidak callback.")

payload = urllib.parse.urlencode({
    "grant_type": "authorization_code",
    "code": holder["code"],
    "client_id": client_id,
    "client_secret": client_secret,
    "redirect_uri": redirect_uri,
}).encode()

req = urllib.request.Request(
    "https://oauth2.googleapis.com/token",
    data=payload,
    headers={"Content-Type": "application/x-www-form-urlencoded"},
    method="POST",
)
try:
    with urllib.request.urlopen(req) as res:
        token = json.loads(res.read().decode())
except urllib.error.HTTPError as exc:
    detail = exc.read().decode()[:500]
    sys.exit(f"✗ Gagal menukar kode (HTTP {exc.code}): {detail}")

refresh = token.get("refresh_token") or ""
if not refresh:
    sys.exit(
        "✗ Google tidak mengirim refresh_token.\n"
        "  Biasanya karena consent tidak memakai prompt=consent, atau akun sudah grant.\n"
        "  Cabut akses lama di https://myaccount.google.com/permissions lalu jalankan lagi."
    )

expires = token.get("refresh_token_expires_in")
if expires:
    days = int(expires) / 86400
    print()
    print("✗ Token ini PUNYA TIMER kedaluwarsa.")
    print(f"  refresh_token_expires_in = {expires} detik (~{days:.0f} hari).")
    print("  Artinya consent screen masih **Testing**.")
    print("  Publish app ke In production, lalu jalankan skrip ini lagi.")
    print("  Token ini TIDAK disimpan.")
    sys.exit(2)

os.makedirs(out_dir, mode=0o700, exist_ok=True)

# Cadangkan file env lama sebelum ditimpa — supaya token lama masih bisa
# dipulihkan bila mint sebagian berhasil.
if os.path.exists(out_file):
    backup = out_file + ".bak"
    with open(out_file, "rb") as src, open(backup, "wb") as dst:
        dst.write(src.read())
    os.chmod(backup, 0o600)
    print(f"▸ File env lama dicadangkan: {backup}")

content = (
    f"GOOGLE_OAUTH_CLIENT_ID={client_id}\n"
    f"GOOGLE_OAUTH_CLIENT_SECRET={client_secret}\n"
    f"GOOGLE_OAUTH_REFRESH_TOKEN={refresh}\n"
)
tmp = out_file + ".tmp"
with open(tmp, "w") as fh:
    fh.write(content)
os.chmod(tmp, 0o600)
os.replace(tmp, out_file)

print()
print(f"✓ Refresh token disimpan: {out_file}")
print(f"  (chmod 600, {len(refresh)} karakter, suffix …{refresh[-6:]})")
print("  Scope yang diminta: drive + spreadsheets")
print()
print("Lanjut pasang secret + deploy:")
print("  bash scripts/setup-drive-secrets.sh \\")
print(f"    {out_file} \\")
print("    <FOLDER_ID> \\")
print("    <SHEET_ID>   # opsional, untuk auto-isi Google Sheet")
print()
print("Folder ID = bagian setelah /folders/ di URL Drive, tanpa ?usp=...")
print("Sheet ID  = bagian di antara /spreadsheets/d/ dan /edit.")
print()
print("Catatan: bila Sheets API baru diaktifkan, tunggu 1-2 menit sebelum uji.")
PY
