import PortalNavbar from './PortalNavbar';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <PortalNavbar />
      <main className="max-w-5xl mx-auto px-4 py-6 page-transition">
        {children}
      </main>
    </div>
  );
}
