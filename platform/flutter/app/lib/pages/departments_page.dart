// Departamentos em árvore (subdepartamentos ilimitados) com seções dentro de cada um.
import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/glass.dart';
import '../core/tokens.dart';
import '../widgets/company_scope.dart';
import '../widgets/ui.dart';

class DepartmentsPage extends StatefulWidget {
  const DepartmentsPage({super.key});
  @override
  State<DepartmentsPage> createState() => _DepartmentsPageState();
}

class _DepartmentsPageState extends State<DepartmentsPage> {
  int _token = 0;
  final _collapsed = <String>{};

  @override
  Widget build(BuildContext context) {
    final canManage = api.can('org.departments:manage');
    return PageScaffold(
      title: 'Departamentos',
      subtitle: 'Estrutura em árvore, com subdepartamentos ilimitados e seções dentro de cada departamento.',
      icon: Icons.account_tree_rounded,
      children: [
        CompanyScope(
          builder: (context, companyId, picker) => Async<List<Map<String, dynamic>>>(
            reloadToken: '$companyId|$_token',
            load: () => api.getList('/departments', {'companyId': companyId}),
            builder: (context, list, _) {
              bool hidden(Map<String, dynamic> d) => list.any((p) => _collapsed.contains(p['id']) && '${d['path']}'.startsWith('${p['path']} › '));
              final visible = list.where((d) => !hidden(d)).toList();
              final t = context.sp;
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Wrap(
                    spacing: 12,
                    runSpacing: 12,
                    alignment: WrapAlignment.spaceBetween,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      picker,
                      Text('${list.length} departamento(s)', style: TextStyle(color: t.muted)),
                      if (canManage) GlassButton(label: 'Novo departamento', icon: Icons.add_rounded, onPressed: () => _edit(companyId!, list, null, null)),
                    ],
                  ),
                  const SizedBox(height: 14),
                  if (list.isEmpty)
                    const Glass(
                      child: EmptyState(
                        icon: Icons.account_tree_rounded,
                        title: 'Nenhum departamento',
                        body: 'Comece pelos departamentos principais (ex.: Secretaria de Saúde) e adicione os subdepartamentos dentro deles.',
                      ),
                    )
                  else
                    Glass(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Column(
                        children: [
                          for (final d in visible)
                            _DeptTile(
                              d: d,
                              collapsed: _collapsed.contains(d['id']),
                              canManage: canManage,
                              onToggle: () => setState(() => _collapsed.contains(d['id']) ? _collapsed.remove(d['id']) : _collapsed.add(d['id'] as String)),
                              onChanged: () => setState(() => _token++),
                              onEdit: (dept, parent) => _edit(companyId!, list, dept, parent),
                            ),
                        ],
                      ),
                    ),
                ],
              );
            },
          ),
        ),
      ],
    );
  }

  Future<void> _edit(String companyId, List<Map<String, dynamic>> depts, Map<String, dynamic>? dept, String? parentId) async {
    final ok = await showGlassDialog<bool>(
      context,
      title: dept != null ? 'Editar departamento' : 'Novo departamento',
      builder: (_) => _DeptForm(companyId: companyId, depts: depts, dept: dept, parentId: parentId),
    );
    if (ok == true && mounted) setState(() => _token++);
  }
}

class _DeptTile extends StatefulWidget {
  const _DeptTile({required this.d, required this.collapsed, required this.canManage, required this.onToggle, required this.onChanged, required this.onEdit});
  final Map<String, dynamic> d;
  final bool collapsed, canManage;
  final VoidCallback onToggle, onChanged;
  final void Function(Map<String, dynamic>? dept, String? parentId) onEdit;
  @override
  State<_DeptTile> createState() => _DeptTileState();
}

