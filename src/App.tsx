import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import SuperAdminProtectedRoute from "@/components/SuperAdminProtectedRoute";
import CollapsibleSidebar from "@/components/layout/CollapsibleSidebar";
import SuperAdminLayout from "@/components/layout/SuperAdminLayout";
import { GuidedTourButton } from "@/components/GuidedTour";

// Auth
import Auth from "@/pages/Auth";
import SuperAdminAuth from "@/pages/SuperAdminAuth";

// Core pages
import Dashboard from "@/pages/Dashboard";
import Home from "@/pages/Home";
import TimeClock from "@/pages/TimeClock";
import MyRecords from "@/pages/MyRecords";
import NotFound from "@/pages/NotFound";

// Employee Management
import Employees from "@/pages/Employees";
import RegisterEmployee from "@/pages/RegisterEmployee";
import Users from "@/pages/Users";

// Configuration
import Company from "@/pages/Company";
import NewCompanySettings from "@/pages/NewCompanySettings";
import AccountSettings from "@/pages/AccountSettings";
import WorkSchedules from "@/pages/WorkSchedules";
import Holidays from "@/pages/Holidays";
import NewPositionsDepartments from "@/pages/NewPositionsDepartments";
import NewDepartments from "@/pages/NewDepartments";
import NewScales from "@/pages/NewScales";
import Scales from "@/pages/Scales";

// Time Management
import Adjustments from "@/pages/Adjustments";
import MirrorPoint from "@/pages/MirrorPoint";
import TimeBank from "@/pages/TimeBank";
import Absences from "@/pages/Absences";
import OvertimeDashboard from "@/pages/OvertimeDashboard";
import Timesheet from "@/pages/Timesheet";
import LeaveManagement from "@/pages/LeaveManagement";

// Basic Registrations
import BasicRegistrations from "@/pages/BasicRegistrations";
import Unions from "@/pages/Unions";
import Justifications from "@/pages/Justifications";
import OvertimePercentages from "@/pages/OvertimePercentages";
import CompetencyPeriods from "@/pages/CompetencyPeriods";
import GeoreferencedLocations from "@/pages/GeoreferencedLocations";
import IdentificationMethods from "@/pages/IdentificationMethods";
import Vacations from "@/pages/Vacations";
import PresenceMonitoring from "@/pages/PresenceMonitoring";
import WorkStations from "@/pages/WorkStations";
import CustomNotifications from "@/pages/CustomNotifications";

// Reports
import NewReports from "@/pages/NewReports";
import MirrorPointPage from "@/pages/reports/MirrorPointPage";
import WorkedHoursPage from "@/pages/reports/WorkedHoursPage";
import OvertimePage from "@/pages/reports/OvertimePage";
import AbsencesPage from "@/pages/reports/AbsencesPage";
import AttendancePage from "@/pages/reports/AttendancePage";
import TimeBankPage from "@/pages/reports/TimeBankPage";
import MTEExportsPage from "@/pages/reports/MTEExportsPage";

// Import/Export
import ImportExport from "@/pages/ImportExport";
import PayrollExports from "@/pages/PayrollExports";
import CategoryPage from "@/pages/CategoryPage";

// Teacher Module
import NewTeacherModule from "@/pages/teacher/NewTeacherModule";
import TeacherDashboard from "@/pages/teacher/TeacherDashboard";
import TeacherSchedule from "@/pages/teacher/TeacherSchedule";
import TeacherClasses from "@/pages/teacher/TeacherClasses";
import TeacherLessonPlans from "@/pages/teacher/TeacherLessonPlans";
import TeacherMirror from "@/pages/teacher/TeacherMirror";
import TeacherSummary from "@/pages/teacher/TeacherSummary";
import TeacherSchools from "@/pages/teacher/TeacherSchools";

// Doctor Module
import DoctorModule from "@/pages/doctor/DoctorModule";
import DoctorDashboard from "@/pages/doctor/DoctorDashboard";
import DoctorSchedule from "@/pages/doctor/DoctorSchedule";
import DoctorShifts from "@/pages/doctor/DoctorShifts";
import DoctorMirror from "@/pages/doctor/DoctorMirror";
import DoctorSummary from "@/pages/doctor/DoctorSummary";
import DoctorHealthUnits from "@/pages/doctor/DoctorHealthUnits";

// Payroll Module
import PayrollModule from "@/pages/payroll/PayrollModule";
import PayrollDashboard from "@/pages/payroll/PayrollDashboard";
import PayrollCreate from "@/pages/payroll/PayrollCreate";

