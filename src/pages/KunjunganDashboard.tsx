// ─── TAB: LAPORAN ───
const HARI_ID = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const BULAN_ID = ['Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember'];

const fmtRpWA = (n: number) => Math.round(n).toLocaleString('id-ID');
const todayStr = () => new Date().toISOString().split('T')[0];

type FormData = {
  tanggal: string;
  petugas: string;
  jenisHari: 'kerja' | 'sabtu' | 'minggu';
  rj: number; nonBpjsRJ: number;
  ri: number; nonBpjsRI: number;
  igd: number; nonBpjsIGD: number;
  mcu: number;
  rujukanGrahu: number; rujukanPPK1: number;
  rujukanSatkal: number; rujukanLuar: number;
  poliExclusive: number; poliPrioritas: number;
  briLife: number[];
  promoLab: number[];
  morullaTerjadwal: number; morullaHadir: number;
  targetKunjungan: number; targetOmzet: number;
  pendMCU: number; pendSelainMCU: number;
};

const defaultForm = (): FormData => ({
  tanggal: todayStr(), petugas: '', jenisHari: 'kerja',
  rj: 0, nonBpjsRJ: 0, ri: 0, nonBpjsRI: 0,
  igd: 0, nonBpjsIGD: 0, mcu: 0,
  rujukanGrahu: 0, rujukanPPK1: 0, rujukanSatkal: 0, rujukanLuar: 0,
  poliExclusive: 0, poliPrioritas: 0,
  briLife: BRI_LIFE.map(() => 0),
  promoLab: PROMO_LAB.map(() => 0),
  morullaTerjadwal: 0, morullaHadir: 0,
  targetKunjungan: 0, targetOmzet: 0,
  pendMCU: 0, pendSelainMCU: 0,
});

