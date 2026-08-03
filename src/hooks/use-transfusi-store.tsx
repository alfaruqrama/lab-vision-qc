import React, { createContext, useContext } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { isConnected } from '@/lib/api';
import { useTransfusiDocuments, useUploadTransfusi, useDeleteTransfusiDocument, transfusiKeys } from '@/features/transfusi/hooks/useTransfusiRecords';
import type { TransfusiDocument, TransfusiFilters } from '@/lib/transfusi-types';

interface TransfusiStore {
  connected: boolean;
  documents: TransfusiDocument[];
  loading: boolean;
  refresh: () => Promise<void>;
  uploadDocument: (pdfBase64: string, metadata: { patientName?: string; medicalRecordNumber?: string; notes?: string }) => Promise<any>;
  deleteDocument: (id: string) => Promise<void>;
}

const TransfusiContext = createContext<TransfusiStore | null>(null);

export function TransfusiProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const connected = isConnected();
  const { data: documents = [], isLoading } = useTransfusiDocuments();
  const uploadMutation = useUploadTransfusi();
  const deleteMutation = useDeleteTransfusiDocument();

  const refresh = async () => { await queryClient.invalidateQueries({ queryKey: transfusiKeys.all }); };

  const uploadDocument = async (pdfBase64: string, metadata: { patientName?: string; medicalRecordNumber?: string; notes?: string }) => {
    return uploadMutation.mutateAsync({ pdfBase64, metadata });
  };

  const deleteDocument = async (id: string) => { await deleteMutation.mutateAsync(id); };

  return (
    <TransfusiContext.Provider value={{ connected, documents, loading: isLoading, refresh, uploadDocument, deleteDocument }}>
      {children}
    </TransfusiContext.Provider>
  );
}

export function useTransfusiStore(): TransfusiStore {
  const ctx = useContext(TransfusiContext);
  if (!ctx) throw new Error('useTransfusiStore must be used within TransfusiProvider');
  return ctx;
}