// Equipment
import EquipmentList from "@/pages/equipment/EquipmentList";
import EquipmentAdd from "@/pages/equipment/EquipmentAdd";
import EquipmentEmployees from "@/pages/equipment/EquipmentEmployees";
import EquipmentPendingRecords from "@/pages/equipment/EquipmentPendingRecords";
import EquipmentLogs from "@/pages/equipment/EquipmentLogs";
import EquipmentStatus from "@/pages/equipment/EquipmentStatus";
import EquipmentSync from "@/pages/equipment/EquipmentSync";
import EquipmentHelp from "@/pages/equipment/EquipmentHelp";
import MTECompliancePanel from "@/pages/equipment/MTECompliancePanel";

// Security & Help
import SecurityDashboard from "@/pages/SecurityDashboard";
import SystemManual from "@/pages/SystemManual";

// Homologation & Cards
import PointHomologation from "@/pages/PointHomologation";
import PointOccurrences from "@/pages/PointOccurrences";
import PointCards from "@/pages/PointCards";

// Super Admin
import SuperAdminDashboard from "@/pages/superadmin/Dashboard";
import SuperAdminCompanies from "@/pages/superadmin/Companies";
import SuperAdminCityHalls from "@/pages/superadmin/CityHalls";
import SuperAdminLicenses from "@/pages/superadmin/Licenses";
import SuperAdminUsers from "@/pages/superadmin/SuperAdminUsers";

