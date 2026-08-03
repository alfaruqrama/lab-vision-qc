import { useNavigate } from 'react-router-dom';
import { FileText, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { TransfusiDocument } from '@/lib/transfusi-types';
import { cn } from '@/lib/utils';

interface Props { doc: TransfusiDocument }

export default function TransfusiCard({ doc }: Props) {
  const navigate = useNavigate();
  const hasPdf = !!doc.drive_url;

  const hari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const d = new Date(doc.request_date);
  const dateStr = `${hari[d.getDay()]}, ${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`;

  const label = doc.patient_name || doc.medical_record_number || 'Tanpa Nama';

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
          <div className="flex items-center gap-2 mb-1">
            <p className="font-semibold text-sm">{label}</p>
            <Badge variant="outline" className={cn('text-[10px]', hasPdf ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : 'border-amber-200 text-amber-700 bg-amber-50')}>
              {hasPdf ? '✓ PDF Tersedia' : 'Pending'}
            </Badge>
          </div>

          {doc.patient_name && doc.medical_record_number && (
            <p className="text-xs text-muted-foreground">RM: {doc.medical_record_number}</p>
          )}
          {doc.notes && <p className="text-xs text-muted-foreground mt-0.5 truncate">{doc.notes}</p>}

          <p className="text-[10px] text-muted-foreground mt-1">{dateStr}</p>
        </div>

        {hasPdf && (
          <button
            onClick={(e) => { e.stopPropagation(); window.open(doc.drive_url!, '_blank'); }}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
            title="Buka di Drive"
          >
            <ExternalLink size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
