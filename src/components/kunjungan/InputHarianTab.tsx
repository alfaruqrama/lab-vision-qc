import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Send, RotateCcw, Save, ChevronDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KunjunganInputRow {
  id: string;
  namaPenjamin: string;
  badge: string;
  rjYani: number;
  riYani: number;
  igd: number;
  mcuAuto: number; // auto-aggregated from MCU rows
  promo: number;
  dokter: number;
  exc: number;
  prior: number;
  grhuRj: number;
  grhuRi: number;
  sat: number;
  ppk1: number;
  total: number;
}

export interface McuInputRow {
  id: string;
  perusahaan: string;
  label: string;
  paket: string;
  peserta: number;
  nominal: number;
  total: number;
}

export interface InputHarianDraft {
  tanggal: string;
  kunjungan: KunjunganInputRow[];
  mcu: McuInputRow[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DRAFT_KEY = 'input-harian-draft';

export const KUNJUNGAN_COLS = [
  { k: 'rjYani',  l: 'RJ YANI' },
  { k: 'riYani',  l: 'RI YANI' },
  { k: 'igd',     l: 'IGD' },
  { k: 'mcuAuto', l: 'MCU AUTO', readOnly: true },
  { k: 'promo',   l: 'PROMO' },
  { k: 'dokter',  l: 'DOKTER' },
  { k: 'exc',     l: 'EXC' },
  { k: 'prior',   l: 'PRIOR' },
  { k: 'grhuRj',  l: 'GRHU RJ' },
  { k: 'grhuRi',  l: 'GRHU RI' },
  { k: 'sat',     l: 'SAT' },
  { k: 'ppk1',    l: 'PPK1' },
] as const;

// Label colors — matches the 9 label categories
export const LABEL_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  'PG':            { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-300' },
  'BPJS':          { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-300' },
  'BRI LIFE PG':   { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-300' },
  'PROKESPEN':     { bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-300' },
  'PROKESPEN BPJS':{ bg: 'bg-cyan-50',    text: 'text-cyan-700',    border: 'border-cyan-300' },
  'JKK':           { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-300' },
  'UMUM':          { bg: 'bg-yellow-50',  text: 'text-yellow-700',  border: 'border-yellow-300' },
  'NPG':           { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-300' },
  'AS':            { bg: 'bg-pink-50',    text: 'text-pink-700',    border: 'border-pink-300' },
};

const ALL_LABELS = Object.keys(LABEL_STYLES);

function labelClass(badge: string) {
  const s = LABEL_STYLES[badge?.toUpperCase()] || LABEL_STYLES['NPG'];
  return `${s.bg} ${s.text} ${s.border}`;
}

// Default penjamin rows matching Laporan Harian structure
const DEFAULT_PENJAMIN: Omit<KunjunganInputRow, 'id'>[] = [
  { namaPenjamin: 'KARYAWAN PG',              badge: 'PG',             rjYani:0,riYani:0,igd:0,mcuAuto:0,promo:0,dokter:0,exc:0,prior:0,grhuRj:0,grhuRi:0,sat:0,ppk1:0,total:0 },
  { namaPenjamin: 'KELUARGA PG',              badge: 'PG',             rjYani:0,riYani:0,igd:0,mcuAuto:0,promo:0,dokter:0,exc:0,prior:0,grhuRj:0,grhuRi:0,sat:0,ppk1:0,total:0 },
  { namaPenjamin: 'BPJS KESEHATAN',           badge: 'BPJS',           rjYani:0,riYani:0,igd:0,mcuAuto:0,promo:0,dokter:0,exc:0,prior:0,grhuRj:0,grhuRi:0,sat:0,ppk1:0,total:0 },
  { namaPenjamin: 'BPJS NAIK KELAS.',         badge: 'BPJS',           rjYani:0,riYani:0,igd:0,mcuAuto:0,promo:0,dokter:0,exc:0,prior:0,grhuRj:0,grhuRi:0,sat:0,ppk1:0,total:0 },
  { namaPenjamin: 'KARYAWAN PG BRI LIFE',     badge: 'BRI LIFE PG',    rjYani:0,riYani:0,igd:0,mcuAuto:0,promo:0,dokter:0,exc:0,prior:0,grhuRj:0,grhuRi:0,sat:0,ppk1:0,total:0 },
  { namaPenjamin: 'KELUARGA PG BRI LIFE',     badge: 'BRI LIFE PG',    rjYani:0,riYani:0,igd:0,mcuAuto:0,promo:0,dokter:0,exc:0,prior:0,grhuRj:0,grhuRi:0,sat:0,ppk1:0,total:0 },
  { namaPenjamin: 'PROKESPEN MURNI',          badge: 'PROKESPEN',      rjYani:0,riYani:0,igd:0,mcuAuto:0,promo:0,dokter:0,exc:0,prior:0,grhuRj:0,grhuRi:0,sat:0,ppk1:0,total:0 },
  { namaPenjamin: 'PROKESPEN BPJS COB',       badge: 'PROKESPEN BPJS', rjYani:0,riYani:0,igd:0,mcuAuto:0,promo:0,dokter:0,exc:0,prior:0,grhuRj:0,grhuRi:0,sat:0,ppk1:0,total:0 },
  { namaPenjamin: 'PASIEN UMUM',              badge: 'UMUM',           rjYani:0,riYani:0,igd:0,mcuAuto:0,promo:0,dokter:0,exc:0,prior:0,grhuRj:0,grhuRi:0,sat:0,ppk1:0,total:0 },
  { namaPenjamin: 'BPJS KETENAGAKERJAAN (JKK)', badge: 'JKK',          rjYani:0,riYani:0,igd:0,mcuAuto:0,promo:0,dokter:0,exc:0,prior:0,grhuRj:0,grhuRi:0,sat:0,ppk1:0,total:0 },
];

// Full penjamin list for autocomplete (NPG/AS label)
const PENJAMIN_LIST: { nama: string; badge: string }[] = [
  // Fixed labels
  { nama: 'KARYAWAN PG', badge: 'PG' },
  { nama: 'KELUARGA PG', badge: 'PG' },
  { nama: 'KARYAWAN PG INHEALTH', badge: 'PG' },
  { nama: 'KELUARGA PG INHEALTH', badge: 'PG' },
  { nama: 'BPJS KESEHATAN', badge: 'BPJS' },
  { nama: 'BPJS KESEHATAN - KAPITASI', badge: 'BPJS' },
  { nama: 'BPJS NAIK KELAS.', badge: 'BPJS' },
  { nama: 'KARYAWAN PG BRI LIFE', badge: 'BRI LIFE PG' },
  { nama: 'KELUARGA PG BRI LIFE', badge: 'BRI LIFE PG' },
  { nama: 'PROKESPEN MURNI', badge: 'PROKESPEN' },
  { nama: 'PROKESPEN BPJS COB', badge: 'PROKESPEN BPJS' },
  { nama: 'PASIEN UMUM', badge: 'UMUM' },
  { nama: 'MCU UMUM', badge: 'UMUM' },
  { nama: 'GENERAL PATIENT', badge: 'UMUM' },
  { nama: 'BPJS KETENAGAKERJAAN (JKK)', badge: 'JKK' },
  { nama: 'K3PG', badge: 'JKK' },
  { nama: 'COB BPJS KESEHATAN', badge: 'NPG' },
  // NPG (asuransi & perusahaan)
  { nama: 'ABYAKTA NASTARI TRANSINDO, PT', badge: 'NPG' },
  { nama: 'ADHI KARYA (PERSERO), PT', badge: 'NPG' },
  { nama: 'ADINATA GRAHA SOLUSI, PT', badge: 'NPG' },
  { nama: 'ADIRA DINAMIKA MEDICILIN (ADMEDIKA)', badge: 'AS' },
  { nama: 'ADMEDIKA - INHEALTH MANDIRI', badge: 'AS' },
  { nama: 'ADMEDIKA HEALTHCARE SOLUTION', badge: 'AS' },
  { nama: 'AIA ADMEDIKA', badge: 'AS' },
  { nama: 'AIA FINANCIAL', badge: 'AS' },
  { nama: 'AJ INHEALTH', badge: 'AS' },
  { nama: 'AKSES TELKO MEDIKA (PT TELKOM AKSES)', badge: 'NPG' },
  { nama: 'ANEKA JASA GRHADIKA, PT', badge: 'NPG' },
  { nama: 'APLIKANUSA LINTASARTA, PT', badge: 'NPG' },
  { nama: 'ASTRA AVIVA LIFE, PT', badge: 'AS' },
  { nama: 'ASURANSI ACA (ADMEDIKA)', badge: 'AS' },
  { nama: 'ASURANSI ADIRA MEDICILLIN - JSMART', badge: 'AS' },
  { nama: 'ASURANSI ADMEDIKA', badge: 'AS' },
  { nama: 'ASURANSI ALLIANZ ADMEDIKA', badge: 'AS' },
  { nama: 'ASURANSI ASTRA BUANA, PT', badge: 'AS' },
  { nama: 'ASURANSI AXA INDONESIA (ADMEDIKA), PT', badge: 'AS' },
  { nama: 'ASURANSI BRI LIFE, PT', badge: 'AS' },
  { nama: 'ASURANSI GARDA MEDIKA (ADMEDIKA)', badge: 'AS' },
  { nama: 'ASURANSI INHEALTH (ADMEDIKA)', badge: 'AS' },
  { nama: 'ASURANSI JIWA MANULIFE INDONESIA, PT (ADMEDIKA)', badge: 'AS' },
  { nama: 'ASURANSI MEGA LIFE', badge: 'AS' },
  { nama: 'ASURANSI RAMAYANA', badge: 'AS' },
  { nama: 'ASURANSI SINAR MAS, PT (ADMEDIKA)', badge: 'AS' },
  { nama: 'ASURANSI TAKAFUL KELUARGA, PT', badge: 'AS' },
  { nama: 'AVRIST ADMEDIKA', badge: 'AS' },
  { nama: 'AXA INSURANCE INDONESIA, PT', badge: 'AS' },
  { nama: 'AXA MANDIRI (ADMEDIKA)', badge: 'AS' },
  { nama: 'BANK RAKYAT INDONESIA', badge: 'NPG' },
  { nama: 'BANK TABUNGAN NEGARA (BTN)', badge: 'NPG' },
  { nama: 'BNI LIFE INSURANCE, PT', badge: 'AS' },
  { nama: 'CARGILL INDONESIA, PT', badge: 'NPG' },
  { nama: 'CEMINDO GEMILANG', badge: 'NPG' },
  { nama: 'CIGNA INDONESIA, PT (ADMEDIKA)', badge: 'AS' },
  { nama: 'COB BPJS KESEHATAN', badge: 'NPG' },
  { nama: 'DPB PETROKIMIA KAYAKU', badge: 'NPG' },
  { nama: 'EQUITY LIFE INDONESIA, PT', badge: 'AS' },
  { nama: 'FWD LIFE INDONESIA', badge: 'AS' },
  { nama: 'GENERALI INDONESIA LIFE (ADMEDIKA)', badge: 'AS' },
  { nama: 'GRAHA SARANA GRESIK, PT', badge: 'NPG' },
  { nama: 'HM. SAMPOERNA, PT', badge: 'NPG' },
  { nama: 'HIKARI TEKNOLOGI INDONESIA', badge: 'AS' },
  { nama: 'INHEALTH INDEMITY', badge: 'AS' },
  { nama: 'JASA RAHARJA, PT', badge: 'NPG' },
  { nama: 'JASINDO HEALTHCARE', badge: 'AS' },
  { nama: 'JINDAL STAINLES INDONESIA, PT', badge: 'NPG' },
  { nama: 'KOPERASI WARGA SEMEN GRESIK (KWSG)', badge: 'NPG' },
  { nama: 'KRAKATAU MEDIKA, PT', badge: 'NPG' },
  { nama: 'LIPPO LIFE ASSURANCE, PT (MEDITAP)', badge: 'AS' },
  { nama: 'MANDIRI INHEALTH OWLEXA', badge: 'AS' },
  { nama: 'MEGA INSURANCE (Fullerton)', badge: 'AS' },
  { nama: 'NIPSEA PAINT AND CHEMICALS (NIPPON PAINT), PT', badge: 'NPG' },
  { nama: 'PANGANSARI UTAMA, PT', badge: 'NPG' },
  { nama: 'PBV PETROKIMIA GRESIK', badge: 'NPG' },
  { nama: 'PELINDO, PT', badge: 'NPG' },
  { nama: 'PERTAMINA, PT', badge: 'NPG' },
  { nama: 'PETRO GRAHA MEDIKA (RSPG)(PGM), PT', badge: 'NPG' },
  { nama: 'PETRO JORDAN ABADI, PT', badge: 'NPG' },
  { nama: 'PETROKIMIA GRESIK, PT', badge: 'NPG' },
  { nama: 'PETROKIMIA KAYAKU, PT', badge: 'NPG' },
  { nama: 'PETRONIKA, PT', badge: 'NPG' },
  { nama: 'PETROSIDA, PT', badge: 'NPG' },
  { nama: 'PJB UNIT PEMBANGKITAN GRESIK, PT', badge: 'NPG' },
  { nama: 'PLN NUSANTARA, PT', badge: 'NPG' },
  { nama: 'PT INDOSPRING TBK', badge: 'NPG' },
  { nama: 'PT KNAUF GYPSUM INDONESIA', badge: 'NPG' },
  { nama: 'PT PAMAPERSADA NUSANTARA', badge: 'NPG' },
  { nama: 'PT PUPUK INDONESIA', badge: 'NPG' },
  { nama: 'PT WIJAYA KARYA Tbk (WIKA)', badge: 'NPG' },
  { nama: 'SMELTING, PT', badge: 'NPG' },
  { nama: 'SOLVAY MANYAR, PT', badge: 'NPG' },
  { nama: 'SUNDAY INSURANCE', badge: 'AS' },
  { nama: 'HANWHA LIFE', badge: 'AS' },
  { nama: 'MNC LIFE', badge: 'AS' },
  { nama: 'OONA INSURANCE', badge: 'AS' },
  { nama: 'NAYAKA', badge: 'AS' },
  { nama: 'WILMAR NABATI INDONESIA, PT', badge: 'NPG' },
  { nama: 'XINYI GLASS INDONESIA, PT', badge: 'NPG' },
  { nama: 'YAYASAN KESEHATAN PERTAMINA', badge: 'NPG' },
  { nama: 'YAYASAN PETROKIMIA GRESIK', badge: 'NPG' },
  // MCU pakets
  { nama: 'ANTIGEN MCU', badge: 'UMUM' },
  { nama: 'ANTIGEN PASIEN', badge: 'UMUM' },
  { nama: 'MCU CALON JAMAAH HAJI', badge: 'UMUM' },
  { nama: 'PAKET MINI MCU (UMUM)', badge: 'UMUM' },
  { nama: 'PAKET MERAH PUTIH (UMUM)', badge: 'UMUM' },
  { nama: 'PAKET PAHLAWAN (UMUM)', badge: 'UMUM' },
  { nama: 'PAKET PEJUANG (UMUM)', badge: 'UMUM' },
  { nama: 'PAKET SEGAR BUGAR', badge: 'UMUM' },
  { nama: 'PAKET SEHAT BUGAR', badge: 'UMUM' },
  { nama: 'PAKET SCREENING A (UMUM)', badge: 'UMUM' },
  { nama: 'PAKET SAHABAT DIABETES (UMUM)', badge: 'UMUM' },
  { nama: 'PAKET SAHABAT JANTUNG BASIC (UMUM)', badge: 'UMUM' },
  { nama: 'PAKET NARKOBA (UMUM)', badge: 'UMUM' },
  { nama: 'PAKET BASIC PEKERJA (UMUM)', badge: 'UMUM' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function nanoid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function calcTotal(row: Omit<KunjunganInputRow, 'id' | 'total'>): number {
  return KUNJUNGAN_COLS.reduce((s, c) => s + (Number((row as any)[c.k]) || 0), 0);
}

function defaultKunjunganRows(): KunjunganInputRow[] {
  return DEFAULT_PENJAMIN.map(p => ({ ...p, id: nanoid() }));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Combobox for penjamin name with autocomplete */
function PenjaminCombobox({
  value,
  badge,
  onChange,
}: {
  value: string;
  badge: string;
  onChange: (nama: string, badge: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = query.length >= 1
    ? PENJAMIN_LIST.filter(p => p.nama.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : [];

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-1">
        <Input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => {
            // commit free-text if not in list
            if (query !== value) onChange(query, badge);
          }, 150)}
          className="h-7 text-[11px] w-[160px]"
          placeholder="Cari penjamin..."
        />
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border whitespace-nowrap ${labelClass(badge)}`}>
          {badge || '?'}
        </span>
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-8 left-0 w-72 bg-popover border border-border rounded-md shadow-lg max-h-52 overflow-y-auto">
          {filtered.map(p => (
            <button
              key={p.nama}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-left hover:bg-muted transition-colors"
              onMouseDown={() => { onChange(p.nama, p.badge); setQuery(p.nama); setOpen(false); }}
            >
              <span className={`text-[9px] font-bold px-1 py-0.5 rounded border shrink-0 ${labelClass(p.badge)}`}>{p.badge}</span>
              <span className="truncate">{p.nama}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Summary card */
function SummaryCard({ label, value, color, sub }: { label: string; value: number; color: string; sub?: string }) {
  return (
    <div className="card-clinical px-3 py-2 flex flex-col gap-0.5 min-w-[90px]">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground font-mono-data">{label}</p>
      <p className="text-lg font-bold font-display" style={{ color }}>{value}</p>
      {sub && <p className="text-[9px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InputHarianTab() {
  const [tanggal, setTanggal] = useState(todayISO());
  const [kunjungan, setKunjungan] = useState<KunjunganInputRow[]>(defaultKunjunganRows());
  const [mcu, setMcu] = useState<McuInputRow[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // ── Load draft ─────────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft: InputHarianDraft = JSON.parse(raw);
        setTanggal(draft.tanggal || todayISO());
        setKunjungan(draft.kunjungan?.length ? draft.kunjungan : defaultKunjunganRows());
        setMcu(draft.mcu || []);
      }
    } catch { /* ignore */ }
  }, []);

  // ── Auto-save draft ────────────────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ tanggal, kunjungan, mcu }));
  }, [tanggal, kunjungan, mcu]);

  // ── MCU → auto-aggregate mcuAuto per badge ─────────────────────────────────
  useEffect(() => {
    // Build map: badge → total peserta
    const mcuByBadge: Record<string, number> = {};
    for (const row of mcu) {
      if (row.label) {
        mcuByBadge[row.label] = (mcuByBadge[row.label] || 0) + (row.peserta || 0);
      }
    }

    setKunjungan(prev => prev.map(row => {
      const aggregated = mcuByBadge[row.badge] || 0;
      if (row.mcuAuto === aggregated) return row;
      const updated = { ...row, mcuAuto: aggregated };
      updated.total = calcTotal(updated);
      return updated;
    }));
  }, [mcu]);

  // ── Kunjungan handlers ─────────────────────────────────────────────────────
  const updateKunjungan = useCallback((id: string, field: string, val: string) => {
    setKunjungan(prev => prev.map(row => {
      if (row.id !== id) return row;
      const updated = { ...row, [field]: Number(val) || 0 };
      updated.total = calcTotal(updated);
      return updated;
    }));
  }, []);

  const updatePenjamin = useCallback((id: string, nama: string, badge: string) => {
    setKunjungan(prev => prev.map(row => row.id === id ? { ...row, namaPenjamin: nama, badge } : row));
  }, []);

  const addKunjunganRow = () => {
    setKunjungan(prev => [...prev, { id: nanoid(), namaPenjamin: '', badge: 'NPG', rjYani:0,riYani:0,igd:0,mcuAuto:0,promo:0,dokter:0,exc:0,prior:0,grhuRj:0,grhuRi:0,sat:0,ppk1:0,total:0 }]);
  };

  const removeKunjunganRow = (id: string) => {
    setKunjungan(prev => prev.filter(r => r.id !== id));
  };

  // ── MCU handlers ───────────────────────────────────────────────────────────
  const updateMcu = useCallback((id: string, field: string, val: string) => {
    setMcu(prev => prev.map(row => {
      if (row.id !== id) return row;
      const numFields = ['peserta', 'nominal'];
      const updated = { ...row, [field]: numFields.includes(field) ? Number(val) || 0 : val };
      updated.total = updated.peserta * updated.nominal;
      return updated;
    }));
  }, []);

  const addMcuRow = () => setMcu(prev => [...prev, { id: nanoid(), perusahaan: '', label: 'NPG', paket: '', peserta: 0, nominal: 0, total: 0 }]);
  const removeMcuRow = (id: string) => setMcu(prev => prev.filter(r => r.id !== id));

  // ── Reset ──────────────────────────────────────────────────────────────────
  const handleReset = () => {
    setTanggal(todayISO());
    setKunjungan(defaultKunjunganRows());
    setMcu([]);
    localStorage.removeItem(DRAFT_KEY);
    toast.success('Form direset');
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const GS_URL = (import.meta.env.VITE_GAS_INPUT_URL as string) || '';
    if (!GS_URL) { toast.error('VITE_GAS_INPUT_URL belum diset di .env'); return; }

    setSubmitting(true);
    try {
      await fetch(GS_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'inputHarian', tanggal, kunjungan, mcu }),
      });
      toast.success('Data berhasil dikirim ke Sheets!');
      localStorage.removeItem(DRAFT_KEY);
    } catch (err: any) {
      toast.error(`Gagal kirim: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Computed totals & summary ──────────────────────────────────────────────
  const colTotals = KUNJUNGAN_COLS.map(c => ({
    k: c.k,
    total: kunjungan.reduce((s, r) => s + (Number((r as any)[c.k]) || 0), 0),
  }));

  const grandTotal = kunjungan.reduce((s, r) => s + r.total, 0);

  // Summary per unit
  const unitSummary = {
    rj: kunjungan.reduce((s, r) => s + r.rjYani, 0),
    ri: kunjungan.reduce((s, r) => s + r.riYani, 0),
    igd: kunjungan.reduce((s, r) => s + r.igd, 0),
    mcu: kunjungan.reduce((s, r) => s + r.mcuAuto, 0),
    promo: kunjungan.reduce((s, r) => s + r.promo, 0),
  };

  // Summary per label per unit
  const labelSummary = ALL_LABELS.map(label => {
    const rows = kunjungan.filter(r => r.badge === label);
    return {
      label,
      rj: rows.reduce((s, r) => s + r.rjYani, 0),
      ri: rows.reduce((s, r) => s + r.riYani, 0),
      igd: rows.reduce((s, r) => s + r.igd, 0),
      mcu: rows.reduce((s, r) => s + r.mcuAuto, 0),
      total: rows.reduce((s, r) => s + r.total, 0),
    };
  }).filter(l => l.total > 0);

  const mcuTotalPeserta = mcu.reduce((s, r) => s + r.peserta, 0);
  const mcuTotalNominal = mcu.reduce((s, r) => s + r.total, 0);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 page-transition">

      {/* ── Date picker + action bar ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground">Tanggal</label>
          <Input
            type="date"
            value={tanggal}
            onChange={e => setTanggal(e.target.value)}
            className="w-38 text-sm h-8"
          />
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-1 ml-1">
          <Save className="w-3 h-3" />
          <span>Draft tersimpan otomatis</span>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={submitting}
            className="bg-[#1a3a5c] hover:bg-[#1a3a5c]/90 text-white">
            <Send className="w-3.5 h-3.5 mr-1" />
            {submitting ? 'Mengirim...' : 'Submit ke Sheets'}
          </Button>
        </div>
      </div>

      {/* ── Summary harian ───────────────────────────────────────────────── */}
      <div className="card-clinical p-4 space-y-3">
        <h3 className="text-sm font-bold">Summary Harian — {tanggal}</h3>

        {/* Per unit */}
        <div className="flex gap-2 flex-wrap">
          <SummaryCard label="RJ A.Yani" value={unitSummary.rj} color="#2563eb" />
          <SummaryCard label="RI A.Yani" value={unitSummary.ri} color="#7c3aed" />
          <SummaryCard label="IGD" value={unitSummary.igd} color="#dc2626" />
          <SummaryCard label="MCU" value={unitSummary.mcu} color="#0891b2" sub={`${mcuTotalPeserta} peserta MCU`} />
          <SummaryCard label="Promo" value={unitSummary.promo} color="#059669" />
          <SummaryCard label="Grand Total" value={grandTotal} color="#0a9e87" />
        </div>

        {/* Per label breakdown */}
        {labelSummary.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] font-mono-data">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-1.5 pr-3 font-semibold text-muted-foreground">LABEL</th>
                  <th className="text-right py-1.5 px-2 font-semibold text-muted-foreground">RJ</th>
                  <th className="text-right py-1.5 px-2 font-semibold text-muted-foreground">RI</th>
                  <th className="text-right py-1.5 px-2 font-semibold text-muted-foreground">IGD</th>
                  <th className="text-right py-1.5 px-2 font-semibold text-muted-foreground">MCU</th>
                  <th className="text-right py-1.5 pl-2 font-semibold text-muted-foreground">TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {labelSummary.map(l => (
                  <tr key={l.label} className="border-b border-border/30">
                    <td className="py-1 pr-3">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${labelClass(l.label)}`}>{l.label}</span>
                    </td>
                    <td className="text-right px-2 py-1">{l.rj || '—'}</td>
                    <td className="text-right px-2 py-1">{l.ri || '—'}</td>
                    <td className="text-right px-2 py-1">{l.igd || '—'}</td>
                    <td className="text-right px-2 py-1">{l.mcu || '—'}</td>
                    <td className="text-right pl-2 py-1 font-bold text-[#0a9e87]">{l.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Tabel Kunjungan per Penjamin ──────────────────────────────────── */}
      <div className="card-clinical p-4 overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold">Kunjungan per Penjamin</h3>
          <span className="text-xs text-muted-foreground">{kunjungan.length} baris</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[11px] font-mono-data" style={{ minWidth: '1000px' }}>
            <thead>
              <tr className="bg-muted">
                <th className="px-2 py-2 text-left w-7">#</th>
                <th className="px-2 py-2 text-left" style={{ minWidth: '200px' }}>NAMA PENJAMIN</th>
                {KUNJUNGAN_COLS.map(c => (
                  <th key={c.k} className={`px-2 py-2 text-center whitespace-nowrap ${'readOnly' in c && c.readOnly ? 'bg-blue-50 text-blue-700' : ''}`}>
                    {c.l}
                    {'readOnly' in c && c.readOnly && <span className="block text-[8px] text-blue-400">auto</span>}
                  </th>
                ))}
                <th className="px-2 py-2 text-right font-bold">TOTAL</th>
                <th className="px-2 py-2 w-7" />
              </tr>
            </thead>
            <tbody>
              {kunjungan.map((row, i) => (
                <tr key={row.id} className="border-t border-border/40 hover:bg-muted/20 transition-colors">
                  <td className="px-2 py-1 text-muted-foreground">{i + 1}</td>
                  <td className="px-1 py-1">
                    <PenjaminCombobox
                      value={row.namaPenjamin}
                      badge={row.badge}
                      onChange={(nama, badge) => updatePenjamin(row.id, nama, badge)}
                    />
                  </td>
                  {KUNJUNGAN_COLS.map(c => {
                    const isAuto = 'readOnly' in c && c.readOnly;
                    const val = (row as any)[c.k] as number;
                    return (
                      <td key={c.k} className={`px-1 py-1 ${isAuto ? 'bg-blue-50/50' : ''}`}>
                        {isAuto ? (
                          <div className="h-7 w-14 flex items-center justify-center text-blue-700 font-bold text-[11px]">
                            {val > 0 ? val : '—'}
                          </div>
                        ) : (
                          <Input
                            type="number"
                            min={0}
                            value={val === 0 ? '' : val}
                            onChange={e => updateKunjungan(row.id, c.k, e.target.value)}
                            className="h-7 text-[11px] text-center w-14 px-1"
                            placeholder="—"
                          />
                        )}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1 text-right font-bold text-[#0a9e87]">
                    {row.total > 0 ? row.total : '—'}
                  </td>
                  <td className="px-1 py-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => removeKunjunganRow(row.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </td>
                </tr>
              ))}

              {/* Total row */}
              <tr className="border-t-2 border-border bg-muted/60 font-bold">
                <td colSpan={2} className="px-2 py-2 text-right text-xs text-muted-foreground">TOTAL</td>
                {colTotals.map(c => (
                  <td key={c.k} className="px-2 py-2 text-center text-[#0a9e87]">
                    {c.total > 0 ? c.total : '—'}
                  </td>
                ))}
                <td className="px-2 py-2 text-right text-[#0a9e87]">{grandTotal > 0 ? grandTotal : '—'}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>

        <Button variant="outline" size="sm" className="text-xs mt-3" onClick={addKunjunganRow}>
          <Plus className="w-3 h-3 mr-1" /> + Penjamin Baru
        </Button>
      </div>

      {/* ── Tabel MCU Harian ──────────────────────────────────────────────── */}
      <div className="card-clinical p-4 overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold">MCU Harian</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Total peserta akan otomatis teraggregate ke kolom MCU AUTO per label
            </p>
          </div>
          <span className="text-xs text-muted-foreground">{mcu.length} baris · {mcuTotalPeserta} peserta</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[11px] font-mono-data" style={{ minWidth: '680px' }}>
            <thead>
              <tr className="bg-muted">
                <th className="px-2 py-2 text-left w-7">#</th>
                <th className="px-2 py-2 text-left" style={{ minWidth: '200px' }}>PERUSAHAAN</th>
                <th className="px-2 py-2 text-center w-24">LABEL</th>
                <th className="px-2 py-2 text-left" style={{ minWidth: '120px' }}>PAKET</th>
                <th className="px-2 py-2 text-center w-20">PESERTA</th>
                <th className="px-2 py-2 text-right w-28">NOMINAL/ORG</th>
                <th className="px-2 py-2 text-right w-28">TOTAL</th>
                <th className="px-2 py-2 w-7" />
              </tr>
            </thead>
            <tbody>
              {mcu.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-2 py-8 text-center text-muted-foreground text-xs">
                    Belum ada data MCU — klik "+ Baris MCU" untuk menambah
                  </td>
                </tr>
              )}
              {mcu.map((row, i) => (
                <tr key={row.id} className="border-t border-border/40 hover:bg-muted/20">
                  <td className="px-2 py-1 text-muted-foreground">{i + 1}</td>
                  <td className="px-1 py-1">
                    <Input value={row.perusahaan} onChange={e => updateMcu(row.id, 'perusahaan', e.target.value)}
                      className="h-7 text-[11px]" placeholder="Nama perusahaan" />
                  </td>
                  <td className="px-1 py-1">
                    <select
                      value={row.label}
                      onChange={e => updateMcu(row.id, 'label', e.target.value)}
                      className={`h-7 w-full text-[10px] font-bold rounded border px-1 cursor-pointer ${labelClass(row.label)}`}
                    >
                      {ALL_LABELS.map(l => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-1 py-1">
                    <Input value={row.paket} onChange={e => updateMcu(row.id, 'paket', e.target.value)}
                      className="h-7 text-[11px]" placeholder="Nama paket" />
                  </td>
                  <td className="px-1 py-1">
                    <Input type="number" min={0} value={row.peserta || ''}
                      onChange={e => updateMcu(row.id, 'peserta', e.target.value)}
                      className="h-7 text-[11px] text-center w-full" placeholder="0" />
                  </td>
                  <td className="px-1 py-1">
                    <Input type="number" min={0} value={row.nominal || ''}
                      onChange={e => updateMcu(row.id, 'nominal', e.target.value)}
                      className="h-7 text-[11px] text-right w-full" placeholder="0" />
                  </td>
                  <td className="px-2 py-1 text-right font-bold text-[#0a9e87]">
                    {row.total > 0 ? row.total.toLocaleString('id-ID') : '—'}
                  </td>
                  <td className="px-1 py-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => removeMcuRow(row.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </td>
                </tr>
              ))}

              {mcu.length > 0 && (
                <tr className="border-t-2 border-border bg-muted/60 font-bold">
                  <td colSpan={4} className="px-2 py-2 text-right text-xs text-muted-foreground">TOTAL</td>
                  <td className="px-2 py-2 text-center text-[#0a9e87]">{mcuTotalPeserta}</td>
                  <td />
                  <td className="px-2 py-2 text-right text-[#0a9e87]">{mcuTotalNominal.toLocaleString('id-ID')}</td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Button variant="outline" size="sm" className="text-xs mt-3" onClick={addMcuRow}>
          <Plus className="w-3 h-3 mr-1" /> + Baris MCU
        </Button>
      </div>

      {/* ── Bottom submit ─────────────────────────────────────────────────── */}
      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <Button variant="outline" size="sm" onClick={handleReset}>
          <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset
        </Button>
        <Button size="sm" onClick={handleSubmit} disabled={submitting}
          className="bg-[#1a3a5c] hover:bg-[#1a3a5c]/90 text-white">
          <Send className="w-3.5 h-3.5 mr-1" />
          {submitting ? 'Mengirim...' : 'Submit ke Sheets'}
        </Button>
      </div>

    </div>
  );
}
