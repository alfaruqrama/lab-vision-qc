import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, PlusCircle, Droplets } from 'lucide-react';
import { useTransfusiStore } from '@/hooks/use-transfusi-store';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import TransfusiCard from '@/features/transfusi/components/TransfusiCard';
import TransfusiSearch from '@/features/transfusi/components/TransfusiSearch';
import type { TransfusiFilters } from '@/lib/transfusi-types';

function StatCard({ label, value, sub, icon: Icon, color }: { label: string; value: string | number; sub?: string; icon: any; color: string }) {
  return (
    <div className="card-clinical p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl" style={{ background: color }} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
          <p className="text-2xl font-bold font-display" style={{ color }}>{value}</p>
          {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        <div className="p-2 rounded-lg" style={{ background: `${color}15` }}><Icon size={20} style={{ color }} /></div>
      </div>
    </div>
  );
}

export default function TransfusiDashboard() {
  const navigate = useNavigate();
  const { documents, loading } = useTransfusiStore();
  const { user } = useAuth();
  const canInput = user?.role === 'admin' || user?.role === 'petugas';
  const [filters, setFilters] = useState<TransfusiFilters>({});

  const filteredDocs = useMemo(() => {
    let result = documents;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter((d) =>
        (d.patient_name || '').toLowerCase().includes(q) ||
        (d.medical_record_number || '').toLowerCase().includes(q)
      );
    }
    if (filters.dateFrom) result = result.filter((d) => d.request_date >= filters.dateFrom!);
    if (filters.dateTo) result = result.filter((d) => d.request_date <= filters.dateTo!);
    return result;
  }, [documents, filters]);

  const today = new Date().toISOString().split('T')[0];
  const todayCount = documents.filter((d) => d.request_date === today).length;
  const monthCount = documents.filter((d) => d.request_date.startsWith(today.slice(0, 7))).length;
  const withPdf = documents.filter((d) => !!d.drive_url).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-display flex items-center gap-2"><Droplets size={22} className="text-red-500" />Transfusi Darah</h1>
          <p className="text-sm text-muted-foreground">Scan & upload dokumen transfusi ke Google Drive</p>
        </div>
        {canInput && (
          <Button size="sm" onClick={() => navigate('/transfusi/input')}><PlusCircle size={14} className="mr-1" />Scan Baru</Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Bulan Ini" value={monthCount} icon={FileText} color="#2563eb" />
        <StatCard label="Hari Ini" value={todayCount} icon={Droplets} color="#dc2626" />
        <StatCard label="PDF Tersedia" value={withPdf} sub={documents.length > 0 ? `${Math.round((withPdf / documents.length) * 100)}%` : undefined} icon={FileText} color={withPdf === documents.length && documents.length > 0 ? '#16a34a' : '#d97706'} />
        <StatCard label="Total Arsip" value={documents.length} icon={FileText} color="#7c3aed" />
      </div>

      <TransfusiSearch filters={filters} onChange={setFilters} />

      {loading ? (
        <div className="text-center py-12 text-sm text-muted-foreground">Memuat data...</div>
      ) : filteredDocs.length === 0 ? (
        <Card className="p-12 text-center">
          <Droplets size={40} className="mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            {documents.length === 0 ? 'Belum ada dokumen. Klik "Scan Baru" untuk memulai.' : 'Tidak ada dokumen yang cocok dengan filter.'}
          </p>
          {documents.length === 0 && canInput && (
            <Button size="sm" className="mt-4" onClick={() => navigate('/transfusi/input')}><PlusCircle size={14} className="mr-1" />Scan Dokumen Pertama</Button>
          )}
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredDocs.map((doc) => <TransfusiCard key={doc.id} doc={doc} />)}
        </div>
      )}
    </div>
  );
}
