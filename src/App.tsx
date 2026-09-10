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
import { MaintenanceBanner } from "@/components/MaintenanceBanner";
import { GlobalWatermark } from "@/components/GlobalWatermark";
import { WhatsNewPopup } from "@/components/WhatsNewPopup";
import { HolidayThemeProvider } from "@/components/HolidayThemeProvider";
import { HolidayBanner } from "@/components/HolidayBanner";
import React, { Suspense } from "react";
import { Loader2 } from "lucide-react";

// Lazy loading fallback
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

// Auth (eager - needed immediately)
import Auth from "@/pages/Auth";
const KioskTerminal = React.lazy(() => import("@/pages/KioskTerminal"));
import SuperAdminAuth from "@/pages/SuperAdminAuth";
import NotFound from "@/pages/NotFound";

// Core pages - lazy loaded
const Dashboard = React.lazy(() => import("@/pages/Dashboard"));
const Home = React.lazy(() => import("@/pages/Home"));
const TimeClock = React.lazy(() => import("@/pages/TimeClock"));
const MyRecords = React.lazy(() => import("@/pages/MyRecords"));

// Employee Management
const Employees = React.lazy(() => import("@/pages/Employees"));
const RegisterEmployee = React.lazy(() => import("@/pages/RegisterEmployee"));
const Users = React.lazy(() => import("@/pages/Users"));

// Configuration
const Company = React.lazy(() => import("@/pages/Company"));
const NewCompanySettings = React.lazy(() => import("@/pages/NewCompanySettings"));
const CompanyUnits = React.lazy(() => import("@/pages/CompanyUnits"));
const TerminalApp = React.lazy(() => import("@/pages/TerminalApp"));
const AccountSettings = React.lazy(() => import("@/pages/AccountSettings"));
const WorkSchedules = React.lazy(() => import("@/pages/WorkSchedules"));
const Holidays = React.lazy(() => import("@/pages/Holidays"));
const NewPositionsDepartments = React.lazy(() => import("@/pages/NewPositionsDepartments"));
const NewDepartments = React.lazy(() => import("@/pages/NewDepartments"));
const NewScales = React.lazy(() => import("@/pages/NewScales"));
const Scales = React.lazy(() => import("@/pages/Scales"));
const ScheduledScales = React.lazy(() => import("@/pages/ScheduledScales"));
const FixedScales = React.lazy(() => import("@/pages/FixedScales"));
const Journeys = React.lazy(() => import("@/pages/Journeys"));
const AttendanceRules = React.lazy(() => import("@/pages/AttendanceRules"));

// Time Management
const Adjustments = React.lazy(() => import("@/pages/Adjustments"));
const MirrorPoint = React.lazy(() => import("@/pages/MirrorPoint"));
const TimeBank = React.lazy(() => import("@/pages/TimeBank"));
const Absences = React.lazy(() => import("@/pages/Absences"));
const OvertimeDashboard = React.lazy(() => import("@/pages/OvertimeDashboard"));
const Timesheet = React.lazy(() => import("@/pages/Timesheet"));
const LeaveManagement = React.lazy(() => import("@/pages/LeaveManagement"));

// Basic Registrations
const BasicRegistrations = React.lazy(() => import("@/pages/BasicRegistrations"));
const Unions = React.lazy(() => import("@/pages/Unions"));
const Justifications = React.lazy(() => import("@/pages/Justifications"));
const OvertimePercentages = React.lazy(() => import("@/pages/OvertimePercentages"));
const CompetencyPeriods = React.lazy(() => import("@/pages/CompetencyPeriods"));
const GeoreferencedLocations = React.lazy(() => import("@/pages/GeoreferencedLocations"));
const IdentificationMethods = React.lazy(() => import("@/pages/IdentificationMethods"));
const ValidationAudit = React.lazy(() => import("@/pages/ValidationAudit"));
const KioskTerminals = React.lazy(() => import("@/pages/KioskTerminals"));
const DiagnosticPanel = React.lazy(() => import("@/pages/admin/DiagnosticPanel"));
const CnpjAudit = React.lazy(() => import("@/pages/admin/CnpjAudit"));

const Suggestions = React.lazy(() => import("@/pages/Suggestions"));
const Vacations = React.lazy(() => import("@/pages/Vacations"));
const PresenceMonitoring = React.lazy(() => import("@/pages/PresenceMonitoring"));
const WorkStations = React.lazy(() => import("@/pages/WorkStations"));
const CustomNotifications = React.lazy(() => import("@/pages/CustomNotifications"));
const CommuteTime = React.lazy(() => import("@/pages/CommuteTime"));
const OnCallSchedules = React.lazy(() => import("@/pages/OnCallSchedules"));
const BatchAbsolutions = React.lazy(() => import("@/pages/BatchAbsolutions"));
const MaritalStatuses = React.lazy(() => import("@/pages/MaritalStatuses"));
const Cities = React.lazy(() => import("@/pages/Cities"));
const CompensationBank = React.lazy(() => import("@/pages/CompensationBank"));

