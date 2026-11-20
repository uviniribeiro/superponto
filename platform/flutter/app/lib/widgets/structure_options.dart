// Opções da estrutura (para filtros e formulários): unidades, departamentos, cargos, funções, centros de custo, tipos, sindicatos, agrupamentos.
import '../core/api.dart';

class StructureOptions {
  StructureOptions(this.units, this.departments, this.positions, this.functions, this.costCenters, this.types, this.unions, this.groupings);
  final List<Map<String, dynamic>> units, departments, positions, functions, costCenters, types, unions, groupings;

  static final _memo = <String, (DateTime, Future<StructureOptions>)>{};

  /// Mesma consulta reaproveitada por 60 s (evita recarregar a cada redesenho da tela).
  static Future<StructureOptions> cached(String? companyId) {
    final k = '${api.activeTenant}|$companyId';
    final hit = _memo[k];
    if (hit != null && DateTime.now().difference(hit.$1).inSeconds < 60) return hit.$2;
    final f = load(companyId);
    _memo[k] = (DateTime.now(), f);
    return f;
  }

  static Future<StructureOptions> load(String? companyId) async {
    Future<List<Map<String, dynamic>>> safe(String path, [Map<String, Object?>? q]) async {
      try {
        return (await api.getList(path, {'pageSize': 200, ...?q})).where((r) => r['active'] != false).toList();
      } catch (_) {
        return const [];
      }
    }

    final none = Future.value(const <Map<String, dynamic>>[]);
    final r = await Future.wait([
      companyId == null ? none : safe('/units', {'companyId': companyId}),
      companyId == null ? none : safe('/departments', {'companyId': companyId}),
      companyId == null ? none : safe('/job-positions', {'companyId': companyId}),
      safe('/job-functions'),
      safe('/cost-centers'),
      safe('/employee-types'),
      safe('/labor-unions'),
      safe('/groupings'),
    ]);
    return StructureOptions(r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7]);
  }
}

List<(String, String)> opts(List<Map<String, dynamic>> rows) => [for (final r in rows) (r['id'] as String, '${r['name']}')];
List<(String, String)> deptOpts(List<Map<String, dynamic>> rows) => [for (final r in rows) (r['id'] as String, '${'   ' * ((r['depth'] as num?)?.toInt() ?? 0)}${r['name']}')];