function LaporanTab() {
  const DRAFT_KEY = 'laporan-draft';
  const [form, setForm] = useState<FormData>(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      return saved ? JSON.parse(saved) : defaultForm();
    } catch { return defaultForm(); }
  });
  const [draftTime, setDraftTime] = useState<string>('');
  const [collapsed, setCollapsed] = useState({ briLife: true, promo: true, morulla: true });
  const [copied, setCopied] = useState(false);

  const set = (key: keyof FormData, val: any) => {
    setForm(prev => {
      const next = { ...prev, [key]: val };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
      setDraftTime(new Date().toLocaleTimeString('id-ID'));
      return next;
    });
  };

  const setArr = (key: 'briLife' | 'promoLab', idx: number, val: number) => {
    setForm(prev => {
      const arr = [...prev[key]];
      arr[idx] = val;
      const next = { ...prev, [key]: arr };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
      setDraftTime(new Date().toLocaleTimeString('id-ID'));
      return next;
    });
  };

  const clearDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setForm(defaultForm());
    setDraftTime('');
  };

  // Kalkulasi otomatis
  const totalKunj = form.rj + form.ri + form.igd + form.mcu;
  const pctKunj = form.targetKunjungan > 0 ? Math.round((totalKunj / form.targetKunjungan) * 100) : 0;
  const totalPend = form.pendMCU + form.pendSelainMCU;
  const pctPend = form.targetOmzet > 0 ? Math.round((totalPend / form.targetOmzet) * 100) : 0;
  const rerata = totalKunj > 0 ? Math.round(totalPend / totalKunj) : 0;

  // Format tanggal untuk output
  const tgl = new Date(form.tanggal + 'T00:00:00');
  const namaHari = HARI_ID[tgl.getDay()];
  const tglFull = `${namaHari} ${tgl.getDate()} ${BULAN_ID[tgl.getMonth()]} ${tgl.getFullYear()}`;
  const bulanStr = `${BULAN_ID[tgl.getMonth()]} ${tgl.getFullYear()}`;

  // Generate teks WA
  const outputWA = `LAPORAN KUNJUNGAN  
${tglFull}
* Rawat Jalan : ${form.rj}
▪Non BPJS : ${form.nonBpjsRJ}
* Rawat Inap : ${form.ri}
▪Non BPJS : ${form.nonBpjsRI}
* IGD : ${form.igd}
▪Non BPJS : ${form.nonBpjsIGD}
* MCU : ${form.mcu}
* Rujukan SBU/Grahu : ${form.rujukanGrahu}
* Rujukan SBU/PPK1 : ${form.rujukanPPK1}
* Rujukan SBU/Satkal : ${form.rujukanSatkal}
* Rujukan dokter Luar : ${form.rujukanLuar}
* Poli Exclusive : ${form.poliExclusive}
* Poli Prioritas : ${form.poliPrioritas}
* Pasien BRI LIFE PG:
${BRI_LIFE.map((n, i) => `${i + 1}. ${n} : ${form.briLife[i]}`).join('\n')}
* Promo Lab : 
${PROMO_LAB.map((n, i) => `${i + 1}. ${n}: ${form.promoLab[i]}`).join('\n')}
* Pasien AS Morulla 
1. Terjadwal hari ini : ${form.morullaTerjadwal}
2. Hadir hari ini : ${form.morullaHadir}
  ================
Capaian Harian 
* Total Kunj Harian : ${totalKunj} (${pctKunj}%)
* Pendapatan MCU :  Rp ${fmtRpWA(form.pendMCU)}
* Pendapatan selain MCU: Rp ${fmtRpWA(form.pendSelainMCU)}
* Total Pendapatan: Rp ${fmtRpWA(totalPend)} (${pctPend}%)
* Target harian : Rp ${fmtRpWA(form.targetOmzet)}
----------------
Rerata Jumlah entryan Per pasien : Rp ${fmtRpWA(rerata)}/Pasien
---------------`;

  const numInput = (val: number, onChange: (v: number) => void, label: string) => (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-border last:border-0">
      <label className="text-xs text-muted-foreground flex-1">{label}</label>
      <input
        type="number"
        inputMode="numeric"
        value={val || ''}
        onChange={e => onChange(Number(e.target.value) || 0)}
        className="w-20 text-right px-2 py-1 text-sm font-mono-data border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-accent"
        placeholder="0"
      />
    </div>
  );

  const Section = ({ title, children, bold }: { title: string; children: React.ReactNode; bold?: boolean }) => (
    <div className="card-clinical p-4 space-y-1">
      <h3 className={`text-xs font-bold uppercase tracking-wider mb-3 ${bold ? 'text-accent' : 'text-muted-foreground'}`}>{title}</h3>
      {children}
    </div>
  );

  const CollapseSection = ({ id, title, children }: { id: keyof typeof collapsed; title: string; children: React.ReactNode }) => (
    <div className="card-clinical overflow-hidden">
      <button
        onClick={() => setCollapsed(p => ({ ...p, [id]: !p[id] }))}
        className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:bg-muted/50 transition-colors"
      >
        <span>{title}</span>
        <span className="text-lg leading-none">{collapsed[id] ? '＋' : '－'}</span>
      </button>
      {!collapsed[id] && <div className="px-4 pb-4 space-y-1">{children}</div>}
    </div>
  );

  return (
    <div className="space-y-4 page-transition">
      <div className="grid lg:grid-cols-2 gap-4 items-start">

        {/* ── FORM ── */}
        <div className="space-y-3">
          {/* Draft info */}
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{draftTime ? `Draft tersimpan: ${draftTime}` : 'Isi form di bawah'}</span>
            <button onClick={clearDraft} className="text-destructive hover:underline">🗑 Hapus Draft</button>
          </div>

          {/* A — Identitas */}
          <Section title="Identitas" bold>
            <div className="flex items-center justify-between gap-2 py-1.5 border-b border-border">
              <label className="text-xs text-muted-foreground">Tanggal</label>
              <input type="date" value={form.tanggal} onChange={e => set('tanggal', e.target.value)}
                className="text-xs px-2 py-1 border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-accent" />
            </div>
            <div className="flex items-center justify-between gap-2 py-1.5 border-b border-border">
              <label className="text-xs text-muted-foreground">Petugas</label>
              <input type="text" value={form.petugas} onChange={e => set('petugas', e.target.value)}
                className="w-36 text-right text-xs px-2 py-1 border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-accent"
                placeholder="Nama petugas" />
            </div>
            <div className="flex items-center justify-between gap-2 py-1.5">
              <label className="text-xs text-muted-foreground">Jenis Hari</label>
              <select value={form.jenisHari} onChange={e => set('jenisHari', e.target.value)}
                className="text-xs px-2 py-1 border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-accent">
                <option value="kerja">Hari Kerja</option>
                <option value="sabtu">Sabtu / Cuti Bersama</option>
                <option value="minggu">Minggu / Tanggal Merah</option>
              </select>
            </div>
          </Section>

          {/* B — Kunjungan */}
          <Section title="Kunjungan" bold>
            {numInput(form.rj, v => set('rj', v), 'Rawat Jalan')}
            {numInput(form.nonBpjsRJ, v => set('nonBpjsRJ', v), '  ▪ Non BPJS')}
            {numInput(form.ri, v => set('ri', v), 'Rawat Inap')}
            {numInput(form.nonBpjsRI, v => set('nonBpjsRI', v), '  ▪ Non BPJS')}
            {numInput(form.igd, v => set('igd', v), 'IGD')}
            {numInput(form.nonBpjsIGD, v => set('nonBpjsIGD', v), '  ▪ Non BPJS')}
            {numInput(form.mcu, v => set('mcu', v), 'MCU')}
            {numInput(form.rujukanGrahu, v => set('rujukanGrahu', v), 'Rujukan SBU/Grahu')}
            {numInput(form.rujukanPPK1, v => set('rujukanPPK1', v), 'Rujukan SBU/PPK1')}
            {numInput(form.rujukanSatkal, v => set('rujukanSatkal', v), 'Rujukan SBU/Satkal')}
            {numInput(form.rujukanLuar, v => set('rujukanLuar', v), 'Rujukan Dokter Luar')}
            {numInput(form.poliExclusive, v => set('poliExclusive', v), 'Poli Exclusive')}
            {numInput(form.poliPrioritas, v => set('poliPrioritas', v), 'Poli Prioritas')}
          </Section>

          {/* C — BRI Life (collapse) */}
          <CollapseSection id="briLife" title="Pasien BRI Life PG">
            {BRI_LIFE.map((n, i) => numInput(form.briLife[i], v => setArr('briLife', i, v), n))}
          </CollapseSection>

          {/* D — Promo Lab (collapse) */}
          <CollapseSection id="promo" title="Promo Lab">
            {PROMO_LAB.map((n, i) => numInput(form.promoLab[i], v => setArr('promoLab', i, v), n))}
          </CollapseSection>

          {/* E — Morulla (collapse) */}
          <CollapseSection id="morulla" title="Pasien AS Morulla">
            {numInput(form.morullaTerjadwal, v => set('morullaTerjadwal', v), 'Terjadwal Hari Ini')}
            {numInput(form.morullaHadir, v => set('morullaHadir', v), 'Hadir Hari Ini')}
          </CollapseSection>

          {/* F — Capaian */}
          <Section title="Capaian Harian" bold>
            {numInput(form.targetKunjungan, v => set('targetKunjungan', v), 'Target Kunjungan')}
            {numInput(form.targetOmzet, v => set('targetOmzet', v), 'Target Omzet (Rp)')}
            {numInput(form.pendMCU, v => set('pendMCU', v), 'Pendapatan MCU (Rp)')}
            {numInput(form.pendSelainMCU, v => set('pendSelainMCU', v), 'Pendapatan Selain MCU (Rp)')}
            <div className="pt-2 grid grid-cols-2 gap-2">
              <div className="bg-muted rounded-lg p-2 text-center">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Total Kunjungan</p>
                <p className="text-base font-bold text-accent">{totalKunj} <span className="text-[10px]">({pctKunj}%)</span></p>
              </div>
              <div className="bg-muted rounded-lg p-2 text-center">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Total Pendapatan</p>
                <p className="text-base font-bold text-accent">Rp {fmtRpWA(totalPend)} <span className="text-[10px]">({pctPend}%)</span></p>
              </div>
            </div>
          </Section>
        </div>

        {/* ── PREVIEW ── */}
        <div className="space-y-3 lg:sticky lg:top-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Preview Teks WA</h3>
            <span className="text-[9px] text-muted-foreground">Update otomatis</span>
          </div>
          <div className="card-clinical p-4 bg-[#0a1628] border-[#1e3a5f]">
            <pre className="text-[11px] font-mono-data text-green-400 whitespace-pre-wrap leading-relaxed">{outputWA}</pre>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { navigator.clipboard.writeText(outputWA); setCopied(true); setTimeout(() => setCopied(false), 2000); toast.success('Teks berhasil disalin'); }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${copied ? 'bg-success/20 text-success border border-success/30' : 'bg-muted hover:bg-muted/80 text-foreground'}`}
            >
              {copied ? '✓ Tersalin!' : '📋 Salin Teks'}
            </button>
            <button
              onClick={() => window.open('https://wa.me/?text=' + encodeURIComponent(outputWA), '_blank')}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-[#25d366] hover:bg-[#20bd5a] text-white transition-all"
            >
              💬 Kirim via WA
            </button>
          </div>
          <p className="text-[9px] text-center text-muted-foreground">
            Kumulatif bulan akan ditambahkan setelah data tersedia
          </p>
        </div>
      </div>
    </div>
  );
}
