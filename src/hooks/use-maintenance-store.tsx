import React, { createContext, useContext } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { MaintenanceRecord } from '@/lib/maintenance-types';
import { isMaintenanceConnected } from '@/lib/maintenance-gs-api';
import {
  useMaintenanceRecords,
  useAddMaintenanceRecord,
  useDeleteMaintenanceRecord,
  maintenanceKeys,
} from '@/features/maintenance/hooks/useMaintenanceRecords';

interface MaintenanceStore {
  records: MaintenanceRecord[];
  loading: boolean;
  connected: boolean;
  addRecord: (record: MaintenanceRecord) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const MaintenanceContext = createContext<MaintenanceStore | null>(null);

export function MaintenanceProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const connected = isMaintenanceConnected();

  const { data: records = [], isLoading } = useMaintenanceRecords();
  const addRecordMutation = useAddMaintenanceRecord();
  const deleteRecordMutation = useDeleteMaintenanceRecord();

  const addRecord = async (record: MaintenanceRecord) => {
    await addRecordMutation.mutateAsync(record);
  };

  const deleteRecord = async (id: string) => {
    await deleteRecordMutation.mutateAsync(id);
  };

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: maintenanceKeys.all });
  };

  return (
    <MaintenanceContext.Provider
      value={{ records, loading: isLoading, connected, addRecord, deleteRecord, refresh }}
    >
      {children}
    </MaintenanceContext.Provider>
  );
}

export function useMaintenanceStore(): MaintenanceStore {
  const ctx = useContext(MaintenanceContext);
  if (!ctx) throw new Error('useMaintenanceStore must be used within MaintenanceProvider');
  return ctx;
}
