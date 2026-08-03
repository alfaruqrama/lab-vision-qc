import { getStoredAuth } from './auth-api';
import { createSupabaseClient } from './supabase';
import { isConnected } from './api';
import type { TransfusiDocument, TransfusiFilters, UploadTransfusiResponse } from './transfusi-types';

// ─── Helpers ────────────────────────────────────────────────────────────────

function loadLocalDocuments(): TransfusiDocument[] {
  try {
    const raw = localStorage.getItem('lab_transfusi_documents');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalDocuments(docs: TransfusiDocument[]) {
  localStorage.setItem('lab_transfusi_documents', JSON.stringify(docs));
}

// ─── Fetch Documents ────────────────────────────────────────────────────────

export async function fetchDocuments(filters?: TransfusiFilters): Promise<TransfusiDocument[]> {
  if (!isConnected()) {
    let docs = loadLocalDocuments();
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      docs = docs.filter(d =>
        (d.patient_name || '').toLowerCase().includes(q) ||
        (d.medical_record_number || '').toLowerCase().includes(q)
      );
    }
    if (filters?.dateFrom) docs = docs.filter(d => d.request_date >= filters.dateFrom!);
    if (filters?.dateTo) docs = docs.filter(d => d.request_date <= filters.dateTo!);
    return docs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  const auth = getStoredAuth();
  if (!auth) return [];

  const client = createSupabaseClient(auth.token);

  let query = client
    .from('transfusion_documents')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters?.search) {
    const q = `%${filters.search}%`;
    query = query.or(`patient_name.ilike.${q},medical_record_number.ilike.${q}`);
  }
  if (filters?.dateFrom) query = query.gte('request_date', filters.dateFrom);
  if (filters?.dateTo) query = query.lte('request_date', filters.dateTo);

  const { data, error } = await query;
  if (error) { console.error('Fetch transfusi documents error:', error); return []; }
  return (data || []) as TransfusiDocument[];
}

export async function fetchDocumentById(id: string): Promise<TransfusiDocument | null> {
  if (!isConnected()) {
    return loadLocalDocuments().find(d => d.id === id) || null;
  }
  const auth = getStoredAuth();
  if (!auth) return null;
  const client = createSupabaseClient(auth.token);
  const { data, error } = await client.from('transfusion_documents').select('*').eq('id', id).single();
  if (error) { console.error('Fetch transfusi document error:', error); return null; }
  return data as TransfusiDocument;
}

// ─── Upload to Drive (via Edge Function) ────────────────────────────────────

export async function uploadToDrive(
  pdfBase64: string,
  metadata: { patientName?: string; medicalRecordNumber?: string; notes?: string },
): Promise<UploadTransfusiResponse> {
  const auth = getStoredAuth();
  if (!auth) throw new Error('Not authenticated');

  const functionUrl = import.meta.env.VITE_EDGE_FUNCTION_URL
    || `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-transfusi`;

  if (!functionUrl) throw new Error('VITE_SUPABASE_URL or VITE_EDGE_FUNCTION_URL not configured');

  const res = await fetch(functionUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pdfBase64,
      patientName: metadata.patientName,
      medicalRecordNumber: metadata.medicalRecordNumber,
      notes: metadata.notes,
      sessionToken: auth.token,
    }),
  });

  const result: UploadTransfusiResponse = await res.json();
  if (!res.ok || !result.success) throw new Error(result.error || `HTTP ${res.status}`);

  // Save to local cache as fallback
  if (result.document_id) {
    const docs = loadLocalDocuments();
    const now = new Date().toISOString();
    docs.unshift({
      id: result.document_id,
      patient_name: metadata.patientName || null,
      medical_record_number: metadata.medicalRecordNumber || null,
      request_date: now.split('T')[0],
      notes: metadata.notes || null,
      drive_file_id: result.drive_file_id || null,
      drive_url: result.drive_url || null,
      uploaded_by: auth.id || null,
      created_at: now,
    });
    saveLocalDocuments(docs.slice(0, 500));
  }

  return result;
}

// ─── Delete Document ────────────────────────────────────────────────────────

export async function deleteDocument(id: string): Promise<void> {
  if (!isConnected()) {
    const docs = loadLocalDocuments();
    saveLocalDocuments(docs.filter(d => d.id !== id));
    return;
  }
  const auth = getStoredAuth();
  if (!auth) throw new Error('Not authenticated');
  const client = createSupabaseClient(auth.token);
  const { error } = await client.from('transfusion_documents').delete().eq('id', id);
  if (error) { console.error('Delete transfusi document error:', error); throw new Error(error.message); }
}
