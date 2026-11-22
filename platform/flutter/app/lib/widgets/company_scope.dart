// Escolha da empresa (muitas telas trabalham por empresa). Lembra a última escolhida durante a sessão.
import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/format.dart';
import 'ui.dart';

String? _lastCompany;
List<Map<String, dynamic>>? _cache;
String? _cacheTenant;
String? _cacheUser;

Future<List<Map<String, dynamic>>> loadCompanies({bool force = false}) async {
  // Outra pessoa entrou: volta a abrir no CNPJ do login dela.
  if (_cacheUser != api.me?.id) {
    _cacheUser = api.me?.id;
    _lastCompany = null;
    _cache = null;
  }
  if (!force && _cache != null && _cacheTenant == api.activeTenant) return _cache!;
  _cache = await api.getList('/companies', {'pageSize': 200});
  _cacheTenant = api.activeTenant;
  return _cache!;
}

void invalidateCompanies() => _cache = null;

/// Empresa do CNPJ usado no login (como na v1: entra-se pelo CNPJ e o sistema abre naquele CNPJ).
String? _loginCompany(List<Map<String, dynamic>> list) {
  final cnpj = api.lastLoginMode == 'email' ? '' : api.lastLoginCnpj.toUpperCase().replaceAll(RegExp('[^0-9A-Z]'), '');
  if (cnpj.isEmpty) return null;
  for (final c in list) {
    if ('${c['cnpj'] ?? ''}'.toUpperCase() == cnpj) return c['id'] as String;
  }
  return null;
}

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
      // Primeira vez na sessão: abre no CNPJ do login.
      if (_id == null && _lastCompany == null) _id = _loginCompany(list);
      if (_id == null && !widget.allowAll) _id = list.first['id'] as String;
      _lastCompany = _id ?? _lastCompany;
      // Um CNPJ só no cliente: nada para escolher. Mais de um: escolhe por CNPJ.
      final Widget picker = list.length == 1 && !widget.allowAll
          ? const SizedBox.shrink()
          : Select<String?>(
              width: isWide(context) ? 340 : double.infinity,
              label: 'Empresa (CNPJ)',
              value: _id,
              items: [if (widget.allowAll) (null, 'Todos os CNPJs'), for (final c in list) (c['id'] as String, c['cnpj'] != null ? '${companyName(c)} · ${fmtCnpj(c['cnpj'])}' : companyName(c))],
              onChanged: (v) => setState(() => _lastCompany = _id = v),
            );
      return widget.builder(context, _id, picker);
    },
  );
}
