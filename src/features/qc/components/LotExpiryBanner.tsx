import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { XCircle, AlertTriangle, ChevronDown, ChevronUp, ArrowRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { INSTRUMENT_LABELS } from '@/features/qc/lib/constants';
import { formatExpiryMessage, type LotExpiryInfo } from '@/lib/lot-expiry';

interface LotExpiryBannerProps {
  expiredLots: LotExpiryInfo[];
  expiringSoonLots: LotExpiryInfo[];
  onDismiss: () => void;
}

export function LotExpiryBanner({ expiredLots, expiringSoonLots, onDismiss }: LotExpiryBannerProps) {
  const [expanded, setExpanded] = useState(true);
  const navigate = useNavigate();

  const hasExpired = expiredLots.length > 0;
  const totalProblematic = expiredLots.length + expiringSoonLots.length;

  if (totalProblematic === 0) return null;

  const isRed = hasExpired;
  const allLots = [...expiredLots, ...expiringSoonLots];

  return (
    <div
      className={cn(
        'rounded-lg border-2 overflow-hidden',
        'animate-in slide-in-from-top-2 duration-300',
        isRed
          ? 'border-destructive/60 bg-destructive/5'
          : 'border-warning/60 bg-warning/5',
      )}
      role="alert"
      aria-live="polite"
    >
      {/* Header row */}
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="mt-0.5 shrink-0">
          {isRed ? (
            <XCircle size={18} className="text-destructive" />
          ) : (
            <AlertTriangle size={18} className="text-warning" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className={cn('text-sm font-semibold', isRed ? 'text-destructive' : 'text-warning')}>
            {hasExpired
              ? `${expiredLots.length} Lot Kontrol Expired`
              : `${expiringSoonLots.length} Lot Kontrol Akan Expired`}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {hasExpired && expiringSoonLots.length > 0
              ? `+${expiringSoonLots.length} lot lainnya akan expired dalam 7 hari`
              : hasExpired
                ? 'Segera update lot di halaman Konfigurasi'
                : 'Siapkan lot baru dalam 7 hari ke depan'}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1 rounded hover:bg-black/5 transition-colors text-muted-foreground"
            aria-label={expanded ? 'Sembunyikan detail' : 'Tampilkan detail'}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button
            onClick={onDismiss}
            className="p-1 rounded hover:bg-black/5 transition-colors text-muted-foreground"
            aria-label="Tutup notifikasi"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Expandable detail */}
      {expanded && (
        <div className="px-4 pb-3 space-y-1.5 animate-in slide-in-from-top-1 duration-200">
          {/* Divider */}
          <div className={cn('h-px mb-2', isRed ? 'bg-destructive/20' : 'bg-warning/20')} />

          {allLots.map((lot) => {
            const isExpired = lot.status === 'expired';
            return (
              <div
                key={`${lot.instrument}-${lot.lotNumber}`}
                className="flex items-center justify-between bg-background/70 rounded-md px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-semibold truncate">{lot.lotNumber}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {INSTRUMENT_LABELS[lot.instrument]}
                  </span>
                </div>
                <span
                  className={cn(
                    'text-[11px] font-medium shrink-0 ml-2',
                    isExpired ? 'text-destructive' : 'text-warning',
                  )}
                >
                  {formatExpiryMessage(lot.daysRemaining)}
                </span>
              </div>
            );
          })}

          <Button
            variant="outline"
            size="sm"
            className={cn(
              'w-full mt-2 h-8 text-xs gap-1.5',
              isRed
                ? 'border-destructive/40 text-destructive hover:bg-destructive/10'
                : 'border-warning/40 text-warning hover:bg-warning/10',
            )}
            onClick={() => navigate('/qc/config')}
          >
            Update Lot Config
            <ArrowRight size={13} />
          </Button>
        </div>
      )}
    </div>
  );
}
