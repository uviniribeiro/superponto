import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import SuperAdminProtectedRoute from "@/components/SuperAdminProtectedRoute";
import AppLayout from "@/components/layout/AppLayout";
import SuperAdminLayout from "@/components/layout/SuperAdminLayout";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Home from "@/pages/Home";
import TimeClock from "@/pages/TimeClock";
import MyRecords from "@/pages/MyRecords";
import Employees from "@/pages/Employees";
import RegisterEmployee from "@/pages/RegisterEmployee";
import WorkSchedules from "@/pages/WorkSchedules";
import Adjustments from "@/pages/Adjustments";
import Reports from "@/pages/Reports";
import MirrorPoint from "@/pages/MirrorPoint";
import Company from "@/pages/Company";
import Holidays from "@/pages/Holidays";
import TimeBank from "@/pages/TimeBank";
import Absences from "@/pages/Absences";
import Users from "@/pages/Users";
import OvertimeDashboard from "@/pages/OvertimeDashboard";
import PositionsDepartments from "@/pages/PositionsDepartments";
import SuperAdminAuth from "@/pages/SuperAdminAuth";
import SuperAdminDashboard from "@/pages/superadmin/Dashboard";
import SuperAdminCompanies from "@/pages/superadmin/Companies";
import SuperAdminCityHalls from "@/pages/superadmin/CityHalls";
import SuperAdminLicenses from "@/pages/superadmin/Licenses";
import SuperAdminUsers from "@/pages/superadmin/SuperAdminUsers";
import TeacherModule from "@/pages/TeacherModule";
import Timesheet from "@/pages/Timesheet";
import ImportExport from "@/pages/ImportExport";
import CategoryPage from "@/pages/CategoryPage";
import AccountSettings from "@/pages/AccountSettings";
import NotFound from "@/pages/NotFound";

// Equipment pages
import EquipmentList from "@/pages/equipment/EquipmentList";
import EquipmentAdd from "@/pages/equipment/EquipmentAdd";
import EquipmentEmployees from "@/pages/equipment/EquipmentEmployees";
import EquipmentPendingRecords from "@/pages/equipment/EquipmentPendingRecords";
import EquipmentLogs from "@/pages/equipment/EquipmentLogs";
import EquipmentStatus from "@/pages/equipment/EquipmentStatus";
import EquipmentSync from "@/pages/equipment/EquipmentSync";
import EquipmentHelp from "@/pages/equipment/EquipmentHelp";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Navigate to="/home" replace />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/super-admin-auth" element={<SuperAdminAuth />} />
              
              {/* Super Admin Routes - Completely Separate */}
              <Route path="/super-admin" element={
                <SuperAdminProtectedRoute>
                  <SuperAdminLayout />
                </SuperAdminProtectedRoute>
              }>
                <Route index element={<SuperAdminDashboard />} />
                <Route path="companies" element={<SuperAdminCompanies />} />
                <Route path="city-halls" element={<SuperAdminCityHalls />} />
                <Route path="licenses" element={<SuperAdminLicenses />} />
                <Route path="users" element={<SuperAdminUsers />} />
              </Route>
              
              {/* Regular App Routes */}
              <Route path="/" element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }>
                <Route path="home" element={<Home />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="time-clock" element={<TimeClock />} />
                <Route path="my-records" element={<MyRecords />} />
                <Route path="category/:categoryId" element={<CategoryPage />} />
                <Route path="employees" element={<ProtectedRoute requiredRoles={['admin', 'manager']}><Employees /></ProtectedRoute>} />
                <Route path="employees/register" element={<ProtectedRoute requiredRoles={['admin']}><RegisterEmployee /></ProtectedRoute>} />
                <Route path="positions-departments" element={<ProtectedRoute requiredRoles={['admin']}><PositionsDepartments /></ProtectedRoute>} />
                <Route path="schedules" element={<ProtectedRoute requiredRoles={['admin']}><WorkSchedules /></ProtectedRoute>} />
                <Route path="adjustments" element={<ProtectedRoute requiredRoles={['admin', 'manager']}><Adjustments /></ProtectedRoute>} />
                <Route path="reports" element={<ProtectedRoute requiredRoles={['admin', 'manager']}><Reports /></ProtectedRoute>} />
                <Route path="mirror-point" element={<ProtectedRoute requiredRoles={['admin', 'manager']}><MirrorPoint /></ProtectedRoute>} />
                <Route path="company" element={<ProtectedRoute requiredRoles={['admin']}><Company /></ProtectedRoute>} />
                <Route path="holidays" element={<ProtectedRoute requiredRoles={['admin']}><Holidays /></ProtectedRoute>} />
                <Route path="time-bank" element={<TimeBank />} />
                <Route path="absences" element={<ProtectedRoute requiredRoles={['admin', 'manager']}><Absences /></ProtectedRoute>} />
                <Route path="users" element={<ProtectedRoute requiredRoles={['admin']}><Users /></ProtectedRoute>} />
                <Route path="overtime-dashboard" element={<ProtectedRoute requiredRoles={['admin', 'manager']}><OvertimeDashboard /></ProtectedRoute>} />
                <Route path="timesheet" element={<ProtectedRoute requiredRoles={['admin', 'manager']}><Timesheet /></ProtectedRoute>} />
                <Route path="import-export" element={<ProtectedRoute requiredRoles={['admin']}><ImportExport /></ProtectedRoute>} />
                <Route path="teacher-module" element={<ProtectedRoute requiredRoles={['admin']}><TeacherModule /></ProtectedRoute>} />
                <Route path="account-settings" element={<AccountSettings />} />
                
                {/* Equipment Routes */}
                <Route path="equipment" element={<ProtectedRoute requiredRoles={['admin']}><EquipmentStatus /></ProtectedRoute>} />
                <Route path="equipment/list" element={<ProtectedRoute requiredRoles={['admin']}><EquipmentList /></ProtectedRoute>} />
                <Route path="equipment/add" element={<ProtectedRoute requiredRoles={['admin']}><EquipmentAdd /></ProtectedRoute>} />
                <Route path="equipment/employees" element={<ProtectedRoute requiredRoles={['admin']}><EquipmentEmployees /></ProtectedRoute>} />
                <Route path="equipment/pending" element={<ProtectedRoute requiredRoles={['admin']}><EquipmentPendingRecords /></ProtectedRoute>} />
                <Route path="equipment/logs" element={<ProtectedRoute requiredRoles={['admin']}><EquipmentLogs /></ProtectedRoute>} />
                <Route path="equipment/status" element={<ProtectedRoute requiredRoles={['admin']}><EquipmentStatus /></ProtectedRoute>} />
                <Route path="equipment/sync" element={<ProtectedRoute requiredRoles={['admin']}><EquipmentSync /></ProtectedRoute>} />
                <Route path="equipment/help" element={<ProtectedRoute requiredRoles={['admin']}><EquipmentHelp /></ProtectedRoute>} />
              </Route>
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;