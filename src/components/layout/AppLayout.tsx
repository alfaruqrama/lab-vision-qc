import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, LineChart, FileText, Settings, Plus } from 'lucide-react';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/chart', label: 'L-J Chart', icon: LineChart },
  { path: '/report', label: 'Laporan', icon: FileText },
  { path: '/config', label: 'Konfigurasi', icon: Settings },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-[220px] flex-col bg-navy z-40">
        <div className="p-5 border-b border-sidebar-border">
          <h1 className="text-lg font-bold text-navy-foreground">LabQC</h1>
          <p className="text-xs text-navy-foreground/60 mt-0.5">RS Petrokimia Gresik</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
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
            onClick={() => navigate('/input')}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-md text-sm font-semibold transition-colors bg-primary text-primary-foreground hover:bg-primary/90`}
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

          {/* Center FAB */}
          <button
            onClick={() => navigate('/input')}
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
