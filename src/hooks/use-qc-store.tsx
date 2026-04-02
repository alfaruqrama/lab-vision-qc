import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { LotConfig, QCRecord } from '@/lib/types';
import { DEFAULT_LOT_CONFIG, generateMockRecords } from '@/lib/mock-data';
import * as api from '@/lib/api';

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

export function QCProvider({ children }: { children: React.ReactNode }) {
  const [records, setRecords] = useState<QCRecord[]>([]);
  const [config, setConfig] = useState<LotConfig>(DEFAULT_LOT_CONFIG);
  const [loading, setLoading] = useState(true);
  const connected = api.isConnected();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (connected) {
        const [recs, cfg] = await Promise.all([api.fetchAllRecords(), api.fetchConfig()]);
        setRecords(recs);
        // Merge with defaults so new instruments (ONCALL) always have config
        setConfig({
          CA660: cfg.CA660 || DEFAULT_LOT_CONFIG.CA660,
          EASYLITE: cfg.EASYLITE || DEFAULT_LOT_CONFIG.EASYLITE,
          ONCALL: cfg.ONCALL || DEFAULT_LOT_CONFIG.ONCALL,
        });
      } else {
        const storedConfig = localStorage.getItem('labqc_config');
        const storedRecords = localStorage.getItem('labqc_records');
        setConfig(storedConfig ? JSON.parse(storedConfig) : DEFAULT_LOT_CONFIG);
        setRecords(storedRecords ? JSON.parse(storedRecords) : generateMockRecords());
      }
    } catch {
      setConfig(DEFAULT_LOT_CONFIG);
      setRecords(generateMockRecords());
    } finally {
      setLoading(false);
    }
  }, [connected]);

  useEffect(() => { loadData(); }, [loadData]);

  const addRecord = async (record: QCRecord) => {
    if (connected) {
      await api.saveRecord(record);
      await loadData();
    } else {
      const updated = [...records, record];
      setRecords(updated);
      localStorage.setItem('labqc_records', JSON.stringify(updated));
    }
  };

  const updateConfig = async (newConfig: LotConfig) => {
    if (connected) {
      await api.saveConfig(newConfig);
      await loadData();
    } else {
      setConfig(newConfig);
      localStorage.setItem('labqc_config', JSON.stringify(newConfig));
    }
  };

  return (
    <QCContext.Provider value={{ records, config, loading, connected, addRecord, updateConfig, refresh: loadData }}>
      {children}
    </QCContext.Provider>
  );
}

export function useQCStore(): QCStore {
  const ctx = useContext(QCContext);
  if (!ctx) throw new Error('useQCStore must be used within QCProvider');
  return ctx;
}
