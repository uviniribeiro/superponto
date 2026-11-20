// Unidades e funcionários de uma empresa (para os módulos especializados).
import '../core/api.dart';

class CompanyOptions {
  CompanyOptions(this.units, this.employees);
  final List<(String, String)> units, employees;

  static Future<CompanyOptions> load(String companyId) async {
    final r = await Future.wait([
      api.getList('/units', {'companyId': companyId, 'pageSize': 200}).catchError((_) => <Map<String, dynamic>>[]),
      api.getList('/employees', {'companyId': companyId, 'pageSize': 200}).catchError((_) => <Map<String, dynamic>>[]),
    ]);
    return CompanyOptions([for (final u in r[0]) (u['id'] as String, '${u['name']}')], [for (final e in r[1]) (e['id'] as String, '${e['socialName'] ?? e['fullName']} · ${e['registration']}')]);
  }
}
