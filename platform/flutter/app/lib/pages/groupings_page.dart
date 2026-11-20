// Agrupamentos: grupos livres de funcionários, cargos e unidades.
import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/glass.dart';
import '../core/tokens.dart';
import '../widgets/company_scope.dart';
import '../widgets/ui.dart';
import 'catalog_page.dart';

final groupingsDef = CatalogDef(
  title: 'Agrupamentos',
  singular: 'Agrupamento',
  path: 'groupings',
  icon: Icons.widgets_rounded,
  description: 'Grupos livres de funcionários, cargos e unidades (ex.: "Plantão noturno", "Motoristas da frota") para filtrar relatórios, cálculo em lote e envio aos relógios.',
  readPermission: 'org.groupings:read',
  managePermission: 'org.groupings:manage',
  fields: const [CField('name', 'Descrição', FType.text, required: true, max: 120), CField('code', 'Código', FType.text, max: 20), CField('active', 'Ativo', FType.active)],
  subtitle: (r) => r['code'] != null ? 'Código ${r['code']}' : 'Sem código',
  extra: (context, r, canManage, reload) => [
    RowAction(Icons.group_rounded, 'Membros', () async {
      if (!canManage) return toast(context, 'Você pode ver o agrupamento, mas não alterar os membros.');
      final ok = await showGlassDialog<bool>(
        context,
        title: 'Membros: ${r['name']}',
        width: 760,
        builder: (_) => _MembersEditor(id: r['id'] as String),
      );
      if (ok == true) reload();
    }),
  ],
);

class _MembersEditor extends StatefulWidget {
  const _MembersEditor({required this.id});
  final String id;
  @override
  State<_MembersEditor> createState() => _MembersEditorState();
}

class _MembersEditorState extends State<_MembersEditor> {
  Map<String, String>? _emp;
  final _pos = <String, String>{}, _units = <String, String>{};
  String _q = '';
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    api.getMap('/groupings/${widget.id}/members').then((m) {
      if (!mounted) return;
      setState(() {
        _emp = {for (final e in asList(m['employments'])) e['id'] as String: '${e['fullName']} · ${e['registration']}'};
        for (final p in asList(m['positions'])) {
          _pos[p['id'] as String] = '${p['name']}';
        }
        for (final u in asList(m['units'])) {
          _units[u['id'] as String] = '${u['name']}';
        }
      });
    }, onError: (Object e) => mounted ? toast(context, '$e', error: true) : null);
  }

  Widget _chips(Map<String, String> sel, List<Map<String, dynamic>> opts, String empty) {
    final t = context.sp;
    if (opts.isEmpty) return Text(empty, style: TextStyle(color: t.subtle, fontSize: 13));
    return Wrap(
      spacing: 6,
      runSpacing: 6,
      children: [
        for (final o in opts)
          FilterChip(
            label: Text('${o['name']}', style: const TextStyle(fontSize: 12.5)),
            selected: sel.containsKey(o['id']),
            selectedColor: t.brand.withValues(alpha: 0.2),
            checkmarkColor: t.brand,
            side: BorderSide(color: sel.containsKey(o['id']) ? t.brand.withValues(alpha: 0.5) : t.border),
            onSelected: (v) => setState(() => v ? sel[o['id'] as String] = '${o['name']}' : sel.remove(o['id'])),
          ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    if (_emp == null) return const Loading();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SectionTitle('Funcionários (${_emp!.length})'),
        if (_emp!.isNotEmpty)
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final e in _emp!.entries)
                InputChip(
                  label: Text(e.value, style: const TextStyle(fontSize: 12.5)),
                  onDeleted: () => setState(() => _emp!.remove(e.key)),
                ),
            ],
          ),
        const SizedBox(height: 10),
        SearchField(hint: 'Buscar funcionário por nome ou matrícula…', width: 720, onChanged: (v) => setState(() => _q = v)),
        const SizedBox(height: 8),
        SizedBox(
          height: 220,
          child: Glass(
            padding: EdgeInsets.zero,
            radius: SpTokens.radiusSm,
            child: Async<List<Map<String, dynamic>>>(
              reloadToken: _q,
              load: () => api.getList('/employees', {'pageSize': 30, 'status': 'ALL', 'search': _q}),
              builder: (context, list, _) => list.isEmpty
                  ? Center(
                      child: Text('Nenhum funcionário encontrado', style: TextStyle(color: t.subtle)),
                    )
                  : ListView(
                      children: [
                        for (final e in list)
                          CheckboxListTile(
                            dense: true,
                            value: _emp!.containsKey(e['id']),
                            title: Text('${e['socialName'] ?? e['fullName']} · ${e['registration']}'),
                            subtitle: Text(companyName(asMap(e['company']))),
                            onChanged: (v) => setState(() => v == true ? _emp![e['id'] as String] = '${e['socialName'] ?? e['fullName']} · ${e['registration']}' : _emp!.remove(e['id'])),
                          ),
                      ],
                    ),
            ),
          ),
        ),
        const SizedBox(height: 18),
        CompanyScope(
          builder: (context, companyId, picker) => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              picker,
              const SizedBox(height: 12),
              SectionTitle('Cargos (${_pos.length})'),
              Async<List<Map<String, dynamic>>>(
                reloadToken: companyId,
                load: () => api.getList('/job-positions', {'companyId': companyId, 'pageSize': 500}),
                builder: (_, list, _) => _chips(_pos, list, 'Esta empresa não tem cargos cadastrados.'),
              ),
              const SizedBox(height: 14),
              SectionTitle('Unidades e locais (${_units.length})'),
              Async<List<Map<String, dynamic>>>(
                reloadToken: companyId,
                load: () => api.getList('/units', {'companyId': companyId, 'pageSize': 200}),
                builder: (_, list, _) => _chips(_units, list, 'Esta empresa não tem unidades cadastradas.'),
              ),
              const SizedBox(height: 8),
              Text('Cargos e unidades seguem a empresa escolhida; os já marcados em outras empresas continuam no agrupamento.', style: TextStyle(color: t.subtle, fontSize: 12.5)),
            ],
          ),
        ),
        const SizedBox(height: 20),
        Align(
          alignment: Alignment.centerRight,
          child: GlassButton(
            label: 'Salvar membros',
            loading: _busy,
            onPressed: () async {
              setState(() => _busy = true);
              final ok = await act(
                context,
                () => api.put('/groupings/${widget.id}/members', {'employmentIds': _emp!.keys.toList(), 'positionIds': _pos.keys.toList(), 'unitIds': _units.keys.toList()}),
                success: 'Membros salvos',
              );
              if (!mounted) return;
              setState(() => _busy = false);
              if (ok) Navigator.pop(this.context, true);
            },
          ),
        ),
      ],
    );
  }
}
