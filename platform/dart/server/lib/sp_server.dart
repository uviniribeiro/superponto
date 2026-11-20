/// Servidor da API SuperPonto em Dart.
library;

import 'src/app.dart';
import 'src/config.dart';
import 'src/http.dart';
import 'src/modules/auth_routes.dart';
import 'src/modules/companies.dart';
import 'src/modules/dashboard.dart';
import 'src/modules/devices.dart';
import 'src/modules/health.dart';
import 'src/modules/holidays.dart';
import 'src/modules/lookup.dart';
import 'src/modules/people.dart';
import 'src/modules/platform_tenants.dart';
import 'src/modules/reports.dart';
import 'src/modules/schedules.dart';
import 'src/modules/structure.dart';
import 'src/modules/timesheet.dart';
import 'src/modules/tools.dart';
import 'src/modules/users.dart';

export 'src/app.dart' show App;
export 'src/config.dart' show AppConfig, ConfigError;

/// Cria o servidor com todos os módulos registrados.
App buildApp(AppConfig config) {
  final app = App(config);
  final support = SupportProvisioning(app);
  healthRoutes(app);
  authRoutes(app);
  companiesRoutes(app);
  platformTenantsRoutes(app, support);
  UsersModule(app).routes();
  structureRoutes(app);
  PeopleModule(app).routes();
  final holidays = HolidaysService(app)..routes();
  final lookup = LookupService()..routes(app);
  dashboardRoutes(app, holidays);
  final schedules = SchedulesModule(app, holidays)..routes();
  final timesheet = TimesheetModule(app, schedules)..routes();
  ReportsModule(app, timesheet.core0, holidays).routes();
  final tools = ToolsModule(app, timesheet)..routes();
  final devices = DevicesModule(app)..routes();
  if (config.testHooks) _testHooks(app, support, holidays, lookup, devices, tools);
  app.router.sort();
  if (!config.testHooks) {
    support.backfill().catchError((Object e) => 0);
  }
  return app;
}

/// Somente NODE_ENV=test: deixa os testes de contrato esperarem tarefas de fundo.
void _testHooks(App app, SupportProvisioning support, HolidaysService holidays, LookupService lookup, DevicesModule devices, ToolsModule tools) {
  app.router.post('/__test/drain', access: Access.public, status: 200, (ctx) async {
    await app.passwordReset.drain();
    return {'ok': true};
  });
  app.router.post('/__test/holidays-generate', access: Access.public, status: 200, (ctx) async => {'created': await holidays.generateYear(ctx.json['year']! as int)});
  app.router.post('/__test/holidays-ensure', access: Access.public, status: 200,
      (ctx) => holidays.ensureUpcoming(DateTime.parse(ctx.json['now']! as String)));
  app.router.post('/__test/lookup-stub', access: Access.public, status: 200, (ctx) {
    lookup.useStub(ctx.json['url']! as String);
    return {'ok': true};
  });
  app.router.post('/__test/device-check-offline', access: Access.public, status: 200, (ctx) async => {'offline': await devices.checkOffline()});
  app.router.post('/__test/live', access: Access.public, status: 200,
      (ctx) => tools.live(ctx.json['tenantId']! as String, (ctx.json['query']! as Map).cast<String, Object?>(), DateTime.parse(ctx.json['now']! as String)));
  app.router.post('/__test/notifications-tick', access: Access.public, status: 200, (ctx) async => {'sent': await tools.tick(DateTime.parse(ctx.json['now']! as String))});
  app.router.post('/__test/support-backfill', access: Access.public, status: 200, (ctx) async => {'created': await support.backfill()});
}
