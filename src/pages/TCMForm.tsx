import { useState } from 'react';

interface Pasien {
  id: number;
  nama: string;
  nik: string;
  umur: string;
  jk: string;
  spes1: string;
  spes2: string;
}

const SPESIMEN_OPTIONS = [
  "Dahak", "BAL", "Jaringan", "Urin",
  "Cairan Pleura", "LCS", "Lainnya"
];

const DRIVERS = [
  { nama: 'MUHAMMAD RAHMAN HANIF',   nik: 'K21011' },
  { nama: 'MOCHAMAD ZAENAL ABIDIN',  nik: 'K17131' },
  { nama: 'MUHAMMAD SYIFAUL UYUN',   nik: 'K12564' },
  { nama: 'AHMAD DAI ROBBY',         nik: 'K22177' },
  { nama: 'RIYADUS SHOLIHIN',        nik: 'K12347' },
  { nama: 'MAHSUN AZIZI',            nik: 'K14887' },
  { nama: 'MATSYAFIK',               nik: 'K13654' },
];

const PEMERIKSAAN_OPTIONS = [
  "Pemeriksaan Mikroskopis",
  "Pemeriksaan TCM MTB Rif (Xpert)",
  "Pemeriksaan TCM MTB Rif INH (BDMAX)",
  "Pemeriksaan TCM MTB RIF (Truenat)",
  "Pemeriksaan PCR Open System",
  "Pemeriksaan TCM ID Care",
  "Pemeriksaan NPOC"
];

