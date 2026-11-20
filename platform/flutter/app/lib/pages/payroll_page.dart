// Exportação para a folha: layout com o código de evento de cada verba e geração do arquivo do período.
import 'dart:convert';

import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/glass.dart';
import '../core/save_file.dart';
import '../core/timesheet.dart';
import '../core/tokens.dart';
import '../widgets/company_scope.dart';
import '../widgets/ui.dart';

const _sep = {';': 'Ponto e vírgula (;)', ',': 'Vírgula (,)', '|': 'Barra vertical (|)', 'TAB': 'Tabulação'};
const _qf = {'HHMM': 'Horas (08:30)', 'DECIMAL': 'Decimal (8,50)', 'MINUTES': 'Minutos (510)'};

class PayrollPage extends StatefulWidget {
  const PayrollPage({super.key});
  @override
  State<PayrollPage> createState() => _PayrollPageState();
}

class _PayrollPageState extends State<PayrollPage> {
  late var _period = monthRange(DateTime(todayBr().year, todayBr().month - 1));
  late final Future<List<Map<String, dynamic>>> _items = api.getList('/payroll-layouts/items');
  Map<String, dynamic>? _last;
  String? _busy;
  int _token = 0;

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    return PageScaffold(
      title: 'Exportação para a folha',
      subtitle:
          'Monte o layout com o código de evento de cada verba e gere o arquivo do período para importar no seu sistema de folha. O SuperPonto só gera o arquivo; não envia dados a outros sistemas.',
      icon: Icons.output_rounded,
      children: [
        CompanyScope(
          builder: (context, companyId, picker) => FutureBuilder<List<Map<String, dynamic>>>(
            future: _items,
            builder: (context, its) {
              final items = its.data ?? const <Map<String, dynamic>>[];
              String label(String k) => '${items.where((i) => i['key'] == k).firstOrNull?['label'] ?? k}';
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      picker,
                      DateField(label: 'De', value: _period.from, width: 170, onChanged: (v) => setState(() => _period = (from: v ?? _period.from, to: _period.to))),
                      DateField(label: 'Até', value: _period.to, width: 170, onChanged: (v) => setState(() => _period = (from: _period.from, to: v ?? _period.to))),
                      GlassButton(label: 'Novo layout', icon: Icons.add_rounded, onPressed: () => _edit(companyId!, null, items)),
                    ],
                  ),
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text('Os valores saem da folha de conferência do período (calcule e feche o período antes de exportar).', style: TextStyle(color: t.subtle, fontSize: 12.5)),
                  ),
                  if (_last != null)
                    Glass(
                      margin: const EdgeInsets.only(top: 12),
                      tint: t.success,
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Arquivo gerado: ${_last!['lines']} linha(s) para ${_last!['employees']} funcionário(s).'),
                          if ((_last!['missingKey'] as List?)?.isNotEmpty == true)
                            Text('Sem CPF/matrícula (ficaram de fora): ${(_last!['missingKey'] as List).join(', ')}', style: TextStyle(color: t.warning)),
                          if ((_last!['unmappedItems'] as List?)?.isNotEmpty == true)
                            Text('Verbas com valor no período e sem código no layout: ${(_last!['unmappedItems'] as List).map((k) => label('$k')).join(', ')}', style: TextStyle(color: t.warning)),
                        ],
                      ),
                    ),
                  const SizedBox(height: 14),
                  Async<List<Map<String, dynamic>>>(
                    reloadToken: '$companyId|$_token',
                    load: () => api.getList('/payroll-layouts', {'companyId': companyId}),
                    builder: (context, list, _) => list.isEmpty
                        ? const Glass(
                            child: EmptyState(icon: Icons.output_rounded, title: 'Nenhum layout', body: 'Crie o layout com os códigos de evento usados no seu sistema de folha.'),
                          )
                        : Column(
                            children: [
                              for (final l in list)
                                Glass(
                                  margin: const EdgeInsets.only(bottom: 10),
                                  child: Row(
                                    children: [
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text('${l['name']}', style: const TextStyle(fontWeight: FontWeight.w700)),
                                            Text(asMap(l['events']).entries.map((e) => '${label(e.key)} → ${e.value}').join(' · '), style: TextStyle(color: t.muted, fontSize: 13)),
                                            Text(
                                              '${l['employeeKey'] == 'CPF' ? 'CPF' : 'Matrícula'} · ${_sep[l['separator']] ?? l['separator']} · ${_qf[l['quantityFormat']]}${l['includeHeader'] == true ? ' · com cabeçalho' : ''}',
                                              style: TextStyle(color: t.subtle, fontSize: 12),
                                            ),
                                          ],
                                        ),
                                      ),
                                      GlassButton(
                                        label: 'Gerar arquivo',
                                        icon: Icons.download_rounded,
                                        small: true,
                                        loading: _busy == l['id'],
                                        onPressed: () async {
                                          setState(() => _busy = l['id'] as String);
                                          try {
                                            final r = asMap(await api.post('/payroll-layouts/${l['id']}/export', {'from': _period.from, 'to': _period.to}));
                                            final path = await saveBytes(base64Decode('${r['base64']}'), '${r['filename']}', mime: '${r['mime']}');
                                            if (!mounted) return;
                                            setState(() => _last = r);
                                            toast(this.context, 'Arquivo salvo: $path');
                                          } catch (e) {
                                            if (mounted) toast(this.context, '$e', error: true);
                                          } finally {
                                            if (mounted) setState(() => _busy = null);
                                          }
                                        },
                                      ),
                                      RowAction(Icons.edit_rounded, 'Editar', () => _edit(companyId!, l, items)),
                                      RowAction(Icons.delete_outline_rounded, 'Excluir', () async {
                                        if (!await confirm(context, title: 'Excluir layout?', body: '"${l['name']}" deixa de estar disponível.', confirmLabel: 'Excluir') || !context.mounted) return;
                                        if (await act(context, () => api.delete('/payroll-layouts/${l['id']}'), success: 'Layout excluído') && mounted) setState(() => _token++);
                                      }, danger: true),
                                    ],
                                  ),
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

  Future<void> _edit(String companyId, Map<String, dynamic>? l, List<Map<String, dynamic>> items) async {
    final ok = await showGlassDialog<bool>(
      context,
      title: l == null ? 'Novo layout' : 'Editar layout',
      width: 720,
      builder: (_) => _LayoutForm(companyId: companyId, layout: l, items: items),
    );
    if (ok == true && mounted) setState(() => _token++);
  }
}

class _LayoutForm extends StatefulWidget {
  const _LayoutForm({required this.companyId, required this.layout, required this.items});
  final String companyId;
  final Map<String, dynamic>? layout;
  final List<Map<String, dynamic>> items;
  @override
  State<_LayoutForm> createState() => _LayoutFormState();
}

class _LayoutFormState extends State<_LayoutForm> {
  late final _name = TextEditingController(text: widget.layout?['name'] as String?);
  late final Map<String, String> _events = {for (final i in widget.items) '${i['key']}': '${asMap(widget.layout?['events'])[i['key']] ?? ''}'};
  late String _key = '${widget.layout?['employeeKey'] ?? 'MATRICULA'}', _sepV = '${widget.layout?['separator'] ?? ';'}', _q = '${widget.layout?['quantityFormat'] ?? 'HHMM'}';
  late bool _header = widget.layout?['includeHeader'] as bool? ?? true;
  bool _busy = false;

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final s = _sepV == 'TAB' ? '⇥' : _sepV;
    final code = _events.values.firstWhere((v) => v.trim().isNotEmpty, orElse: () => '150');
    final qty = switch (_q) {
      'HHMM' => '02:30',
      'DECIMAL' => '2,50',
      _ => '150',
    };
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: _name,
          decoration: const InputDecoration(labelText: 'Nome *', hintText: 'Ex.: Folha mensal'),
        ),
        const SizedBox(height: 16),
        const FieldLabel('Código do evento por verba (em branco = não exporta)'),
        FormGrid(
          columns: 3,
          children: [
            for (final i in widget.items)
              TextFormField(
                initialValue: _events['${i['key']}'],
                maxLength: 20,
                onChanged: (v) => setState(() => _events['${i['key']}'] = v),
                decoration: InputDecoration(labelText: '${i['label']}', counterText: ''),
              ),
          ],
        ),
        const SizedBox(height: 14),
        FormGrid(
          columns: 3,
          children: [
            Select<String>(label: 'Funcionário por', value: _key, items: const [('MATRICULA', 'Matrícula'), ('CPF', 'CPF')], onChanged: (v) => setState(() => _key = v ?? 'MATRICULA')),
            Select<String>(label: 'Separador', value: _sepV, items: [for (final e in _sep.entries) (e.key, e.value)], onChanged: (v) => setState(() => _sepV = v ?? ';')),
            Select<String>(label: 'Quantidade', value: _q, items: [for (final e in _qf.entries) (e.key, e.value)], onChanged: (v) => setState(() => _q = v ?? 'HHMM')),
          ],
        ),
        Row(
          children: [
            Checkbox(value: _header, onChanged: (v) => setState(() => _header = v ?? true)),
            const Text('Primeira linha com os nomes das colunas'),
          ],
        ),
        Text(
          'Exemplo de linha: ${_key == 'CPF' ? '52998224725' : '1001'}$s$code$s$qty',
          style: TextStyle(color: t.muted, fontFamily: 'monospace'),
        ),
        const SizedBox(height: 18),
        Align(
          alignment: Alignment.centerRight,
          child: GlassButton(
            label: 'Salvar',
            loading: _busy,
            onPressed: () async {
              if (_name.text.trim().length < 2) return toast(context, 'Informe o nome do layout', error: true);
              final body = {
                'name': _name.text.trim(),
                'events': {
                  for (final e in _events.entries)
                    if (e.value.trim().isNotEmpty) e.key: e.value.trim(),
                },
                'separator': _sepV,
                'quantityFormat': _q,
                'includeHeader': _header,
                'employeeKey': _key,
              };
              setState(() => _busy = true);
              final ok = await act(
                context,
                () => widget.layout != null ? api.put('/payroll-layouts/${widget.layout!['id']}', body) : api.post('/payroll-layouts', {...body, 'companyId': widget.companyId}),
                success: 'Layout salvo',
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
