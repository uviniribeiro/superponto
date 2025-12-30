import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/layout/AppLayout";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import TimeClock from "@/pages/TimeClock";
import MyRecords from "@/pages/MyRecords";
import Employees from "@/pages/Employees";
import Schedules from "@/pages/Schedules";
import Adjustments from "@/pages/Adjustments";
import Reports from "@/pages/Reports";
import Company from "@/pages/Company";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/auth" element={<Auth />} />
            
            <Route path="/" element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }>
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="time-clock" element={<TimeClock />} />
              <Route path="my-records" element={<MyRecords />} />
              <Route path="employees" element={
                <ProtectedRoute requiredRoles={['admin', 'manager']}>
                  <Employees />
                </ProtectedRoute>
              } />
              <Route path="schedules" element={
                <ProtectedRoute requiredRoles={['admin']}>
                  <Schedules />
                </ProtectedRoute>
              } />
              <Route path="adjustments" element={
                <ProtectedRoute requiredRoles={['admin', 'manager']}>
                  <Adjustments />
                </ProtectedRoute>
              } />
              <Route path="reports" element={
                <ProtectedRoute requiredRoles={['admin', 'manager']}>
                  <Reports />
                </ProtectedRoute>
              } />
              <Route path="company" element={
                <ProtectedRoute requiredRoles={['admin']}>
                  <Company />
                </ProtectedRoute>
              } />
            </Route>
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;