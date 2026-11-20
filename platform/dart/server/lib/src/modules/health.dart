// /health e documentação OpenAPI.
import '../app.dart';
import '../db.dart';
import '../http.dart';

void healthRoutes(App app) {
  final r = app.router;
  r.get('/health', access: Access.public, (ctx) async {
    try {
      await app.db.plain((tx) => tx.query('SELECT 1'));
      return {'status': 'ok', 'database': 'ok', 'time': isoMs(DateTime.now())};
    } catch (_) {
      throw HttpError.body(503, {'status': 'degraded', 'database': 'unreachable'});
    }
  });
  r.get('/docs-json', access: Access.public, (ctx) => app.router.openApi());
}
