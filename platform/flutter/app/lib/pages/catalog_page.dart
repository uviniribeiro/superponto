// Cadastros simples da estrutura (cargos, funções, centros de custo, sindicatos, competências, unidades…), por definição.
import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/glass.dart';
import '../core/tokens.dart';
import '../widgets/company_scope.dart';
import '../widgets/ui.dart';

enum FType { text, date, cnpj, select, active }

class CField {
  const CField(this.key, this.label, this.type, {this.required = false, this.max, this.hint, this.placeholder, this.options = const [], this.empty, this.numeric = false});
  final String key, label;
  final FType type;
  final bool required, numeric;
  final int? max;
  final String? hint, placeholder, empty;
  final List<(String, String)> options;
}

typedef RowFn = String? Function(Map<String, dynamic>);

class CatalogDef {
  const CatalogDef({
    required this.title,
    required this.singular,
    required this.path,
    required this.icon,
    required this.description,
    required this.readPermission,
    required this.managePermission,
    required this.fields,
    this.feminine = false,
    this.companyScoped = false,
    this.subtitle,
    this.badge,
    this.extra,
  });
  final String title, singular, path, description, readPermission, managePermission;
  final IconData icon;
  final List<CField> fields;
  final bool feminine, companyScoped;
  final RowFn? subtitle, badge;

  /// ação extra por linha (ex.: setores do departamento, membros do agrupamento)
  final List<Widget> Function(BuildContext, Map<String, dynamic> row, bool canManage, VoidCallback reload)? extra;
}

const _monthNames = months;
String? _code(Map<String, dynamic> r) => r['code'] != null ? 'Código ${r['code']}' : 'Sem código';

const simpleFields = [
  CField('name', 'Descrição', FType.text, required: true, max: 120),
  CField('code', 'Código', FType.text, max: 20, hint: 'Opcional; usado na exportação para a folha'),
  CField('active', 'Ativo', FType.active),
];

const unitTypes = [
  ('HEADQUARTERS', 'Matriz / sede'),
  ('BRANCH', 'Filial'),
  ('OFFICE', 'Escritório'),
  ('SCHOOL', 'Escola'),
  ('HOSPITAL', 'Hospital'),
  ('CLINIC', 'Clínica'),
  ('UPA', 'UPA'),
  ('UBS', 'UBS'),
  ('LABORATORY', 'Laboratório'),
  ('OPERATIONAL_SITE', 'Base operacional'),
  ('OTHER', 'Outro'),
];

