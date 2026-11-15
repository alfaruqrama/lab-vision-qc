
import React from 'react';
import { Button } from '@/components/ui/button';
import { FileText, ImageIcon, Download, Loader2, Printer } from 'lucide-react';
import { toPng } from 'html-to-image';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  buildLJChartPrintHtml,
  openPrintWindow,
  type LJChartPrintOptions,
} from '@/features/qc/lib/lj-print';

interface LJExportProps {
  chartRef: React.RefObject<HTMLDivElement>;
  downloading: boolean;
  setDownloading: (val: boolean) => void;
  selected: { alat: string; name: string; month: string };
  /** Everything the printed sheet needs, minus the timestamp. */
  printDoc: Omit<LJChartPrintOptions, 'printedAt'>;
}

export function LJExportControls({
  chartRef,
  downloading,
  setDownloading,
  selected,
  printDoc,
}: LJExportProps) {
  function handlePrint() {
    const html = buildLJChartPrintHtml({ ...printDoc, printedAt: new Date() });
    const ok = openPrintWindow(html, `LJ ${selected.alat} ${selected.name}`);
    if (!ok) toast.error('Popup diblokir! Izinkan popup untuk mencetak.');
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

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={handlePrint}>
        <Printer size={14} />
        Cetak Laporan
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-1.5" disabled={downloading}>
            {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Download
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handlePrint}>
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