// Legal pages
import PrivacyPolicy from "@/pages/legal/PrivacyPolicy";
import TermsOfService from "@/pages/legal/TermsOfService";
import DataProcessingTerms from "@/pages/legal/DataProcessingTerms";
import CookiePolicy from "@/pages/legal/CookiePolicy";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider delayDuration={300}>
        <Toaster />
        <Sonner position="top-right" richColors closeButton />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Navigate to="/home" replace />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/super-admin-auth" element={<SuperAdminAuth />} />
              
              {/* Public Legal Pages */}
              <Route path="/legal/privacy" element={<PrivacyPolicy />} />
              <Route path="/legal/terms" element={<TermsOfService />} />
              <Route path="/legal/data-processing" element={<DataProcessingTerms />} />
              <Route path="/legal/cookies" element={<CookiePolicy />} />
              
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
                  <CollapsibleSidebar />
                </ProtectedRoute>
              }>
                <Route path="home" element={<Home />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="time-clock" element={<TimeClock />} />
                <Route path="my-records" element={<MyRecords />} />
                <Route path="category/:categoryId" element={<CategoryPage />} />
                <Route path="employees" element={<ProtectedRoute requiredRoles={['admin', 'manager']}><Employees /></ProtectedRoute>} />
                <Route path="employees/register" element={<ProtectedRoute requiredRoles={['admin']}><RegisterEmployee /></ProtectedRoute>} />
                <Route path="positions-departments" element={<ProtectedRoute requiredRoles={['admin']}><NewPositionsDepartments /></ProtectedRoute>} />
                <Route path="departments" element={<ProtectedRoute requiredRoles={['admin']}><NewDepartments /></ProtectedRoute>} />
                <Route path="schedules" element={<ProtectedRoute requiredRoles={['admin']}><WorkSchedules /></ProtectedRoute>} />
                <Route path="work-schedules" element={<ProtectedRoute requiredRoles={['admin']}><NewScales /></ProtectedRoute>} />
                <Route path="adjustments" element={<ProtectedRoute requiredRoles={['admin', 'manager']}><Adjustments /></ProtectedRoute>} />
                <Route path="reports" element={<ProtectedRoute requiredRoles={['admin', 'manager']}><NewReports /></ProtectedRoute>} />
                <Route path="mirror-point" element={<ProtectedRoute requiredRoles={['admin', 'manager']}><MirrorPoint /></ProtectedRoute>} />
                <Route path="company" element={<ProtectedRoute requiredRoles={['admin']}><Company /></ProtectedRoute>} />
                <Route path="company-settings" element={<ProtectedRoute requiredRoles={['admin']}><NewCompanySettings /></ProtectedRoute>} />
                <Route path="holidays" element={<ProtectedRoute requiredRoles={['admin']}><Holidays /></ProtectedRoute>} />
                <Route path="time-bank" element={<TimeBank />} />
                <Route path="absences" element={<ProtectedRoute requiredRoles={['admin', 'manager']}><Absences /></ProtectedRoute>} />
                <Route path="users" element={<ProtectedRoute requiredRoles={['admin']}><Users /></ProtectedRoute>} />
                <Route path="overtime-dashboard" element={<ProtectedRoute requiredRoles={['admin', 'manager']}><OvertimeDashboard /></ProtectedRoute>} />
                <Route path="timesheet" element={<ProtectedRoute requiredRoles={['admin', 'manager']}><Timesheet /></ProtectedRoute>} />
                <Route path="import-export" element={<ProtectedRoute requiredRoles={['admin']}><ImportExport /></ProtectedRoute>} />
                {/* Teacher Module Routes - Individual Pages */}
                <Route path="teacher-module" element={<ProtectedRoute requiredRoles={['admin']}><TeacherDashboard /></ProtectedRoute>} />
                <Route path="teacher/dashboard" element={<ProtectedRoute requiredRoles={['admin']}><TeacherDashboard /></ProtectedRoute>} />
                <Route path="teacher/professors" element={<ProtectedRoute requiredRoles={['admin']}><NewTeacherModule defaultTab="teachers" /></ProtectedRoute>} />
                <Route path="teacher/classes" element={<ProtectedRoute requiredRoles={['admin']}><TeacherClasses /></ProtectedRoute>} />
                <Route path="teacher/lesson-plans" element={<ProtectedRoute requiredRoles={['admin']}><TeacherLessonPlans /></ProtectedRoute>} />
                <Route path="teacher/schools" element={<ProtectedRoute requiredRoles={['admin']}><TeacherSchools /></ProtectedRoute>} />
                <Route path="teacher/schedule" element={<ProtectedRoute requiredRoles={['admin']}><TeacherSchedule /></ProtectedRoute>} />
                <Route path="teacher/mirror" element={<ProtectedRoute requiredRoles={['admin']}><TeacherMirror /></ProtectedRoute>} />
                <Route path="teacher/summary" element={<ProtectedRoute requiredRoles={['admin']}><TeacherSummary /></ProtectedRoute>} />
                <Route path="teacher/configurations" element={<ProtectedRoute requiredRoles={['admin']}><NewTeacherModule defaultTab="config" /></ProtectedRoute>} />
                {/* Doctor Module Routes - Individual Pages */}
                <Route path="doctor-module" element={<ProtectedRoute requiredRoles={['admin']}><DoctorDashboard /></ProtectedRoute>} />
                <Route path="doctor/dashboard" element={<ProtectedRoute requiredRoles={['admin']}><DoctorDashboard /></ProtectedRoute>} />
                <Route path="doctor/doctors" element={<ProtectedRoute requiredRoles={['admin']}><DoctorModule defaultTab="doctors" /></ProtectedRoute>} />
                <Route path="doctor/health-units" element={<ProtectedRoute requiredRoles={['admin']}><DoctorHealthUnits /></ProtectedRoute>} />
                <Route path="doctor/shifts" element={<ProtectedRoute requiredRoles={['admin']}><DoctorShifts /></ProtectedRoute>} />
                <Route path="doctor/schedule" element={<ProtectedRoute requiredRoles={['admin']}><DoctorSchedule /></ProtectedRoute>} />
                <Route path="doctor/mirror" element={<ProtectedRoute requiredRoles={['admin']}><DoctorMirror /></ProtectedRoute>} />
                <Route path="doctor/summary" element={<ProtectedRoute requiredRoles={['admin']}><DoctorSummary /></ProtectedRoute>} />
                <Route path="doctor/configurations" element={<ProtectedRoute requiredRoles={['admin']}><DoctorModule defaultTab="config" /></ProtectedRoute>} />
                {/* Payroll Module Routes - Individual Pages */}
                <Route path="payroll-module" element={<ProtectedRoute requiredRoles={['admin']}><PayrollDashboard /></ProtectedRoute>} />
                <Route path="payroll/dashboard" element={<ProtectedRoute requiredRoles={['admin']}><PayrollDashboard /></ProtectedRoute>} />
                <Route path="payroll/list" element={<ProtectedRoute requiredRoles={['admin']}><PayrollModule defaultTab="payrolls" /></ProtectedRoute>} />
                <Route path="payroll/create" element={<ProtectedRoute requiredRoles={['admin']}><PayrollCreate /></ProtectedRoute>} />
                <Route path="payroll/payslips" element={<ProtectedRoute requiredRoles={['admin']}><PayrollModule defaultTab="payslips" /></ProtectedRoute>} />
                <Route path="payroll/items" element={<ProtectedRoute requiredRoles={['admin']}><PayrollModule defaultTab="items" /></ProtectedRoute>} />
                <Route path="account-settings" element={<AccountSettings />} />
                <Route path="leave-management" element={<ProtectedRoute requiredRoles={['admin', 'manager']}><LeaveManagement /></ProtectedRoute>} />
                <Route path="payroll-exports" element={<ProtectedRoute requiredRoles={['admin']}><PayrollExports /></ProtectedRoute>} />
                <Route path="identification-methods" element={<ProtectedRoute requiredRoles={['admin']}><IdentificationMethods /></ProtectedRoute>} />
                <Route path="basic-registrations" element={<ProtectedRoute requiredRoles={['admin']}><BasicRegistrations /></ProtectedRoute>} />
                <Route path="unions" element={<ProtectedRoute requiredRoles={['admin']}><Unions /></ProtectedRoute>} />
                <Route path="justifications" element={<ProtectedRoute requiredRoles={['admin']}><Justifications /></ProtectedRoute>} />
                <Route path="scales" element={<ProtectedRoute requiredRoles={['admin']}><Scales /></ProtectedRoute>} />
                <Route path="overtime-percentages" element={<ProtectedRoute requiredRoles={['admin']}><OvertimePercentages /></ProtectedRoute>} />
                <Route path="competency-periods" element={<ProtectedRoute requiredRoles={['admin']}><CompetencyPeriods /></ProtectedRoute>} />
                <Route path="georeferenced-locations" element={<ProtectedRoute requiredRoles={['admin']}><GeoreferencedLocations /></ProtectedRoute>} />
                <Route path="vacations" element={<Vacations />} />
                <Route path="presence-monitoring" element={<ProtectedRoute requiredRoles={['admin', 'manager']}><PresenceMonitoring /></ProtectedRoute>} />
                <Route path="work-stations" element={<ProtectedRoute requiredRoles={['admin']}><WorkStations /></ProtectedRoute>} />
                <Route path="custom-notifications" element={<ProtectedRoute requiredRoles={['admin']}><CustomNotifications /></ProtectedRoute>} />
                <Route path="security" element={<SecurityDashboard />} />
                <Route path="system-manual" element={<SystemManual />} />
                {/* Homologation & Cards Routes */}
                <Route path="point-homologation" element={<ProtectedRoute requiredRoles={['admin', 'manager']}><PointHomologation /></ProtectedRoute>} />
                <Route path="point-occurrences" element={<PointOccurrences />} />
                <Route path="point-cards" element={<ProtectedRoute requiredRoles={['admin', 'manager']}><PointCards /></ProtectedRoute>} />
                {/* Individual Report Routes */}
                <Route path="reports/mirror-point" element={<ProtectedRoute requiredRoles={['admin', 'manager']}><MirrorPointPage /></ProtectedRoute>} />
                <Route path="reports/worked-hours" element={<ProtectedRoute requiredRoles={['admin', 'manager']}><WorkedHoursPage /></ProtectedRoute>} />
                <Route path="reports/overtime" element={<ProtectedRoute requiredRoles={['admin', 'manager']}><OvertimePage /></ProtectedRoute>} />
                <Route path="reports/absences" element={<ProtectedRoute requiredRoles={['admin', 'manager']}><AbsencesPage /></ProtectedRoute>} />
                <Route path="reports/attendance" element={<ProtectedRoute requiredRoles={['admin', 'manager']}><AttendancePage /></ProtectedRoute>} />
                <Route path="reports/time-bank" element={<ProtectedRoute requiredRoles={['admin', 'manager']}><TimeBankPage /></ProtectedRoute>} />
                <Route path="reports/mte" element={<ProtectedRoute requiredRoles={['admin', 'manager']}><MTEExportsPage /></ProtectedRoute>} />
                {/* Equipment Routes */}
                <Route path="equipment" element={<ProtectedRoute requiredRoles={['admin']}><EquipmentStatus /></ProtectedRoute>} />
                <Route path="equipment/list" element={<ProtectedRoute requiredRoles={['admin']}><EquipmentList /></ProtectedRoute>} />
                <Route path="equipment/add" element={<ProtectedRoute requiredRoles={['admin']}><EquipmentAdd /></ProtectedRoute>} />
                <Route path="equipment/employees" element={<ProtectedRoute requiredRoles={['admin']}><EquipmentEmployees /></ProtectedRoute>} />
                <Route path="equipment/pending" element={<ProtectedRoute requiredRoles={['admin']}><EquipmentPendingRecords /></ProtectedRoute>} />
                <Route path="equipment/logs" element={<ProtectedRoute requiredRoles={['admin']}><EquipmentLogs /></ProtectedRoute>} />
                <Route path="equipment/status" element={<ProtectedRoute requiredRoles={['admin']}><EquipmentStatus /></ProtectedRoute>} />
                <Route path="equipment/sync" element={<ProtectedRoute requiredRoles={['admin']}><EquipmentSync /></ProtectedRoute>} />
                <Route path="equipment/compliance" element={<ProtectedRoute requiredRoles={['admin']}><MTECompliancePanel /></ProtectedRoute>} />
                <Route path="equipment/help" element={<ProtectedRoute requiredRoles={['admin']}><EquipmentHelp /></ProtectedRoute>} />
              </Route>
              
              <Route path="*" element={<NotFound />} />
            </Routes>
            <GuidedTourButton />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;