import { useState, useMemo, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import {
  type KunjunganData,
  normalizeMonthKeys, sortMonths, BULAN_ORDER
} from '@/lib/kunjungan-types';
import { useKunjunganData } from '@/hooks/use-kunjungan-data';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import LaporanTab from '@/components/kunjungan/LaporanTab';
import InputHarianTab from '@/components/kunjungan/InputHarianTab';
import {
  OmzetTab,
  KunjunganTab,
  McuTab,
  ConnectionStatusBadge,
} from '@/features/kunjungan/components';

type TabType = 'omzet' | 'kunjungan' | 'mcu' | 'laporan' | 'input';

const CURRENT_MONTH_NAME = BULAN_ORDER[new Date().getMonth()];

export default function KunjunganDashboard() {
  const { data, status, lastUpdated, error, refresh, availableMonths } = useKunjunganData();
  const [tab, setTab] = useState<TabType>('omzet');
  const [refreshing, setRefreshing] = useState(false);
  const [month, setMonth] = useState(CURRENT_MONTH_NAME);
  const [mcuMonth, setMcuMonth] = useState(CURRENT_MONTH_NAME);

  const activeMonthsList = useMemo(() => {
    const months = availableMonths(tab === 'mcu' ? 'mcu' : tab === 'kunjungan' ? 'kunjungan' : 'omzet');
    if (!months.includes(CURRENT_MONTH_NAME)) {
      return sortMonths([...months, CURRENT_MONTH_NAME]);
    }
    return months;
  }, [tab, availableMonths]);

  const activeMonth = tab === 'mcu' ? mcuMonth : month;
  const setActiveMonth = (m: string) => {
    if (tab === 'mcu') setMcuMonth(m);
    else setMonth(m);
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
    toast.success('Data di-refresh');
  }, [refresh]);

  const { canAccess } = useAuth();

  const tabs: { key: TabType; label: string; emoji: string }[] = [
    { key: 'omzet', label: 'Omzet', emoji: '💰' },
    { key: 'kunjungan', label: 'Kunjungan', emoji: '👥' },
    { key: 'mcu', label: 'Omzet MCU', emoji: '🔬' },
    { key: 'laporan', label: 'Laporan', emoji: '📋' },
    ...(canAccess('input-harian') ? [{ key: 'input' as TabType, label: 'Input Harian', emoji: '✏️' }] : []),
  ];

  return (
    <div className="space-y-0">
      <div className="flex items-center justify-between gap-2 pb-2">
        <div className="flex items-center gap-2">
          <ConnectionStatusBadge
            status={status}
            lastUpdated={lastUpdated}
            onRefresh={handleRefresh}
            refreshing={refreshing}
          />
          {lastUpdated && (
            <span className="text-[9px] text-muted-foreground font-mono-data">
              {new Date(lastUpdated).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {error && <span className="text-[9px] text-destructive">{error}</span>}
        </div>
      </div>

      <div className="bg-card border-b border-border -mx-4 px-4 flex items-center gap-1 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t.key
                ? 'border-accent text-accent font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.emoji} {t.label}
          </button>
        ))}

        {tab !== 'laporan' && tab !== 'input' && activeMonthsList.length > 0 && (
          <select
            value={activeMonth}
            onChange={e => setActiveMonth(e.target.value)}
            className="ml-auto text-xs bg-card border border-border rounded-lg px-3 py-1.5 font-medium text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent"
          >
            {activeMonthsList.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        )}
      </div>

      <div className="pt-4">
        {tab === 'laporan' && <LaporanTab />}
        {tab === 'input' && <InputHarianTab />}
        {tab !== 'laporan' && tab !== 'input' && (
          status === 'loading' ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground">
              <RefreshCw className="w-8 h-8 animate-spin text-accent" />
              <p className="text-sm font-medium">Memuat data...</p>
            </div>
          ) : (
            <>
              {tab === 'omzet' && <OmzetTab month={activeMonth} data={data.omzet[activeMonth] || []} />}
              {tab === 'kunjungan' && <KunjunganTab month={activeMonth} data={data.kunjungan[activeMonth] || []} />}
              {tab === 'mcu' && <McuTab month={activeMonth} data={data.mcu[activeMonth] || []} />}
            </>
          )
        )}
      </div>
    </div>
  );
}
