import { useNavigate, useLocation } from 'react-router-dom';
import { FlaskConical, Sun, Moon, ChevronLeft } from 'lucide-react';
import { useTheme } from '@/hooks/use-theme';
import { useQCStore } from '@/hooks/use-qc-store';

export default function PortalNavbar() {
  const { theme, toggle } = useTheme();
  const { connected } = useQCStore();
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b border-border">
      <div className="max-w-5xl mx-auto flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-3">
          {!isHome && (
            <button
              onClick={() => navigate('/')}
              className="p-1.5 -ml-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
            >
              <ChevronLeft size={20} />
            </button>
          )}
          <button onClick={() => navigate('/')} className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <FlaskConical size={16} className="text-accent-foreground" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold leading-tight">Portal Lab Internal</p>
              <p className="text-[10px] text-muted-foreground leading-tight">RS Petrokimia Gresik</p>
            </div>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-success animate-pulse-dot' : 'bg-muted-foreground/40'}`} />
            {connected ? 'LIVE' : 'OFFLINE'}
          </div>
          <button
            onClick={toggle}
            className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
        </div>
      </div>
    </header>
  );
}
