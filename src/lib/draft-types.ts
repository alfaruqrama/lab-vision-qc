import type { KunjunganInputRow, McuInputRow } from '@/components/kunjungan/InputHarianTab';

export interface InputDraft {
  id: string;
  tanggal: string;
  kunjungan: KunjunganInputRow[];
  mcu: McuInputRow[];
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}
