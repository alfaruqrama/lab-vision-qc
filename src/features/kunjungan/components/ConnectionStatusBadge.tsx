import { RefreshCw } from 'lucide-react';
import { type ConnectionStatus } from '@/hooks/use-kunjungan-data';

export function ConnectionStatusBadge({ status, lastUpdated, onRefresh, refreshing }: {
  status: ConnectionStatus;
  lastUpdated: string | null;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const isLive = status === 'live';
  const isLoading = status === 'loading' || refreshing;
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onRefresh}
        disabled={isLoading}
        className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
        title="Refresh data"
      >
        <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${isLoading ? 'animate-spin' : ''}`} />
      </button>
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
        isLive ? 'bg-success/10 text-success border-success/20' :
        status === 'error' ? 'bg-destructive/10 text-destructive border-destructive/20' :
        'bg-muted text-muted-foreground border-border'
      }`}>
        <span className={`w-1.5 h-1.5 rounded-full ${
          isLive ? 'bg-success animate-pulse' :
          status === 'error' ? 'bg-destructive' : 'bg-muted-foreground'
        }`} />
        {isLive ? 'REALTIME' : status === 'error' ? 'ERROR' : status === 'loading' ? 'LOADING...' : 'EMBEDDED'}
      </span>
    </div>
  );
}
