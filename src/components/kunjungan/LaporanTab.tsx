import { useState, useEffect, useMemo, useCallback } from 'react';
import { Copy, MessageCircle, Trash2, Plus, Minus, RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';


const HARI_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const LS_KEY = 'laporan-draft';
const INPUT_HARIAN_KEY = 'input-harian-draft';

const fmtRpWA = (n: number) => Math.round(n).toLocaleString('id-ID');
const fmtKunjTarget = (n: number) => n.toLocaleString('id-ID');
const todayISO = () => new Date().toISOString().slice(0, 10);

interface PromoItem { label: string; value: number }

const DEFAULT_PROMO: PromoItem[] = [
  { label: 'paket Basic pekerja (umum)', value: 0 },
  { label: 'Paket sahabat ginjal (umum)', value: 0 },
  { label: 'Screening paket B', value: 0 },
  { label: 'Pre marital silver', value: 0 },
  { label: 'Promo alergi', value: 0 },
  { label: 'Sehat Bugar', value: 0 },
  { label: 'Paket Narkoba', value: 0 },
  { label: 'Paket executive platinum', value: 0 },
];

interface FormData {
  tanggal: string;
  rj: number; nonBpjsRJ: number;
  ri: number; nonBpjsRI: number;
  igd: number; nonBpjsIGD: number;
  mcu: number;
  rujukanGrahu: number; rujukanPPK1: number; rujukanSatkal: number; rujukanDokterLuar: number;
  poliExclusive: number; poliPrioritas: number;
  briIgdKry: number; briIgdKel: number; briRajalKry: number; briRajalKel: number; briRawinKry: number; briRawinKel: number;
  promoItems: PromoItem[];
  morullaTerjadwal: number; morullaHadir: number;
  targetKunjungan: number; targetOmzet: number;
  totalOmzet: number; pendapatanMCU: number;
  // Kumulatif manual
  kumOmzet: number; kumKunj: number;
  targetOmzetBulan: number; targetKunjBulan: number;
  tglAkhir: number;
}

function defaultForm(): FormData {
  return {
    tanggal: todayISO(),
    rj: 0, nonBpjsRJ: 0, ri: 0, nonBpjsRI: 0, igd: 0, nonBpjsIGD: 0, mcu: 0,
    rujukanGrahu: 0, rujukanPPK1: 0, rujukanSatkal: 0, rujukanDokterLuar: 0,
    poliExclusive: 0, poliPrioritas: 0,
    briIgdKry: 0, briIgdKel: 0, briRajalKry: 0, briRajalKel: 0, briRawinKry: 0, briRawinKel: 0,
    promoItems: DEFAULT_PROMO.map(p => ({ ...p })),
    morullaTerjadwal: 0, morullaHadir: 0,
    targetKunjungan: 0, targetOmzet: 0,
    totalOmzet: 0, pendapatanMCU: 0,
    kumOmzet: 0, kumKunj: 0, targetOmzetBulan: 0, targetKunjBulan: 0, tglAkhir: 0,
  };
}

// Read & compute totals from InputHarian draft
function readInputHarianDraft(tanggal: string) {
  try {
    const raw = localStorage.getItem(INPUT_HARIAN_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as { tanggal: string; kunjungan: any[]; mcu?: any[] };
    if (draft.tanggal !== tanggal) return null;
    const rows: any[] = draft.kunjungan || [];
    const sum = (key: string) => rows.reduce((s: number, r: any) => s + (Number(r[key]) || 0), 0);
    const bpjsRows = rows.filter((r: any) => r.badge === 'BPJS');
    const sumBpjs = (key: string) => bpjsRows.reduce((s: number, r: any) => s + (Number(r[key]) || 0), 0);
    const rj  = sum('rjYani');
    const ri  = sum('riYani');
    const igd = sum('igd');
    const mcuRows: any[] = draft.mcu || [];
    const pendapatanMCU = mcuRows.reduce((s: number, r: any) => s + (Number(r.total) || 0), 0);
    const grandTotal = rows.reduce((s: number, r: any) =>
      s + ['rjYani','riYani','igd','mcuAuto','promo','dokter','exc','prior','grhuRj','grhuRi','sat','ppk1']
        .reduce((rs, k) => rs + (Number(r[k])||0), 0), 0);
    // Pasien PG: baris 1-4 (KARYAWAN PG, KELUARGA PG, KARYAWAN PG BRI LIFE, KELUARGA PG BRI LIFE)
    const pgNames = ['KARYAWAN PG', 'KARYAWAN PG BRI LIFE'];
    const pgKelNames = ['KELUARGA PG', 'KELUARGA PG BRI LIFE'];
    const pgKryRows = rows.filter((r: any) => pgNames.includes(r.namaPenjamin));
    const pgKelRows = rows.filter((r: any) => pgKelNames.includes(r.namaPenjamin));
    const sumRows = (arr: any[], key: string) => arr.reduce((s: number, r: any) => s + (Number(r[key]) || 0), 0);

    return {
      rj,  nonBpjsRJ:  rj  - sumBpjs('rjYani'),
      ri,  nonBpjsRI:  ri  - sumBpjs('riYani'),
      igd, nonBpjsIGD: igd - sumBpjs('igd'),
      mcu: sum('mcuAuto'),
      rujukanGrahu:      sum('grhuRj') + sum('grhuRi'),
      rujukanPPK1:       sum('ppk1'),
      rujukanSatkal:     sum('sat'),
      rujukanDokterLuar: sum('dokter'),
      poliExclusive:     sum('exc'),
      poliPrioritas:     sum('prior'),
      pendapatanMCU,
      grandTotal,
      // Pasien PG (auto dari baris 1-4)
      briIgdKry:    sumRows(pgKryRows, 'igd'),
      briIgdKel:    sumRows(pgKelRows, 'igd'),
      briRajalKry:  sumRows(pgKryRows, 'rjYani'),
      briRajalKel:  sumRows(pgKelRows, 'rjYani'),
      briRawinKry:  sumRows(pgKryRows, 'riYani'),
      briRawinKel:  sumRows(pgKelRows, 'riYani'),
    };
  } catch { return null; }
}

function NumInput({ value, onChange, label, auto, gsAutoFill }: {
  value: number; onChange: (v: number) => void; label: string;
  auto?: boolean; gsAutoFill?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-muted-foreground flex-1 min-w-0">
        {label}
        {auto      && <span className="text-[9px] ml-1 text-green-600 font-medium">(auto)</span>}
        {gsAutoFill && <span className="text-[9px] ml-1 text-accent font-medium">(dari Sheets)</span>}
      </label>
      <Input
        type="text" inputMode="numeric"
        value={value || ''}
        onChange={e => onChange(Number(e.target.value.replace(/\D/g, '')) || 0)}
        className={cn("w-24 h-8 text-right text-xs font-mono",
          auto && "border-green-400/50 bg-green-50/30",
          gsAutoFill && "bg-accent/5 border-accent/30")}
        placeholder="0"
      />
    </div>
  );
}

function RpInput({ value, onChange, label, auto, gsAutoFill }: { value: number; onChange: (v: number) => void; label: string; auto?: boolean; gsAutoFill?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-muted-foreground flex-1 min-w-0">
        {label}
        {auto      && <span className="text-[9px] ml-1 text-green-600 font-medium">(auto)</span>}
        {gsAutoFill && <span className="text-[9px] ml-1 text-accent font-medium">(dari Sheets)</span>}
      </label>
      <div className="relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">Rp</span>
        <Input
          type="text" inputMode="numeric"
          value={value ? fmtRpWA(value) : ''}
          onChange={e => onChange(Number(e.target.value.replace(/\D/g, '')) || 0)}
          className={cn("w-40 h-8 text-right text-[10px] font-mono pl-7",
            auto && "border-green-400/50 bg-green-50/30",
            gsAutoFill && "bg-accent/5 border-accent/30")}
          placeholder="0"
        />
      </div>
    </div>
  );
}

export default function LaporanTab() {
  const [form, setForm] = useState<FormData>(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) return { ...defaultForm(), ...JSON.parse(saved).data };
    } catch {}
    return defaultForm();
  });
  const [draftTime, setDraftTime] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) return JSON.parse(saved).time || null;
    } catch {}
    return null;
  });
  const [autoFields, setAutoFields] = useState<Set<string>>(new Set());
  const [inputHarianGrandTotal, setInputHarianGrandTotal] = useState<number | null>(null);

  // Auto-fill Section B from InputHarian draft when tanggal matches
  const syncFromInputHarian = useCallback((silent = false) => {
    const data = readInputHarianDraft(form.tanggal);
    if (!data) {
      if (!silent) toast.error('Data Input Harian untuk tanggal ini tidak ditemukan');
      return;
    }
    setInputHarianGrandTotal(data.grandTotal ?? null);
    const { grandTotal: _, ...formData } = data;
    setForm(prev => ({ ...prev, ...formData }));
    setAutoFields(new Set(Object.keys(formData)));
    if (!silent) toast.success('Data kunjungan disinkronkan dari Input Harian');
  }, [form.tanggal]);

  // Auto-sync on mount or date change (silent)
  useEffect(() => {
    syncFromInputHarian(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.tanggal]);

  // Auto-fill targets dari GAS getTarget (sheet OMSET HARIAN 2026)
  useEffect(() => {
    let cancelled = false;
    const GS_URL = (import.meta.env.VITE_GAS_INPUT_URL as string) || '';
    if (!GS_URL || !form.tanggal) return;

    fetch(`${GS_URL}?action=getTarget&tanggal=${encodeURIComponent(form.tanggal)}`)
      .then(res => res.ok ? res.json() : Promise.reject('HTTP ' + res.status))
      .then(d => {
        if (cancelled) return;
        if (d.error) { console.warn('getTarget error:', d.error); return; }
        console.log('getTarget response:', d);
        setForm(prev => ({
          ...prev,
          targetKunjungan: d.targetKunjHarian || prev.targetKunjungan,
          targetOmzet: d.targetOmzetHarian || prev.targetOmzet,
          targetOmzetBulan: d.targetOmzetBulan || prev.targetOmzetBulan,
          targetKunjBulan: d.targetKunjBulan || prev.targetKunjBulan,
        }));
        setAutoFields(prev => {
          const s = new Set(prev);
          if (d.targetKunjHarian) s.add('targetKunjungan');
          if (d.targetOmzetHarian) s.add('targetOmzet');
          if (d.targetOmzetBulan) s.add('targetOmzetBulan');
          if (d.targetKunjBulan) s.add('targetKunjBulan');
          return s;
        });
      })
      .catch(err => console.warn('getTarget fetch failed:', err));

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.tanggal]);

  // Auto-fill kumulatif dari GAS getKumulatif (sheet OMSET HARIAN 2026)
  // Sum kolom D (omzet) & F (kunjungan) dari tgl 1 s/d (tanggal - 1)
  useEffect(() => {
    let cancelled = false;
    const GS_URL = (import.meta.env.VITE_GAS_INPUT_URL as string) || '';
    if (!GS_URL || !form.tanggal) return;

    fetch(`${GS_URL}?action=getKumulatif&tanggal=${encodeURIComponent(form.tanggal)}`)
      .then(res => res.ok ? res.json() : Promise.reject('HTTP ' + res.status))
      .then(d => {
        if (cancelled) return;
        if (d.error) { console.warn('getKumulatif error:', d.error); return; }
        console.log('getKumulatif response:', d);
        setForm(prev => ({
          ...prev,
          kumOmzet: d.kumOmzet ?? prev.kumOmzet,
          kumKunj: d.kumKunj ?? prev.kumKunj,
          tglAkhir: d.tglAkhir ?? prev.tglAkhir,
        }));
        setAutoFields(prev => {
          const s = new Set(prev);
          if (d.kumOmzet !== undefined) s.add('kumOmzet');
          if (d.kumKunj !== undefined) s.add('kumKunj');
          return s;
        });
      })
      .catch(err => console.warn('getKumulatif fetch failed:', err));

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.tanggal]);

  // Auto-save
  useEffect(() => {
    const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    localStorage.setItem(LS_KEY, JSON.stringify({ data: form, time }));
    setDraftTime(time);
  }, [form]);

  const set = useCallback(<K extends keyof FormData>(key: K, val: FormData[K]) => {
    setForm(prev => ({ ...prev, [key]: val }));
    setAutoFields(prev => { const s = new Set(prev); s.delete(key as string); return s; });
  }, []);

  const setPromo = useCallback((idx: number, val: number) => {
    setForm(prev => { const items = [...prev.promoItems]; items[idx] = { ...items[idx], value: val }; return { ...prev, promoItems: items }; });
  }, []);
  const addPromo = useCallback(() => {
    setForm(prev => ({ ...prev, promoItems: [...prev.promoItems, { label: 'Item baru', value: 0 }] }));
  }, []);
  const removePromo = useCallback((idx: number) => {
    setForm(prev => ({ ...prev, promoItems: prev.promoItems.filter((_, i) => i !== idx) }));
  }, []);
  const setPromoLabel = useCallback((idx: number, label: string) => {
    setForm(prev => { const items = [...prev.promoItems]; items[idx] = { ...items[idx], label }; return { ...prev, promoItems: items }; });
  }, []);

  // Calculations
  const totalPromoLab = form.promoItems.reduce((s, p) => s + p.value, 0);
  const totalKunjungan = form.rj + form.ri + form.igd + form.mcu
    + form.rujukanGrahu + form.rujukanPPK1 + form.rujukanSatkal + form.rujukanDokterLuar
    + form.poliExclusive + form.poliPrioritas + totalPromoLab;
  const pctKunjungan   = form.targetKunjungan > 0 ? Math.round((totalKunjungan / form.targetKunjungan) * 100) : 0;
  const pendapatanSelainMCU = Math.max(0, form.totalOmzet - form.pendapatanMCU);
  const totalPendapatan = form.totalOmzet;
  const pctPendapatan  = form.targetOmzet > 0 ? Math.round((totalPendapatan / form.targetOmzet) * 100) : 0;
  const rerataPerPasien = totalKunjungan > 0 ? Math.round(totalPendapatan / totalKunjungan) : 0;
  // Kumulatif total = data s/d kemarin (dari Sheets) + data hari ini (dari baris F)
  const kumOmzetTotal = form.kumOmzet + totalPendapatan;
  const kumKunjTotal  = form.kumKunj  + totalKunjungan;
  const pctKumOmzet = form.targetOmzetBulan > 0 ? Math.round((kumOmzetTotal / form.targetOmzetBulan) * 100) : 0;
  const pctKumKunj  = form.targetKunjBulan  > 0 ? Math.round((kumKunjTotal  / form.targetKunjBulan)  * 100) : 0;

  const tgl = useMemo(() => {
    const [y, m, d] = form.tanggal.split('-').map(Number);
    return new Date(y, m - 1, d);
  }, [form.tanggal]);
  const namaHari  = HARI_ID[tgl.getDay()];
  const namaBulan = BULAN_ID[tgl.getMonth()];
  const tahun     = tgl.getFullYear();
  const tglAkhir  = tgl.getDate();

  const isAuto = (k: string) => autoFields.has(k);

  const outputTeks = useMemo(() => {
    const lines: string[] = [];
    lines.push(`LAPORAN KUNJUNGAN  `);
    lines.push(`${namaHari} ${tgl.getDate()} ${namaBulan} ${tahun}`);
    lines.push(`* Rawat Jalan : ${form.rj}`);
    lines.push(`▪Non BPJS : ${form.nonBpjsRJ}`);
    lines.push(`* Rawat Inap : ${form.ri}`);
    lines.push(`▪Non BPJS : ${form.nonBpjsRI}`);
    lines.push(`* IGD : ${form.igd}`);
    lines.push(`▪Non BPJS : ${form.nonBpjsIGD}`);
    lines.push(`* MCU : ${form.mcu}`);
    lines.push(`* Rujukan SBU/Grahu : ${form.rujukanGrahu}`);
    lines.push(`* Rujukan SBU/PPK1 : ${form.rujukanPPK1}`);
    lines.push(`* Rujukan SBU/Satkal : ${form.rujukanSatkal}`);
    lines.push(`* Rujukan dokter Luar : ${form.rujukanDokterLuar}`);
    lines.push(`* Poli Exclusive : ${form.poliExclusive}`);
    lines.push(`* Poli Prioritas : ${form.poliPrioritas}`);
    lines.push(`* Pasien PG:`);
    lines.push(`1. Igd Kry PG : ${form.briIgdKry}`);
    lines.push(`2. Igd Kel PG : ${form.briIgdKel}`);
    lines.push(`3. Rajal Kry PG : ${form.briRajalKry}`);
    lines.push(`4. Rajal Kel  PG : ${form.briRajalKel}`);
    lines.push(`5. Rawin Kry PG : ${form.briRawinKry}`);
    lines.push(`6. Rawin Kel PG : ${form.briRawinKel}`);
    lines.push(`* Promo Lab : `);
    form.promoItems.forEach((p, i) => { lines.push(`${i + 1}. ${p.label}: ${p.value}`); });
    lines.push(`* Pasien AS Morulla `);
    lines.push(`1. Terjadwal hari ini : ${form.morullaTerjadwal}`);
    lines.push(`2. Hadir hari ini : ${form.morullaHadir}`);
    lines.push(`  ================`);
    lines.push(`Capaian Harian `);
    lines.push(`* Total Kunj Harian : ${totalKunjungan} (${pctKunjungan}%)`);
    lines.push(`* Pendapatan MCU :  Rp ${fmtRpWA(form.pendapatanMCU)}`);
    lines.push(`* Pendapatan selain MCU: Rp ${fmtRpWA(pendapatanSelainMCU)}`);
    lines.push(`* Total Pendapatan: Rp ${fmtRpWA(totalPendapatan)} (${pctPendapatan}%)`);
    lines.push(`* Target harian : Rp ${fmtRpWA(form.targetOmzet)}`);
    lines.push(`----------------`);
    lines.push(`Rerata Jumlah entryan Per pasien : Rp ${fmtRpWA(rerataPerPasien)}/Pasien`);
    lines.push(`---------------`);
    lines.push(`================`);
    lines.push(`CAPAIAN 01 - ${tglAkhir} ${namaBulan} ${tahun}`);
    lines.push(`* Total pendapatan : Rp ${fmtRpWA(kumOmzetTotal)} (${pctKumOmzet}%)`);
    lines.push(`* Total kunjungan  :   ${kumKunjTotal} (${pctKumKunj}%)`);
    lines.push(`----------------------------------`);
    lines.push(`Data`);
    lines.push(`Target ${namaBulan} ${tahun}`);
    lines.push(`* Kunjungan : ${fmtKunjTarget(form.targetKunjBulan)}`);
    lines.push(`* Omzet : Rp. ${fmtRpWA(form.targetOmzetBulan)}`);
    return lines.join('\n');
  }, [form, totalKunjungan, pctKunjungan, totalPendapatan, pctPendapatan, rerataPerPasien,
      namaHari, namaBulan, tahun, tgl, tglAkhir, pendapatanSelainMCU, pctKumOmzet, pctKumKunj,
      kumOmzetTotal, kumKunjTotal]);

  const handleCopy  = async () => { await navigator.clipboard.writeText(outputTeks); toast.success('✅ Teks berhasil disalin'); };
  const handleWA    = () => window.open('https://wa.me/?text=' + encodeURIComponent(outputTeks), '_blank');
  const handleClear = () => { localStorage.removeItem(LS_KEY); setForm(defaultForm()); setDraftTime(null); setAutoFields(new Set()); toast.success('Draft dihapus'); };

  return (
    <div className="grid lg:grid-cols-2 gap-4 page-transition">
      {/* LEFT: Form */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">📋 Input Laporan Harian</h2>
          <div className="flex items-center gap-2">
            {draftTime && <span className="text-[9px] text-muted-foreground">Draft: {draftTime}</span>}
            <Button variant="ghost" size="sm" onClick={handleClear} className="h-7 px-2 text-[10px]">
              <Trash2 className="w-3 h-3 mr-1" /> Hapus Draft
            </Button>
          </div>
        </div>

        <Accordion type="multiple" defaultValue={['a','b']} className="space-y-2">

          {/* A: Tanggal */}
          <AccordionItem value="a" className="card-clinical border rounded-lg overflow-hidden">
            <AccordionTrigger className="px-4 py-2 text-xs font-semibold hover:no-underline">A — Tanggal</AccordionTrigger>
            <AccordionContent className="px-4 space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground flex-1">Tanggal</label>
                <Input
                  type="date"
                  value={form.tanggal}
                  onChange={e => setForm(prev => ({ ...prev, tanggal: e.target.value }))}
                  className="w-36 text-xs h-8"
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* B: Kunjungan */}
          <AccordionItem value="b" className="card-clinical border rounded-lg overflow-hidden">
            <AccordionTrigger className="px-4 py-2 text-xs font-semibold hover:no-underline">
              B — Kunjungan
              <Button
                variant="outline" size="sm"
                className="ml-auto mr-2 h-6 px-2 text-[10px] text-green-700 border-green-400 hover:bg-green-50"
                onClick={e => { e.stopPropagation(); syncFromInputHarian(false); }}>
                <RefreshCw className="w-2.5 h-2.5 mr-1" /> Sync Input Harian
              </Button>
            </AccordionTrigger>
            <AccordionContent className="px-4 space-y-1.5">
              <p className="text-[9px] text-muted-foreground pb-1">Field bertanda <span className="text-green-600 font-medium">(auto)</span> diisi dari Tab Input Harian.</p>
              <NumInput label="Rawat Jalan (Total)"  value={form.rj}  onChange={v => set('rj', v)}  auto={isAuto('rj')} />
              <NumInput label="  └ Non BPJS RJ"      value={form.nonBpjsRJ}  onChange={v => set('nonBpjsRJ', v)}  auto={isAuto('nonBpjsRJ')} />
              <NumInput label="Rawat Inap (Total)"   value={form.ri}  onChange={v => set('ri', v)}  auto={isAuto('ri')} />
              <NumInput label="  └ Non BPJS RI"      value={form.nonBpjsRI}  onChange={v => set('nonBpjsRI', v)}  auto={isAuto('nonBpjsRI')} />
              <NumInput label="IGD (Total)"          value={form.igd} onChange={v => set('igd', v)} auto={isAuto('igd')} />
              <NumInput label="  └ Non BPJS IGD"     value={form.nonBpjsIGD} onChange={v => set('nonBpjsIGD', v)} auto={isAuto('nonBpjsIGD')} />
              <NumInput label="MCU"                  value={form.mcu} onChange={v => set('mcu', v)} auto={isAuto('mcu')} />
              <NumInput label="Rujukan SBU/Grahu"    value={form.rujukanGrahu}      onChange={v => set('rujukanGrahu', v)}      auto={isAuto('rujukanGrahu')} />
              <NumInput label="Rujukan SBU/PPK1"     value={form.rujukanPPK1}       onChange={v => set('rujukanPPK1', v)}       auto={isAuto('rujukanPPK1')} />
              <NumInput label="Rujukan SBU/Satkal"   value={form.rujukanSatkal}     onChange={v => set('rujukanSatkal', v)}     auto={isAuto('rujukanSatkal')} />
              <NumInput label="Rujukan Dokter Luar"  value={form.rujukanDokterLuar} onChange={v => set('rujukanDokterLuar', v)} auto={isAuto('rujukanDokterLuar')} />
              <NumInput label="Poli Exclusive"       value={form.poliExclusive}     onChange={v => set('poliExclusive', v)}     auto={isAuto('poliExclusive')} />
              <NumInput label="Poli Prioritas"       value={form.poliPrioritas}     onChange={v => set('poliPrioritas', v)}     auto={isAuto('poliPrioritas')} />
            </AccordionContent>
          </AccordionItem>

          {/* C: BRI Life */}
          <AccordionItem value="c" className="card-clinical border rounded-lg overflow-hidden">
            <AccordionTrigger className="px-4 py-2 text-xs font-semibold hover:no-underline">C — Pasien PG</AccordionTrigger>
            <AccordionContent className="px-4 space-y-1.5">
              <NumInput label="IGD Kry PG"    value={form.briIgdKry}   onChange={v => set('briIgdKry', v)} />
              <NumInput label="IGD Kel PG"    value={form.briIgdKel}   onChange={v => set('briIgdKel', v)} />
              <NumInput label="Rajal Kry PG"  value={form.briRajalKry} onChange={v => set('briRajalKry', v)} />
              <NumInput label="Rajal Kel PG"  value={form.briRajalKel} onChange={v => set('briRajalKel', v)} />
              <NumInput label="Rawin Kry PG"  value={form.briRawinKry} onChange={v => set('briRawinKry', v)} />
              <NumInput label="Rawin Kel PG"  value={form.briRawinKel} onChange={v => set('briRawinKel', v)} />
            </AccordionContent>
          </AccordionItem>

          {/* D: Promo Lab */}
          <AccordionItem value="d" className="card-clinical border rounded-lg overflow-hidden">
            <AccordionTrigger className="px-4 py-2 text-xs font-semibold hover:no-underline">D — Promo Lab</AccordionTrigger>
            <AccordionContent className="px-4 space-y-1.5">
              {form.promoItems.map((p, i) => (
                <div key={i} className="flex items-center gap-1">
                  <Input value={p.label} onChange={e => setPromoLabel(i, e.target.value)} className="flex-1 h-7 text-[11px]" />
                  <Input
                    type="text" inputMode="numeric"
                    value={p.value || ''}
                    onChange={e => setPromo(i, Number(e.target.value.replace(/\D/g, '')) || 0)}
                    className="w-16 h-7 text-right text-xs font-mono" placeholder="0"
                  />
                  <button onClick={() => removePromo(i)} className="p-1 text-muted-foreground hover:text-destructive">
                    <Minus className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addPromo} className="h-7 text-[10px] w-full">
                <Plus className="w-3 h-3 mr-1" /> Tambah Item
              </Button>
            </AccordionContent>
          </AccordionItem>

          {/* E: Morulla */}
          <AccordionItem value="e" className="card-clinical border rounded-lg overflow-hidden">
            <AccordionTrigger className="px-4 py-2 text-xs font-semibold hover:no-underline">E — Pasien AS Morulla</AccordionTrigger>
            <AccordionContent className="px-4 space-y-1.5">
              <NumInput label="Terjadwal Hari Ini" value={form.morullaTerjadwal} onChange={v => set('morullaTerjadwal', v)} />
              <NumInput label="Hadir Hari Ini"     value={form.morullaHadir}     onChange={v => set('morullaHadir', v)} />
            </AccordionContent>
          </AccordionItem>

          {/* F: Capaian */}
          <AccordionItem value="f" className="card-clinical border rounded-lg overflow-hidden">
            <AccordionTrigger className="px-4 py-2 text-xs font-semibold hover:no-underline">F — Capaian Harian</AccordionTrigger>
            <AccordionContent className="px-4 space-y-1.5">
              <NumInput label="Target Kunjungan Harian" value={form.targetKunjungan} onChange={v => set('targetKunjungan', v)} gsAutoFill={isAuto('targetKunjungan')} />
              <RpInput  label="Target Omzet Harian"     value={form.targetOmzet}     onChange={v => set('targetOmzet', v)}     gsAutoFill={isAuto('targetOmzet')} />
              <RpInput  label="Total Omzet Harian"       value={form.totalOmzet}       onChange={v => set('totalOmzet', v)} />
              <RpInput  label="Pendapatan MCU"          value={form.pendapatanMCU}    onChange={v => set('pendapatanMCU', v)} auto={isAuto('pendapatanMCU')} />
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground flex-1">Pendapatan Selain MCU <span className="text-[9px] text-blue-500 font-medium">(auto)</span></label>
                <span className="w-40 h-8 text-right text-[10px] font-mono flex items-center justify-end pr-1 text-muted-foreground">Rp {fmtRpWA(pendapatanSelainMCU)}</span>
              </div>
              <div className="pt-2 border-t border-border space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Total Kunjungan</span>
                  <span className="font-bold">{totalKunjungan} <span className="text-accent">({pctKunjungan}%)</span></span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Total Pendapatan</span>
                  <span className="font-bold">Rp {fmtRpWA(totalPendapatan)} <span className="text-accent">({pctPendapatan}%)</span></span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Rerata/Pasien</span>
                  <span className="font-bold">Rp {fmtRpWA(rerataPerPasien)}</span>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* G: Kumulatif */}
          <AccordionItem value="g" className="card-clinical border rounded-lg overflow-hidden">
            <AccordionTrigger className="px-4 py-2 text-xs font-semibold hover:no-underline">
              G — Kumulatif Bulan
              {(isAuto('kumOmzet') || isAuto('kumKunj')) && <span className="text-accent ml-1 text-[9px]">(dari Sheets)</span>}
            </AccordionTrigger>
            <AccordionContent className="px-4 space-y-1.5">
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground flex-1">Tanggal Akhir Data <span className="text-[9px] text-blue-500 font-medium">(dari date picker)</span></label>
                <span className="w-24 h-8 text-right text-xs font-mono flex items-center justify-end pr-1 font-semibold">{tglAkhir}</span>
              </div>
              <RpInput  label="Pendapatan s/d kemarin"     value={form.kumOmzet}         onChange={v => set('kumOmzet', v)}        gsAutoFill={isAuto('kumOmzet')} />
              <NumInput label="Kunjungan s/d kemarin"     value={form.kumKunj}          onChange={v => set('kumKunj', v)}         gsAutoFill={isAuto('kumKunj')} />
              <div className="pt-1.5 border-t border-dashed border-border/50 space-y-1">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground flex-1">Total Pendapatan s/d tgl <span className="text-[9px] text-blue-500 font-medium">(auto)</span></label>
                  <span className="w-40 h-8 text-right text-[10px] font-mono flex items-center justify-end pr-1 font-semibold">Rp {fmtRpWA(kumOmzetTotal)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground flex-1">Total Kunjungan s/d tgl <span className="text-[9px] text-blue-500 font-medium">(auto)</span></label>
                  <span className="w-24 h-8 text-right text-xs font-mono flex items-center justify-end pr-1 font-semibold">{kumKunjTotal}</span>
                </div>
              </div>
              <RpInput  label="Target Omzet Bulan"        value={form.targetOmzetBulan} onChange={v => set('targetOmzetBulan', v)} gsAutoFill={isAuto('targetOmzetBulan')} />
              <NumInput label="Target Kunjungan Bulan"    value={form.targetKunjBulan}  onChange={v => set('targetKunjBulan', v)}  gsAutoFill={isAuto('targetKunjBulan')} />
              <div className="pt-2 border-t border-border space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Capaian Omzet</span>
                  <span className="font-bold text-accent">{pctKumOmzet}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Capaian Kunjungan</span>
                  <span className="font-bold text-accent">{pctKumKunj}%</span>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

        </Accordion>
      </div>

      {/* RIGHT: Preview */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold">📱 Preview Teks WhatsApp</h2>
        {inputHarianGrandTotal !== null && totalKunjungan !== inputHarianGrandTotal && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-xs text-amber-800">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-500" />
            <span>
              Total kunjungan laporan <strong>{totalKunjungan}</strong>, tidak sama dengan total di Tab Input Harian <strong>{inputHarianGrandTotal}</strong>. Cek kembali yaa.
            </span>
          </div>
        )}
        <div className="rounded-lg bg-[#0b141a] text-[#e9edef] p-4 overflow-auto max-h-[70vh] lg:max-h-[80vh]">
          <pre className="text-[11px] leading-relaxed whitespace-pre-wrap font-mono">{outputTeks}</pre>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleCopy} variant="outline" className="flex-1 h-9 text-xs">
            <Copy className="w-3.5 h-3.5 mr-1.5" /> Salin Teks
          </Button>
          <Button onClick={handleWA} className="flex-1 h-9 text-xs bg-[#25d366] hover:bg-[#20bd5a] text-white">
            <MessageCircle className="w-3.5 h-3.5 mr-1.5" /> Kirim via WhatsApp
          </Button>
        </div>
      </div>
    </div>
  );
}
