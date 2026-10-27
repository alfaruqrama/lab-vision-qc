
import React from 'react';
import { Button } from '@/components/ui/button';
import { FileText, ImageIcon, Download, Loader2, AlertCircle } from 'lucide-react';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import { INSTRUMENT_LABELS } from '@/features/qc/lib/constants';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface LJExportProps {
  chartRef: React.RefObject<HTMLDivElement>;
  previewRef: React.RefObject<HTMLDivElement>;
  previewImage: string | null;
  downloading: boolean;
  setDownloading: (val: boolean) => void;
  setPreviewImage: (img: string | null) => void;
  setPreviewOpen: (open: boolean) => void;
  selected: { alat: string; name: string; month: string };
  user: any;
  controlSummary: any;
  displayLevel: string;
  formatMonthLabel: () => string;
}

export function LJExportControls({ 
  chartRef, previewRef, previewImage, downloading, setDownloading, 
  setPreviewImage, setPreviewOpen, selected, user, controlSummary, 
  displayLevel, formatMonthLabel 
}: LJExportProps) {
  
  async function handleOpenPreview() {
    if (!chartRef.current) {
      toast.error('Chart tidak ditemukan');
      return;
    }
    setDownloading(true);
    try {
      const dataUrl = await toPng(chartRef.current, { quality: 0.95, pixelRatio: 2, skipFonts: true });
      setPreviewImage(dataUrl);
      setPreviewOpen(true);
    } catch (err) {
      console.error('Failed to capture chart:', err);
      toast.error('Gagal membuat preview grafik. Coba refresh halaman.');
    } finally {
      setDownloading(false);
    }
  }

  async function handleDownloadPNG() {
    if (!chartRef.current) {
      toast.error('Chart tidak ditemukan');
      return;
    }
    setDownloading(true);
    try {
      const dataUrl = await toPng(chartRef.current, { quality: 0.95, pixelRatio: 2, skipFonts: true });
      const link = document.createElement('a');
      link.download = `LJ_${selected.alat}_${selected.name}_${selected.month}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('Grafik PNG berhasil diunduh');
    } catch (err) {
      console.error('Failed to capture chart:', err);
      toast.error('Gagal mengunduh PNG. Coba lagi nanti.');
    } finally {
      setDownloading(false);
    }
  }

  function handlePrint() {
    if (!previewImage) return;
    const monthLabel = formatMonthLabel();
    const printWin = window.open('', '_blank', 'width=800,height=600');
    if (!printWin) {
      toast.error('Popup diblokir! Izinkan popup untuk mencetak.');
      return;
    }

    const picName = user?.nama || '.....................................';
    const kaLabName = 'Marlina Setya Dewi, Str.Kes';

    const html = `<!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="utf-8" />
      <title>Grafik LJ - ${INSTRUMENT_LABELS[selected.alat as any]} - ${selected.name}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: system-ui, -apple-system, sans-serif; color: #1a1a1a; padding: 24px 28px; }
        .header { text-align: center; border-bottom: 2px solid #1a1a1a; padding-bottom: 12px; margin-bottom: 16px; }
        .header h2 { font-size: 16px; letter-spacing: 1px; }
        .header p { font-size: 11px; color: #555; margin-top: 2px; }
        .title { text-align: center; margin-bottom: 14px; }
        .title h3 { font-size: 13px; text-transform: uppercase; letter-spacing: 1px; }
        .title .main { font-size: 15px; font-weight: 700; margin: 4px 0; }
        .title .sub { font-size: 10px; color: #666; }
        .chart { border: 1px solid #ddd; border-radius: 4px; overflow: hidden; margin-bottom: 20px; }
        .chart img { width: 100%; display: block; }
        .summary { margin: 16px 0; padding: 12px 16px; border: 1px solid #ddd; border-radius: 4px; }
        .summary-title { font-size: 13px; font-weight: 700; margin-bottom: 8px; }
        .summary-table { width: 100%; border-collapse: collapse; font-size: 11px; }
        .summary-table td { padding: 4px 8px; text-align: center; border: 1px solid #eee; }
        .summary-table .bold { font-weight: 700; font-size: 12px; }
        .summary-table .ok { color: #16a34a; }
        .summary-table .nok { color: #dc2626; }
        .verdict { font-size: 12px; font-weight: 700; margin-top: 8px; }
        .verdict.ok { color: #16a34a; }
        .verdict.nok { color: #dc2626; }
        .signatures { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 16px; border-top: 1px solid #ccc; }
        .sig { text-align: center; flex: 1; }
        .sig .label { font-size: 11px; font-weight: 600; margin-bottom: 8px; }
        .sig .line { font-size: 10px; color: #555; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>RS PETROKIMIA GRESIK</h2>
        <p>Instalasi Laboratorium Klinik</p>
      </div>
      <div class="title">
        <h3>Grafik Levey-Jennings</h3>
        <p class="main">${INSTRUMENT_LABELS[selected.alat as any]} — ${selected.name}</p>
        <p class="sub">Level: ${displayLevel} &mdash; ${monthLabel}</p>
      </div>
      <div class="chart">
        <img src="${previewImage}" alt="LJ Chart" />
      </div>
      <div class="summary">
        <h3 class="summary-title">Resume Kontrol${controlSummary.levelLabel ? ` (${controlSummary.levelLabel})` : ''}</h3>
        <table class="summary-table">
          <tr><td>Total Run</td><td>In-Control</td><td>Out-of-Control</td></tr>
          <tr>
            <td class="bold">${controlSummary.total}</td>
            <td class="bold ok">${controlSummary.inControl} (${controlSummary.inControlPct.toFixed(0)}%)</td>
            <td class="bold nok">${controlSummary.outOfControl} (${controlSummary.total > 0 ? ((controlSummary.outOfControl / controlSummary.total) * 100).toFixed(0) : 0}%)</td>
          </tr>
        </table>
        <p class="verdict ${controlSummary.inControlPct >= 95 ? 'ok' : 'nok'}">
          ${controlSummary.inControlPct >= 95 ? '✓ Kontrol Masuk' : '✗ Kontrol Tidak Masuk'}
        </p>
      </div>
      <div class="signatures">
        <div class="sig"><p class="label">PIC Alat</p><p class="line">${picName}</p></div>
        <div class="sig"><p class="label">Ka. Instalasi Lab</p><p class="line">${kaLabName}</p></div>
      </div>
      <script>window.onload = function() { window.print(); }</script>
    </body>
    </html>`;
    printWin.document.write(html);
    printWin.document.close();
  }

  async function handleDownloadPDF() {
    if (!previewRef.current) {
      toast.error('Preview tidak ditemukan');
      return;
    }
    setDownloading(true);
    try {
      const dataUrl = await toPng(previewRef.current, { quality: 0.95, pixelRatio: 2, skipFonts: true });
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const imgWidth = pageWidth - margin * 2;
      const img = document.createElement('img');
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.src = dataUrl;
      });
      const imgHeight = Math.min((img.height / img.width) * imgWidth, pageHeight - margin * 2);
      pdf.addImage(dataUrl, 'PNG', margin, margin, imgWidth, imgHeight);
      pdf.save(`LJ_${selected.alat}_${selected.name}_${selected.month}.pdf`);
      toast.success('PDF berhasil diunduh');
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      toast.error('Gagal membuat PDF. Coba gunakan opsi Cetak.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-1.5" disabled={downloading}>
            {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Download
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleOpenPreview}>
            <FileText size={14} className="mr-2" /> Preview &amp; Cetak
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDownloadPNG}>
            <ImageIcon size={14} className="mr-2" /> Download PNG
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
