// Todas as telas do app logado, por caminho (os mesmos da web).
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import 'account_page.dart';
import 'adjustments_page.dart';
import 'admin_pages.dart';
import 'allowances_page.dart';
import 'bank_page.dart';
import 'catalog_page.dart';
import 'closing_page.dart';
import 'content_pages.dart';
import 'companies_page.dart';
import 'employees_page.dart';
import 'holidays_page.dart';
import 'import_employees_page.dart';
import 'import_marks_page.dart';
import 'live_page.dart';
import 'mirror_page.dart';
import 'occurrences_page.dart';
import 'my_devices_page.dart';
import 'payroll_page.dart';
import 'platform_pages.dart';
import 'punch_page.dart';
import 'reports_page.dart';
import 'requests_page.dart';
import 'rules_page.dart';
import 'schedule_grid_page.dart';
import 'shifts_page.dart';
import 'timetables_page.dart';
import 'tools_pages.dart';
import 'users_page.dart';
import 'daily_page.dart';
import 'dashboard_page.dart';
import 'departments_page.dart';
import 'devices_page.dart';
import 'education_page.dart';
import 'groupings_page.dart';

typedef PageBuilder = Widget Function(BuildContext, GoRouterState);

final Map<String, PageBuilder> pageRoutes = {
  '/': (_, _) => const DashboardPage(),
  '/empresas': (_, _) => const CompaniesPage(),
  '/feriados': (_, _) => const HolidaysPage(),
  '/funcionarios': (_, _) => const EmployeesPage(),
  '/funcionarios/importar': (_, _) => const ImportEmployeesPage(),
  '/jornada/escalas': (_, _) => const ScheduleGridPage(),
  '/jornada/horarios': (_, _) => const TimetablesPage(),
  '/jornada/regras': (_, _) => const RulesPage(),
  '/ponto/registrar': (_, _) => const PunchPage(),
  '/ponto/espelho': (_, _) => const MirrorPage(),
  '/ponto/diario': (_, _) => const DailyPage(),
  '/ponto/aparelhos': (_, _) => const MyDevicesPage(),
  '/ponto/importar': (_, _) => const ImportMarksPage(),
  '/ponto/ajustes': (_, _) => const AdjustmentsPage(),
  '/ponto/justificativas': (_, _) => CatalogPage(def: justificationsDef),
  '/ponto/abonos': (_, _) => const AllowancesPage(),
  '/ponto/fechamento': (_, _) => const ClosingPage(),
  '/ferramentas/ao-vivo': (_, _) => const LivePage(),
  '/bancos/banco-de-horas': (_, _) => const BankPage(),
  '/bancos/meu-banco': (_, _) => const MyBankPage(),
  '/solicitacoes': (_, _) => const RequestsPage(),
  '/solicitacoes/fluxos': (_, _) => const FlowsPage(),
  '/relatorios': (_, _) => const ReportsPage(),
  '/folha': (_, _) => const PayrollPage(),
  '/saude/plantoes': (_, _) => const ShiftsPage(),
  '/educacao': (_, _) => const EducationPage(),
  '/operacional/ocorrencias': (_, _) => const OccurrencesPage(),
  '/ferramentas/avisos': (_, _) => const AnnouncementsPage(),
  '/ferramentas/emails': (_, _) => const EmailsPage(),
  '/ferramentas/textos': (_, _) => const CustomTextsPage(),
  '/ferramentas/ajuda': (_, _) => const HelpPage(),
  '/equipamentos': (_, _) => const DevicesPage(),
  '/usuarios': (_, _) => const UsersPage(),
  '/perfis': (_, _) => const RolesPage(),
  '/bloqueios': (_, _) => const BlocksPage(),
  '/plano': (_, _) => const PlanUsagePage(),
  '/usuarios/aparelhos': (_, _) => const AppDevicesAdminPage(),
  '/usuarios/ldap': (_, _) => const LdapPage(),
  '/plataforma': (_, _) => const PlatformHomePage(),
  '/plataforma/clientes': (_, _) => const TenantsPage(),
  '/plataforma/planos': (_, _) => const PlansPage(),
  '/minha-conta': (_, _) => const AccountPage(),
  '/manual': (_, _) => const ManualPage(),
  '/conformidade': (_, _) => const CompliancePage(),
  '/estrutura/unidades': (_, _) => CatalogPage(def: unitsDef),
  '/estrutura/departamentos': (_, _) => const DepartmentsPage(),
  '/estrutura/cargos': (_, _) => CatalogPage(def: positionsDef),
  '/estrutura/funcoes': (_, _) => CatalogPage(def: functionsDef),
  '/estrutura/centros-de-custo': (_, _) => CatalogPage(def: costCentersDef),
  '/estrutura/tipos-de-funcionario': (_, _) => CatalogPage(def: employeeTypesDef),
  '/estrutura/sindicatos': (_, _) => CatalogPage(def: unionsDef),
  '/estrutura/competencias': (_, _) => CatalogPage(def: competencesDef),
  '/estrutura/agrupamentos': (_, _) => CatalogPage(def: groupingsDef),
};
