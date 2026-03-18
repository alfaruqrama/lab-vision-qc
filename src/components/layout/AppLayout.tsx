import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, LineChart, FileText, Settings, Plus, ChevronLeft, FlaskConical, Sun, Moon } from 'lucide-react';
import { useTheme } from '@/hooks/use-theme';
import { useQCStore } from '@/hooks/use-qc-store';

const navItems = [
  { path: '/qc', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/qc/chart', label: 'L-J Chart', icon: LineChart },
  { path: '/qc/report', label: 'Laporan', icon: FileText },
  { path: '/qc/config', label: 'Konfigurasi', icon: Settings },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const { connected } = useQCStore();

  return (
    <div className="min-h-screen bg-background">
      {/* Top navbar */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border">
        <div className="max-w-[860px] mx-auto flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/')}
              className="p-1.5 -ml-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
              <FlaskConical size={14} className="text-accent-foreground" />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight">Lab QC</p>
              <p className="text-[10px] text-muted-foreground leading-tight">RS Petrokimia Gresik</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
              <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-success animate-pulse-dot' : 'bg-muted-foreground/40'}`} />
              {connected ? 'LIVE' : 'OFFLINE'}
            </div>
            <button onClick={toggle} className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
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
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? 'bg-sidebar-accent text-sidebar-primary'
                    : 'text-navy-foreground/70 hover:bg-sidebar-accent/50 hover:text-navy-foreground'
                }`}
              >
                <item.icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="p-3">
          <button
            onClick={() => navigate('/qc/input')}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-md text-sm font-semibold transition-colors bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus size={18} />
            Input QC
          </button>
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
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 text-[10px] font-medium transition-colors ${
                  active ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <item.icon size={20} />
                {item.label}
              </button>
            );
          })}

          <button
            onClick={() => navigate('/qc/input')}
            className="nav-fab -mt-5 w-14 h-14 flex items-center justify-center"
          >
            <Plus size={26} />
          </button>

          {navItems.slice(2).map((item) => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 text-[10px] font-medium transition-colors ${
                  active ? 'text-primary' : 'text-muted-foreground'
                }`}
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
