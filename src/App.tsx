import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QCProvider } from "@/hooks/use-qc-store";
import AppLayout from "@/components/layout/AppLayout";
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
      <QCProvider>
        <BrowserRouter>
          <AppLayout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/input" element={<InputQC />} />
              <Route path="/chart" element={<LeveyJennings />} />
              <Route path="/report" element={<MonthlyReport />} />
              <Route path="/config" element={<LotConfig />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppLayout>
        </BrowserRouter>
      </QCProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
