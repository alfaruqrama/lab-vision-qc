import { useState, useEffect, useMemo, useCallback } from 'react';
import { Copy, MessageCircle, Trash2, ChevronDown, Plus, Minus } from 'lucide-react';
import { toast } from 'sonner';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import type { KumulatifData } from '@/hooks/use-kunjungan-data';

const HARI_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const LS_KEY = 'laporan-draft';

const fmtRpWA = (n: number) => Math.round(n).toLocaleString('id-ID');
const fmtKunjTarget = (n: number) => n.toLocaleString('id-ID');

interface PromoItem { label: string; value: number }

const DEFAULT_PROMO: PromoItem[] = [
  { label: 'paket Basic pekerja (umum)', value: 0 },
  { label: 'Paket sahabat ginjal (umum)', value: 0 },
  { label: 'Screaning paket B', value: 0 },
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
  pendapatanMCU: number; pendapatanSelainMCU: number;
}

function defaultForm(): FormData {
  return {
    tanggal: new Date().toISOString().slice(0, 10),
    rj: 0, nonBpjsRJ: 0, ri: 0, nonBpjsRI: 0, igd: 0, nonBpjsIGD: 0, mcu: 0,
    rujukanGrahu: 0, rujukanPPK1: 0, rujukanSatkal: 0, rujukanDokterLuar: 0,
    poliExclusive: 0, poliPrioritas: 0,
    briIgdKry: 0, briIgdKel: 0, briRajalKry: 0, briRajalKel: 0, briRawinKry: 0, briRawinKel: 0,
    promoItems: DEFAULT_PROMO.map(p => ({ ...p })),
    morullaTerjadwal: 0, morullaHadir: 0,
    targetKunjungan: 0, targetOmzet: 0,
    pendapatanMCU: 0, pendapatanSelainMCU: 0,
  };
}

function NumInput({ value, onChange, label, gsAutoFill }: { value: number; onChange: (v: number) => void; label: string; gsAutoFill?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-muted-foreground flex-1 min-w-0">
        {label}
        {gsAutoFill && <span className="text-[9px] ml-1 text-accent font-medium">(dari Sheets)</span>}
      </label>
      <Input
        type="text"
        inputMode="numeric"
        value={value || ''}
        onChange={e => onChange(Number(e.target.value.replace(/\D/g, '')) || 0)}
        className={cn("w-24 h-8 text-right text-xs font-mono", gsAutoFill && "bg-accent/5 border-accent/30")}
        placeholder="0"
      />
    </div>
  );
}

function RpInput({ value, onChange, label, gsAutoFill }: { value: number; onChange: (v: number) => void; label: string; gsAutoFill?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-muted-foreground flex-1 min-w-0">
        {label}
        {gsAutoFill && <span className="text-[9px] ml-1 text-accent font-medium">(dari Sheets)</span>}
      </label>
      <div className="relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">Rp</span>
        <Input
          type="text"
          inputMode="numeric"
          value={value ? fmtRpWA(value) : ''}
          onChange={e => onChange(Number(e.target.value.replace(/\D/g, '')) || 0)}
          className={cn("w-32 h-8 text-right text-xs font-mono pl-7", gsAutoFill && "bg-accent/5 border-accent/30")}
          placeholder="0"
        />
      </div>
    </div>
  );
}

