import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, FileText, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import DocumentPreview from '@/features/transfusi/components/DocumentPreview';
import { useTransfusiDocument, useDeleteTransfusiDocument } from '@/features/transfusi/hooks/useTransfusiRecords';
import { useAuth } from '@/hooks/use-auth';

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export default function TransfusiDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: doc, isLoading } = useTransfusiDocument(id || '');
  const deleteMutation = useDeleteTransfusiDocument();
  const [previewOpen, setPreviewOpen] = useState(false);
  const canDelete = user?.role === 'admin';

  const handleDelete = async () => {
    if (!doc || !window.confirm(`Hapus dokumen ${doc.patient_name || 'tanpa nama'}?`)) return;
    try { await deleteMutation.mutateAsync(doc.id); navigate('/transfusi'); } catch { /* toasted */ }
  };

  if (isLoading) return <div className="flex items-center justify-center py-20"><p className="text-sm text-muted-foreground">Memuat dokumen...</p></div>;
  if (!doc) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <FileText size={48} className="text-muted-foreground/30 mb-4" />
        <h2 className="text-lg font-semibold mb-2">Dokumen Tidak Ditemukan</h2>
        <Button variant="outline" size="sm" onClick={() => navigate('/transfusi')}>Kembali ke Dashboard</Button>
      </div>
    );
  }

  const hasPdf = !!doc.drive_url;
  const d = new Date(doc.request_date);
  const dateStr = `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
  const created = new Date(doc.created_at);
  const createdStr = `${created.toLocaleDateString('id-ID')} ${created.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/transfusi')}><ArrowLeft size={18} /></Button>
          <div>
            <h1 className="text-xl font-bold font-display">{doc.patient_name || 'Tanpa Nama'}</h1>
            <p className="text-sm text-muted-foreground">RM: {doc.medical_record_number || '—'} · {dateStr}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasPdf && (
            <>
              <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}><FileText size={14} className="mr-1" />Preview</Button>
              <Button variant="outline" size="sm" onClick={() => window.open(doc.drive_url!, '_blank')}><ExternalLink size={14} className="mr-1" />Drive</Button>
            </>
          )}
          {canDelete && <Button variant="outline" size="sm" className="text-destructive" onClick={handleDelete}><Trash2 size={14} /></Button>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm">Data Pasien</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Nama Pasien</span><span className="font-medium">{doc.patient_name || '—'}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">No. RM</span><span className="font-mono">{doc.medical_record_number || '—'}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Tgl Permintaan</span><span>{dateStr}</span></div>
            {doc.notes && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Catatan</span><span>{doc.notes}</span></div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 pt-4"><CardTitle className="text-sm">Status & File</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Status PDF</span>
              <Badge className={hasPdf ? 'bg-emerald-500/20 text-emerald-700 border-0' : 'bg-amber-500/20 text-amber-600 border-0'}>
                {hasPdf ? '✓ Tersimpan di Drive' : 'Pending'}
              </Badge>
            </div>
            {doc.drive_file_id && <div className="flex justify-between text-sm"><span className="text-muted-foreground">File ID</span><span className="font-mono text-xs max-w-[200px] truncate">{doc.drive_file_id}</span></div>}
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Dibuat</span><span className="text-xs">{createdStr}</span></div>
          </CardContent>
        </Card>
      </div>

      <DocumentPreview open={previewOpen} onOpenChange={setPreviewOpen} driveUrl={doc.drive_url} bagNumber={doc.patient_name || 'Dokumen'} />
    </div>
  );
}
