// ─── Main Document Type ─────────────────────────────────────────────────────

export interface TransfusiDocument {
  id: string;
  patient_name: string | null;
  medical_record_number: string | null;
  request_date: string;
  notes: string | null;
  drive_file_id: string | null;
  drive_url: string | null;
  uploaded_by: string | null;
  created_at: string;
}

// ─── API Request / Response ─────────────────────────────────────────────────

export interface UploadTransfusiRequest {
  pdfBase64: string;
  patientName?: string;
  medicalRecordNumber?: string;
  notes?: string;
  sessionToken: string;
}

export interface UploadTransfusiResponse {
  success: boolean;
  drive_file_id?: string;
  drive_url?: string;
  document_id?: string;
  error?: string;
}

// ─── Search / Filter Types ──────────────────────────────────────────────────

export interface TransfusiFilters {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}
