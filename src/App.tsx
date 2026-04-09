import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QCProvider } from "@/hooks/use-qc-store";
import { ThemeProvider } from "@/hooks/use-theme";
import { AuthProvider } from "@/hooks/use-auth";
import PortalLayout from "@/components/layout/PortalLayout";
import AppLayout from "@/components/layout/AppLayout";
import ProtectedRoute from "@/components/layout/ProtectedRoute";
import PortalHome from "@/pages/PortalHome";
import KunjunganDashboard from "@/pages/KunjunganDashboard";
import MonitorSuhu from "@/pages/MonitorSuhu";
import { SuhuProvider } from "@/hooks/use-suhu-store";
import Dashboard from "@/pages/Dashboard";
import InputQC from "@/pages/InputQC";
import LeveyJennings from "@/pages/LeveyJennings";
import MonthlyReport from "@/pages/MonthlyReport";
import LotConfig from "@/pages/LotConfig";
import NotFound from "@/pages/NotFound";
import PinAccess from "@/pages/PinAccess";
import LoginPage from "@/pages/LoginPage";
import AdminUserPanel from "@/pages/AdminUserPanel";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner position="top-center" />
      <ThemeProvider>
        <AuthProvider>
          <QCProvider>
            <BrowserRouter>
              <Routes>
                {/* Login page - no auth required */}
                <Route path="/login" element={<LoginPage />} />

                {/* Halaman PIN — untuk akses dari luar jaringan RS */}
                <Route path="/pin" element={<PinAccess />} />

                {/* Protected routes - Portal pages with top navbar */}
                <Route path="/" element={<ProtectedRoute><PortalLayout><PortalHome /></PortalLayout></ProtectedRoute>} />
                <Route path="/kunjungan" element={<ProtectedRoute><PortalLayout><KunjunganDashboard /></PortalLayout></ProtectedRoute>} />
                <Route path="/suhu" element={<ProtectedRoute><PortalLayout><SuhuProvider><MonitorSuhu /></SuhuProvider></PortalLayout></ProtectedRoute>} />

                {/* Protected routes - QC module with sidebar/bottom nav */}
                <Route path="/qc" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
                <Route path="/qc/input" element={<ProtectedRoute allowedRoles={['admin', 'petugas']}><AppLayout><InputQC /></AppLayout></ProtectedRoute>} />
                <Route path="/qc/chart" element={<ProtectedRoute><AppLayout><LeveyJennings /></AppLayout></ProtectedRoute>} />
                <Route path="/qc/report" element={<ProtectedRoute><AppLayout><MonthlyReport /></AppLayout></ProtectedRoute>} />
                <Route path="/qc/config" element={<ProtectedRoute allowedRoles={['admin', 'petugas']}><AppLayout><LotConfig /></AppLayout></ProtectedRoute>} />

                {/* Admin only routes */}
                <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['admin']}><PortalLayout><AdminUserPanel /></PortalLayout></ProtectedRoute>} />

                <Route path="*" element={<ProtectedRoute><PortalLayout><NotFound /></PortalLayout></ProtectedRoute>} />
              </Routes>
            </BrowserRouter>
          </QCProvider>
        </AuthProvider>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
