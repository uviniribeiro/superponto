// Funcionários: pessoas e seus vínculos com as empresas, com detalhes, histórico, desligamento e reativação.
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/glass.dart';
import '../core/options.dart';
import '../core/tokens.dart';
import '../widgets/company_scope.dart';
import '../widgets/masked.dart';
import '../widgets/structure_options.dart';
import '../widgets/ui.dart';

const _field = {
  'departmentId': 'Departamento',
  'sectorId': 'Seção',
  'positionId': 'Cargo',
  'functionId': 'Função',
  'costCenterId': 'Centro de custo',
  'employeeTypeId': 'Tipo',
  'unionId': 'Sindicato',
  'unitId': 'Unidade',
  'contractType': 'Contrato',
  'weeklyHours': 'Carga semanal',
  'registration': 'Matrícula',
  'supervisorId': 'Superior',
};

String _doc(Object? v, bool cpf) {
  if (v == null) return '—';
  final s = '$v';
  return s.contains('*') ? s : (cpf ? fmtCpf(s) : fmtPis(s));
}

String _initials(String n) => n.split(RegExp(r'\s+')).where((p) => p.isNotEmpty).take(2).map((p) => p[0].toUpperCase()).join();

Color statusColor(BuildContext c, Object? s) => switch (s) {
  'ACTIVE' => c.sp.success,
  'ON_LEAVE' => c.sp.info,
  'SUSPENDED' => c.sp.warning,
  _ => c.sp.muted,
};

class EmployeesPage extends StatefulWidget {
  const EmployeesPage({super.key});
  @override
  State<EmployeesPage> createState() => _EmployeesPageState();
}

class _EmployeesPageState extends State<EmployeesPage> {
  String? _company;
  String _dept = '', _type = '', _pos = '', _group = '', _status = 'ACTIVE', _q = '';
  int _token = 0;
  late Future<StructureOptions> _opt = StructureOptions.load(null);

