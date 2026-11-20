// Importar funcionários por planilha CSV: confere cada linha antes de gravar.
import 'dart:convert';

import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/csv.dart';
import '../core/glass.dart';
import '../core/save_file.dart';
import '../core/tokens.dart';
import '../widgets/company_scope.dart';
import '../widgets/pick.dart';
import '../widgets/ui.dart';

const _bucket = {'departments': 'departamentos', 'positions': 'cargos', 'functions': 'funções', 'costCenters': 'centros de custo', 'types': 'tipos de funcionário'};

class ImportEmployeesPage extends StatefulWidget {
  const ImportEmployeesPage({super.key});
  @override
  State<ImportEmployeesPage> createState() => _ImportEmployeesPageState();
}

class _ImportEmployeesPageState extends State<ImportEmployeesPage> {
  String? _name;
  List<Map<String, String>>? _rows;
  List<String> _ignored = const [], _recognized = const [];
  bool _createMissing = false, _updateExisting = false, _onlyErrors = false;
  Map<String, dynamic>? _report;
  bool? _running;

  Future<void> _pick() async {
    final f = await pickFile(['csv', 'txt']);
    if (f == null || !mounted) return;
    final (bytes, name) = f;
    if (bytes.length > 10 * 1024 * 1024) return toast(context, 'Arquivo acima de 10 MB', error: true);
    final parsed = toImportRows(parseCsv(decodeCsvBytes(bytes)));
    if (parsed.rows.isEmpty) return toast(context, 'Nenhuma linha encontrada abaixo do cabeçalho', error: true);
    if (!parsed.recognized.contains('nome') || !parsed.recognized.contains('matricula')) return toast(context, 'A planilha precisa das colunas Nome e Matrícula', error: true);
    setState(() {
      _name = name;
      _rows = parsed.rows;
      _ignored = parsed.ignored;
      _recognized = parsed.recognized;
      _report = null;
    });
  }

