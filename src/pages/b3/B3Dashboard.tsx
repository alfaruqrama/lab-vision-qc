import { Package, AlertTriangle, Clock, Beaker, ArrowRight, ClipboardList, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useB3Store } from '@/hooks/use-b3-store';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { getExpiryStatus, EXPIRY_LABELS, EXPIRY_COLORS, parseHazardClasses, HAZARD_CONFIG } from '@/lib/b3-types';
import type { B3Material, B3Stock, B3Pemakaian, B3Limbah } from '@/lib/b3-types';

// ─── Stat Card ───
function StatCard({ label, value, sub, icon: Icon, color, onClick }: {
  label: string; value: string | number; sub?: string; icon: any; color: string; onClick?: () => void;
}) {
  return (
    <div
      className={cn('card-clinical p-4 relative overflow-hidden', onClick && 'cursor-pointer hover:shadow-md transition-shadow')}
      onClick={onClick}
    >
      <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl" style={{ background: color }} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground font-mono-data mb-1">{label}</p>
          <p className="text-2xl font-bold font-display" style={{ color }}>{value}</p>
          {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        <div className="p-2 rounded-lg" style={{ background: `${color}15` }}>
          <Icon size={20} style={{ color }} />
        </div>
      </div>
    </div>
  );
}

// ─── Alert Item ───
function AlertItem({ icon: Icon, title, desc, color, onClick }: {
  icon: any; title: string; desc: string; color: string; onClick?: () => void;
}) {
  return (
    <div className={cn(
      'flex items-start gap-3 p-3 rounded-lg border',
      onClick && 'cursor-pointer hover:shadow-sm transition-shadow',
    )}
      style={{ borderColor: `${color}40`, background: `${color}08` }}
      onClick={onClick}
    >
      <div className="p-1.5 rounded-full" style={{ background: `${color}20` }}>
        <Icon size={14} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{desc}</p>
      </div>
      {onClick && <ArrowRight size={14} className="text-muted-foreground flex-shrink-0 mt-0.5" />}
    </div>
  );
}

export default function B3Dashboard() {
  const navigate = useNavigate();
  const { dashboard, materials, stockEntries, pemakaianRecords, connected, status } = useB3Store();
  const { user } = useAuth();

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Beaker size={48} className="text-muted-foreground/30 mb-4" />
        <h2 className="text-lg font-semibold mb-2">Modul B3 Belum Dikonfigurasi</h2>
        <p className="text-sm text-muted-foreground max-w-md mb-4">
          Set <code className="px-1 bg-muted rounded text-xs">VITE_GAS_B3_URL</code> di file <code className="px-1 bg-muted rounded text-xs">.env.local</code> untuk mengaktifkan modul B3.
        </p>
        <p className="text-xs text-muted-foreground">
          Lihat panduan setup di file <code className="px-1 bg-muted rounded text-xs">scripts/b3-gas-backend.js</code>
        </p>
      </div>
    );
  }

  // ─── Compute alerts ───
  const lowStockItems: { mat: B3Material; stock: number }[] = [];
  materials.forEach(m => {
    const total = stockEntries
      .filter(s => s.material_id === m.id)
      .reduce((sum, s) => sum + s.current_qty, 0);
    if (total <= m.low_stock_threshold) {
      lowStockItems.push({ mat: m, stock: total });
    }
  });

  const expiringItems: B3Stock[] = stockEntries.filter(s => {
    const status = getExpiryStatus(s.expiry_date);
    return status === 'expired' || status === 'expiring-soon';
  });

  const canInput = user?.role === 'admin' || user?.role === 'petugas';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold font-display">Dashboard B3</h1>
          <p className="text-sm text-muted-foreground">Manajemen Bahan Berbahaya dan Beracun</p>
        </div>
        {status !== 'live' && (
          <span className={cn(
            'text-xs px-2 py-1 rounded-full border',
            status === 'loading' ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-red-600 bg-red-50 border-red-200',
          )}>
            {status === 'loading' ? 'Memuat...' : 'Error'}
          </span>
        )}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total Material"
          value={dashboard.total_materials}
          icon={Package}
          color="#2563eb"
          onClick={() => navigate('/b3/inventory')}
        />
        <StatCard
          label="Stok Menipis"
          value={dashboard.low_stock_count}
          sub={dashboard.low_stock_count > 0 ? 'Perlu restock' : 'Aman'}
          icon={AlertTriangle}
          color={dashboard.low_stock_count > 0 ? '#ea580c' : '#16a34a'}
          onClick={() => navigate('/b3/inventory')}
        />
        <StatCard
          label="Kadaluarsa / Akan Kadaluarsa"
          value={dashboard.expired_count + dashboard.expiring_soon_count}
          sub={dashboard.expired_count > 0 ? `${dashboard.expired_count} kadaluarsa` : `${dashboard.expiring_soon_count} < 30 hari`}
          icon={Clock}
          color={dashboard.expired_count > 0 ? '#dc2626' : '#d97706'}
          onClick={() => navigate('/b3/inventory')}
        />
        <StatCard
          label="Limbah Bulan Ini"
          value={`${dashboard.waste_month_total} unit`}
          sub={dashboard.waste_pending_count > 0 ? `${dashboard.waste_pending_count} pending disposal` : 'Semua tertangani'}
          icon={Beaker}
          color="#7c3aed"
          onClick={() => navigate('/b3/limbah')}
        />
      </div>

      {/* Alerts Section */}
      {(lowStockItems.length > 0 || expiringItems.length > 0) && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <AlertTriangle size={14} /> Peringatan
          </h2>
          <div className="grid md:grid-cols-2 gap-2">
            {lowStockItems.map(({ mat, stock }) => (
              <AlertItem
                key={mat.id}
                icon={AlertTriangle}
                title={`${mat.nama} — Stok Menipis`}
                desc={`Sisa ${stock} ${mat.satuan} (threshold: ${mat.low_stock_threshold} ${mat.satuan})`}
                color="#ea580c"
                onClick={() => navigate('/b3/inventory')}
              />
            ))}
            {expiringItems.slice(0, 5).map(item => (
              <AlertItem
                key={item.id}
                icon={Clock}
                title={`${item.material_nama || item.material_id} — ${EXPIRY_LABELS[getExpiryStatus(item.expiry_date)]}`}
                desc={`Batch ${item.batch_lot} · Exp: ${item.expiry_date || '?'}`}
                color={getExpiryStatus(item.expiry_date) === 'expired' ? '#dc2626' : '#d97706'}
                onClick={() => navigate('/b3/inventory')}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent Usage */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Pemakaian Terakhir
            </h2>
            <button
              onClick={() => navigate('/b3/pemakaian')}
              className="text-xs text-accent hover:underline"
            >
              Lihat semua →
            </button>
          </div>
          {pemakaianRecords.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground bg-muted/30 rounded-lg">
              Belum ada pemakaian tercatat
            </div>
          ) : (
            <div className="space-y-2">
              {pemakaianRecords.slice(0, 5).map((p: B3Pemakaian) => (
                <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{p.material_nama || p.material_id}</p>
                    <p className="text-xs text-muted-foreground">{p.tujuan}</p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className="font-mono text-xs">{p.qty} {p.satuan}</p>
                    <p className="text-[10px] text-muted-foreground">{p.tanggal} · {p.analis}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Waste */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Limbah Terakhir
            </h2>
            <button
              onClick={() => navigate('/b3/limbah')}
              className="text-xs text-accent hover:underline"
            >
              Lihat semua →
            </button>
          </div>
          {limbahRecords.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground bg-muted/30 rounded-lg">
              Belum ada limbah tercatat
            </div>
          ) : (
            <div className="space-y-2">
              {limbahRecords.slice(0, 5).map((l: B3Limbah) => (
                <div key={l.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{l.material_nama || l.sumber || 'Limbah B3'}</p>
                    <p className="text-xs text-muted-foreground">{l.waste_type} · {l.disposal_method}</p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className="font-mono text-xs">{l.qty} {l.satuan}</p>
                    <p className="text-[10px] text-muted-foreground">{l.tanggal_generasi}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      {canInput && (
        <div className="border-t pt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Aksi Cepat
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Input Pemakaian', icon: ClipboardList, path: '/b3/pemakaian', color: '#2563eb' },
              { label: 'Catat Limbah', icon: Beaker, path: '/b3/limbah', color: '#7c3aed' },
              { label: 'Lihat Laporan', icon: FileText, path: '/b3/report', color: '#16a34a' },
            ].map(a => (
              <button
                key={a.path}
                onClick={() => navigate(a.path)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:bg-muted/50 transition-colors text-center"
              >
                <div className="p-2 rounded-full" style={{ background: `${a.color}15` }}>
                  <a.icon size={20} style={{ color: a.color }} />
                </div>
                <span className="text-xs font-medium">{a.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