  @override
  Widget build(BuildContext context) {
    final canManage = api.can('people.employments:manage');
    final t = context.sp;
    return PageScaffold(
      title: 'Funcionários',
      subtitle: 'Pessoas e seus vínculos com as empresas da organização.',
      icon: Icons.groups_rounded,
      actions: [
        if (api.can('people.employments:import')) GlassButton(label: 'Importar planilha', icon: Icons.upload_file_rounded, kind: BtnKind.glass, onPressed: () => context.go('/funcionarios/importar')),
        if (canManage) GlassButton(label: 'Novo funcionário', icon: Icons.person_add_rounded, onPressed: () => _edit(null)),
      ],
      children: [
        FutureBuilder<StructureOptions>(
          future: _opt,
          builder: (context, s) {
            final o = s.data;
            return Wrap(
              spacing: 10,
              runSpacing: 10,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                FutureBuilder(
                  future: loadCompanies(),
                  builder: (_, cs) => Select<String>(
                    width: 240,
                    label: 'Empresa',
                    value: _company ?? '',
                    items: [('', 'Todas as empresas'), for (final c in cs.data ?? const <Map<String, dynamic>>[]) (c['id'] as String, companyName(c))],
                    onChanged: (v) => setState(() {
                      _company = v == '' ? null : v;
                      _dept = _pos = '';
                      _opt = StructureOptions.load(_company);
                    }),
                  ),
                ),
                if (_company != null && o != null) ...[
                  Select<String>(width: 220, label: 'Departamento', value: _dept, items: [('', 'Todos'), ...deptOpts(o.departments)], onChanged: (v) => setState(() => _dept = v ?? '')),
                  Select<String>(width: 200, label: 'Cargo', value: _pos, items: [('', 'Todos'), ...opts(o.positions)], onChanged: (v) => setState(() => _pos = v ?? '')),
                ],
                if (o != null && o.types.isNotEmpty)
                  Select<String>(width: 180, label: 'Tipo', value: _type, items: [('', 'Todos'), ...opts(o.types)], onChanged: (v) => setState(() => _type = v ?? '')),
                if (o != null && o.groupings.isNotEmpty)
                  Select<String>(width: 200, label: 'Agrupamento', value: _group, items: [('', 'Todos'), ...opts(o.groupings)], onChanged: (v) => setState(() => _group = v ?? '')),
                Select<String>(
                  width: 170,
                  label: 'Situação',
                  value: _status,
                  items: const [('ACTIVE', 'Ativos'), ('ON_LEAVE', 'Afastados'), ('TERMINATED', 'Desligados'), ('ALL', 'Todas')],
                  onChanged: (v) => setState(() => _status = v ?? 'ACTIVE'),
                ),
                SearchField(hint: 'Nome, matrícula ou CPF…', width: 260, onChanged: (v) => setState(() => _q = v)),
              ],
            );
          },
        ),
        const SizedBox(height: 14),
        Async<Map<String, dynamic>>(
          reloadToken: '$_company|$_dept|$_type|$_pos|$_group|$_status|$_q|$_token',
          load: () => api.getMap('/employees', {
            'pageSize': 200,
            'status': _status,
            'companyId': _company,
            'departmentId': _dept,
            'employeeTypeId': _type,
            'positionId': _pos,
            'groupingId': _group,
            'search': _q,
          }),
          builder: (context, page, _) {
            final rows = asList(page['data']);
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text('${page['total'] ?? rows.length} funcionário(s)', style: TextStyle(color: t.muted)),
                ),
                GlassTable<Map<String, dynamic>>(
                  rows: rows,
                  empty: EmptyState(
                    icon: Icons.groups_rounded,
                    title: _q.isEmpty ? 'Nenhum funcionário' : 'Nada encontrado',
                    body: _q.isEmpty ? 'Cadastre um funcionário ou importe uma planilha.' : 'Tente outro termo ou ajuste os filtros.',
                  ),
                  onTap: (e) => _view(e['id'] as String),
                  columns: [
                    Col(
                      'Nome',
                      (e) => Row(
                        children: [
                          CircleAvatar(
                            radius: 17,
                            backgroundColor: t.brand.withValues(alpha: 0.18),
                            child: Text(
                              _initials('${e['socialName'] ?? e['fullName']}'),
                              style: TextStyle(color: t.brand, fontWeight: FontWeight.w700, fontSize: 12),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  '${e['socialName'] ?? e['fullName']}',
                                  style: const TextStyle(fontWeight: FontWeight.w600),
                                  overflow: TextOverflow.ellipsis,
                                ),
                                Text('Matrícula ${e['registration']}', style: TextStyle(color: t.subtle, fontSize: 12)),
                              ],
                            ),
                          ),
                        ],
                      ),
                      flex: 4,
                      primary: true,
                    ),
                    Col(
                      'Lotação',
                      (e) => txt([asMap(e['department'])['name'], asMap(e['position'])['name']].whereType<String>().join(' · ').ifEmpty(companyName(asMap(e['company']))), muted: true),
                      flex: 4,
                    ),
                    Col('Documento', (e) => txt(e['cpf'] != null ? _doc(e['cpf'], true) : _doc(e['pis'], false), mono: true, muted: true), flex: 2),
                    Col('Situação', (e) => Pill(statusLabel[e['status']] ?? '${e['status']}', color: statusColor(context, e['status'])), flex: 2),
                  ],
                ),
              ],
            );
          },
        ),
      ],
    );
  }

  Future<void> _view(String id) async {
    await showGlassDialog<void>(
      context,
      title: 'Funcionário',
      width: 640,
      builder: (ctx) => _Detail(
        id: id,
        canManage: api.can('people.employments:manage'),
        onEdit: (d) {
          Navigator.pop(ctx);
          _edit(d);
        },
        onChanged: () => setState(() => _token++),
      ),
    );
  }

  Future<void> _edit(Map<String, dynamic>? e) async {
    final id = await showGlassDialog<String>(
      context,
      title: e == null ? 'Novo funcionário' : 'Editar funcionário',
      width: 780,
      builder: (_) => EmployeeForm(employee: e, defaultCompanyId: _company),
    );
    if (id != null && mounted) {
      setState(() => _token++);
      _view(id);
    }
  }
}