  Future<void> _run(String companyId, bool dryRun) async {
    setState(() => _running = dryRun);
    final r = await run(context, () => api.post('/employees/import', {'companyId': companyId, 'dryRun': dryRun, 'createMissing': _createMissing, 'updateExisting': _updateExisting, 'rows': _rows}));
    if (!mounted) return;
    setState(() {
      _running = null;
      if (r != null) _report = asMap(r);
    });
    if (r != null && !dryRun) toast(context, '${_report!['created']} cadastrado(s), ${_report!['updated']} atualizado(s)');
  }

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    return PageScaffold(
      title: 'Importar funcionários',
      subtitle: 'Envie uma planilha CSV: o sistema confere cada linha antes de gravar.',
      icon: Icons.upload_file_rounded,
      actions: [
        GlassButton(
          label: 'Baixar modelo',
          icon: Icons.download_rounded,
          kind: BtnKind.glass,
          onPressed: () async {
            final path = await saveBytes(utf8.encode(templateCsv()), 'modelo-funcionarios-superponto.csv', mime: 'text/csv');
            if (context.mounted) toast(context, 'Modelo salvo: $path');
          },
        ),
      ],
      children: [
        CompanyScope(
          builder: (context, companyId, picker) {
            final left = Glass(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  picker,
                  const SizedBox(height: 14),
                  Glass(
                    onTap: _pick,
                    radius: SpTokens.radiusSm,
                    padding: const EdgeInsets.all(18),
                    child: Row(
                      children: [
                        const IconBubble(Icons.upload_rounded),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(_name ?? 'Escolher arquivo CSV', style: const TextStyle(fontWeight: FontWeight.w600)),
                              Text(
                                _rows == null ? 'Separador ; ou , · até 5.000 linhas' : '${_rows!.length} linha(s) · ${_recognized.length} coluna(s) reconhecida(s)',
                                style: TextStyle(color: t.subtle, fontSize: 12.5),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (_ignored.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Text('Colunas ignoradas: ${_ignored.join(', ')}', style: TextStyle(color: t.warning, fontSize: 12.5)),
                    ),
                  const SizedBox(height: 8),
                  CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    value: _createMissing,
                    onChanged: (v) => setState(() {
                      _createMissing = v ?? false;
                      _report = null;
                    }),
                    title: const Text('Criar departamentos, cargos, funções, centros de custo e tipos que não existirem'),
                  ),
                  CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    value: _updateExisting,
                    onChanged: (v) => setState(() {
                      _updateExisting = v ?? false;
                      _report = null;
                    }),
                    title: const Text('Atualizar funcionários com matrícula já cadastrada'),
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      GlassButton(label: '1. Conferir planilha', kind: BtnKind.glass, loading: _running == true, onPressed: _rows == null ? null : () => _run(companyId!, true)),
                      GlassButton(
                        label: '2. Importar${_report?['dryRun'] == true ? ' ${_report!['valid']} linha(s) válida(s)' : ''}',
                        loading: _running == false,
                        onPressed: _report?['dryRun'] == true && (_report!['valid'] as num? ?? 0) > 0 ? () => _run(companyId!, false) : null,
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text('Datas em dd/mm/aaaa. Cada linha precisa de nome, matrícula, admissão e CPF ou PIS.', style: TextStyle(color: t.subtle, fontSize: 12.5)),
                  TextButton(onPressed: () => context.go('/funcionarios'), child: const Text('Voltar para funcionários')),
                ],
              ),
            );
            final right = Glass(child: _reportView(t));
            return isWide(context)
                ? Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(flex: 2, child: left),
                      const SizedBox(width: 14),
                      Expanded(flex: 3, child: right),
                    ],
                  )
                : Column(children: [left, const SizedBox(height: 14), right]);
          },
        ),
      ],
    );
  }

  Widget _reportView(SpTokens t) {
    final r = _report;
    if (r == null) return const EmptyState(icon: Icons.table_view_rounded, title: 'Nada conferido ainda', body: 'Escolha o arquivo e clique em Conferir planilha: nada é gravado nessa etapa.');
    final results = asList(r['results']).where((x) => !_onlyErrors || x['status'] == 'error').toList();
    final toCreate = asMap(r['toCreate']).entries.where((e) => (e.value as List).isNotEmpty).toList();
    const label = {'ok': 'pronta', 'created': 'cadastrada', 'updated': 'atualizada', 'error': 'erro', 'skipped': 'ignorada'};
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 8,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Text(r['dryRun'] == true ? 'Conferência' : 'Resultado da importação', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
            Pill(r['dryRun'] == true ? '${r['valid']} válida(s)' : '${r['created']} cadastrado(s) · ${r['updated']} atualizado(s)', color: t.success),
            if ((r['errors'] as num? ?? 0) > 0) Pill('${r['errors']} com erro', color: t.danger),
            FilterChip(label: const Text('Só erros'), selected: _onlyErrors, onSelected: (v) => setState(() => _onlyErrors = v)),
          ],
        ),
        if (toCreate.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: Text(
              '${r['dryRun'] == true ? 'Serão criados' : 'Foram criados'}: ${toCreate.map((e) => '${_bucket[e.key] ?? e.key} (${(e.value as List).join(', ')})').join('; ')}',
              style: TextStyle(color: t.info, fontSize: 13),
            ),
          ),
        const SizedBox(height: 10),
        for (final x in results)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(x['status'] == 'error' ? Icons.error_outline_rounded : Icons.check_circle_outline_rounded, size: 18, color: x['status'] == 'error' ? t.danger : t.success),
                const SizedBox(width: 8),
                SizedBox(
                  width: 64,
                  child: Text('linha ${x['line']}', style: TextStyle(color: t.subtle, fontSize: 12.5)),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('${x['name'] ?? '(sem nome)'}${x['registration'] != null ? ' · ${x['registration']}' : ''}'),
                      if ((x['messages'] as List?)?.isNotEmpty == true) Text((x['messages'] as List).join(' · '), style: TextStyle(color: x['status'] == 'error' ? t.danger : t.muted, fontSize: 12.5)),
                    ],
                  ),
                ),
                Pill(label[x['status']] ?? '${x['status']}', color: x['status'] == 'error' ? t.danger : t.success),
              ],
            ),
          ),
      ],
    );
  }
}