// Reports
const NewReports = React.lazy(() => import("@/pages/NewReports"));
const MirrorPointPage = React.lazy(() => import("@/pages/reports/MirrorPointPage"));
const WorkedHoursPage = React.lazy(() => import("@/pages/reports/WorkedHoursPage"));
const OvertimePage = React.lazy(() => import("@/pages/reports/OvertimePage"));
const AbsencesPage = React.lazy(() => import("@/pages/reports/AbsencesPage"));
const AttendancePage = React.lazy(() => import("@/pages/reports/AttendancePage"));
const TimeBankPage = React.lazy(() => import("@/pages/reports/TimeBankPage"));
const MTEExportsPage = React.lazy(() => import("@/pages/reports/MTEExportsPage"));
const TurnoverReport = React.lazy(() => import("@/pages/TurnoverReport"));

// Import/Export
const ImportExport = React.lazy(() => import("@/pages/ImportExport"));
const DataImport = React.lazy(() => import("@/pages/DataImport"));
const PayrollExports = React.lazy(() => import("@/pages/PayrollExports"));
const CategoryPage = React.lazy(() => import("@/pages/CategoryPage"));

// Tools
const HoursCalculator = React.lazy(() => import("@/pages/HoursCalculator"));
const CustomTexts = React.lazy(() => import("@/pages/CustomTexts"));

// Teacher Module
const NewTeacherModule = React.lazy(() => import("@/pages/teacher/NewTeacherModule"));
const TeacherDashboard = React.lazy(() => import("@/pages/teacher/TeacherDashboard"));
const TeacherSchedule = React.lazy(() => import("@/pages/teacher/TeacherSchedule"));
const TeacherClasses = React.lazy(() => import("@/pages/teacher/TeacherClasses"));
const TeacherLessonPlans = React.lazy(() => import("@/pages/teacher/TeacherLessonPlans"));
const TeacherMirror = React.lazy(() => import("@/pages/teacher/TeacherMirror"));
const TeacherSummary = React.lazy(() => import("@/pages/teacher/TeacherSummary"));
const TeacherSchools = React.lazy(() => import("@/pages/teacher/TeacherSchools"));

// Doctor Module
const DoctorModule = React.lazy(() => import("@/pages/doctor/DoctorModule"));
const DoctorDashboard = React.lazy(() => import("@/pages/doctor/DoctorDashboard"));
const DoctorSchedule = React.lazy(() => import("@/pages/doctor/DoctorSchedule"));
const DoctorShifts = React.lazy(() => import("@/pages/doctor/DoctorShifts"));
const DoctorMirror = React.lazy(() => import("@/pages/doctor/DoctorMirror"));
const DoctorSummary = React.lazy(() => import("@/pages/doctor/DoctorSummary"));
const DoctorHealthUnits = React.lazy(() => import("@/pages/doctor/DoctorHealthUnits"));

// Payroll Module
const PayrollModule = React.lazy(() => import("@/pages/payroll/PayrollModule"));
const PayrollDashboard = React.lazy(() => import("@/pages/payroll/PayrollDashboard"));
const PayrollCreate = React.lazy(() => import("@/pages/payroll/PayrollCreate"));

// Equipment
const EquipmentList = React.lazy(() => import("@/pages/equipment/EquipmentList"));
const EquipmentAdd = React.lazy(() => import("@/pages/equipment/EquipmentAdd"));
const EquipmentEmployees = React.lazy(() => import("@/pages/equipment/EquipmentEmployees"));
const EquipmentPendingRecords = React.lazy(() => import("@/pages/equipment/EquipmentPendingRecords"));
const EquipmentLogs = React.lazy(() => import("@/pages/equipment/EquipmentLogs"));
const EquipmentStatus = React.lazy(() => import("@/pages/equipment/EquipmentStatus"));
const EquipmentSync = React.lazy(() => import("@/pages/equipment/EquipmentSync"));
const EquipmentHelp = React.lazy(() => import("@/pages/equipment/EquipmentHelp"));
const CommunicationServers = React.lazy(() => import("@/pages/equipment/CommunicationServers"));
const CommunicationAgents = React.lazy(() => import("@/pages/equipment/CommunicationAgents"));
const AgentHealth = React.lazy(() => import("@/pages/equipment/AgentHealth"));
const ClocksLive = React.lazy(() => import("@/pages/equipment/ClocksLive"));

