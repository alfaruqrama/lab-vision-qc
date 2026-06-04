import { useNavigate, useLocation } from 'react-router-dom';
import { Package, ClipboardList, Beaker, FileText, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';
import PortalNavbar from './PortalNavbar';
import { B3Provider, useB3Store } from '@/hooks/use-b3-store';

const b3NavItems = [
  { path: '/b3', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/b3/inventory', label: 'Inventaris', icon: Package },
  { path: '/b3/pemakaian', label: 'Pemakaian', icon: ClipboardList },
  { path: '/b3/limbah', label: 'Limbah B3', icon: Beaker },
  { path: '/b3/report', label: 'Laporan', icon: FileText },
];

function B3Nav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { dashboard, connected, status } = useB3Store();

  const alertCount = (dashboard?.low_stock_count || 0) + (dashboard?.expired_count || 0);

  return (
    <div className="bg-card border-b border-border sticky top-14 z-40">
      <div className="max-w-5xl mx-auto flex items-center gap-1 px-2 overflow-x-auto scrollbar-none">
        {b3NavItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'flex items-center gap-2 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors relative',
                active
                  ? 'border-accent text-accent'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <item.icon size={16} />
              {item.label}
              {item.path === '/b3' && alertCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {alertCount > 9 ? '9+' : alertCount}
                </span>
              )}
            </button>
          );
        })}
        {/* Connection status */}
        {connected && (
          <span className={cn(
            'ml-auto text-[10px] px-2 py-0.5 rounded-full border',
            status === 'live' ? 'text-green-600 bg-green-50 border-green-200' :
            status === 'loading' ? 'text-amber-600 bg-amber-50 border-amber-200' :
            'text-red-600 bg-red-50 border-red-200',
          )}>
            {status === 'live' ? 'Live' : status === 'loading' ? 'Loading...' : 'Error'}
          </span>
        )}
        {!connected && (
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full border text-gray-500 bg-gray-50 border-gray-200">
            Offline
          </span>
        )}
      </div>
    </div>
  );
}

export default function B3Layout({ children }: { children: React.ReactNode }) {
  return (
    <B3Provider>
      <div className="min-h-screen bg-background">
        <PortalNavbar />
        <B3Nav />
        <main className="max-w-5xl mx-auto px-4 py-6 page-transition">
          {children}
        </main>
      </div>
    </B3Provider>
  );
}