export default function TCMForm() {
  const [pasienList, setPasienList] = useState<Pasien[]>([{ id: 1, nama: '', nik: '', umur: '', jk: '', spes1: '', spes2: '' }]);
  const [counter, setCounter] = useState(1);
  const [showPreview, setShowPreview] = useState(false);
  
  const [jenisPemeriksaan, setJenisPemeriksaan] = useState('');
  const [faskesPenerima, setFaskesPenerima] = useState('');
  const [tglKirim, setTglKirim] = useState(new Date().toISOString().split('T')[0]);
  const [tglTerima, setTglTerima] = useState('');
  const [namaPengirim, setNamaPengirim] = useState('');
  const [nikPengirim, setNikPengirim] = useState('');
  const [jabatanPengirim, setJabatanPengirim] = useState('');
  const [selectedDriver, setSelectedDriver] = useState('');

  const tambahPasien = () => {
    const newId = counter + 1;
    setCounter(newId);
    setPasienList([...pasienList, { id: newId, nama: '', nik: '', umur: '', jk: '', spes1: '', spes2: '' }]);
  };

  const hapusPasien = (id: number) => {
    if (pasienList.length <= 1) return;
    setPasienList(pasienList.filter(p => p.id !== id));
  };

  const updatePasien = (id: number, field: keyof Pasien, value: string) => {
    // Validasi NIK: hanya angka, max 16 digit
    if (field === 'nik') {
      const numericValue = value.replace(/\D/g, '');
      if (numericValue.length <= 16) {
        setPasienList(pasienList.map(p => p.id === id ? { ...p, [field]: numericValue } : p));
      }
      return;
    }
    
    // Validasi umur: hanya angka
    if (field === 'umur') {
      const numericValue = value.replace(/\D/g, '');
      setPasienList(pasienList.map(p => p.id === id ? { ...p, [field]: numericValue } : p));
      return;
    }
    
    setPasienList(pasienList.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleNikPengirimChange = (value: string) => {
    setNikPengirim(value);
  };

  const handleDriverSelect = (val: string) => {
    setSelectedDriver(val);
    const driver = DRIVERS.find(d => d.nama === val);
    if (driver) {
      setNamaPengirim(driver.nama);
      setNikPengirim(driver.nik);
      setJabatanPengirim('Driver');
    }
  };

  const formatTgl = (val: string) => {
    if (!val) return null;
    const d = new Date(val + 'T00:00:00');
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const resetForm = () => {
    if (!confirm('Reset semua data?')) return;
    setJenisPemeriksaan('');
    setFaskesPenerima('');
    setTglKirim(new Date().toISOString().split('T')[0]);
    setTglTerima('');
    setNamaPengirim('');
    setNikPengirim('');
    setJabatanPengirim('');
    setSelectedDriver('');
    setPasienList([{ id: 1, nama: '', nik: '', umur: '', jk: '', spes1: '', spes2: '' }]);
    setCounter(1);
    setShowPreview(false);
  };

  const handlePrint = () => {
    setShowPreview(true);
    setTimeout(() => window.print(), 200);
  };

  const handleExportWord = async () => {
    const {
      Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
      AlignmentType, WidthType, BorderStyle, ImageRun, ShadingType,
    } = await import('docx');

    let gresikBuf: ArrayBuffer | null = null;
    let tossTbBuf: ArrayBuffer | null = null;
    try { gresikBuf = await (await fetch('/logo-gresik.png')).arrayBuffer(); } catch { /* no logo */ }
    try { tossTbBuf = await (await fetch('/logo-toss-tb.png')).arrayBuffer(); } catch { /* no logo */ }

    const tglKirimStr = tglKirim ? formatTgl(tglKirim)! : '…………………………';
    const tglTerimaStr = tglTerima ? formatTgl(tglTerima)! : '…………………………';

    const nb = (side: 'top' | 'bottom' | 'left' | 'right') =>
      ({ style: BorderStyle.NONE, size: 0, color: 'FFFFFF' });
    const noBorder = { top: nb('top'), bottom: nb('bottom'), left: nb('left'), right: nb('right') };
    const lineBorder = { style: BorderStyle.SINGLE, size: 4, color: '666666' };
    const cellBorder = { top: lineBorder, bottom: lineBorder, left: lineBorder, right: lineBorder };
    const noTableBorder = { ...noBorder, insideH: nb('top'), insideV: nb('left') };

    const txt = (text: string, opts: Record<string, unknown> = {}) =>
      new TextRun({ text, font: 'Times New Roman', size: 22, ...opts });

    const metaKV = (key: string, val: string, keyW = 2700, valW = 6538) =>
      new TableRow({
        children: [
          new TableCell({ borders: noBorder, width: { size: keyW, type: WidthType.DXA }, children: [new Paragraph({ children: [txt(key)] })] }),
          new TableCell({ borders: noBorder, width: { size: 300, type: WidthType.DXA },   children: [new Paragraph({ children: [txt(': ')] })] }),
          new TableCell({ borders: noBorder, width: { size: valW, type: WidthType.DXA }, children: [new Paragraph({ children: [txt(val)] })] }),
        ],
      });

    const CONTENT_W = 9638;
    const LOGO_PX   = 65;

    const logoCell = (buf: ArrayBuffer | null, align: typeof AlignmentType.LEFT, w: number) =>
      new TableCell({
        borders: noBorder,
        width: { size: w, type: WidthType.DXA },
        children: [new Paragraph({
          alignment: align,
          children: buf
            ? [new ImageRun({ data: buf, transformation: { width: LOGO_PX, height: LOGO_PX }, type: 'png' })]
            : [txt('')],
        })],
      });

    const doc = new Document({
      sections: [{
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
          },
        },
        children: [
          /* ── LOGO HEADER ── */
          new Table({
            width: { size: CONTENT_W, type: WidthType.DXA },
            borders: noTableBorder,
            rows: [new TableRow({ children: [
              logoCell(gresikBuf, AlignmentType.LEFT, 1440),
              new TableCell({
                borders: noBorder,
                width: { size: CONTENT_W - 2880, type: WidthType.DXA },
                children: [
                  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120 }, children: [txt('TANDA TERIMA PENGIRIMAN SPESIMEN', { bold: true, size: 24 })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [txt(`UNTUK PEMERIKSAAN ${(jenisPemeriksaan || 'TCM MTB RIF').toUpperCase()}`, { bold: true, size: 24 })] }),
                ],
              }),
              logoCell(tossTbBuf, AlignmentType.RIGHT, 1440),
            ]})],
          }),

          new Paragraph({ children: [txt('')] }),

          /* ── METADATA ── */
          new Table({
            width: { size: CONTENT_W, type: WidthType.DXA },
            borders: noTableBorder,
            rows: [
              metaKV('Fasyankes pengirim',    'RS Petrokimia Gresik'),
              metaKV('Berupa',                `${pasienList.length} spesimen dari ${pasienList.length} terduga TB`),
              metaKV('Fasyankes penerima',    faskesPenerima  || '…………………………………'),
              metaKV('Untuk keperluan',       jenisPemeriksaan || '…………………………………'),
              metaKV('Alasan pemeriksaan',    'Diagnosis Terduga TB'),
              metaKV('Tgl. pengiriman spesimen', tglKirimStr),
              metaKV('Tgl. penerimaan spesimen', tglTerimaStr),
            ],
          }),

          new Paragraph({ children: [txt('')] }),

          /* ── TABEL PASIEN ── */
          new Table({
            width: { size: CONTENT_W, type: WidthType.DXA },
            rows: [
              new TableRow({
                tableHeader: true,
                children: [
                  ['No', 400], ['Nama Lengkap Pasien', 2800], ['NIK', 1700],
                  ['Umur (Th)', 800], ['Jenis Kelamin', 1000], ['Jenis Spesimen', 2938],
                ].map(([label, w]) => new TableCell({
                  borders: cellBorder,
                  width: { size: w as number, type: WidthType.DXA },
                  shading: { type: ShadingType.CLEAR, fill: 'EEEEEE' },
                  children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [txt(label as string, { bold: true, size: 20 })] })],
                })),
              }),
              ...pasienList.map((p, i) => new TableRow({
                children: [
                  new TableCell({ borders: cellBorder, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [txt(String(i + 1), { size: 20 })] })] }),
                  new TableCell({ borders: cellBorder, children: [new Paragraph({ children: [txt(p.nama || '—', { size: 20 })] })] }),
                  new TableCell({ borders: cellBorder, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [txt(p.nik  || '—', { size: 20 })] })] }),
                  new TableCell({ borders: cellBorder, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [txt(p.umur || '—', { size: 20 })] })] }),
                  new TableCell({ borders: cellBorder, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [txt(p.jk   || '—', { size: 20 })] })] }),
                  new TableCell({ borders: cellBorder, children: [new Paragraph({ children: [txt([p.spes1, p.spes2].filter(Boolean).join(' + ') || '—', { size: 20 })] })] }),
                ],
              })),
            ],
          }),

          new Paragraph({ children: [txt('')] }),

          /* ── TANDA TANGAN ── */
          new Table({
            width: { size: CONTENT_W, type: WidthType.DXA },
            borders: noTableBorder,
            rows: [new TableRow({ children: [
              new TableCell({
                borders: noBorder,
                width: { size: Math.floor(CONTENT_W / 2), type: WidthType.DXA },
                children: [
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [txt('Penerima')] }),
                  new Paragraph({ children: [txt('')] }), new Paragraph({ children: [txt('')] }), new Paragraph({ children: [txt('')] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [txt('(____________________)')] }),
                ],
              }),
              new TableCell({
                borders: noBorder,
                width: { size: CONTENT_W - Math.floor(CONTENT_W / 2), type: WidthType.DXA },
                children: [
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [txt('Pengirim')] }),
                  new Paragraph({ children: [txt('')] }), new Paragraph({ children: [txt('')] }), new Paragraph({ children: [txt('')] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [txt(namaPengirim ? `(${namaPengirim})` : '(____________________)', { bold: !!namaPengirim })] }),
                ],
              }),
            ]})],
          }),

          /* ══ HALAMAN 2: SURAT KETERANGAN ══ */
          new Paragraph({ pageBreakBefore: true, alignment: AlignmentType.CENTER, children: [txt('SURAT KETERANGAN', { bold: true, size: 26 })] }),

          new Paragraph({ spacing: { after: 80 }, children: [txt('Yang bertanda tangan dibawah ini:')] }),

          new Table({
            width: { size: 6000, type: WidthType.DXA },
            borders: noTableBorder,
            rows: [
              metaKV('Nama',    'dr. Dian Ayu Lukitasari, M.H., C.M.C.', 1500, 4200),
              metaKV('NIK',     'PGM11216',  1500, 4200),
              metaKV('Jabatan', 'Direktur',  1500, 4200),
            ],
          }),

          new Paragraph({ spacing: { before: 160, after: 80 }, children: [txt('Menerangkan bahwa benar petugas yang bernama:')] }),

          new Table({
            width: { size: 6000, type: WidthType.DXA },
            borders: noTableBorder,
            rows: [
              metaKV('Nama',    namaPengirim    || '………………………', 1500, 4200),
              metaKV('NIK',     nikPengirim     || '………………………', 1500, 4200),
              metaKV('Jabatan', jabatanPengirim || '………………………', 1500, 4200),
            ],
          }),

          new Paragraph({
            spacing: { before: 160, after: 160 },
            children: [txt(`Melakukan pengiriman pada tanggal ${tglKirimStr} ke ${faskesPenerima || '…………………………'}. Demikian surat keterangan ini dibuat, terima kasih.`)],
          }),

          /* Tanda tangan direktur (kanan) */
          new Table({
            width: { size: CONTENT_W, type: WidthType.DXA },
            borders: noTableBorder,
            rows: [new TableRow({ children: [
              new TableCell({ borders: noBorder, width: { size: Math.floor(CONTENT_W / 2), type: WidthType.DXA }, children: [new Paragraph({ children: [] })] }),
              new TableCell({
                borders: noBorder,
                width: { size: CONTENT_W - Math.floor(CONTENT_W / 2), type: WidthType.DXA },
                children: [
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [txt(`Gresik, ${tglKirimStr}`)] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [txt('Direktur RS Petrokimia Gresik')] }),
                  new Paragraph({ children: [] }), new Paragraph({ children: [] }), new Paragraph({ children: [] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [txt('dr. Dian Ayu Lukitasari, M.H., C.M.C.', { bold: true })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [txt('Direktur')] }),
                ],
              }),
            ]})],
          }),
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `tanda-terima-tcm-${tglKirim || 'draft'}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <style>{`
        :root {
          --bg: #F7F6F3;
          --surface: #FFFFFF;
          --surface2: #F2F1EE;
          --border: #E4E2DC;
          --border2: #CCCBC4;
          --text: #1A1917;
          --text2: #6B6A65;
          --text3: #9B9A95;
          --accent: #1A1917;
          --accent-bg: #1A1917;
          --accent-fg: #FFFFFF;
          --danger: #C94040;
          --danger-bg: #FDF2F2;
          --radius: 10px;
          --radius-sm: 6px;
        }
        .tcm-app { display: grid; grid-template-columns: 280px 1fr; min-height: 100vh; font-family: 'DM Sans', sans-serif; background: var(--bg); color: var(--text); font-size: 14px; line-height: 1.5; }
        .tcm-sidebar { background: var(--surface); border-right: 1px solid var(--border); padding: 2rem 1.5rem; position: sticky; top: 0; height: 100vh; overflow-y: auto; }
        .tcm-main { padding: 2rem 2.5rem; max-width: 780px; }
        .sidebar-logo { display: flex; align-items: center; gap: 10px; margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 1px solid var(--border); }
        .logo-mark { width: 32px; height: 32px; background: var(--accent-bg); border-radius: 8px; display: flex; align-items: center; justify-content: center; }
        .logo-mark svg { width: 16px; height: 16px; fill: white; }
        .logo-text { font-size: 13px; font-weight: 600; line-height: 1.2; }
        .logo-sub { font-size: 11px; color: var(--text3); font-weight: 400; }
        .sidebar-label { font-size: 10px; font-weight: 600; letter-spacing: 0.1em; color: var(--text3); text-transform: uppercase; margin-bottom: 0.75rem; }
        .sidebar-field { margin-bottom: 1rem; }
        .sidebar-field label { display: block; font-size: 12px; color: var(--text2); margin-bottom: 4px; }
        .sidebar-field input, .sidebar-field select { width: 100%; height: 34px; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0 10px; font-size: 12px; background: var(--bg); color: var(--text); font-family: 'DM Sans', sans-serif; }
        .sidebar-field input:focus, .sidebar-field select:focus { outline: none; border-color: var(--border2); background: var(--surface); }
        .readonly-field { height: 34px; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0 10px; font-size: 12px; background: var(--surface2); color: var(--text2); display: flex; align-items: center; }
        .sidebar-divider { border: none; border-top: 1px solid var(--border); margin: 1.25rem 0; }
        .main-header { margin-bottom: 1.75rem; }
        .main-title { font-size: 20px; font-weight: 600; letter-spacing: -0.02em; }
        .main-sub { font-size: 13px; color: var(--text3); margin-top: 3px; }
        .pasien-list { display: flex; flex-direction: column; gap: 1px; }
        .pasien-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; transition: border-color 0.15s; margin-bottom: 8px; }
        .pasien-card:hover { border-color: var(--border2); }
        .pasien-card-head { display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; background: var(--surface2); border-bottom: 1px solid var(--border); cursor: pointer; user-select: none; }
        .pasien-num { font-size: 11px; font-weight: 600; color: var(--text3); text-transform: uppercase; letter-spacing: 0.08em; }
        .pasien-name-preview { font-size: 13px; font-weight: 500; color: var(--text); margin-left: 10px; }
        .pasien-head-left { display: flex; align-items: center; gap: 4px; }
        .btn-remove { background: none; border: none; cursor: pointer; color: var(--text3); font-size: 16px; line-height: 1; padding: 2px 4px; border-radius: 4px; }
        .btn-remove:hover { color: var(--danger); background: var(--danger-bg); }
        .pasien-body { padding: 1rem; }
        .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .field-grid.three { grid-template-columns: 2fr 1fr 1fr; }
        .field-group { display: flex; flex-direction: column; gap: 4px; }
        .field-group.span2 { grid-column: 1 / -1; }
        .field-group label { font-size: 11px; color: var(--text3); font-weight: 500; }
        .field-group input, .field-group select { height: 36px; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0 10px; font-size: 13px; background: var(--bg); color: var(--text); font-family: 'DM Sans', sans-serif; }
        .field-group input:focus, .field-group select:focus { outline: none; border-color: var(--border2); background: var(--surface); }
        .spesimen-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
        .spesimen-label { font-size: 11px; color: var(--text3); margin-bottom: 4px; font-weight: 500; }
        .btn-add { display: flex; align-items: center; gap: 8px; padding: 0.65rem 1rem; background: var(--surface); border: 1px dashed var(--border2); border-radius: var(--radius); font-size: 13px; color: var(--text2); cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all 0.15s; width: 100%; margin-top: 8px; }
        .btn-add:hover { background: var(--surface2); border-color: var(--text3); color: var(--text); }
        .btn-add-icon { width: 20px; height: 20px; border-radius: 50%; background: var(--border); display: flex; align-items: center; justify-content: center; font-size: 14px; line-height: 1; color: var(--text2); }
        .count-chip { font-family: 'DM Mono', monospace; font-size: 11px; background: var(--surface2); border: 1px solid var(--border); padding: 2px 8px; border-radius: 99px; color: var(--text3); margin-left: auto; }
        .action-bar { display: flex; gap: 8px; margin-top: 1.5rem; align-items: center; }
        .btn-ghost { height: 38px; padding: 0 16px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 13px; color: var(--text2); cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all 0.15s; }
        .btn-ghost:hover { border-color: var(--border2); color: var(--text); background: var(--surface2); }
        .btn-primary { height: 38px; padding: 0 20px; background: var(--accent-bg); border: none; border-radius: var(--radius-sm); font-size: 13px; color: var(--accent-fg); font-weight: 500; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: opacity 0.15s; }
        .btn-primary:hover { opacity: 0.85; }
        .spacer { flex: 1; }
        .preview-wrap { margin-top: 2rem; border-top: 1px solid var(--border); padding-top: 1.5rem; }
        .preview-toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 1rem; }
        .preview-label { font-size: 12px; font-weight: 600; color: var(--text3); text-transform: uppercase; letter-spacing: 0.08em; }
        .preview-doc { background: white; color: #111; border: 1px solid var(--border); border-radius: var(--radius); padding: 2.5rem; font-size: 11.5px; line-height: 1.65; font-family: 'Times New Roman', serif; box-shadow: 0 2px 12px rgba(0,0,0,0.04); margin-bottom: 1.5rem; }
        .doc-logo-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; gap: 8px; }
        .doc-logo-header .doc-title { margin-bottom: 0; flex: 1; }
        .doc-logo-img { width: 70px; height: 70px; object-fit: contain; flex-shrink: 0; }
        .doc-title { text-align: center; font-size: 13px; font-weight: 700; letter-spacing: 0.02em; margin-bottom: 1.25rem; text-transform: uppercase; }
        .doc-meta { display: grid; grid-template-columns: 190px 1fr; gap: 2px; margin-bottom: 1rem; }
        .doc-meta .k { color: #333; }
        .doc-table { width: 100%; border-collapse: collapse; margin: 0.75rem 0; }
        .doc-table th, .doc-table td { border: 1px solid #666; padding: 5px 7px; font-size: 10.5px; }
        .doc-table th { background: #eee; font-weight: 600; text-align: center; }
        .doc-table td { text-align: center; }
        .doc-table td.left { text-align: left; }
        .ttd { display: flex; justify-content: space-between; margin-top: 2rem; }
        .ttd-col { text-align: center; width: 42%; }
        .ttd-space { height: 52px; }
        .ttd-name { font-weight: 700; }
        .surat-title { text-align: center; font-size: 13px; font-weight: 700; text-transform: uppercase; margin-bottom: 1rem; letter-spacing: 0.02em; }
        .surat-meta { display: grid; grid-template-columns: 100px 1fr; gap: 2px; margin: 0.5rem 0; }
        .surat-meta .k { color: #333; }
        .surat-ttd { display: flex; justify-content: flex-end; margin-top: 1.5rem; }
        .surat-ttd-col { text-align: center; width: 42%; }
        @media print {
          .tcm-app { display: block; }
          .tcm-sidebar { display: none !important; }
          .tcm-main { padding: 0; max-width: 100%; }
          .main-header, .pasien-list, .action-bar, .preview-toolbar, .no-print, .btn-add { display: none !important; }
          .preview-wrap { margin: 0; border: none; padding: 0; }
          .preview-doc { border: none; border-radius: 0; padding: 5cm 2cm 1.5cm 2cm; box-shadow: none; margin-bottom: 0; }
          .ttd-space { height: 90px; }
          .page-break { page-break-after: always; break-after: page; }
          @page { margin: 0; }
        }
      `}</style>

      <div className="tcm-app">
        {/* SIDEBAR */}
        <aside className="tcm-sidebar">
          <div className="sidebar-logo">
            <div className="logo-mark">
              <svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
            </div>
            <div>
              <div className="logo-text">TCM Specimen Form</div>
              <div className="logo-sub">RS Petrokimia Gresik</div>
            </div>
          </div>

          <div className="sidebar-label">Info fasyankes</div>
          <div className="sidebar-field">
            <label>Fasyankes pengirim</label>
            <div className="readonly-field">RS Petrokimia Gresik</div>
          </div>
          <div className="sidebar-field">
            <label>Jenis pemeriksaan <span style={{color:'#E53E3E'}}>*</span></label>
            <select value={jenisPemeriksaan} onChange={(e) => setJenisPemeriksaan(e.target.value)} style={{width:'100%', height:'36px', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'0 10px', fontSize:'13px', background:'var(--bg)', color:'var(--text)', fontFamily:'inherit'}} required>
              <option value="">— pilih jenis pemeriksaan —</option>
              {PEMERIKSAAN_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="sidebar-field">
            <label>Alasan pemeriksaan</label>
            <div className="readonly-field">Diagnosis Terduga TB</div>
          </div>

          <hr className="sidebar-divider" />
          <div className="sidebar-label">Detail pengiriman</div>
          <div className="sidebar-field">
            <label>Fasyankes penerima <span style={{color:'#E53E3E'}}>*</span></label>
            <input type="text" value={faskesPenerima} onChange={(e) => setFaskesPenerima(e.target.value)} placeholder="Nama puskesmas / RS..." required />
          </div>
          <div className="sidebar-field">
            <label>Tanggal pengiriman <span style={{color:'#E53E3E'}}>*</span></label>
            <input type="date" value={tglKirim} onChange={(e) => setTglKirim(e.target.value)} required />
          </div>
          <div className="sidebar-field">
            <label>Tanggal penerimaan <span style={{color:'var(--text3)'}}>(diisi penerima)</span></label>
            <input type="date" value={tglTerima} onChange={(e) => setTglTerima(e.target.value)} />
          </div>

          <hr className="sidebar-divider" />
          <div className="sidebar-label">Petugas pengirim</div>
          <div className="sidebar-field">
            <label>Pilih driver <span style={{color:'#E53E3E'}}>*</span></label>
            <select value={selectedDriver} onChange={(e) => handleDriverSelect(e.target.value)} style={{width:'100%', height:'36px', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'0 10px', fontSize:'12px', background:'var(--bg)', color:'var(--text)', fontFamily:'inherit'}}>
              <option value="">— input manual —</option>
              {DRIVERS.map(d => <option key={d.nik} value={d.nama}>{d.nama}</option>)}
            </select>
          </div>
          <div className="sidebar-field">
            <label>Nama petugas pengirim <span style={{color:'#E53E3E'}}>*</span></label>
            {selectedDriver
              ? <div className="readonly-field" style={{fontSize:'11px', letterSpacing:'0.01em'}}>{namaPengirim}</div>
              : <input type="text" value={namaPengirim} onChange={(e) => setNamaPengirim(e.target.value)} placeholder="Nama lengkap pengirim..." required />
            }
          </div>
          <div className="sidebar-field">
            <label>NIK pengirim <span style={{color:'#E53E3E'}}>*</span></label>
            {selectedDriver
              ? <div className="readonly-field">{nikPengirim}</div>
              : <input type="text" value={nikPengirim} onChange={(e) => handleNikPengirimChange(e.target.value)} placeholder="NIK pengirim" required />
            }
          </div>
          <div className="sidebar-field">
            <label>Jabatan pengirim <span style={{color:'#E53E3E'}}>*</span></label>
            <input type="text" value={jabatanPengirim} onChange={(e) => setJabatanPengirim(e.target.value)} placeholder="cth: Driver, Kurir..." required />
          </div>

          <hr className="sidebar-divider" />
          <div className="sidebar-label" style={{marginBottom:'0.5rem'}}>Direktur (Surat Ket.)</div>
          <div className="sidebar-field">
            <label>Nama direktur</label>
            <div className="readonly-field" style={{fontSize:'11px'}}>dr. Dian Ayu Lukitasari, M.H., C.M.C.</div>
          </div>
          <div className="sidebar-field">
            <label>NIK direktur</label>
            <div className="readonly-field" style={{fontSize:'11px'}}>PGM11216</div>
          </div>
        </aside>

        {/* MAIN */}
        <main className="tcm-main">
          <div className="main-header">
            <div style={{display:'flex', alignItems:'baseline', gap:'10px'}}>
              <h1 className="main-title">Data pasien</h1>
              <span className="count-chip">{pasienList.length} pasien</span>
            </div>
            <p className="main-sub">Tambah pasien sesuai kebutuhan. Setiap pasien bisa memiliki 1-2 spesimen.</p>
          </div>

          <div className="pasien-list">
            {pasienList.map((pasien, idx) => (
              <div key={pasien.id} className="pasien-card">
                <div className="pasien-card-head">
                  <div className="pasien-head-left">
                    <span className="pasien-num">Pasien #{idx + 1}</span>
                    <span className="pasien-name-preview">{pasien.nama ? `— ${pasien.nama}` : ''}</span>
                  </div>
                  <button className="btn-remove" onClick={() => hapusPasien(pasien.id)} title="Hapus pasien">×</button>
                </div>
                <div className="pasien-body">
                  <div className="field-grid three">
                    <div className="field-group span2">
                      <label>Nama lengkap pasien <span style={{color:'#E53E3E'}}>*</span></label>
                      <input type="text" value={pasien.nama} onChange={(e) => updatePasien(pasien.id, 'nama', e.target.value)} placeholder="Nama pasien..." required />
                    </div>
                    <div className="field-group">
                      <label>Umur (tahun) <span style={{color:'#E53E3E'}}>*</span></label>
                      <input type="text" inputMode="numeric" value={pasien.umur} onChange={(e) => updatePasien(pasien.id, 'umur', e.target.value)} placeholder="0" required />
                    </div>
                  </div>
                  <div className="field-grid" style={{marginTop:'10px'}}>
                    <div className="field-group">
                      <label>NIK <span style={{color:'#E53E3E'}}>*</span></label>
                      <input type="text" inputMode="numeric" value={pasien.nik} onChange={(e) => updatePasien(pasien.id, 'nik', e.target.value)} placeholder="16 digit NIK" maxLength={16} required />
                    </div>
                    <div className="field-group">
                      <label>Jenis kelamin <span style={{color:'#E53E3E'}}>*</span></label>
                      <select value={pasien.jk} onChange={(e) => updatePasien(pasien.id, 'jk', e.target.value)} required>
                        <option value="">Pilih...</option>
                        <option value="Laki-laki">Laki-laki</option>
                        <option value="Perempuan">Perempuan</option>
                      </select>
                    </div>
                  </div>
                  <div className="spesimen-row">
                    <div>
                      <div className="spesimen-label">Spesimen 1 <span style={{color:'#E53E3E'}}>*</span></div>
                      <select value={pasien.spes1} onChange={(e) => updatePasien(pasien.id, 'spes1', e.target.value)} style={{width:'100%', height:'36px', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'0 10px', fontSize:'13px', background:'var(--bg)', color:'var(--text)', fontFamily:'inherit'}} required>
                        <option value="">— pilih —</option>
                        {SPESIMEN_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <div className="spesimen-label">Spesimen 2 <span style={{color:'var(--text3)', fontWeight:400}}>(opsional)</span></div>
                      <select value={pasien.spes2} onChange={(e) => updatePasien(pasien.id, 'spes2', e.target.value)} style={{width:'100%', height:'36px', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'0 10px', fontSize:'13px', background:'var(--bg)', color:'var(--text)', fontFamily:'inherit'}}>
                        <option value="">— tidak ada —</option>
                        {SPESIMEN_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button className="btn-add" onClick={tambahPasien}>
            <span className="btn-add-icon">+</span>
            Tambah pasien
          </button>

          <div className="action-bar">
            <button className="btn-ghost" onClick={resetForm}>Reset semua</button>
            <div className="spacer"></div>
            <button className="btn-ghost" onClick={() => setShowPreview(!showPreview)}>
              {showPreview ? 'Tutup preview' : 'Preview dokumen'}
            </button>
            <button className="btn-ghost" onClick={handleExportWord}>Export Word</button>
            <button className="btn-primary" onClick={handlePrint}>Print / Save PDF</button>
          </div>

          {/* PREVIEW */}
          {showPreview && (
            <div className="preview-wrap">
              <div className="preview-toolbar no-print">
                <span className="preview-label">Preview dokumen</span>
                <div className="spacer"></div>
                <button className="btn-ghost" onClick={() => setShowPreview(false)}>Tutup preview</button>
                <button className="btn-ghost" onClick={handleExportWord}>Export Word</button>
                <button className="btn-primary" onClick={() => window.print()}>Print / Save PDF</button>
              </div>
              
              {/* TANDA TERIMA - Halaman 1 */}
              <div className="preview-doc page-break">
                <div className="doc-logo-header">
                  <img src="/logo-gresik.png" alt="Pemkab Gresik" className="doc-logo-img" />
                  <div className="doc-title">Tanda Terima Pengiriman Spesimen<br/>untuk Pemeriksaan {jenisPemeriksaan || 'TCM MTB RIF'}</div>
                  <img src="/logo-toss-tb.png" alt="TOSS TBC" className="doc-logo-img" />
                </div>

                <div className="doc-meta">
                  <span className="k">Fasyankes pengirim</span><span>: RS Petrokimia Gresik</span>
                  <span className="k">Berupa</span><span>: {pasienList.length} spesimen dari {pasienList.length} terduga TB</span>
                  <span className="k">Fasyankes penerima</span><span>: {faskesPenerima || '…………………………'}</span>
                  <span className="k">Untuk keperluan</span><span>: {jenisPemeriksaan || '…………………………'}</span>
                  <span className="k">Alasan pemeriksaan</span><span>: Diagnosis Terduga TB</span>
                  <span className="k">Tgl. pengiriman spesimen</span><span>: {tglKirim ? formatTgl(tglKirim) : '…………………………'}</span>
                  <span className="k">Tgl. penerimaan spesimen</span><span>: {tglTerima ? formatTgl(tglTerima) : '…………………………'}</span>
                </div>

                <table className="doc-table">
                  <thead>
                    <tr>
                      <th style={{width:'28px'}}>No</th>
                      <th>Nama Lengkap Pasien</th>
                      <th style={{width:'120px'}}>NIK</th>
                      <th style={{width:'55px'}}>Umur (Th)</th>
                      <th style={{width:'70px'}}>Jenis Kelamin</th>
                      <th>Jenis Spesimen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pasienList.map((p, i) => {
                      const spes = [p.spes1, p.spes2].filter(Boolean).join(' + ') || '—';
                      return (
                        <tr key={p.id}>
                          <td>{i + 1}</td>
                          <td className="left">{p.nama || '—'}</td>
                          <td>{p.nik || '—'}</td>
                          <td>{p.umur || '—'}</td>
                          <td>{p.jk || '—'}</td>
                          <td className="left">{spes}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="ttd">
                  <div className="ttd-col">
                    <div>Penerima</div>
                    <div className="ttd-space"></div>
                    <div>(____________________)</div>
                  </div>
                  <div className="ttd-col">
                    <div>Pengirim</div>
                    <div className="ttd-space"></div>
                    <div className="ttd-name">{namaPengirim ? `(${namaPengirim})` : '(____________________)'}</div>
                  </div>
                </div>
              </div>

              {/* SURAT KETERANGAN - Halaman 2 */}
              <div className="preview-doc">
                <div className="surat-title">Surat Keterangan</div>
                <p>Yang bertanda tangan dibawah ini:</p>
                <div className="surat-meta" style={{marginTop:'8px'}}>
                  <span className="k">Nama</span><span>: dr. Dian Ayu Lukitasari, M.H., C.M.C.</span>
                  <span className="k">NIK</span><span>: PGM11216</span>
                  <span className="k">Jabatan</span><span>: Direktur</span>
                </div>
                <p style={{margin: '10px 0'}}>Menerangkan bahwa benar petugas yang bernama:</p>
                <div className="surat-meta">
                  <span className="k">Nama</span><span>: {namaPengirim || '………………………'}</span>
                  <span className="k">NIK</span><span>: {nikPengirim || '………………………'}</span>
                  <span className="k">Jabatan</span><span>: {jabatanPengirim || '………………………'}</span>
                </div>
                <p style={{marginTop:'10px'}}>
                  Melakukan pengiriman pada tanggal {tglKirim ? formatTgl(tglKirim) : '…………………………'} ke {faskesPenerima || '…………………………'}. Demikian surat keterangan ini dibuat, terima kasih.
                </p>
                <div className="surat-ttd">
                  <div className="surat-ttd-col">
                    <div>Gresik, {tglKirim ? formatTgl(tglKirim) : '…………………………'}</div>
                    <div style={{marginTop: '2px'}}>Direktur RS Petrokimia Gresik</div>
                    <div className="ttd-space"></div>
                    <div className="ttd-name">dr. Dian Ayu Lukitasari, M.H., C.M.C.</div>
                    <div>Direktur</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
