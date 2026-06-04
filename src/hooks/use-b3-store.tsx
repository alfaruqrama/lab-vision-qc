import { createContext, useContext, type ReactNode } from 'react';
import { useB3Data } from './use-b3-data';

type B3Store = ReturnType<typeof useB3Data>;

const B3Context = createContext<B3Store | null>(null);

export function B3Provider({ children }: { children: ReactNode }) {
  const store = useB3Data();
  return <B3Context.Provider value={store}>{children}</B3Context.Provider>;
}

export function useB3Store() {
  const ctx = useContext(B3Context);
  if (!ctx) throw new Error('useB3Store must be used within B3Provider');
  return ctx;
}
