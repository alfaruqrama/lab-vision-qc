import { useNavigate } from 'react-router-dom';
import { FileText, ExternalLink, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { bloodProductLabel, type TransfusiDocument } from '@/lib/transfusi-types';
import { canModifyRecords } from '@/lib/auth-types';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

interface Props {
  doc: TransfusiDocument;
  /** Dipanggil setelah pengguna mengonfirmasi hapus. */
  onDelete?: (doc: TransfusiDocument) => void;
}

export default function TransfusiCard({ doc, onDelete }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const hasPdf = !!doc.drive_url;
  const canDelete = !!onDelete && canModifyRecords(user?.role);

  const hari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const d = new Date(doc.request_date);
  const dateStr = `${hari[d.getDay()]}, ${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`;

  const label = doc.patient_name || doc.medical_record_number || 'Tanpa Nama';
  const produk = bloodProductLabel(doc.blood_product);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nama = doc.patient_name || 'tanpa nama';
    const rm = doc.medical_record_number ? ` (RM: ${doc.medical_record_number})` : '';
    if (
      window.confirm(
        `Hapus dokumen transfusi "${nama}"${rm}?\n\nTindakan ini tidak dapat dibatalkan. ` +
          'Catatan: berkas PDF di Google Drive tidak ikut terhapus.',
      )
    ) {
      onDelete?.(doc);
    }
  };

  return (
    <div
      className="card-clinical p-4 cursor-pointer hover:shadow-md transition-shadow relative overflow-hidden"
      onClick={() => navigate(`/transfusi/${doc.id}`)}
    >
      <div className={cn('absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl', hasPdf ? 'bg-emerald-500' : 'bg-amber-500')} />

      <div className="flex items-start gap-3">
        <div className={cn('p-2 rounded-lg', hasPdf ? 'bg-emerald-500/10' : 'bg-amber-500/10')}>
          <FileText size={20} className={hasPdf ? 'text-emerald-600' : 'text-amber-600'} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="font-semibold text-sm">{label}</p>
            {doc.blood_product && (
              <Badge variant="outline" className="text-[10px] font-mono border-red-200 text-red-700 bg-red-50">
                {produk}
              </Badge>
            )}
            <Badge variant="outline" className={cn('text-[10px]', hasPdf ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : 'border-amber-200 text-amber-700 bg-amber-50')}>
              {hasPdf ? '✓ PDF Tersedia' : 'Pending'}
            </Badge>
          </div>

          {doc.patient_name && doc.medical_record_number && (
            <p className="text-xs text-muted-foreground">RM: {doc.medical_record_number}</p>
          )}

          {(doc.blood_type_rh || doc.bag_number) && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {doc.blood_type_rh && <span className="font-mono font-medium">{doc.blood_type_rh}</span>}
              {doc.blood_type_rh && doc.bag_number && ' · '}
              {doc.bag_number && <span>Kantong: {doc.bag_number}</span>}
            </p>
          )}

          {doc.notes && <p className="text-xs text-muted-foreground mt-0.5 truncate">{doc.notes}</p>}

          <p className="text-[10px] text-muted-foreground mt-1">{dateStr}</p>
        </div>

        <div className="flex items-center gap-0.5">
          {hasPdf && (
            <button
              onClick={(e) => { e.stopPropagation(); window.open(doc.drive_url!, '_blank'); }}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
              title="Buka di Drive"
              aria-label="Buka di Drive"
            >
              <ExternalLink size={14} />
            </button>
          )}
          {canDelete && (
            <button
              onClick={handleDelete}
              className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
              title="Hapus dokumen"
              aria-label="Hapus dokumen"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
