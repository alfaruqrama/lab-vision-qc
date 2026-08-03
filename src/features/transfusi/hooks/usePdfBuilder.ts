import { jsPDF } from 'jspdf';

export function usePdfBuilder() {
  const buildPdf = async (
    photos: File[],
    metadata: { patientName?: string; medicalRecordNumber?: string; requestDate: string; petugas: string },
  ): Promise<{ blob: Blob; base64: string }> => {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Cover Page
    pdf.setFontSize(18);
    pdf.text('Dokumen Transfusi Darah', pageWidth / 2, 40, { align: 'center' });

    pdf.setFontSize(12);
    if (metadata.patientName) {
      pdf.text(`Nama Pasien: ${metadata.patientName}`, pageWidth / 2, 60, { align: 'center' });
    }
    if (metadata.medicalRecordNumber) {
      pdf.text(`No. RM: ${metadata.medicalRecordNumber}`, pageWidth / 2, 70, { align: 'center' });
    }
    pdf.text(`Tanggal Permintaan: ${metadata.requestDate}`, pageWidth / 2, 85, { align: 'center' });
    pdf.text(`Petugas: ${metadata.petugas}`, pageWidth / 2, 95, { align: 'center' });

    pdf.setFontSize(10);
    pdf.setTextColor(128);
    pdf.text('Dokumen dibuat otomatis — RS Petrokimia Gresik', pageWidth / 2, pageHeight - 15, { align: 'center' });

    // Photo pages
    for (let i = 0; i < photos.length; i++) {
      pdf.addPage();
      const dataUrl = await fileToDataUrl(photos[i]);
      const imgProps = pdf.getImageProperties(dataUrl);
      const imgWidth = pageWidth - 20;
      const imgHeight = (imgProps.height / imgProps.width) * imgWidth;
      const maxHeight = pageHeight - 30;
      const finalHeight = Math.min(imgHeight, maxHeight);
      const finalWidth = (imgProps.width / imgProps.height) * finalHeight;
      const x = (pageWidth - finalWidth) / 2;
      pdf.addImage(dataUrl, 'JPEG', x, 10, finalWidth, finalHeight);
      pdf.setFontSize(9);
      pdf.setTextColor(100);
      pdf.text(`Halaman ${i + 2} — Foto ${i + 1} dari ${photos.length}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    }

    const arrayBuffer = pdf.output('arraybuffer');
    const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
    const base64 = await blobToBase64(blob);
    return { blob, base64 };
  };

  return { buildPdf };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).replace(/^data:.*?;base64,/, ''));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
