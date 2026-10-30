import { Printer, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PrintPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  data: {
    alat: string;
    tanggal: string;
    petugas: string;
    periode: string;
    status: 'baik' | 'rusak';
    items: string[];
    aktivitas: Record<string, boolean>;
    keterangan?: string;
  };
}

export function PrintPreview({ isOpen, onClose, data }: PrintPreviewProps) {
  if (!isOpen) return null;

  const getPeriodeLabel = (periode: string) => {
    const labels: Record<string, string> = {
      harian: 'Harian',
      mingguan: 'Mingguan',
      bulanan: 'Bulanan',
      uji_fungsi: 'Uji Fungsi',
    };
    return labels[periode] || periode;
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={cn(
      'fixed inset-0 z-50 flex flex-col bg-slate-600/90 backdrop-blur-sm',
      'print:bg-white print:static print:z-auto'
    )}>
      {/* Toolbar - Hidden on Print */}
      <div className="bg-card px-6 py-4 flex justify-between items-center shadow-lg print:hidden shrink-0">
        <h2 className="font-bold text-lg">Preview Dokumen Cetak</h2>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={onClose}>
            <X size={16} className="mr-1" />
            Tutup Preview
          </Button>
          <Button size="sm" onClick={handlePrint}>
            <Printer size={16} className="mr-1" />
            Cetak Dokumen
          </Button>
        </div>
      </div>

      {/* A4 Paper Container */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center print:p-0 print:overflow-visible">
        <div className="bg-white shadow-2xl max-w-[210mm] w-full min-h-[297mm] p-[10mm] sm:p-[20mm] text-black print:shadow-none print:max-w-none print:w-full print:min-h-0 print:p-0 mx-auto">
          {/* Print Header */}
          <div className="mb-6 border-b-2 border-black pb-4 text-center">
            <h1 className="text-xl font-bold uppercase tracking-wide">
              Catatan Pemeliharaan Alat Laboratorium
            </h1>
            <p className="text-sm mt-1 text-gray-600 print:text-black">
              Laboratorium Patologi
            </p>
          </div>

          {/* Info Alat */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-8 text-sm">
            <div>
              <span className="font-semibold inline-block w-28">Nama Alat</span>: {data.alat}
            </div>
            <div>
              <span className="font-semibold inline-block w-28">Tanggal</span>: {data.tanggal}
            </div>
            <div>
              <span className="font-semibold inline-block w-28">Petugas</span>: {data.petugas || '(Belum diisi)'}
            </div>
            <div>
              <span className="font-semibold inline-block w-28">Periode</span>: {getPeriodeLabel(data.periode)}
            </div>
            <div>
              <span className="font-semibold inline-block w-28">Status</span>:{' '}
              <span className="uppercase font-bold">{data.status}</span>
            </div>
          </div>

          {/* Checklist Table */}
          <div className="mb-8">
            <table className="w-full border-collapse border border-black text-sm">
              <thead>
                <tr className="bg-gray-100 print:bg-transparent">
                  <th className="border border-black p-2 w-12 text-center">No</th>
                  <th className="border border-black p-2 text-left">Parameter / Tindakan Pemeliharaan</th>
                  <th className="border border-black p-2 w-24 text-center">Dilakukan</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item, idx) => {
                  const isChecked = data.aktivitas[item] || false;
                  return (
                    <tr key={item}>
                      <td className="border border-black p-2 text-center">{idx + 1}</td>
                      <td className="border border-black p-2">{item}</td>
                      <td className="border border-black p-2 text-center text-lg font-bold">
                        {isChecked ? '✓' : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="mt-3 text-sm">
              <p>
                Total penyelesaian: <strong>{Object.values(data.aktivitas).filter(Boolean).length}</strong> dari{' '}
                <strong>{data.items.length}</strong> tugas pemeliharaan.
              </p>
            </div>
          </div>

          {/* Keterangan */}
          {data.keterangan && (
            <div className="mb-8 text-sm">
              <p className="font-semibold mb-2">Keterangan:</p>
              <p className="whitespace-pre-wrap">{data.keterangan}</p>
            </div>
          )}

          {/* Signatures */}
          <div className="flex justify-between text-sm mt-24 px-4 sm:px-12">
            <div className="text-center">
              <p className="mb-24">Mengetahui,</p>
              <p className="font-bold underline">Kepala Laboratorium</p>
            </div>
            <div className="text-center">
              <p className="mb-24">Petugas Pelaksana,</p>
              <p className="font-bold underline">{data.petugas || '(____________________)'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
