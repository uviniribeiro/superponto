// Todas as telas do app logado, por caminho (os mesmos da web).
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import 'adjustments_page.dart';
import 'allowances_page.dart';
import 'bank_page.dart';
import 'catalog_page.dart';
import 'closing_page.dart';
import 'companies_page.dart';
import 'employees_page.dart';
import 'holidays_page.dart';
import 'import_employees_page.dart';
import 'import_marks_page.dart';
import 'live_page.dart';
import 'mirror_page.dart';
import 'my_devices_page.dart';
import 'punch_page.dart';
import 'rules_page.dart';
import 'schedule_grid_page.dart';
import 'timetables_page.dart';
import 'daily_page.dart';
import 'dashboard_page.dart';
import 'departments_page.dart';
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