final functionsDef = CatalogDef(
  title: 'Funções',
  singular: 'Função',
  feminine: true,
  path: 'job-functions',
  icon: Icons.verified_rounded,
  description: 'O que a pessoa faz no dia a dia, independente do cargo (ex.: recepcionista num cargo de auxiliar administrativo).',
  readPermission: 'org.functions:read',
  managePermission: 'org.functions:manage',
  fields: simpleFields,
  subtitle: _code,
);
final costCentersDef = CatalogDef(
  title: 'Centros de custo',
  singular: 'Centro de custo',
  path: 'cost-centers',
  icon: Icons.account_balance_wallet_rounded,
  description: 'Agrupam a folha e as horas por área de despesa; vão na exportação para a folha de pagamento.',
  readPermission: 'org.costcenters:read',
  managePermission: 'org.costcenters:manage',
  fields: simpleFields,
  subtitle: _code,
);
final employeeTypesDef = CatalogDef(
  title: 'Tipos de funcionário',
  singular: 'Tipo de funcionário',
  path: 'employee-types',
  icon: Icons.sell_rounded,
  description: 'Classificação usada em filtros, relatórios e cálculo em lote (efetivo, comissionado, contratado, estagiário…).',
  readPermission: 'org.employeetypes:read',
  managePermission: 'org.employeetypes:manage',
  fields: simpleFields,
  subtitle: _code,
);
final unionsDef = CatalogDef(
  title: 'Sindicatos',
  singular: 'Sindicato',
  path: 'labor-unions',
  icon: Icons.account_balance_rounded,
  description: 'Entidades sindicais das categorias; a data-base orienta o reajuste e as regras da convenção.',
  readPermission: 'org.unions:read',
  managePermission: 'org.unions:manage',
  fields: [
    const CField('name', 'Nome', FType.text, required: true, max: 120),
    const CField('acronym', 'Sigla', FType.text, required: true, max: 20),
    const CField('cnpj', 'CNPJ', FType.cnpj),
    const CField('entityType', 'Tipo de entidade', FType.select, options: [('SINDICATO', 'Sindicato'), ('FEDERACAO', 'Federação'), ('CONFEDERACAO', 'Confederação'), ('CENTRAL', 'Central sindical')]),
    const CField('side', 'Representa', FType.select, options: [('EMPREGADOS', 'Empregados'), ('EMPREGADORES', 'Empregadores')]),
    CField('baseMonth', 'Data-base (mês)', FType.select, empty: 'Não informada', numeric: true, options: [for (var i = 0; i < 12; i++) ('${i + 1}', _monthNames[i])]),
    const CField('code', 'Código', FType.text, max: 20),
    const CField('active', 'Ativo', FType.active),
  ],
  subtitle: (r) =>
      [r['acronym'], r['cnpj'] != null ? fmtCnpj(r['cnpj']) : null, r['baseMonth'] != null ? 'data-base ${_monthNames[(r['baseMonth'] as num).toInt() - 1]}' : null].whereType<Object>().join(' · '),
  badge: (r) => r['side'] == 'EMPREGADORES' ? 'Patronal' : 'Laboral',
);
final competencesDef = CatalogDef(
  title: 'Competências',
  singular: 'Competência',
  feminine: true,
  path: 'competences',
  icon: Icons.date_range_rounded,
  description: 'Períodos com nome (ex.: "Janeiro/2027", "1º trimestre") para filtrar espelho, relatórios e cálculo em lote.',
  readPermission: 'org.competences:read',
  managePermission: 'org.competences:manage',
  fields: const [
    CField('name', 'Descrição', FType.text, required: true, max: 120, placeholder: 'Ex.: Janeiro/2027'),
    CField('startsOn', 'Data inicial', FType.date, required: true),
    CField('endsOn', 'Data final', FType.date, required: true),
  ],
  subtitle: (r) => '${brDate(r['startsOn'])} a ${brDate(r['endsOn'])}',
);
const _categories = [
  ('GENERAL', 'Geral'),
  ('TEACHER', 'Professor'),
  ('PHYSICIAN', 'Médico'),
  ('NURSE', 'Enfermeiro'),
  ('NURSING_TECHNICIAN', 'Técnico de enfermagem'),
  ('NURSING_ASSISTANT', 'Auxiliar de enfermagem'),
  ('PHYSIOTHERAPIST', 'Fisioterapeuta'),
  ('PSYCHOLOGIST', 'Psicólogo'),
  ('PHARMACIST', 'Farmacêutico'),
  ('DENTIST', 'Dentista'),
  ('NUTRITIONIST', 'Nutricionista'),
  ('SOCIAL_WORKER', 'Assistente social'),
  ('OTHER_HEALTH', 'Outro profissional da saúde'),
];
final positionsDef = CatalogDef(
  title: 'Cargos',
  singular: 'Cargo',
  path: 'job-positions',
  icon: Icons.work_rounded,
  companyScoped: true,
  description: 'Cargos de cada empresa, com o código CBO usado no eSocial.',
  readPermission: 'org.positions:read',
  managePermission: 'org.positions:manage',
  fields: const [
    CField('name', 'Descrição', FType.text, required: true, max: 120),
    CField('cbo', 'CBO', FType.text, max: 7, placeholder: '0000-00', hint: 'Classificação Brasileira de Ocupações'),
    CField('category', 'Categoria profissional', FType.select, options: _categories),
  ],
  subtitle: (r) {
    final c = '${r['cbo'] ?? ''}';
    return c.isEmpty ? 'Sem CBO' : 'CBO ${c.length == 6 ? '${c.substring(0, 4)}-${c.substring(4)}' : c}';
  },
  badge: (r) => r['category'] == null || r['category'] == 'GENERAL' ? null : _categories.where((e) => e.$1 == r['category']).firstOrNull?.$2,
);
final unitsDef = CatalogDef(
  title: 'Unidades e locais',
  singular: 'Unidade',
  feminine: true,
  path: 'units',
  icon: Icons.place_rounded,
  companyScoped: true,
  description: 'Locais de trabalho de cada empresa (filial, escola, UBS…). A cerca virtual (coordenadas e raio) é usada pelo app de ponto.',
  readPermission: 'org.units:read',
  managePermission: 'org.units:manage',
  fields: const [
    CField('name', 'Nome', FType.text, required: true, max: 120),
    CField('type', 'Tipo', FType.select, options: unitTypes),
    CField('code', 'Código', FType.text, max: 20, hint: 'Opcional; usado na exportação e nas integrações'),
    CField('cnpj', 'CNPJ (se tiver próprio)', FType.cnpj),
    CField('latitude', 'Latitude', FType.text, max: 14, placeholder: '-19.9191'),
    CField('longitude', 'Longitude', FType.text, max: 14, placeholder: '-43.9386'),
    CField('geofenceM', 'Raio da cerca (metros)', FType.text, max: 5, placeholder: '150', hint: 'Entre 20 e 5.000 m; deixe vazio para não usar cerca'),
  ],
  subtitle: (r) => [
    unitTypes.where((e) => e.$1 == r['type']).firstOrNull?.$2,
    r['code'] != null ? 'código ${r['code']}' : null,
    r['cnpj'] != null ? fmtCnpj(r['cnpj']) : null,
    r['geofenceM'] != null ? 'cerca de ${r['geofenceM']} m' : null,
  ].whereType<String>().join(' · '),
);