extension on String {
  String ifEmpty(String other) => isEmpty ? other : this;
}

class _Detail extends StatefulWidget {
  const _Detail({required this.id, required this.canManage, required this.onEdit, required this.onChanged});
  final String id;
  final bool canManage;
  final void Function(Map<String, dynamic>) onEdit;
  final VoidCallback onChanged;
  @override
  State<_Detail> createState() => _DetailState();
}

class _DetailState extends State<_Detail> {
  int _token = 0;
  bool _terminating = false;
  String _termDate = isoDate(todayBr());
  final _reason = TextEditingController();

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    return Async<Map<String, dynamic>>(
      reloadToken: _token,
      load: () => api.getMap('/employees/${widget.id}'),
      builder: (context, d, _) {
        Widget row(String k, Object? v) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 5),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                width: 140,
                child: Text(k, style: TextStyle(color: t.subtle, fontSize: 13)),
              ),
              Expanded(child: Text(v == null || '$v'.isEmpty ? '—' : '$v')),
            ],
          ),
        );
        final name = '${d['socialName'] ?? d['fullName']}';
        final terminated = d['status'] == 'TERMINATED';
        final addr = asMap(d['address']);
        final pos = asMap(d['position']);
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 26,
                  backgroundColor: t.brand,
                  child: Text(
                    _initials(name),
                    style: TextStyle(color: t.onBrand, fontWeight: FontWeight.w800),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                      Text('Matrícula ${d['registration']} · ${companyName(asMap(d['company']))}', style: TextStyle(color: t.muted)),
                    ],
                  ),
                ),
                Pill(statusLabel[d['status']] ?? '${d['status']}', color: statusColor(context, d['status'])),
              ],
            ),
            if (widget.canManage) ...[
              const SizedBox(height: 14),
              Wrap(
                spacing: 8,
                children: [
                  if (!terminated) GlassButton(label: 'Editar', icon: Icons.edit_rounded, kind: BtnKind.glass, small: true, onPressed: () => widget.onEdit(d)),
                  if (!terminated)
                    GlassButton(label: 'Desligar', icon: Icons.person_off_rounded, kind: BtnKind.danger, small: true, onPressed: () => setState(() => _terminating = !_terminating))
                  else
                    GlassButton(
                      label: 'Reativar',
                      icon: Icons.person_add_alt_1_rounded,
                      kind: BtnKind.glass,
                      small: true,
                      onPressed: () async {
                        if (await act(context, () => api.post('/employees/${widget.id}/reactivate'), success: 'Funcionário reativado')) {
                          setState(() => _token++);
                          widget.onChanged();
                        }
                      },
                    ),
                ],
              ),
            ],
            AnimatedSize(
              duration: const Duration(milliseconds: 200),
              child: !_terminating
                  ? const SizedBox(width: double.infinity)
                  : Glass(
                      margin: const EdgeInsets.only(top: 12),
                      tint: t.danger,
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          FormGrid(
                            children: [
                              DateField(label: 'Data do desligamento', value: _termDate, onChanged: (v) => setState(() => _termDate = v ?? _termDate)),
                              TextField(
                                controller: _reason,
                                decoration: const InputDecoration(labelText: 'Motivo', hintText: 'Ex.: pedido de demissão'),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Align(
                            alignment: Alignment.centerRight,
                            child: GlassButton(
                              label: 'Confirmar desligamento',
                              kind: BtnKind.danger,
                              onPressed: () async {
                                if (_reason.text.trim().length < 3) return toast(context, 'Informe o motivo (mínimo 3 caracteres)', error: true);
                                if (await act(
                                  context,
                                  () => api.post('/employees/${widget.id}/terminate', {'terminatedAt': _termDate, 'reason': _reason.text.trim()}),
                                  success: 'Funcionário desligado',
                                )) {
                                  setState(() {
                                    _terminating = false;
                                    _token++;
                                  });
                                  widget.onChanged();
                                }
                              },
                            ),
                          ),
                        ],
                      ),
                    ),
            ),
            const SizedBox(height: 18),
            const SectionTitle('Vínculo'),
            row('Admissão', brDate(d['hiredAt'])),
            if (d['terminatedAt'] != null) row('Desligamento', brDate(d['terminatedAt'])),
            row('Contrato', contractTypes.where((e) => e.$1 == d['contractType']).firstOrNull?.$2),
            row('Unidade', asMap(d['unit'])['name']),
            row('Departamento', [asMap(d['department'])['name'], asMap(d['sector'])['name']].whereType<String>().join(' › ')),
            row('Cargo', pos.isEmpty ? null : '${pos['name']}${pos['cbo'] != null ? ' (CBO ${pos['cbo']})' : ''}'),
            row('Função', asMap(d['function'])['name']),
            row('Tipo', asMap(d['employeeType'])['name']),
            row('Centro de custo', asMap(d['costCenter'])['name']),
            row('Sindicato', asMap(d['union'])['acronym']),
            row('Superior', asMap(d['supervisor'])['fullName']),
            row('Carga semanal', d['weeklyHours'] != null ? '${d['weeklyHours']} h' : null),
            const SizedBox(height: 14),
            const SectionTitle('Pessoa'),
            row('CPF', _doc(d['cpf'], true)),
            row('PIS', _doc(d['pis'], false)),
            row('Nascimento', brDate(d['birthDate'])),
            row('E-mail', d['email']),
            row('Telefone', d['phone'] == null ? null : maskPhone('${d['phone']}')),
            row('Endereço', addr.isEmpty ? null : [addr['street'], addr['number'], if (addr['city'] != null) '${addr['city']}/${addr['state']}'].whereType<Object>().join(', ')),
            if (asList(d['otherEmployments']).isNotEmpty) row('Outros vínculos', asList(d['otherEmployments']).map((o) => '${o['registration']} (${companyName(asMap(o['company']))})').join('; ')),
            const SizedBox(height: 14),
            const SectionTitle('Histórico'),
            if (asList(d['history']).isEmpty)
              Text('Sem alterações registradas.', style: TextStyle(color: t.subtle))
            else
              for (final h in asList(d['history']))
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Text.rich(
                    TextSpan(
                      children: [
                        TextSpan(
                          text: _field[h['field']] ?? '${h['field']}',
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                        TextSpan(
                          text: ' alterado a partir de ${brDate(h['effectiveAt'])}${h['reason'] != null ? ' — ${h['reason']}' : ''}',
                          style: TextStyle(color: t.muted),
                        ),
                      ],
                    ),
                  ),
                ),
          ],
        );
      },
    );
  }
}

