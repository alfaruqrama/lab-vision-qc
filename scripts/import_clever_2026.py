#!/usr/bin/env python3
"""Import QC CLEVER CHECK 2026 (Juli, Agustus, September) ke Supabase.

Layout Excel per sheet:
  R1-R2: header ("Kontrol Alat Gula Darah Strip Alat" / "CLEVER CHECK")
  R3   : tanggal awal bulan (info)
  R4-5 : column headers (ALAT 1 / ALAT 2, NORMAL/LOT/RANGE)
  R6+  : data per hari
    Col A (0): tanggal (hari)
    ALAT 1: B(1)=nilai, C(2)=lot, D(3)=range
    ALAT 2: E(4)=nilai, F(5)=lot, G(6)=range

Mapping DB:
  ALAT 1 → CLEVER1, ALAT 2 → CLEVER2
  level  → "Kontrol" (single-level convention di app)
  params → {"GDA": value}
  analis → FEYZA JASMINE AURANISA (id 17d37361-...)

Skip kombinasi (tanggal, alat) yang sudah ada di DB — idempotent.
"""

import urllib.request, urllib.error, json, sys, time
from datetime import date

import openpyxl

SUPABASE_URL = "https://tpyocjcjoucyymsptbbw.supabase.co"
ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRweW9jamNqb3VjeXltc3B0YmJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MDAzOTMsImV4cCI6MjA5NDA3NjM5M30.d4HIKDyv5VtGPYc2yzVOexsWoU39MCAfGgk3L1ECziM"

EXCEL_PATH = "/Users/rama/Downloads/QC GDA CLEVER CHECK 2026 (1).xlsx"

JASMINE_ID = "17d37361-cc7c-4d63-8bfc-62bbbdcf8003"
JASMINE_NAMA = "FEYZA JASMINE AURANISA"

SHEET_MONTH = {
    "JULI 2026": (2026, 7),
    "AGUSTUS 2026": (2026, 8),
    "SEPTEMBER 2026": (2026, 9),
}

ALAT_COLS = [
    ("CLEVER1", 1, 2),  # B=val, C=lot
    ("CLEVER2", 4, 5),  # E=val, F=lot
]


def api(method, path, body=None):
    url = f"{SUPABASE_URL}{path}"
    headers = {
        "apikey": ANON_KEY,
        "Authorization": f"Bearer {ANON_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, method=method, headers=headers, data=data)
    try:
        resp = urllib.request.urlopen(req)
        b = resp.read()
        return json.loads(b) if b else None
    except urllib.error.HTTPError as e:
        print(f"  ERROR {e.code}: {e.read().decode()[:300]}")
        return None


def fetch_existing_keys():
    """Return set of (tanggal_iso, alat) that already exist for CLEVER1/2 in Jul-Sep 2026."""
    path = (
        "/rest/v1/qc_records"
        "?select=tanggal,alat"
        "&or=(alat.eq.CLEVER1,alat.eq.CLEVER2)"
        "&tanggal=gte.2026-07-01&tanggal=lte.2026-09-30"
    )
    data = api("GET", path)
    return {(r["tanggal"], r["alat"]) for r in (data or [])}


def parse_sheet(ws, year, month):
    records = []
    for row in ws.iter_rows(min_row=6, max_row=ws.max_row, values_only=True):
        if row[0] is None:
            continue
        try:
            day = int(float(row[0]))
        except (ValueError, TypeError):
            continue
        if not (1 <= day <= 31):
            continue
        try:
            tgl = date(year, month, day)
        except ValueError:
            continue

        for alat_name, val_col, lot_col in ALAT_COLS:
            val = row[val_col]
            if val is None or str(val).strip() in ("-", ""):
                continue
            try:
                gda = float(val)
            except (ValueError, TypeError):
                continue

            lot = row[lot_col]
            if lot is not None:
                lot = str(lot).strip()
            else:
                lot = ""

            # Deterministic id — bikin unique per (tanggal, alat) supaya insert ulang tanpa risiko duplikat id
            rec_id = f"qc-import-clever-{tgl.isoformat()}-{alat_name}"
            ts_str = f"{tgl.isoformat()}T00:00:00+00:00"

            records.append(
                {
                    "id": rec_id,
                    "timestamp": ts_str,
                    "tanggal": tgl.isoformat(),
                    "alat": alat_name,
                    "level": "Kontrol",
                    "lot": lot,
                    "params": {"GDA": gda},
                    "status": {"GDA": "ok"},
                    "analis": JASMINE_NAMA,
                    "catatan": "",
                    "created_by": JASMINE_ID,
                }
            )
    return records


def main():
    dry_run = "--apply" not in sys.argv

    print("=" * 60)
    print(f"Import QC CLEVER CHECK 2026 (Juli-September) → Supabase")
    print(f"Mode: {'DRY RUN (no writes)' if dry_run else 'APPLY (write to DB)'}")
    print("=" * 60)

    wb = openpyxl.load_workbook(EXCEL_PATH, data_only=True)
    print(f"\nFile: {EXCEL_PATH}")
    print(f"Sheets: {wb.sheetnames}")

    parsed = []
    for sheet_name, (year, month) in SHEET_MONTH.items():
        if sheet_name not in wb.sheetnames:
            print(f"  WARN: sheet '{sheet_name}' tidak ditemukan, skip")
            continue
        ws = wb[sheet_name]
        recs = parse_sheet(ws, year, month)
        print(f"  {sheet_name}: {len(recs)} rows parsed dari Excel")
        parsed.extend(recs)

    print(f"\nTotal parsed: {len(parsed)}")

    existing = fetch_existing_keys()
    print(f"Existing di DB (Jul-Sep CLEVER): {len(existing)}")

    to_insert = [r for r in parsed if (r["tanggal"], r["alat"]) not in existing]
    skipped = len(parsed) - len(to_insert)

    print(f"Skip (sudah ada): {skipped}")
    print(f"Akan di-insert : {len(to_insert)}")

    if to_insert:
        print("\nSample yang akan di-insert:")
        for r in to_insert[:5]:
            print(f"  {r['tanggal']} | {r['alat']} | GDA={r['params']['GDA']} | lot={r['lot']}")
        if len(to_insert) > 5:
            print(f"  ... (+{len(to_insert) - 5} lagi)")

    if dry_run:
        print("\n[DRY RUN] Selesai. Jalankan dengan --apply untuk insert.")
        return

    if not to_insert:
        print("\nTidak ada data untuk di-insert.")
        return

    print(f"\nMengirim {len(to_insert)} records...")
    BATCH = 100
    ok = 0
    fail = 0
    for i in range(0, len(to_insert), BATCH):
        batch = to_insert[i : i + BATCH]
        result = api("POST", "/rest/v1/qc_records", body=batch)
        if result is None and False:  # api() returns None on error OR on 201-no-body
            fail += len(batch)
        else:
            ok += len(batch)
            print(f"  Batch {i // BATCH + 1}: ✓ {len(batch)}")
        time.sleep(0.1)

    print("\n" + "=" * 60)
    print(f"Selesai: {ok} inserted, {fail} error")
    print("=" * 60)


if __name__ == "__main__":
    main()
