import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Droplets } from 'lucide-react';
import { Button } from '@/components/ui/button';
import TransfusiForm from '@/features/transfusi/components/TransfusiForm';
import { toast } from 'sonner';

export default function TransfusiInput() {
  const navigate = useNavigate();

  const handleSuccess = () => {
    navigate('/transfusi');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/transfusi')}>
          <ArrowLeft size={18} />
        </Button>
        <div>
          <h1 className="text-xl font-bold font-display flex items-center gap-2">
            <Droplets size={20} className="text-red-500" />
            Scan Dokumen Transfusi
          </h1>
          <p className="text-sm text-muted-foreground">
            Scan formulir, kwitansi, dan kantong darah — otomatis digabung jadi 1 PDF & upload ke Drive
          </p>
        </div>
      </div>

      {/* Form */}
      <TransfusiForm onSuccess={handleSuccess} />
    </div>
  );
}
