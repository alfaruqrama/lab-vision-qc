import { Droplets, FileText, PlusCircle, Construction } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import PortalNavbar from './PortalNavbar';
import { TransfusiProvider, useTransfusiStore } from '@/hooks/use-transfusi-store';

const navItems = [
  { path: '/transfusi', label: 'Dashboard', icon: FileText },
  { path: '/transfusi/input', label: 'Input Baru', icon: PlusCircle },
];

function TransfusiNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { connected, documents } = useTransfusiStore();

  const todayCount = documents.filter(
    (d) => d.upload_date === new Date().toISOString().split('T')[0],
  ).length;

  return (
    <div className="bg-card border-b border-border sticky top-14 z-40">
      <div className="max-w-5xl mx-auto flex items-center gap-1 px-2 overflow-x-auto scrollbar-none">
        {navItems.map((item) => {
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
              {item.path === '/transfusi' && todayCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">
                  {todayCount > 9 ? '9+' : todayCount}
                </span>
              )}
            </button>
          );
        })}
        {/* Connection status */}
        {connected ? (
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full border text-green-600 bg-green-50 border-green-200">
            Live
          </span>
        ) : (
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full border text-gray-500 bg-gray-50 border-gray-200">
            Offline
          </span>
        )}
      </div>
    </div>
  );
}

export default function TransfusiLayout({ children }: { children: React.ReactNode }) {
  return (
    <TransfusiProvider>
      <div className="min-h-screen bg-background">
        <PortalNavbar />
        <TransfusiNav />
        <main className="max-w-5xl mx-auto px-4 py-6 page-transition">
          {/* WIP Banner */}
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 mb-6">
            <Construction size={14} className="text-amber-600 shrink-0" />
            <span className="text-xs font-semibold text-amber-700 tracking-wide">WIP — DALAM PENGEMBANGAN</span>
            <span className="text-[10px] text-amber-600 ml-auto">Modul Transfusi Darah — Fitur bertambah secara bertahap</span>
          </div>
          {children}
        </main>
      </div>
    </TransfusiProvider>
  );
}
