import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PortalMaintenanceLayout from '@/components/layout/MaintenanceLayout';
import { MaintenanceContent } from '@/features/maintenance/components/MaintenanceContent';

export default function MaintenancePage() {
  const { alat } = useParams<{ alat: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (!alat) {
      navigate('/maintenance/BC6800', { replace: true });
    }
  }, [alat, navigate]);

  if (!alat) {
    return null;
  }

  return (
    <PortalMaintenanceLayout>
      <MaintenanceContent alat={alat} />
    </PortalMaintenanceLayout>
  );
}
