import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QCProvider } from "@/hooks/use-qc-store";
import { MaintenanceProvider } from "@/hooks/use-maintenance-store";
import { ThemeProvider } from "@/hooks/use-theme";
import { AuthProvider } from "@/hooks/use-auth";
import PortalLayout from "@/components/layout/PortalLayout";
import AppLayout from "@/components/layout/AppLayout";
import MaintenanceLayout from "@/components/layout/MaintenanceLayout";
import ProtectedRoute from "@/components/layout/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import PortalHome from "@/pages/PortalHome";
import KunjunganDashboard from "@/pages/KunjunganDashboard";
import MonitorSuhu from "@/pages/MonitorSuhu";
import { SuhuProvider } from "@/hooks/use-suhu-store";
import B3Layout from "@/components/layout/B3Layout";
import B3Dashboard from "@/pages/b3/B3Dashboard";
import B3Inventory from "@/pages/b3/B3Inventory";
import B3Pemakaian from "@/pages/b3/B3Pemakaian";
import B3Limbah from "@/pages/b3/B3Limbah";
import B3Report from "@/pages/b3/B3Report";
import Dashboard from "@/pages/Dashboard";
import InputQC from "@/pages/InputQC/index";
import LeveyJennings from "@/pages/LeveyJennings";
import MonthlyReport from "@/pages/MonthlyReport";
import LotConfig from "@/pages/LotConfig";
import NotFound from "@/pages/NotFound";
import LoginPage from "@/pages/LoginPage";
import AdminUserPanel from "@/pages/AdminUserPanel";
import TCMForm from "@/pages/TCMForm";
import MaintenanceDashboard from "@/pages/MaintenanceDashboard";
import MaintenanceChecklistHarian from "@/pages/MaintenanceChecklistHarian";
import MaintenanceChecklistBerkala from "@/pages/MaintenanceChecklistBerkala";
import MaintenanceHistory from "@/pages/MaintenanceHistory";
import MaintenanceSchedule from "@/pages/MaintenanceSchedule";
import MaintenanceUjiFungsi from "@/pages/MaintenanceUjiFungsi";
import MaintenanceLaporan from "@/pages/MaintenanceLaporan";

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
                
                {/* TCM Form - public access, no auth required */}
                <Route path="/tcm" element={<TCMForm />} />

                {/* Protected routes - Portal pages with top navbar */}
                <Route path="/" element={<ProtectedRoute><PortalLayout><PortalHome /></PortalLayout></ProtectedRoute>} />
                <Route path="/kunjungan" element={<ProtectedRoute><PortalLayout><ErrorBoundary><KunjunganDashboard /></ErrorBoundary></PortalLayout></ProtectedRoute>} />
                <Route path="/suhu" element={<ProtectedRoute><PortalLayout><SuhuProvider><MonitorSuhu /></SuhuProvider></PortalLayout></ProtectedRoute>} />

                {/* Protected routes - B3 module (admin only) */}
                <Route path="/b3" element={<ProtectedRoute allowedRoles={['admin']}><B3Layout><B3Dashboard /></B3Layout></ProtectedRoute>} />
                <Route path="/b3/inventory" element={<ProtectedRoute allowedRoles={['admin']}><B3Layout><B3Inventory /></B3Layout></ProtectedRoute>} />
                <Route path="/b3/pemakaian" element={<ProtectedRoute allowedRoles={['admin']}><B3Layout><B3Pemakaian /></B3Layout></ProtectedRoute>} />
                <Route path="/b3/limbah" element={<ProtectedRoute allowedRoles={['admin']}><B3Layout><B3Limbah /></B3Layout></ProtectedRoute>} />
                <Route path="/b3/report" element={<ProtectedRoute allowedRoles={['admin']}><B3Layout><B3Report /></B3Layout></ProtectedRoute>} />

                {/* Protected routes - QC module with sidebar/bottom nav */}
                <Route path="/qc" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
                <Route path="/qc/input" element={<ProtectedRoute allowedRoles={['admin', 'petugas']}><AppLayout><InputQC /></AppLayout></ProtectedRoute>} />
                <Route path="/qc/chart" element={<ProtectedRoute><AppLayout><LeveyJennings /></AppLayout></ProtectedRoute>} />
                <Route path="/qc/report" element={<ProtectedRoute><AppLayout><MonthlyReport /></AppLayout></ProtectedRoute>} />
                <Route path="/qc/config" element={<ProtectedRoute allowedRoles={['admin', 'petugas']}><AppLayout><LotConfig /></AppLayout></ProtectedRoute>} />

                {/* Admin only routes */}
                <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['admin']}><PortalLayout><AdminUserPanel /></PortalLayout></ProtectedRoute>} />

                {/* Maintenance module with sidebar/bottom nav */}
                <Route path="/maintenance" element={<ProtectedRoute><MaintenanceProvider><MaintenanceLayout><MaintenanceDashboard /></MaintenanceLayout></MaintenanceProvider></ProtectedRoute>} />
                <Route path="/maintenance/harian" element={<ProtectedRoute allowedRoles={['admin', 'petugas']}><MaintenanceProvider><MaintenanceLayout><MaintenanceChecklistHarian /></MaintenanceLayout></MaintenanceProvider></ProtectedRoute>} />
                <Route path="/maintenance/berkala" element={<ProtectedRoute allowedRoles={['admin', 'petugas']}><MaintenanceProvider><MaintenanceLayout><MaintenanceChecklistBerkala /></MaintenanceLayout></MaintenanceProvider></ProtectedRoute>} />
                <Route path="/maintenance/history" element={<ProtectedRoute><MaintenanceProvider><MaintenanceLayout><MaintenanceHistory /></MaintenanceLayout></MaintenanceProvider></ProtectedRoute>} />
                <Route path="/maintenance/schedule" element={<ProtectedRoute><MaintenanceProvider><MaintenanceLayout><MaintenanceSchedule /></MaintenanceLayout></MaintenanceProvider></ProtectedRoute>} />
                <Route path="/maintenance/uji-fungsi" element={<ProtectedRoute allowedRoles={['admin', 'petugas']}><MaintenanceProvider><MaintenanceLayout><MaintenanceUjiFungsi /></MaintenanceLayout></MaintenanceProvider></ProtectedRoute>} />
                <Route path="/maintenance/laporan" element={<ProtectedRoute><MaintenanceProvider><MaintenanceLayout><MaintenanceLaporan /></MaintenanceLayout></MaintenanceProvider></ProtectedRoute>} />

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