// Controle Operacional
const OperationalDashboard = React.lazy(() => import("@/pages/operational/OperationalDashboard"));
const OperationalSchedules = React.lazy(() => import("@/pages/operational/OperationalSchedules"));
const OperationalDay = React.lazy(() => import("@/pages/operational/OperationalDay"));
const OperationalDrivers = React.lazy(() => import("@/pages/operational/OperationalDrivers"));
const OperationalVehicles = React.lazy(() => import("@/pages/operational/OperationalVehicles"));
const OperationalLines = React.lazy(() => import("@/pages/operational/OperationalLines"));
const OperationalPermissions = React.lazy(() => import("@/pages/operational/OperationalPermissions"));
const OperationalTimeComparison = React.lazy(() => import("@/pages/operational/OperationalTimeComparison"));
const OperationalMyDay = React.lazy(() => import("@/pages/operational/OperationalMyDay"));


const MTECompliancePanel = React.lazy(() => import("@/pages/equipment/MTECompliancePanel"));

// Security & Help
const SecurityDashboard = React.lazy(() => import("@/pages/SecurityDashboard"));
const SystemManual = React.lazy(() => import("@/pages/SystemManual"));

// Homologation & Cards
const PointHomologation = React.lazy(() => import("@/pages/PointHomologation"));
const PointOccurrences = React.lazy(() => import("@/pages/PointOccurrences"));
const PointCards = React.lazy(() => import("@/pages/PointCards"));

// Super Admin
const SuperAdminDashboard = React.lazy(() => import("@/pages/superadmin/Dashboard"));
const SuperAdminCompanies = React.lazy(() => import("@/pages/superadmin/Companies"));
const SuperAdminCityHalls = React.lazy(() => import("@/pages/superadmin/CityHalls"));
const SuperAdminLicenses = React.lazy(() => import("@/pages/superadmin/Licenses"));
const SuperAdminUsers = React.lazy(() => import("@/pages/superadmin/SuperAdminUsers"));

