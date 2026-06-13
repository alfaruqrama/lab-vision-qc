import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ClipboardCheck, CalendarCheck, History, Calendar, Plus, ChevronLeft, Wrench, Sun, Moon, ShieldCheck, FileText } from 'lucide-react';
import { useTheme } from '@/hooks/use-theme';
import { useMaintenanceStore } from '@/hooks/use-maintenance-store';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/maintenance', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/maintenance/harian', label: 'Checklist Harian', icon: ClipboardCheck },
  { path: '/maintenance/berkala', label: 'Checklist Berkala', icon: CalendarCheck },
  { path: '/maintenance/uji-fungsi', label: 'Uji Fungsi', icon: ShieldCheck },
  { path: '/maintenance/laporan', label: 'Laporan', icon: FileText },
  { path: '/maintenance/history', label: 'Riwayat', icon: History },
];

export default function MaintenanceLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const { connected } = useMaintenanceStore();

  return (
    <div className="min-h-screen bg-background">
      {/* Top navbar */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border">
        <div className="max-w-[860px] mx-auto flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
              className="h-8 w-8 -ml-1 text-muted-foreground"
            >
              <ChevronLeft size={20} />
            </Button>
            <div className="w-7 h-7 rounded-lg bg-amber-600 flex items-center justify-center">
              <Wrench size={14} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight">Maintenance</p>
              <p className="text-[10px] text-muted-foreground leading-tight">Alat Laboratorium</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
              <span
                className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  connected ? 'bg-success animate-pulse-dot' : 'bg-muted-foreground/40',
                )}
              />
              {connected ? 'LIVE' : 'OFFLINE'}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              className="h-8 w-8 text-muted-foreground"
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </Button>
          </div>
        </div>
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed left-0 top-14 bottom-0 w-[220px] flex-col bg-navy z-40">
        <nav className="flex-1 p-3 space-y-1 pt-4">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
                  active
                    ? 'bg-sidebar-accent text-sidebar-primary'
                    : 'text-navy-foreground/70 hover:bg-sidebar-accent/50 hover:text-navy-foreground',
                )}
              >
                <item.icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="p-3">
          <Button onClick={() => navigate('/maintenance/harian')} className="w-full gap-2 h-11">
            <Plus size={18} />
            Input Checklist
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="md:ml-[220px] pb-20 md:pb-6">
        <div className="max-w-[860px] mx-auto px-4 py-4 md:py-6 page-transition">
          {children}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40 safe-area-bottom">
        <div className="flex items-end justify-around px-2 pt-1 pb-2">
          {navItems.slice(0, 2).map((item) => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-3 py-1.5 text-[10px] font-medium transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <item.icon size={20} />
                {item.label}
              </button>
            );
          })}

          <button
            onClick={() => navigate('/maintenance/harian')}
            className="nav-fab -mt-5 w-14 h-14 flex items-center justify-center"
            aria-label="Input Checklist"
          >
            <Plus size={26} />
          </button>

          {navItems.slice(2).map((item) => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-3 py-1.5 text-[10px] font-medium transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <item.icon size={20} />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
