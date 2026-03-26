import { useState, useCallback, createContext, useContext } from 'react';

export interface SuhuEntry {
  suhu: number;
  rh: number | null;
  timestamp: string;
  catatan: string;
}

export interface SuhuPayload {
  roomId: string;
  roomLabel: string;
  code: string;
  suhu: number;
  rh: number | null;
  timestamp: string;
  petugas: string;
  catatan: string;
}

interface SuhuStore {
  sessionData: Record<string, SuhuEntry>;
  sessionLog: SuhuPayload[];
  petugas: string;
  setPetugas: (name: string) => void;
  saveEntry: (roomId: string, entry: SuhuEntry, roomLabel: string, code: string) => void;
  clearSession: () => void;
}

const SuhuContext = createContext<SuhuStore | null>(null);

export function SuhuProvider({ children }: { children: React.ReactNode }) {
  const [sessionData, setSessionData] = useState<Record<string, SuhuEntry>>({});
  const [sessionLog, setSessionLog] = useState<SuhuPayload[]>([]);
  const [petugas, setPetugas] = useState('');

  const saveEntry = useCallback((roomId: string, entry: SuhuEntry, roomLabel: string, code: string) => {
    setSessionData(prev => ({ ...prev, [roomId]: entry }));
    setSessionLog(prev => [
      ...prev,
      { roomId, roomLabel, code, suhu: entry.suhu, rh: entry.rh, timestamp: entry.timestamp, petugas, catatan: entry.catatan },
    ]);
  }, [petugas]);

  const clearSession = useCallback(() => {
    setSessionData({});
    setSessionLog([]);
  }, []);

  return (
    <SuhuContext.Provider value={{ sessionData, sessionLog, petugas, setPetugas, saveEntry, clearSession }}>
      {children}
    </SuhuContext.Provider>
  );
}

export function useSuhuStore() {
  const ctx = useContext(SuhuContext);
  if (!ctx) throw new Error('useSuhuStore must be used within SuhuProvider');
  return ctx;
}