class CatalogPage extends StatefulWidget {
  const CatalogPage({super.key, required this.def});
  final CatalogDef def;
  @override
  State<CatalogPage> createState() => _CatalogPageState();
}

class _CatalogPageState extends State<CatalogPage> {
  String _q = '';
  int _token = 0;

  @override
  Widget build(BuildContext context) {
    final d = widget.def;
    final canManage = api.can(d.managePermission);
    Widget list(String? companyId, Widget? picker) => Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Wrap(
          spacing: 12,
          runSpacing: 12,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            ?picker,
            SearchField(onChanged: (v) => setState(() => _q = v)),
          ],
        ),
        const SizedBox(height: 14),
        Async<List<Map<String, dynamic>>>(
          reloadToken: '$companyId|$_q|$_token',
          load: () => api.getList('/${d.path}', {'pageSize': 200, if (d.companyScoped) 'companyId': companyId, 'search': _q}),
          builder: (context, rows, reload) => GlassTable<Map<String, dynamic>>(
            rows: rows,
            empty: EmptyState(icon: d.icon, title: _q.isEmpty ? 'Nenhum registro ainda' : 'Nada encontrado', body: _q.isEmpty && canManage ? 'Use "Novo" para cadastrar.' : null),
            onTap: canManage ? (r) => _edit(r, companyId) : null,
            columns: [
              Col(
                d.singular,
                (r) => Row(
                  children: [
                    Flexible(child: txt(r['name'], bold: true)),
                    if (r['active'] == false) ...[const SizedBox(width: 8), const Pill('Inativo')],
                  ],
                ),
                flex: 3,
                primary: true,
              ),
              if (d.subtitle != null) Col('Detalhes', (r) => txt(d.subtitle!(r), muted: true), flex: 3),
              if (d.badge != null) Col('', (r) => d.badge!(r) == null ? const SizedBox() : Pill(d.badge!(r)!, color: context.sp.info), flex: 1),
              Col('Em uso', (r) => txt((r['inUse'] as num? ?? 0) > 0 ? '${r['inUse']}' : '—', muted: true), flex: 1, numeric: true),
            ],
            actions: (r) => [
              ...?d.extra?.call(context, r, canManage, () => setState(() => _token++)),
              if (canManage) RowAction(Icons.delete_outline_rounded, 'Excluir', () => _remove(r), danger: true),
            ],
          ),
        ),
      ],
    );
    return PageScaffold(
      title: d.title,
      subtitle: d.description,
      icon: d.icon,
      actions: const [],
      children: [
        if (d.companyScoped)
          CompanyScope(
            builder: (context, companyId, picker) => Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (canManage)
                  Align(
                    alignment: Alignment.centerRight,
                    child: GlassButton(label: 'Novo', icon: Icons.add_rounded, onPressed: () => _edit(null, companyId)),
                  ),
                const SizedBox(height: 8),
                list(companyId, picker),
              ],
            ),
          )
        else ...[
          if (canManage)
            Align(
              alignment: Alignment.centerRight,
              child: GlassButton(label: 'Novo', icon: Icons.add_rounded, onPressed: () => _edit(null, null)),
            ),
          const SizedBox(height: 8),
          list(null, null),
        ],
      ],
    );
  }

  Future<void> _remove(Map<String, dynamic> r) async {
    final d = widget.def;
    final a = d.feminine ? 'a' : 'o';
    if ((r['inUse'] as num? ?? 0) > 0) {
      toast(context, '"${r['name']}" está em uso e não pode ser excluíd$a; desative em vez de excluir.', error: true);
      return;
    }
    if (!await confirm(context, title: 'Excluir ${d.singular.toLowerCase()}?', body: '"${r['name']}" deixa de aparecer nas listas. O histórico fica na auditoria.', confirmLabel: 'Excluir')) return;
    if (!mounted) return;
    if (await act(context, () => api.delete('/${d.path}/${r['id']}'), success: '${d.singular} excluíd$a') && mounted) setState(() => _token++);
  }

  Future<void> _edit(Map<String, dynamic>? row, String? companyId) async {
    final d = widget.def;
    final saved = await showGlassDialog<bool>(
      context,
      title: row == null ? 'Novo: ${d.singular.toLowerCase()}' : 'Editar ${d.singular.toLowerCase()}',
      builder: (ctx) => _CatalogForm(def: d, row: row, companyId: companyId),
    );
    if (saved == true && mounted) setState(() => _token++);
  }
}

