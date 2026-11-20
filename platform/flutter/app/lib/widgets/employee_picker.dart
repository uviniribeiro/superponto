// Busca de funcionário (nome, matrícula ou CPF) para telas por pessoa.
import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/glass.dart';
import '../core/tokens.dart';
import 'company_scope.dart';
import 'ui.dart';

typedef PickedEmployee = ({String id, String name});

class EmployeePicker extends StatelessWidget {
  const EmployeePicker({super.key, required this.value, required this.onChanged, this.width = 320});
  final PickedEmployee? value;
  final ValueChanged<PickedEmployee> onChanged;
  final double width;

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    return SizedBox(
      width: isWide(context) ? width : double.infinity,
      child: Glass(
        radius: 999,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        onTap: () async {
          final r = await showGlassDialog<PickedEmployee>(context, title: 'Escolher funcionário', width: 520, builder: (_) => const _Search());
          if (r != null) onChanged(r);
        },
        child: Row(
          children: [
            Icon(Icons.search_rounded, size: 18, color: t.muted),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                value?.name ?? 'Escolha o funcionário…',
                overflow: TextOverflow.ellipsis,
                style: TextStyle(color: value == null ? t.muted : t.fg),
              ),
            ),
            Icon(Icons.expand_more_rounded, color: t.muted),
          ],
        ),
      ),
    );
  }
}

class _Search extends StatefulWidget {
  const _Search();
  @override
  State<_Search> createState() => _SearchState();
}

class _SearchState extends State<_Search> {
  String _q = '';
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      SearchField(hint: 'Nome, matrícula ou CPF…', width: 520, onChanged: (v) => setState(() => _q = v)),
      const SizedBox(height: 10),
      SizedBox(
        height: 360,
        child: Async<List<Map<String, dynamic>>>(
          reloadToken: _q,
          load: () => api.getList('/employees', {'pageSize': 20, 'status': 'ALL', 'search': _q}),
          builder: (context, list, _) => list.isEmpty
              ? Center(
                  child: Text('Nada encontrado', style: TextStyle(color: context.sp.subtle)),
                )
              : ListView(
                  children: [
                    for (final e in list)
                      ListTile(
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        title: Text('${e['socialName'] ?? e['fullName']}'),
                        subtitle: Text('${e['registration']} · ${companyName(asMap(e['company']))}'),
                        onTap: () => Navigator.pop(context, (id: e['id'] as String, name: '${e['socialName'] ?? e['fullName']} · ${e['registration']}')),
                      ),
                  ],
                ),
        ),
      ),
    ],
  );
}

/// Vários funcionários (ou um só, com `single`), com busca inline.
class MultiEmployeePicker extends StatefulWidget {
  const MultiEmployeePicker({super.key, required this.value, required this.onChanged, this.single = false});
  final List<PickedEmployee> value;
  final ValueChanged<List<PickedEmployee>> onChanged;
  final bool single;
  @override
  State<MultiEmployeePicker> createState() => _MultiEmployeePickerState();
}

class _MultiEmployeePickerState extends State<MultiEmployeePicker> {
  String _q = '';
  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final v = widget.value;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        FieldLabel(widget.single ? 'Funcionário' : 'Funcionários (${v.length})'),
        if (v.isNotEmpty)
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final e in v)
                InputChip(
                  label: Text(e.name, style: const TextStyle(fontSize: 12.5)),
                  onDeleted: () => widget.onChanged(v.where((x) => x.id != e.id).toList()),
                ),
            ],
          ),
        if (!widget.single || v.isEmpty) ...[
          const SizedBox(height: 8),
          SearchField(hint: 'Buscar por nome ou matrícula…', width: 900, onChanged: (s) => setState(() => _q = s)),
          const SizedBox(height: 6),
          SizedBox(
            height: 180,
            child: Glass(
              radius: SpTokens.radiusSm,
              padding: EdgeInsets.zero,
              child: Async<List<Map<String, dynamic>>>(
                reloadToken: _q,
                load: () => api.getList('/employees', {'pageSize': 15, 'search': _q}),
                builder: (context, list, _) {
                  final rest = list.where((e) => !v.any((x) => x.id == e['id'])).toList();
                  if (rest.isEmpty) {
                    return Center(
                      child: Text('Nada encontrado', style: TextStyle(color: t.subtle)),
                    );
                  }
                  return ListView(
                    children: [
                      for (final e in rest)
                        ListTile(
                          dense: true,
                          title: Text('${e['socialName'] ?? e['fullName']}'),
                          subtitle: Text('${e['registration']}'),
                          trailing: Icon(Icons.add_rounded, color: t.brand),
                          onTap: () {
                            final p = (id: e['id'] as String, name: '${e['socialName'] ?? e['fullName']}');
                            widget.onChanged(widget.single ? [p] : [...v, p]);
                          },
                        ),
                    ],
                  );
                },
              ),
            ),
          ),
        ],
      ],
    );
  }
}
