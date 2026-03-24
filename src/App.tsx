import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QCProvider } from "@/hooks/use-qc-store";
import { ThemeProvider } from "@/hooks/use-theme";
import PortalLayout from "@/components/layout/PortalLayout";
import AppLayout from "@/components/layout/AppLayout";
import PortalHome from "@/pages/PortalHome";
import KunjunganDashboard from "@/pages/KunjunganDashboard";
import SuhuPlaceholder from "@/pages/SuhuPlaceholder";
import Dashboard from "@/pages/Dashboard";
import InputQC from "@/pages/InputQC";
import LeveyJennings from "@/pages/LeveyJennings";
import MonthlyReport from "@/pages/MonthlyReport";
import LotConfig from "@/pages/LotConfig";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner position="top-center" />
      <ThemeProvider>
        <QCProvider>
          <BrowserRouter>
            <Routes>
              {/* Portal pages with top navbar */}
              <Route path="/" element={<PortalLayout><PortalHome /></PortalLayout>} />
              <Route path="/kunjungan" element={<PortalLayout><KunjunganDashboard /></PortalLayout>} />
              <Route path="/suhu" element={<PortalLayout><SuhuPlaceholder /></PortalLayout>} />

              {/* QC module with sidebar/bottom nav */}
              <Route path="/qc" element={<AppLayout><Dashboard /></AppLayout>} />
              <Route path="/qc/input" element={<AppLayout><InputQC /></AppLayout>} />
              <Route path="/qc/chart" element={<AppLayout><LeveyJennings /></AppLayout>} />
              <Route path="/qc/report" element={<AppLayout><MonthlyReport /></AppLayout>} />
              <Route path="/qc/config" element={<AppLayout><LotConfig /></AppLayout>} />

              <Route path="*" element={<PortalLayout><NotFound /></PortalLayout>} />
            </Routes>
          </BrowserRouter>
        </QCProvider>
      </ThemeProvider>
      <Analytics />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
