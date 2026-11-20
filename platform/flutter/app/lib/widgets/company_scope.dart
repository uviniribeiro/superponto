// Escolha da empresa (muitas telas trabalham por empresa). Lembra a última escolhida durante a sessão.
import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import 'ui.dart';

String? _lastCompany;
List<Map<String, dynamic>>? _cache;
String? _cacheTenant;

Future<List<Map<String, dynamic>>> loadCompanies({bool force = false}) async {
  if (!force && _cache != null && _cacheTenant == api.activeTenant) return _cache!;
  _cache = await api.getList('/companies', {'pageSize': 200});
  _cacheTenant = api.activeTenant;
  return _cache!;
}

void invalidateCompanies() => _cache = null;

String companyName(Map<String, dynamic> c) => (c['tradeName'] as String?)?.isNotEmpty == true ? c['tradeName'] as String : '${c['legalName'] ?? ''}';

/// Carrega as empresas e entrega a escolhida ao `builder`. Sem empresas, mostra o aviso para cadastrar.
class CompanyScope extends StatefulWidget {
  const CompanyScope({super.key, required this.builder, this.allowAll = false});
  final Widget Function(BuildContext context, String? companyId, Widget picker) builder;
  final bool allowAll;
  @override
  State<CompanyScope> createState() => _CompanyScopeState();
}

class _CompanyScopeState extends State<CompanyScope> {
  String? _id = _lastCompany;
  @override
  Widget build(BuildContext context) => Async<List<Map<String, dynamic>>>(
    load: loadCompanies,
    builder: (context, list, _) {
      if (list.isEmpty) {
        return const EmptyState(icon: Icons.business_rounded, title: 'Nenhuma empresa cadastrada', body: 'Cadastre a empresa em Organização › Empresas para usar esta tela.');
      }
      if (_id != null && !list.any((c) => c['id'] == _id)) _id = null;
      if (_id == null && !widget.allowAll) _id = list.first['id'] as String;
      _lastCompany = _id ?? _lastCompany;
      final picker = Select<String?>(
        width: isWide(context) ? 300 : double.infinity,
        label: 'Empresa',
        value: _id,
        items: [if (widget.allowAll) (null, 'Todas as empresas'), for (final c in list) (c['id'] as String, companyName(c))],
        onChanged: (v) => setState(() => _lastCompany = _id = v),
      );
      return widget.builder(context, _id, picker);
    },
  );
}