class _CatalogForm extends StatefulWidget {
  const _CatalogForm({required this.def, this.row, this.companyId});
  final CatalogDef def;
  final Map<String, dynamic>? row;
  final String? companyId;
  @override
  State<_CatalogForm> createState() => _CatalogFormState();
}

class _CatalogFormState extends State<_CatalogForm> {
  late final Map<String, Object?> _v = {
    for (final f in widget.def.fields)
      f.key: switch (f.type) {
        FType.active => widget.row == null ? true : widget.row!['active'] != false,
        FType.date => widget.row?[f.key] == null ? null : '${widget.row![f.key]}'.substring(0, 10),
        FType.cnpj => widget.row?[f.key] == null ? '' : fmtCnpj(widget.row![f.key]),
        _ => widget.row?[f.key] == null ? '' : '${widget.row![f.key]}',
      },
  };
  final _errors = <String, String>{};
  bool _busy = false;

  Future<void> _save() async {
    final body = <String, Object?>{};
    _errors.clear();
    for (final f in widget.def.fields) {
      final v = _v[f.key];
      if (f.type == FType.active) {
        body[f.key] = v;
        continue;
      }
      final s = '${v ?? ''}'.trim();
      if (s.isEmpty) {
        if (f.required) _errors[f.key] = 'Obrigatório';
        continue;
      }
      if (f.key == 'name' && s.length < 3) _errors[f.key] = 'Mínimo de 3 caracteres';
      if (f.type == FType.cnpj) {
        if (!validCnpj(s)) {
          _errors[f.key] = 'CNPJ inválido';
        } else {
          body[f.key] = digits(s);
        }
        continue;
      }
      body[f.key] = f.numeric ? int.parse(s) : s;
    }
    setState(() {});
    if (_errors.isNotEmpty) return;
    if (widget.def.companyScoped && widget.row == null) body['companyId'] = widget.companyId;
    setState(() => _busy = true);
    final ok = await act(
      context,
      () => widget.row == null ? api.post('/${widget.def.path}', body) : api.patch('/${widget.def.path}/${widget.row!['id']}', body),
      success: widget.row == null ? '${widget.def.singular} cadastrad${widget.def.feminine ? 'a' : 'o'}' : 'Alterações salvas',
    );
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) Navigator.pop(context, true);
  }

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        FormGrid(
          children: [
            for (final f in widget.def.fields)
              switch (f.type) {
                FType.active => FullWidth(
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(f.label),
                    subtitle: Text('Inativos não aparecem para novos vínculos', style: TextStyle(color: t.subtle, fontSize: 12)),
                    value: _v[f.key] == true,
                    onChanged: (v) => setState(() => _v[f.key] = v),
                  ),
                ),
                FType.date => DateField(label: f.label + (f.required ? ' *' : ''), value: _v[f.key] as String?, onChanged: (v) => setState(() => _v[f.key] = v)),
                FType.select => Select<String>(label: f.label, value: '${_v[f.key] ?? ''}', items: [('', f.empty ?? 'Selecione'), ...f.options], onChanged: (v) => setState(() => _v[f.key] = v ?? '')),
                _ => TextFormField(
                  initialValue: '${_v[f.key] ?? ''}',
                  maxLength: f.max,
                  onChanged: (v) => _v[f.key] = v,
                  decoration: InputDecoration(labelText: f.label + (f.required ? ' *' : ''), hintText: f.placeholder, helperText: f.hint, errorText: _errors[f.key], counterText: ''),
                ),
              },
          ],
        ),
        const SizedBox(height: 22),
        Align(
          alignment: Alignment.centerRight,
          child: GlassButton(label: 'Salvar', icon: Icons.check_rounded, loading: _busy, onPressed: _save),
        ),
      ],
    );
  }
}

/// Atalho para a lista de opções de um cadastro (usado em formulários).
Future<List<(String, String)>> catalogOptions(String path, {String? companyId}) async {
  final rows = await api.getList('/$path', {'pageSize': 200, 'companyId': companyId});
  return [
    for (final r in rows)
      if (r['active'] != false) (r['id'] as String, '${r['name'] ?? r['acronym'] ?? ''}'),
  ];
}

Widget glassNote(BuildContext context, String text) => Glass(
  padding: const EdgeInsets.all(14),
  radius: SpTokens.radiusSm,
  child: Text(text, style: TextStyle(color: context.sp.muted, fontSize: 13)),
);