export default function LaporanTab({ kumulatif }: { kumulatif: KumulatifData | null }) {
  const [form, setForm] = useState<FormData>(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...defaultForm(), ...parsed.data };
      }
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

  // Auto-detect day type from selected date and auto-fill targets
  useEffect(() => {
    if (!kumulatif) return;
    const d = new Date(form.tanggal);
    const day = d.getDay(); // 0=Sun, 6=Sat
    const key = day === 0 ? 'minggu' : day === 6 ? 'sabtu' : 'hariKerja';
    const tgtK = kumulatif.targetKunjHarian?.[key];
    const tgtO = kumulatif.targetOmzetHarian?.[key];
    if (tgtK !== undefined || tgtO !== undefined) {
      setForm(prev => ({
        ...prev,
        targetKunjungan: tgtK ?? prev.targetKunjungan,
        targetOmzet: tgtO ?? prev.targetOmzet,
      }));
    }
  }, [form.tanggal, kumulatif]);

  // Auto-save draft
  useEffect(() => {
    const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    localStorage.setItem(LS_KEY, JSON.stringify({ data: form, time }));
    setDraftTime(time);
  }, [form]);

  const set = useCallback(<K extends keyof FormData>(key: K, val: FormData[K]) => {
    setForm(prev => ({ ...prev, [key]: val }));
  }, []);

  const setPromo = useCallback((idx: number, val: number) => {
    setForm(prev => {
      const items = [...prev.promoItems];
      items[idx] = { ...items[idx], value: val };
      return { ...prev, promoItems: items };
    });
  }, []);

  const addPromo = useCallback(() => {
    setForm(prev => ({ ...prev, promoItems: [...prev.promoItems, { label: 'Item baru', value: 0 }] }));
  }, []);

  const removePromo = useCallback((idx: number) => {
    setForm(prev => ({ ...prev, promoItems: prev.promoItems.filter((_, i) => i !== idx) }));
  }, []);

  const setPromoLabel = useCallback((idx: number, label: string) => {
    setForm(prev => {
      const items = [...prev.promoItems];
      items[idx] = { ...items[idx], label };
      return { ...prev, promoItems: items };
    });
  }, []);

  // Auto-calc
  const totalKunjungan = form.rj + form.ri + form.igd + form.mcu;
  const pctKunjungan = form.targetKunjungan > 0 ? Math.round((totalKunjungan / form.targetKunjungan) * 100) : 0;
  const totalPendapatan = form.pendapatanMCU + form.pendapatanSelainMCU;
  const pctPendapatan = form.targetOmzet > 0 ? Math.round((totalPendapatan / form.targetOmzet) * 100) : 0;
  const rerataPerPasien = totalKunjungan > 0 ? Math.round(totalPendapatan / totalKunjungan) : 0;

  // Kumulatif calcs
  const kumOmzet = kumulatif?.kumOmzet || 0;
  const kumKunj = kumulatif?.kumKunj || 0;
  const tglAkhir = kumulatif?.tglAkhir || 0;
  const targetOmzetBulan = kumulatif?.targetOmzetBulan || 0;
  const targetKunjBulan = kumulatif?.targetKunjBulan || 0;
  const pctKumOmzet = targetOmzetBulan > 0 ? Math.round((kumOmzet / targetOmzetBulan) * 100) : 0;
  const pctKumKunj = targetKunjBulan > 0 ? Math.round((kumKunj / targetKunjBulan) * 100) : 0;

  const tgl = new Date(form.tanggal);
  const namaHari = HARI_ID[tgl.getDay()];
  const namaBulan = BULAN_ID[tgl.getMonth()];
  const tahun = tgl.getFullYear();

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
    lines.push(`* Pasien BRI LIFE PG:`);
    lines.push(`1. Igd BRI Life Kry PG : ${form.briIgdKry}`);
    lines.push(`2. Igd BRI Life Kel PG : ${form.briIgdKel}`);
    lines.push(`3. Rajal BRI Life Kry PG : ${form.briRajalKry}`);
    lines.push(`4. Rajal BRI Life Kel  PG : ${form.briRajalKel}`);
    lines.push(`5. Rawin BRI Life Kry PG : ${form.briRawinKry}`);
    lines.push(`6. Rawin BRI Life Kel PG : ${form.briRawinKel}`);
    lines.push(`* Promo Lab : `);
    form.promoItems.forEach((p, i) => {
      lines.push(`${i + 1}. ${p.label}: ${p.value}`);
    });
    lines.push(`* Pasien AS Morulla `);
    lines.push(`1. Terjadwal hari ini : ${form.morullaTerjadwal}`);
    lines.push(`2. Hadir hari ini : ${form.morullaHadir}`);
    lines.push(`  ================`);
    lines.push(`Capaian Harian `);
    lines.push(`* Total Kunj Harian : ${totalKunjungan} (${pctKunjungan}%)`);
    lines.push(`* Pendapatan MCU :  Rp ${fmtRpWA(form.pendapatanMCU)}`);
    lines.push(`* Pendapatan selain MCU: Rp ${fmtRpWA(form.pendapatanSelainMCU)}`);
    lines.push(`* Total Pendapatan: Rp ${fmtRpWA(totalPendapatan)} (${pctPendapatan}%)`);
    lines.push(`* Target harian : Rp ${fmtRpWA(form.targetOmzet)}`);
    lines.push(`----------------`);
    lines.push(`Rerata Jumlah entryan Per pasien : Rp ${fmtRpWA(rerataPerPasien)}/Pasien`);
    lines.push(`---------------`);
    lines.push(`================`);
    lines.push(`CAPAIAN 01- ${tglAkhir} ${namaBulan} ${tahun}`);
    lines.push(`* Total pendapatan : Rp ${fmtRpWA(kumOmzet)} (${pctKumOmzet}%)`);
    lines.push(`* Total kunjungan  :   ${kumKunj} (${pctKumKunj}%)`);
    lines.push(`----------------------------------`);
    lines.push(`Data`);
    lines.push(`Target ${namaBulan} ${tahun}`);
    lines.push(`* Kunjungan : ${fmtKunjTarget(targetKunjBulan)}`);
    lines.push(`* Omzet : Rp. ${fmtRpWA(targetOmzetBulan)}`);
    return lines.join('\n');
  }, [form, totalKunjungan, pctKunjungan, totalPendapatan, pctPendapatan, rerataPerPasien, namaHari, namaBulan, tahun, tgl, kumOmzet, kumKunj, tglAkhir, targetOmzetBulan, targetKunjBulan, pctKumOmzet, pctKumKunj]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(outputTeks);
    toast.success('✅ Teks berhasil disalin');
  };

  const handleWA = () => {
    window.open('https://wa.me/?text=' + encodeURIComponent(outputTeks), '_blank');
  };

  const handleClearDraft = () => {
    localStorage.removeItem(LS_KEY);
    setForm(defaultForm());
    setDraftTime(null);
    toast.success('Draft dihapus');
  };

  return (
    <div className="grid lg:grid-cols-2 gap-4 page-transition">
      {/* LEFT: Form */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">📋 Input Laporan Harian</h2>
          <div className="flex items-center gap-2">
            {draftTime && <span className="text-[9px] text-muted-foreground">Draft: {draftTime}</span>}
            <Button variant="ghost" size="sm" onClick={handleClearDraft} className="h-7 px-2 text-[10px]">
              <Trash2 className="w-3 h-3 mr-1" /> Hapus Draft
            </Button>
          </div>
        </div>

        <Accordion type="multiple" defaultValue={['a', 'b']} className="space-y-2">
          {/* A: Tanggal */}
          <AccordionItem value="a" className="card-clinical border rounded-lg overflow-hidden">
            <AccordionTrigger className="px-4 py-2 text-xs font-semibold hover:no-underline">
              A — Tanggal
            </AccordionTrigger>
            <AccordionContent className="px-4 space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground flex-1">Tanggal</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs w-36 justify-start">
                      {format(tgl, 'd MMM yyyy', { locale: idLocale })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={tgl}
                      onSelect={d => d && set('tanggal', d.toISOString().slice(0, 10))}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* B: Kunjungan */}
          <AccordionItem value="b" className="card-clinical border rounded-lg overflow-hidden">
            <AccordionTrigger className="px-4 py-2 text-xs font-semibold hover:no-underline">
              B — Kunjungan
            </AccordionTrigger>
            <AccordionContent className="px-4 space-y-1.5">
              <NumInput label="Rawat Jalan (Total)" value={form.rj} onChange={v => set('rj', v)} />
              <NumInput label="  └ Non BPJS RJ" value={form.nonBpjsRJ} onChange={v => set('nonBpjsRJ', Math.min(v, form.rj))} />
              <NumInput label="Rawat Inap (Total)" value={form.ri} onChange={v => set('ri', v)} />
              <NumInput label="  └ Non BPJS RI" value={form.nonBpjsRI} onChange={v => set('nonBpjsRI', Math.min(v, form.ri))} />
              <NumInput label="IGD (Total)" value={form.igd} onChange={v => set('igd', v)} />
              <NumInput label="  └ Non BPJS IGD" value={form.nonBpjsIGD} onChange={v => set('nonBpjsIGD', Math.min(v, form.igd))} />
              <NumInput label="MCU" value={form.mcu} onChange={v => set('mcu', v)} />
              <NumInput label="Rujukan SBU/Grahu" value={form.rujukanGrahu} onChange={v => set('rujukanGrahu', v)} />
              <NumInput label="Rujukan SBU/PPK1" value={form.rujukanPPK1} onChange={v => set('rujukanPPK1', v)} />
              <NumInput label="Rujukan SBU/Satkal" value={form.rujukanSatkal} onChange={v => set('rujukanSatkal', v)} />
              <NumInput label="Rujukan Dokter Luar" value={form.rujukanDokterLuar} onChange={v => set('rujukanDokterLuar', v)} />
              <NumInput label="Poli Exclusive" value={form.poliExclusive} onChange={v => set('poliExclusive', v)} />
              <NumInput label="Poli Prioritas" value={form.poliPrioritas} onChange={v => set('poliPrioritas', v)} />
            </AccordionContent>
          </AccordionItem>

          {/* C: BRI Life */}
          <AccordionItem value="c" className="card-clinical border rounded-lg overflow-hidden">
            <AccordionTrigger className="px-4 py-2 text-xs font-semibold hover:no-underline">
              C — Pasien BRI Life PG
            </AccordionTrigger>
            <AccordionContent className="px-4 space-y-1.5">
              <NumInput label="IGD BRI Life Kry PG" value={form.briIgdKry} onChange={v => set('briIgdKry', v)} />
              <NumInput label="IGD BRI Life Kel PG" value={form.briIgdKel} onChange={v => set('briIgdKel', v)} />
              <NumInput label="Rajal BRI Life Kry PG" value={form.briRajalKry} onChange={v => set('briRajalKry', v)} />
              <NumInput label="Rajal BRI Life Kel PG" value={form.briRajalKel} onChange={v => set('briRajalKel', v)} />
              <NumInput label="Rawin BRI Life Kry PG" value={form.briRawinKry} onChange={v => set('briRawinKry', v)} />
              <NumInput label="Rawin BRI Life Kel PG" value={form.briRawinKel} onChange={v => set('briRawinKel', v)} />
            </AccordionContent>
          </AccordionItem>

          {/* D: Promo Lab */}
          <AccordionItem value="d" className="card-clinical border rounded-lg overflow-hidden">
            <AccordionTrigger className="px-4 py-2 text-xs font-semibold hover:no-underline">
              D — Promo Lab
            </AccordionTrigger>
            <AccordionContent className="px-4 space-y-1.5">
              {form.promoItems.map((p, i) => (
                <div key={i} className="flex items-center gap-1">
                  <Input
                    value={p.label}
                    onChange={e => setPromoLabel(i, e.target.value)}
                    className="flex-1 h-7 text-[11px]"
                  />
                  <Input
                    type="text" inputMode="numeric"
                    value={p.value || ''}
                    onChange={e => setPromo(i, Number(e.target.value.replace(/\D/g, '')) || 0)}
                    className="w-16 h-7 text-right text-xs font-mono"
                    placeholder="0"
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
            <AccordionTrigger className="px-4 py-2 text-xs font-semibold hover:no-underline">
              E — Pasien AS Morulla
            </AccordionTrigger>
            <AccordionContent className="px-4 space-y-1.5">
              <NumInput label="Terjadwal Hari Ini" value={form.morullaTerjadwal} onChange={v => set('morullaTerjadwal', v)} />
              <NumInput label="Hadir Hari Ini" value={form.morullaHadir} onChange={v => set('morullaHadir', v)} />
            </AccordionContent>
          </AccordionItem>

          {/* F: Capaian */}
          <AccordionItem value="f" className="card-clinical border rounded-lg overflow-hidden">
            <AccordionTrigger className="px-4 py-2 text-xs font-semibold hover:no-underline">
              F — Capaian Harian
            </AccordionTrigger>
            <AccordionContent className="px-4 space-y-1.5">
              <NumInput label="Target Kunjungan Harian" value={form.targetKunjungan} onChange={v => set('targetKunjungan', v)} gsAutoFill={!!kumulatif} />
              <RpInput label="Target Omzet Harian" value={form.targetOmzet} onChange={v => set('targetOmzet', v)} gsAutoFill={!!kumulatif} />
              <RpInput label="Pendapatan MCU" value={form.pendapatanMCU} onChange={v => set('pendapatanMCU', v)} />
              <RpInput label="Pendapatan Selain MCU" value={form.pendapatanSelainMCU} onChange={v => set('pendapatanSelainMCU', v)} />
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
              G — Kumulatif Bulan {kumulatif ? <span className="text-accent ml-1 text-[9px]">(dari Sheets)</span> : ''}
            </AccordionTrigger>
            <AccordionContent className="px-4 space-y-1.5">
              {kumulatif ? (
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Total Pendapatan s/d tgl {tglAkhir}</span><span className="font-bold">Rp {fmtRpWA(kumOmzet)} ({pctKumOmzet}%)</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Total Kunjungan s/d tgl {tglAkhir}</span><span className="font-bold">{kumKunj} ({pctKumKunj}%)</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Target Omzet Bulan</span><span className="font-bold">Rp {fmtRpWA(targetOmzetBulan)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Target Kunjungan Bulan</span><span className="font-bold">{fmtKunjTarget(targetKunjBulan)}</span></div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">Data kumulatif belum tersedia. Pastikan koneksi ke Google Sheets aktif.</p>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* RIGHT: Preview */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold">📱 Preview Teks WhatsApp</h2>
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
