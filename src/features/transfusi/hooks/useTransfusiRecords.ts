import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  TransfusiDocument,
  TransfusiFilters,
  UploadTransfusiMetadata,
} from '@/lib/transfusi-types';
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
    mutationFn: async ({
      pdfBase64,
      metadata,
    }: {
      pdfBase64: string;
      metadata: UploadTransfusiMetadata;
    }) => {
      return uploadToDrive(pdfBase64, metadata);
    },
    onMutate: async ({ metadata }) => {
      await queryClient.cancelQueries({ queryKey: transfusiKeys.all });
      const now = new Date().toISOString();
      const optimistic: TransfusiDocument = {
        id: `optimistic-${Date.now()}`,
        patient_name: metadata.patientName,
        medical_record_number: metadata.medicalRecordNumber,
        request_date: metadata.requestDate || now.split('T')[0],
        notes: metadata.notes || null,
        drive_file_id: null,
        drive_url: null,
        uploaded_by: null,
        created_at: now,
        blood_product: metadata.bloodProduct,
        bag_count: metadata.bagCount,
        blood_type_rh: metadata.bloodTypeRh,
        bag_number: metadata.bagNumber,
        inform_concern: metadata.informConcern ?? true,
        surat_permintaan: metadata.suratPermintaan ?? true,
        form_reaksi: metadata.formReaksi ?? true,
        origin: metadata.origin,
      };
      const previous = queryClient.getQueryData<TransfusiDocument[]>(transfusiKeys.list());
      queryClient.setQueryData<TransfusiDocument[]>(transfusiKeys.list(), (old) =>
        old ? [optimistic, ...old] : [optimistic],
      );
      return { previous };
    },
    onError: (err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(transfusiKeys.list(), context.previous);
      const message = err instanceof Error ? err.message : '';
      if (message.includes('nama pasien') || message.includes('No. RM')) {
        toast.error(message);
      } else if (
        message.includes('GOOGLE_OAUTH_') ||
        message.includes('GOOGLE_SERVICE_ACCOUNT_KEY') ||
        message.includes('belum di-set')
      ) {
        toast.error('Drive belum dikonfigurasi. Hubungi admin.');
      } else if (message.includes('invalid_grant') || message.includes('Refresh token')) {
        toast.error('Otorisasi Google Drive kedaluwarsa. Admin perlu mint token ulang.');
      } else {
        toast.error('Gagal mengunggah dokumen');
      }
    },
    onSuccess: (result) => {
      if (result?.sheet_warning) {
        // PDF tersimpan, tetapi baris arsip gagal masuk Google Sheet.
        // Peringatan (bukan error) — operator tidak perlu mengunggah ulang.
        toast.warning('Dokumen tersimpan ke Drive, tetapi gagal dicatat ke Google Sheet.', {
          description: 'Catat manual bila perlu. Detail teknis ada di log server.',
          duration: 10_000,
        });
      } else {
        toast.success('Dokumen berhasil disimpan ke Google Drive');
      }
    },
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
      queryClient.setQueryData<TransfusiDocument[]>(transfusiKeys.list(), (old) =>
        old ? old.filter((d) => d.id !== documentId) : [],
      );
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
