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
import RegisterEmployee from "@/pages/RegisterEmployee";
import Schedules from "@/pages/Schedules";
import Adjustments from "@/pages/Adjustments";
import Reports from "@/pages/Reports";
import Company from "@/pages/Company";
import Holidays from "@/pages/Holidays";
import TimeBank from "@/pages/TimeBank";
import Absences from "@/pages/Absences";
import Users from "@/pages/Users";
import OvertimeDashboard from "@/pages/OvertimeDashboard";
import PositionsDepartments from "@/pages/PositionsDepartments";
import SuperAdmin from "@/pages/SuperAdmin";
import SuperAdminAuth from "@/pages/SuperAdminAuth";
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
            <Route path="/super-admin-auth" element={<SuperAdminAuth />} />
            
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
              <Route path="employees/register" element={
                <ProtectedRoute requiredRoles={['admin']}>
                  <RegisterEmployee />
                </ProtectedRoute>
              } />
              <Route path="positions-departments" element={
                <ProtectedRoute requiredRoles={['admin']}>
                  <PositionsDepartments />
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
              <Route path="holidays" element={
                <ProtectedRoute requiredRoles={['admin']}>
                  <Holidays />
                </ProtectedRoute>
              } />
              <Route path="time-bank" element={<TimeBank />} />
              <Route path="absences" element={
                <ProtectedRoute requiredRoles={['admin', 'manager']}>
                  <Absences />
                </ProtectedRoute>
              } />
              <Route path="users" element={
                <ProtectedRoute requiredRoles={['admin']}>
                  <Users />
                </ProtectedRoute>
              } />
              <Route path="overtime-dashboard" element={
                <ProtectedRoute requiredRoles={['admin', 'manager']}>
                  <OvertimeDashboard />
                </ProtectedRoute>
              } />
              <Route path="super-admin" element={
                <ProtectedRoute requiredRoles={['super_admin']}>
                  <SuperAdmin />
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