class _DeptTileState extends State<_DeptTile> {
  final _sector = TextEditingController();

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final d = widget.d;
    final depth = (d['depth'] as num? ?? 0).toInt();
    final children = (d['children'] as num? ?? 0).toInt();
    final sectors = asList(d['sectors']);
    return Padding(
      padding: EdgeInsets.fromLTRB(12.0 + depth * 22, 6, 12, 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              IconButton(
                tooltip: widget.collapsed ? 'Expandir' : 'Recolher',
                onPressed: children > 0 ? widget.onToggle : null,
                icon: AnimatedRotation(
                  turns: widget.collapsed ? 0 : 0.25,
                  duration: const Duration(milliseconds: 180),
                  child: Icon(Icons.chevron_right_rounded, color: children > 0 ? t.muted : Colors.transparent),
                ),
              ),
              IconBubble(Icons.folder_rounded, size: 32, color: depth == 0 ? t.brand : t.info),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            '${d['name']}',
                            style: const TextStyle(fontWeight: FontWeight.w600),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (d['code'] != null) ...[const SizedBox(width: 8), Pill('${d['code']}')],
                      ],
                    ),
                    Text('${d['employees'] ?? 0} funcionário(s)${children > 0 ? ' · $children subdepartamento(s)' : ''}', style: TextStyle(color: t.subtle, fontSize: 12.5)),
                  ],
                ),
              ),
              if (widget.canManage) ...[
                RowAction(Icons.create_new_folder_rounded, 'Novo subdepartamento', () => widget.onEdit(null, d['id'] as String)),
                RowAction(Icons.edit_rounded, 'Editar', () => widget.onEdit(d, null)),
                RowAction(Icons.delete_outline_rounded, 'Excluir', _remove, danger: true),
              ],
            ],
          ),
          if (sectors.isNotEmpty || widget.canManage)
            Padding(
              padding: const EdgeInsets.only(left: 90, top: 4),
              child: Wrap(
                spacing: 6,
                runSpacing: 6,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  for (final s in sectors)
                    InputChip(
                      label: Text('${s['name']}', style: const TextStyle(fontSize: 12.5)),
                      avatar: Icon(Icons.view_list_rounded, size: 15, color: t.muted),
                      backgroundColor: t.hover,
                      side: BorderSide(color: t.border),
                      onDeleted: widget.canManage ? () => _removeSector(s['id'] as String) : null,
                      deleteButtonTooltipMessage: 'Remover seção',
                    ),
                  if (widget.canManage)
                    SizedBox(
                      width: 150,
                      height: 34,
                      child: TextField(
                        controller: _sector,
                        style: const TextStyle(fontSize: 13),
                        decoration: const InputDecoration(hintText: '+ seção', contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8)),
                        onSubmitted: (_) => _addSector(),
                      ),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Future<void> _addSector() async {
    final n = _sector.text.trim();
    if (n.length < 3) return toast(context, 'Seção: mínimo de 3 caracteres', error: true);
    if (await act(context, () => api.post('/departments/${widget.d['id']}/sectors', {'name': n}), success: 'Seção adicionada')) {
      _sector.clear();
      widget.onChanged();
    }
  }

  Future<void> _removeSector(String id) async {
    if (await act(context, () => api.delete('/departments/${widget.d['id']}/sectors/$id'))) widget.onChanged();
  }

  Future<void> _remove() async {
    final d = widget.d;
    if ((d['children'] as num? ?? 0) > 0) return toast(context, 'Este departamento tem subdepartamentos: mova ou exclua-os antes.', error: true);
    if (!await confirm(context, title: 'Excluir departamento?', body: '"${d['name']}" deixa de aparecer nas listas.', confirmLabel: 'Excluir') || !mounted) return;
    if (await act(context, () => api.delete('/departments/${d['id']}'), success: 'Departamento excluído')) widget.onChanged();
  }
}

class _DeptForm extends StatefulWidget {
  const _DeptForm({required this.companyId, required this.depts, this.dept, this.parentId});
  final String companyId;
  final List<Map<String, dynamic>> depts;
  final Map<String, dynamic>? dept;
  final String? parentId;
  @override
  State<_DeptForm> createState() => _DeptFormState();
}

class _DeptFormState extends State<_DeptForm> {
  late final _name = TextEditingController(text: widget.dept?['name'] as String?);
  late final _code = TextEditingController(text: widget.dept?['code'] as String?);
  late String _parent = (widget.dept != null ? widget.dept!['parentId'] : widget.parentId) as String? ?? '';
  bool _busy = false;

  @override
  Widget build(BuildContext context) {
    final dept = widget.dept;
    final blocked = <String>{
      if (dept != null) dept['id'] as String,
      if (dept != null)
        for (final d in widget.depts)
          if ('${d['path']}'.startsWith('${dept['path']} › ')) d['id'] as String,
    };
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: _name,
          autofocus: true,
          decoration: const InputDecoration(labelText: 'Descrição *'),
        ),
        const SizedBox(height: 14),
        TextField(
          controller: _code,
          maxLength: 20,
          decoration: const InputDecoration(labelText: 'Código', helperText: 'Opcional; único na empresa', counterText: ''),
        ),
        const SizedBox(height: 14),
        Select<String>(
          label: 'Dentro de',
          value: _parent,
          items: [
            ('', '— Raiz (departamento principal) —'),
            for (final d in widget.depts)
              if (!blocked.contains(d['id'])) (d['id'] as String, '${'   ' * (d['depth'] as num? ?? 0).toInt()}${d['name']}'),
          ],
          onChanged: (v) => setState(() => _parent = v ?? ''),
        ),
        const SizedBox(height: 22),
        Align(
          alignment: Alignment.centerRight,
          child: GlassButton(
            label: dept != null ? 'Salvar alterações' : 'Cadastrar departamento',
            loading: _busy,
            onPressed: () async {
              if (_name.text.trim().length < 3) return toast(context, 'Descrição: mínimo de 3 caracteres', error: true);
              setState(() => _busy = true);
              final code = _code.text.trim();
              final ok = await act(
                context,
                () => dept != null
                    ? api.patch('/departments/${dept['id']}', {'name': _name.text.trim(), if (code.isNotEmpty) 'code': code, 'parentId': _parent.isEmpty ? null : _parent})
                    : api.post('/departments', {'companyId': widget.companyId, 'name': _name.text.trim(), if (code.isNotEmpty) 'code': code, if (_parent.isNotEmpty) 'parentId': _parent}),
                success: dept != null ? 'Departamento atualizado' : 'Departamento cadastrado',
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
