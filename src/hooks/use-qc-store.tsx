import React, { createContext, useContext } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { LotConfig, QCRecord } from '@/lib/types';
import { DEFAULT_LOT_CONFIG } from '@/lib/mock-data';
import * as api from '@/lib/api';
import { useQCRecords, useAddQCRecord, qcRecordKeys } from '@/features/qc/hooks/useQCRecords';
import { useQCConfig, useUpdateQCConfig, qcConfigKeys } from '@/features/qc/hooks/useQCConfig';

interface QCStore {
  records: QCRecord[];
  config: LotConfig;
  loading: boolean;
  connected: boolean;
  addRecord: (record: QCRecord) => Promise<void>;
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
  const { data: config = DEFAULT_LOT_CONFIG, isLoading: configLoading } = useQCConfig();

  const addRecordMutation = useAddQCRecord();
  const updateConfigMutation = useUpdateQCConfig();

  const loading = recordsLoading || configLoading;

  const addRecord = async (record: QCRecord) => {
    await addRecordMutation.mutateAsync(record);
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
    <QCContext.Provider value={{ records, config, loading, connected, addRecord, updateConfig, refresh }}>
      {children}
    </QCContext.Provider>
  );
}

export function useQCStore(): QCStore {
  const ctx = useContext(QCContext);
  if (!ctx) throw new Error('useQCStore must be used within QCProvider');
  return ctx;
}