// Legal pages
const PrivacyPolicy = React.lazy(() => import("@/pages/legal/PrivacyPolicy"));
const TermsOfService = React.lazy(() => import("@/pages/legal/TermsOfService"));
const DataProcessingTerms = React.lazy(() => import("@/pages/legal/DataProcessingTerms"));
const CookiePolicy = React.lazy(() => import("@/pages/legal/CookiePolicy"));

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
        <HolidayThemeProvider>
          <Toaster />
          <Sonner position="top-right" richColors closeButton />
          <BrowserRouter>
            <AuthProvider>
              <MaintenanceBanner />
              <GlobalWatermark />
              <HolidayBanner />
              <WhatsNewPopup />
              <Suspense fallback={<PageLoader />}>
                <Routes>
                <Route path="/" element={<Navigate to="/home" replace />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/terminal" element={<Suspense fallback={<PageLoader />}><KioskTerminal /></Suspense>} />
                <Route path="/super-admin-auth" element={<SuperAdminAuth />} />
                
                {/* Public Legal Pages */}
                <Route path="/legal/privacy" element={<PrivacyPolicy />} />
                <Route path="/legal/terms" element={<TermsOfService />} />
                <Route path="/legal/data-processing" element={<DataProcessingTerms />} />
                <Route path="/legal/cookies" element={<CookiePolicy />} />
                
                {/* Super Admin Routes */}
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
                  <Route path="journeys" element={<ProtectedRoute requiredRoles={['admin']}><Journeys /></ProtectedRoute>} />
                  <Route path="attendance-rules" element={<ProtectedRoute requiredRoles={['admin', 'manager']}><AttendanceRules /></ProtectedRoute>} />
                  <Route path="fixed-scales" element={<ProtectedRoute requiredRoles={['admin']}><FixedScales /></ProtectedRoute>} />
                  <Route path="scheduled-scales" element={<ProtectedRoute requiredRoles={['admin']}><ScheduledScales /></ProtectedRoute>} />
                  <Route path="adjustments" element={<ProtectedRoute requiredRoles={['admin', 'manager']}><Adjustments /></ProtectedRoute>} />
                  <Route path="reports" element={<ProtectedRoute requiredRoles={['admin', 'manager']}><NewReports /></ProtectedRoute>} />
                  <Route path="mirror-point" element={<ProtectedRoute requiredRoles={['admin', 'manager']}><MirrorPoint /></ProtectedRoute>} />
                  <Route path="company" element={<ProtectedRoute requiredRoles={['admin']}><Company /></ProtectedRoute>} />
                  <Route path="company-settings" element={<ProtectedRoute requiredRoles={['admin']}><NewCompanySettings /></ProtectedRoute>} />
                  <Route path="company-units" element={<ProtectedRoute requiredRoles={['admin']}><CompanyUnits /></ProtectedRoute>} />
                  <Route path="terminal-app" element={<ProtectedRoute requiredRoles={['admin']}><TerminalApp /></ProtectedRoute>} />
                  <Route path="holidays" element={<ProtectedRoute requiredRoles={['admin']}><Holidays /></ProtectedRoute>} />
                  <Route path="time-bank" element={<TimeBank />} />
                  <Route path="absences" element={<ProtectedRoute requiredRoles={['admin', 'manager']}><Absences /></ProtectedRoute>} />
                  <Route path="users" element={<ProtectedRoute requiredRoles={['admin']}><Users /></ProtectedRoute>} />
                  <Route path="overtime-dashboard" element={<ProtectedRoute requiredRoles={['admin', 'manager']}><OvertimeDashboard /></ProtectedRoute>} />
                  <Route path="timesheet" element={<ProtectedRoute requiredRoles={['admin', 'manager']}><Timesheet /></ProtectedRoute>} />
                  <Route path="import-export" element={<ProtectedRoute requiredRoles={['admin']}><ImportExport /></ProtectedRoute>} />
                  <Route path="data-import" element={<ProtectedRoute requiredRoles={['admin']}><DataImport /></ProtectedRoute>} />
                  {/* Teacher Module */}
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
                  {/* Doctor Module */}
                  <Route path="doctor-module" element={<ProtectedRoute requiredRoles={['admin']}><DoctorDashboard /></ProtectedRoute>} />
                  <Route path="doctor/dashboard" element={<ProtectedRoute requiredRoles={['admin']}><DoctorDashboard /></ProtectedRoute>} />
                  <Route path="doctor/doctors" element={<ProtectedRoute requiredRoles={['admin']}><DoctorModule defaultTab="doctors" /></ProtectedRoute>} />
                  <Route path="doctor/health-units" element={<ProtectedRoute requiredRoles={['admin']}><DoctorHealthUnits /></ProtectedRoute>} />
                  <Route path="doctor/shifts" element={<ProtectedRoute requiredRoles={['admin']}><DoctorShifts /></ProtectedRoute>} />
                  <Route path="doctor/schedule" element={<ProtectedRoute requiredRoles={['admin']}><DoctorSchedule /></ProtectedRoute>} />
                  <Route path="doctor/mirror" element={<ProtectedRoute requiredRoles={['admin']}><DoctorMirror /></ProtectedRoute>} />
                  <Route path="doctor/summary" element={<ProtectedRoute requiredRoles={['admin']}><DoctorSummary /></ProtectedRoute>} />
                  <Route path="doctor/configurations" element={<ProtectedRoute requiredRoles={['admin']}><DoctorModule defaultTab="config" /></ProtectedRoute>} />
                  {/* Payroll Module */}
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
                  <Route path="validation-audit" element={<ProtectedRoute><ValidationAudit /></ProtectedRoute>} />
                  <Route path="kiosk-terminals" element={<ProtectedRoute requiredRoles={['admin']}><KioskTerminals /></ProtectedRoute>} />
                  <Route path="diagnostics" element={<ProtectedRoute requiredRoles={['admin']}><DiagnosticPanel /></ProtectedRoute>} />
                  <Route path="cnpj-audit" element={<ProtectedRoute requiredRoles={['admin']}><CnpjAudit /></ProtectedRoute>} />

                  <Route path="suggestions" element={<ProtectedRoute><Suggestions /></ProtectedRoute>} />
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
                  <Route path="commute-time" element={<ProtectedRoute requiredRoles={['admin']}><CommuteTime /></ProtectedRoute>} />
                  <Route path="on-call-schedules" element={<ProtectedRoute requiredRoles={['admin']}><OnCallSchedules /></ProtectedRoute>} />
                  <Route path="batch-absolutions" element={<ProtectedRoute requiredRoles={['admin']}><BatchAbsolutions /></ProtectedRoute>} />
                  <Route path="marital-statuses" element={<ProtectedRoute requiredRoles={['admin']}><MaritalStatuses /></ProtectedRoute>} />
                  <Route path="cities" element={<ProtectedRoute requiredRoles={['admin']}><Cities /></ProtectedRoute>} />
                  <Route path="compensation-bank" element={<ProtectedRoute requiredRoles={['admin']}><CompensationBank /></ProtectedRoute>} />
                  <Route path="security" element={<SecurityDashboard />} />
                  <Route path="system-manual" element={<SystemManual />} />
                  {/* Homologation & Cards */}
                  <Route path="point-homologation" element={<ProtectedRoute requiredRoles={['admin', 'manager']}><PointHomologation /></ProtectedRoute>} />
                  <Route path="point-occurrences" element={<PointOccurrences />} />
                  <Route path="point-cards" element={<ProtectedRoute requiredRoles={['admin', 'manager']}><PointCards /></ProtectedRoute>} />
                  {/* Report Routes */}
                  <Route path="reports/mirror-point" element={<ProtectedRoute requiredRoles={['admin', 'manager']}><MirrorPointPage /></ProtectedRoute>} />
                  <Route path="reports/worked-hours" element={<ProtectedRoute requiredRoles={['admin', 'manager']}><WorkedHoursPage /></ProtectedRoute>} />
                  <Route path="reports/overtime" element={<ProtectedRoute requiredRoles={['admin', 'manager']}><OvertimePage /></ProtectedRoute>} />
                  <Route path="reports/absences" element={<ProtectedRoute requiredRoles={['admin', 'manager']}><AbsencesPage /></ProtectedRoute>} />
                  <Route path="reports/attendance" element={<ProtectedRoute requiredRoles={['admin', 'manager']}><AttendancePage /></ProtectedRoute>} />
                  <Route path="reports/time-bank" element={<ProtectedRoute requiredRoles={['admin', 'manager']}><TimeBankPage /></ProtectedRoute>} />
                  <Route path="reports/mte" element={<ProtectedRoute requiredRoles={['admin', 'manager']}><MTEExportsPage /></ProtectedRoute>} />
                  <Route path="reports/turnover" element={<ProtectedRoute requiredRoles={['admin', 'manager']}><TurnoverReport /></ProtectedRoute>} />
                  {/* Tools */}
                  <Route path="hours-calculator" element={<ProtectedRoute requiredRoles={['admin', 'manager']}><HoursCalculator /></ProtectedRoute>} />
                  <Route path="custom-texts" element={<ProtectedRoute requiredRoles={['admin']}><CustomTexts /></ProtectedRoute>} />
                  {/* Equipment */}
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
                  <Route path="equipment/agents" element={<ProtectedRoute requiredRoles={['admin']}><CommunicationAgents /></ProtectedRoute>} />
                  <Route path="equipment/agent-health" element={<ProtectedRoute requiredRoles={['admin']}><AgentHealth /></ProtectedRoute>} />
                  <Route path="equipment/clocks-live" element={<ProtectedRoute requiredRoles={['admin']}><ClocksLive /></ProtectedRoute>} />
                  <Route path="equipment/servers" element={<ProtectedRoute requiredRoles={['admin']}><CommunicationServers /></ProtectedRoute>} />
                  {/* Controle Operacional */}
                  <Route path="operational" element={<ProtectedRoute requiredRoles={['admin', 'manager']}><OperationalDashboard /></ProtectedRoute>} />
                  <Route path="operational/schedules" element={<ProtectedRoute requiredRoles={['admin', 'manager']}><OperationalSchedules /></ProtectedRoute>} />
                  <Route path="operational/day" element={<ProtectedRoute requiredRoles={['admin', 'manager']}><OperationalDay /></ProtectedRoute>} />
                  <Route path="operational/drivers" element={<ProtectedRoute requiredRoles={['admin', 'manager']}><OperationalDrivers /></ProtectedRoute>} />
                  <Route path="operational/vehicles" element={<ProtectedRoute requiredRoles={['admin', 'manager']}><OperationalVehicles /></ProtectedRoute>} />
                  <Route path="operational/lines" element={<ProtectedRoute requiredRoles={['admin', 'manager']}><OperationalLines /></ProtectedRoute>} />
                  <Route path="operational/permissions" element={<ProtectedRoute requiredRoles={['admin']}><OperationalPermissions /></ProtectedRoute>} />
                  <Route path="operational/time-check" element={<ProtectedRoute requiredRoles={['admin', 'manager']}><OperationalTimeComparison /></ProtectedRoute>} />
                  <Route path="operational/my-day" element={<ProtectedRoute><OperationalMyDay /></ProtectedRoute>} />


                </Route>
                
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
              <GuidedTourButton />
            </AuthProvider>
          </BrowserRouter>
        </HolidayThemeProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
