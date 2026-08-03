import { useState, useRef } from 'react';
import { Camera, X, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/use-auth';
import { usePdfBuilder } from '@/features/transfusi/hooks/usePdfBuilder';
import { useUploadTransfusi } from '@/features/transfusi/hooks/useTransfusiRecords';
import { toast } from 'sonner';

export default function TransfusiForm({ onSuccess }: { onSuccess?: () => void }) {
  const { user } = useAuth();
  const { buildPdf } = usePdfBuilder();
  const uploadMutation = useUploadTransfusi();

  const [patientName, setPatientName] = useState('');
  const [medicalRecordNumber, setMedicalRecordNumber] = useState('');
  const [requestDate, setRequestDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [petugas, setPetugas] = useState(user?.nama ?? '');
  const [notes, setNotes] = useState('');

  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayPetugas = petugas || (user?.nama ?? '');
  const isUploading = uploadMutation.isPending;

  const handleAddPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setPhotos((prev) => [...prev, ...files]);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => setPhotoPreviews((prev) => [...prev, ev.target?.result as string]);
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (photos.length === 0) { toast.error('Minimal 1 foto dokumen diperlukan'); return; }

    try {
      const { base64 } = await buildPdf(photos, {
        patientName: patientName.trim() || undefined,
        medicalRecordNumber: medicalRecordNumber.trim() || undefined,
        requestDate,
        petugas: displayPetugas,
      });

      await uploadMutation.mutateAsync({
        pdfBase64: base64,
        metadata: {
          patientName: patientName.trim() || undefined,
          medicalRecordNumber: medicalRecordNumber.trim() || undefined,
          notes: notes.trim() || undefined,
        },
      });

      onSuccess?.();
    } catch (err: any) {
      console.error('Upload error:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Data Pasien */}
      <Card>
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm">Data Pasien</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Nama Pasien</Label>
              <Input placeholder="Nama pasien..." value={patientName} onChange={(e) => setPatientName(e.target.value)} className="mt-1" disabled={isUploading} />
            </div>
            <div>
              <Label className="text-xs">No. Rekam Medis</Label>
              <Input placeholder="No. RM..." value={medicalRecordNumber} onChange={(e) => setMedicalRecordNumber(e.target.value)} className="mt-1 font-mono" disabled={isUploading} />
            </div>
            <div>
              <Label className="text-xs">Tanggal Permintaan</Label>
              <Input type="date" value={requestDate} onChange={(e) => setRequestDate(e.target.value)} className="mt-1" disabled={isUploading} />
            </div>
            <div>
              <Label className="text-xs">Petugas</Label>
              <Input placeholder="Nama petugas..." value={displayPetugas} onChange={(e) => setPetugas(e.target.value)} className="mt-1" disabled={isUploading} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Catatan</Label>
            <Textarea placeholder="Opsional..." value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" rows={2} disabled={isUploading} />
          </div>
        </CardContent>
      </Card>

      {/* Foto */}
      <Card>
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm">Scan Dokumen *</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Ambil foto formulir transfusi, kwitansi, dan kantong darah. Semua foto akan digabung jadi 1 file PDF.
          </p>

          {photoPreviews.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {photoPreviews.map((src, i) => (
                <div key={i} className="relative rounded-lg overflow-hidden border bg-muted aspect-square">
                  <img src={src} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                  <button onClick={() => handleRemovePhoto(i)} className="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 text-white hover:bg-black/80" disabled={isUploading}>
                    <X size={14} />
                  </button>
                  <span className="absolute bottom-1 left-1 text-[10px] bg-black/60 text-white px-1 rounded">{i + 1}/{photoPreviews.length}</span>
                </div>
              ))}
            </div>
          )}

          <input
            id="transfusi-photo-input"
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="sr-only"
            onChange={handleAddPhotos}
          />
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            type="button"
            onClick={() => {
              const input = document.getElementById('transfusi-photo-input') as HTMLInputElement | null;
              input?.click();
            }}
            disabled={isUploading}
          >
            <Camera size={14} className="mr-1" />
            {photos.length > 0 ? `Tambah Foto (${photos.length})` : 'Ambil Foto Dokumen'}
          </Button>

          {photos.length > 0 && (
            <Badge variant="outline" className="text-[10px]">{photos.length} foto siap → 1 PDF</Badge>
          )}
        </CardContent>
      </Card>

      {/* Submit */}
      <Button className="w-full" size="lg" onClick={handleSubmit} disabled={isUploading}>
        {isUploading ? (
          <><Loader2 size={16} className="mr-2 animate-spin" /> Mengupload...</>
        ) : (
          '📤 Scan & Upload ke Drive'
        )}
      </Button>
    </div>
  );
}
