import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { TransfusiDocument, TransfusiFilters } from '@/lib/transfusi-types';
import { isConnected } from '@/lib/api';
import { fetchDocuments, fetchDocumentById, uploadToDrive, deleteDocument } from '@/lib/transfusi-api';
import { toast } from 'sonner';

export const transfusiKeys = {
  all: ['transfusi-documents'] as const,
  list: (filters?: TransfusiFilters) => ['transfusi-documents', 'list', filters ?? {}] as const,
  detail: (id: string) => ['transfusi-documents', 'detail', id] as const,
};

export function useTransfusiDocuments(filters?: TransfusiFilters) {
  return useQuery({
    queryKey: transfusiKeys.list(filters),
    queryFn: () => fetchDocuments(filters),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: isConnected(),
  });
}

export function useTransfusiDocument(id: string) {
  return useQuery({
    queryKey: transfusiKeys.detail(id),
    queryFn: () => fetchDocumentById(id),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    enabled: !!id,
  });
}

export function useUploadTransfusi() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ pdfBase64, metadata }: {
      pdfBase64: string;
      metadata: { patientName?: string; medicalRecordNumber?: string; notes?: string };
    }) => {
      return uploadToDrive(pdfBase64, metadata);
    },
    onMutate: async ({ metadata }) => {
      await queryClient.cancelQueries({ queryKey: transfusiKeys.all });
      const now = new Date().toISOString();
      const optimistic: TransfusiDocument = {
        id: `optimistic-${Date.now()}`,
        patient_name: metadata.patientName || null,
        medical_record_number: metadata.medicalRecordNumber || null,
        request_date: now.split('T')[0],
        notes: metadata.notes || null,
        drive_file_id: null,
        drive_url: null,
        uploaded_by: null,
        created_at: now,
      };
      const previous = queryClient.getQueryData<TransfusiDocument[]>(transfusiKeys.list());
      queryClient.setQueryData<TransfusiDocument[]>(transfusiKeys.list(), (old) => old ? [optimistic, ...old] : [optimistic]);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(transfusiKeys.list(), context.previous);
      toast.error('Gagal mengupload dokumen');
    },
    onSuccess: () => toast.success('Dokumen berhasil diupload ke Drive'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: transfusiKeys.all }),
  });
}

export function useDeleteTransfusiDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteDocument,
    onMutate: async (documentId) => {
      await queryClient.cancelQueries({ queryKey: transfusiKeys.all });
      const previous = queryClient.getQueryData<TransfusiDocument[]>(transfusiKeys.list());
      queryClient.setQueryData<TransfusiDocument[]>(transfusiKeys.list(), (old) => old ? old.filter((d) => d.id !== documentId) : []);
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(transfusiKeys.list(), context.previous);
      toast.error('Gagal menghapus dokumen');
    },
    onSuccess: () => toast.success('Dokumen terhapus'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: transfusiKeys.all }),
  });
}
