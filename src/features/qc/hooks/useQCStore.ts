import { useQCConfig } from './useQCConfig';
import { useQCRecords } from './useQCRecords';

/**
 * Hook gabungan yang menyediakan config dan records untuk Input QC.
 * Menggabungkan useQCConfig dan useQCRecords untuk kemudahan penggunaan.
 */
export function useQCStore() {
  const configResult = useQCConfig();
  const recordsResult = useQCRecords();

  return {
    config: configResult.config,
    connected: configResult.connected,
    records: recordsResult.records,
    addRecord: recordsResult.addRecord,
    updateRecord: recordsResult.updateRecord,
    deleteRecord: recordsResult.deleteRecord,
    refreshRecords: recordsResult.refreshRecords,
  };
}
