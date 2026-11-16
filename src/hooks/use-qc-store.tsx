import React, { createContext, useContext } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { LotConfig, QCRecord } from '@/lib/types';
import { emptyLotConfig } from '@/lib/types';
import * as api from '@/lib/api';
import { useQCRecords, useAddQCRecord, useDeleteQCRecord, qcRecordKeys } from '@/features/qc/hooks/useQCRecords';
import { useQCConfig, useUpdateQCConfig, qcConfigKeys } from '@/features/qc/hooks/useQCConfig';

const EMPTY_CONFIG = emptyLotConfig();

interface QCStore {
  records: QCRecord[];
  config: LotConfig;
  loading: boolean;
  connected: boolean;
  addRecord: (record: QCRecord) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
  updateConfig: (config: LotConfig) => Promise<void>;
  refresh: () => Promise<void>;
}

const QCContext = createContext<QCStore | null>(null);

/**
 * QCProvider — now powered by React Query internally.
 * Maintains the same interface for backward compatibility.
 */
export function QCProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const connected = api.isConnected();

  const { data: records = [], isLoading: recordsLoading } = useQCRecords();
  // While the real config loads, show nothing rather than demo lots — those
  // carry a fabricated target that must never reach a run (finding 4.7).
  const { data: config = EMPTY_CONFIG, isLoading: configLoading } = useQCConfig();

  const addRecordMutation = useAddQCRecord();
  const deleteRecordMutation = useDeleteQCRecord();
  const updateConfigMutation = useUpdateQCConfig();

  const loading = recordsLoading || configLoading;

  const addRecord = async (record: QCRecord) => {
    await addRecordMutation.mutateAsync(record);
  };

  const deleteRecord = async (id: string) => {
    await deleteRecordMutation.mutateAsync(id);
  };

  const updateConfig = async (newConfig: LotConfig) => {
    await updateConfigMutation.mutateAsync(newConfig);
  };

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: qcRecordKeys.all }),
      queryClient.invalidateQueries({ queryKey: qcConfigKeys.all }),
    ]);
  };

  return (
    <QCContext.Provider value={{ records, config, loading, connected, addRecord, deleteRecord, updateConfig, refresh }}>
      {children}
    </QCContext.Provider>
  );
}

export function useQCStore(): QCStore {
  const ctx = useContext(QCContext);
  if (!ctx) throw new Error('useQCStore must be used within QCProvider');
  return ctx;
}