/// Cadastro/edição: pessoa, endereço (pelo CEP) e vínculo com a estrutura.
class EmployeeForm extends StatefulWidget {
  const EmployeeForm({super.key, this.employee, this.defaultCompanyId});
  final Map<String, dynamic>? employee;
  final String? defaultCompanyId;
  @override
  State<EmployeeForm> createState() => _EmployeeFormState();
}

class _EmployeeFormState extends State<EmployeeForm> {
  Map<String, dynamic>? get e => widget.employee;
  bool get editing => e != null;
  bool get canSeeDocs => e == null || e!['sensitiveVisible'] == true;
  late final _c = <String, TextEditingController>{
    'fullName': TextEditingController(text: e?['fullName'] as String?),
    'socialName': TextEditingController(text: e?['socialName'] as String?),
    'cpf': TextEditingController(text: e?['cpf'] != null && canSeeDocs ? maskCpfInput('${e!['cpf']}') : ''),
    'pis': TextEditingController(text: e?['pis'] != null && canSeeDocs ? '${e!['pis']}' : ''),
    'email': TextEditingController(text: e?['email'] as String?),
    'phone': TextEditingController(text: e?['phone'] != null ? maskPhone('${e!['phone']}') : ''),
    'zipCode': TextEditingController(text: asMap(e?['address'])['zipCode'] != null ? maskCep('${asMap(e?['address'])['zipCode']}') : ''),
    'street': TextEditingController(text: asMap(e?['address'])['street'] as String?),
    'number': TextEditingController(text: asMap(e?['address'])['number'] as String?),
    'complement': TextEditingController(text: asMap(e?['address'])['complement'] as String?),
    'district': TextEditingController(text: asMap(e?['address'])['district'] as String?),
    'city': TextEditingController(text: asMap(e?['address'])['city'] as String?),
    'state': TextEditingController(text: asMap(e?['address'])['state'] as String?),
    'registration': TextEditingController(text: e?['registration'] as String?),
    'weeklyHours': TextEditingController(text: e?['weeklyHours'] != null ? '${e!['weeklyHours']}' : ''),
    'reason': TextEditingController(),
  };
  late String _ibge = '${asMap(e?['address'])['ibge'] ?? ''}';
  late String? _birth = e?['birthDate'] as String?;
  late String? _hired = e?['hiredAt'] as String?;
  String _effective = isoDate(todayBr());
  late String _company = (asMap(e?['company'])['id'] ?? widget.defaultCompanyId ?? '') as String;
  late String _contract = e?['contractType'] as String? ?? 'CLT';
  late final _refs = <String, String>{
    for (final k in ['unit', 'department', 'sector', 'position', 'function', 'costCenter', 'employeeType', 'union', 'supervisor']) '${k}Id': '${asMap(e?[k])['id'] ?? ''}',
  };
  Future<StructureOptions>? _opt;
  Future<List<Map<String, dynamic>>>? _peers;
  final _errors = <String, String>{};
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _reload();
  }

  void _reload() {
    _opt = StructureOptions.load(_company.isEmpty ? null : _company);
    _peers = _company.isEmpty ? Future.value(const []) : api.getList('/employees', {'companyId': _company, 'pageSize': 200});
  }

  Future<void> _cep(String v) async {
    final d = digits(v);
    if (d.length != 8) return;
    try {
      final a = await api.getMap('/lookup/cep/$d');
      setState(() {
        if ('${a['street'] ?? ''}'.isNotEmpty) _c['street']!.text = '${a['street']}';
        if ('${a['district'] ?? ''}'.isNotEmpty) _c['district']!.text = '${a['district']}';
        _c['city']!.text = '${a['city'] ?? ''}';
        _c['state']!.text = '${a['uf'] ?? ''}';
        _ibge = '${a['ibge'] ?? ''}';
      });
    } catch (_) {}
  }

  Future<void> _save() async {
    String v(String k) => _c[k]!.text.trim();
    _errors.clear();
    if (v('fullName').length < 3) _errors['fullName'] = 'Informe o nome completo';
    if (canSeeDocs) {
      if (v('cpf').isNotEmpty && !validCpf(v('cpf'))) _errors['cpf'] = 'CPF inválido';
      if (v('pis').isNotEmpty && !validPis(v('pis'))) _errors['pis'] = 'PIS inválido';
      if (!editing && v('cpf').isEmpty && v('pis').isEmpty) _errors['cpf'] = 'Informe o CPF ou o PIS';
    }
    if (v('registration').isEmpty) _errors['registration'] = 'Informe a matrícula';
    if (!editing && _hired == null) _errors['hiredAt'] = 'Informe a admissão';
    if (!editing && _company.isEmpty) _errors['companyId'] = 'Escolha a empresa';
    setState(() {});
    if (_errors.isNotEmpty) return toast(context, _errors.values.first, error: true);
    Object? val(String s) => s.isNotEmpty ? s : (editing ? null : _absent);
    final hasAddr = v('zipCode').isNotEmpty || v('street').isNotEmpty || v('city').isNotEmpty;
    final address = hasAddr
        ? ({
            'zipCode': digits(v('zipCode')),
            'street': v('street'),
            'number': v('number'),
            'complement': v('complement'),
            'district': v('district'),
            'city': v('city'),
            'state': v('state').toUpperCase(),
            'ibge': _ibge,
          }..removeWhere((k, x) => x.isEmpty))
        : (editing ? null : _absent);
    final body = <String, Object?>{
      'fullName': v('fullName'),
      'socialName': val(v('socialName')),
      'birthDate': val(_birth ?? ''),
      'email': val(v('email')),
      'phone': val(digits(v('phone'))),
      'address': address,
      'registration': v('registration'),
      'contractType': _contract,
      'weeklyHours': v('weeklyHours').isNotEmpty ? num.tryParse(v('weeklyHours').replaceAll(',', '.')) : (editing ? null : _absent),
      for (final r in _refs.entries) r.key: val(r.value),
    };
    if (canSeeDocs) {
      body['cpf'] = val(digits(v('cpf')));
      body['pis'] = val(digits(v('pis')));
    }
    if (editing) {
      body['effectiveAt'] = _effective;
      if (v('reason').isNotEmpty) body['reason'] = v('reason');
    } else {
      body['companyId'] = _company;
      body['hiredAt'] = _hired;
    }
    body.removeWhere((k, x) => identical(x, _absent));
    setState(() => _busy = true);
    final r = await run(context, () => editing ? api.patch('/employees/${e!['id']}', body) : api.post('/employees', body), success: editing ? 'Funcionário atualizado' : 'Funcionário cadastrado');
    if (!mounted) return;
    setState(() => _busy = false);
    if (r != null) Navigator.pop(context, asMap(r)['id'] as String? ?? e?['id'] as String?);
  }

  TextField _f(String k, String label, {String? hint, List<TextInputFormatter>? fmt, TextInputType? kb, ValueChanged<String>? onChanged}) => TextField(
    controller: _c[k],
    inputFormatters: fmt,
    keyboardType: kb,
    onChanged: onChanged,
    decoration: InputDecoration(labelText: label, helperText: hint, errorText: _errors[k]),
  );

  Widget _ref(String key, String label, List<(String, String)> items, {String empty = '—', ValueChanged<String>? after}) => Select<String>(
    label: label,
    value: _refs[key] ?? '',
    items: [('', empty), ...items],
    onChanged: (v) => setState(() {
      _refs[key] = v ?? '';
      after?.call(v ?? '');
    }),
  );

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SectionTitle('Pessoa'),
        FormGrid(
          children: [
            FullWidth(_f('fullName', 'Nome completo *')),
            FullWidth(_f('socialName', 'Nome social', hint: 'Usado nas telas e relatórios quando preenchido')),
            if (canSeeDocs) ...[
              _f('cpf', 'CPF', hint: 'Relógios da Portaria 671 usam o CPF', fmt: [MaskFormatter(maskCpfInput)], kb: TextInputType.number),
              _f('pis', 'PIS/PASEP', hint: 'Relógios da Portaria 1.510 usam o PIS', fmt: digitsOnly(11), kb: TextInputType.number),
            ] else
              FullWidth(Text('CPF ${e?['cpf'] ?? '—'} · PIS ${e?['pis'] ?? '—'} (sem permissão para ver ou alterar dados sensíveis)', style: TextStyle(color: t.subtle))),
            DateField(label: 'Nascimento', value: _birth, clearable: true, onChanged: (v) => setState(() => _birth = v)),
            _f('phone', 'Telefone', fmt: [MaskFormatter(maskPhone)], kb: TextInputType.phone),
            FullWidth(_f('email', 'E-mail', kb: TextInputType.emailAddress)),
          ],
        ),
        const SizedBox(height: 20),
        const SectionTitle('Endereço'),
        FormGrid(
          children: [
            _f('zipCode', 'CEP', hint: 'O endereço é preenchido pelo CEP', fmt: [MaskFormatter(maskCep)], kb: TextInputType.number, onChanged: _cep),
            _f('number', 'Número'),
            FullWidth(_f('street', 'Logradouro')),
            _f('district', 'Bairro'),
            _f('complement', 'Complemento'),
            _f('city', 'Cidade'),
            _f('state', 'UF', fmt: [LengthLimitingTextInputFormatter(2)]),
          ],
        ),
        const SizedBox(height: 20),
        const SectionTitle('Vínculo'),
        FutureBuilder<StructureOptions>(
          future: _opt,
          builder: (context, s) {
            final o = s.data;
            final sectors = o == null ? const <Map<String, dynamic>>[] : asList(o.departments.where((d) => d['id'] == _refs['departmentId']).firstOrNull?['sectors']);
            return FormGrid(
              children: [
                if (!editing)
                  FullWidth(
                    FutureBuilder(
                      future: loadCompanies(),
                      builder: (_, cs) => Select<String>(
                        label: 'Empresa *',
                        value: _company,
                        items: [('', 'Escolha a empresa'), for (final c in cs.data ?? const <Map<String, dynamic>>[]) (c['id'] as String, companyName(c))],
                        onChanged: (v) => setState(() {
                          _company = v ?? '';
                          for (final k in ['unitId', 'departmentId', 'sectorId', 'positionId', 'supervisorId']) {
                            _refs[k] = '';
                          }
                          _reload();
                        }),
                      ),
                    ),
                  ),
                _f('registration', 'Matrícula *'),
                if (editing)
                  TextField(
                    enabled: false,
                    controller: TextEditingController(text: brDate(_hired)),
                    decoration: const InputDecoration(labelText: 'Admissão'),
                  )
                else
                  DateField(label: 'Admissão *', value: _hired, onChanged: (v) => setState(() => _hired = v)),
                _f('weeklyHours', 'Carga semanal (h)', kb: const TextInputType.numberWithOptions(decimal: true), fmt: [FilteringTextInputFormatter.allow(RegExp(r'[\d,.]'))]),
                Select<String>(label: 'Tipo de contrato', value: _contract, items: contractTypes, onChanged: (v) => setState(() => _contract = v ?? 'CLT')),
                if (o != null) ...[
                  _ref('employeeTypeId', 'Tipo de funcionário', opts(o.types)),
                  _ref('unitId', 'Unidade / local de trabalho', opts(o.units), empty: o.units.isEmpty ? 'Nenhuma unidade cadastrada' : '—'),
                  _ref('departmentId', 'Departamento', deptOpts(o.departments), after: (_) => _refs['sectorId'] = ''),
                  _ref('sectorId', 'Seção', opts(sectors), empty: sectors.isEmpty ? 'Sem seções' : '—'),
                  _ref('positionId', 'Cargo', opts(o.positions)),
                  _ref('functionId', 'Função', opts(o.functions)),
                  _ref('costCenterId', 'Centro de custo', opts(o.costCenters)),
                  _ref('unionId', 'Sindicato', [for (final u in o.unions) (u['id'] as String, '${u['acronym']} — ${u['name']}')]),
                  FullWidth(
                    FutureBuilder(
                      future: _peers,
                      builder: (_, ps) => _ref('supervisorId', 'Superior imediato', [
                        for (final p in ps.data ?? const <Map<String, dynamic>>[])
                          if (p['id'] != e?['id']) (p['id'] as String, '${p['socialName'] ?? p['fullName']} · ${p['registration']}'),
                      ]),
                    ),
                  ),
                ] else
                  const FullWidth(Loading(height: 60)),
              ],
            );
          },
        ),
        if (editing) ...[
          const SizedBox(height: 20),
          const SectionTitle('Vigência da alteração'),
          FormGrid(
            children: [
              DateField(label: 'Vale a partir de', value: _effective, onChanged: (v) => setState(() => _effective = v ?? _effective)),
              _f('reason', 'Motivo', hint: 'Vai para o histórico do vínculo'),
            ],
          ),
        ],
        const SizedBox(height: 24),
        Align(
          alignment: Alignment.centerRight,
          child: GlassButton(label: editing ? 'Salvar alterações' : 'Cadastrar funcionário', icon: Icons.check_rounded, loading: _busy, onPressed: _save),
        ),
      ],
    );
  }
}

const _absent = Object();
