/// Servidor da API SuperPonto em Dart.
library;

import 'src/app.dart';
import 'src/config.dart';
import 'src/http.dart';
import 'src/modules/auth_routes.dart';
import 'src/modules/companies.dart';
import 'src/modules/health.dart';
import 'src/modules/platform_tenants.dart';

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
  if (config.testHooks) _testHooks(app);
  app.router.sort();
  if (!config.testHooks) {
    support.backfill().catchError((Object e) => 0);
  }
  return app;
}

/// Somente NODE_ENV=test: deixa os testes de contrato esperarem tarefas de fundo.
void _testHooks(App app) {
  app.router.post('/__test/drain', access: Access.public, status: 200, (ctx) async {
    await app.passwordReset.drain();
    return {'ok': true};
  });
}
