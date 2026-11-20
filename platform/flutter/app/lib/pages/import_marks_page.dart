// Importar marcações de planilha (CSV/TXT): matrícula ou CPF, data e hora. Repetir o arquivo não duplica.
import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/csv.dart';
import '../core/format.dart';
import '../core/glass.dart';
import '../core/tokens.dart';
import '../widgets/company_scope.dart';
import '../widgets/pick.dart';
import '../widgets/ui.dart';

class ImportMarksPage extends StatefulWidget {
  const ImportMarksPage({super.key});
  @override
  State<ImportMarksPage> createState() => _ImportMarksPageState();
}

class _ImportMarksPageState extends State<ImportMarksPage> {
  final _content = TextEditingController();
  String _file = '', _key = 'MATRICULA';
  Map<String, dynamic>? _res;
  bool? _running;

  Future<void> _run(String companyId, bool dry) async {
    setState(() => _running = dry);
    final r = await run(context, () => api.post('/time-records/import-csv', {'companyId': companyId, 'content': _content.text, 'employeeKey': _key, 'dryRun': dry}));
    if (!mounted) return;
    setState(() {
      _running = null;
      if (r != null) _res = asMap(r);
    });
    if (r != null && !dry) toast(context, '${_res!['imported']} marcação(ões) importada(s)');
  }

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    return PageScaffold(
      title: 'Importar marcações',
      subtitle: 'Traga marcações de uma planilha (CSV ou TXT): uma por linha, com matrícula (ou CPF), data e hora. Confira antes de gravar; repetir o arquivo não duplica.',
      icon: Icons.file_download_rounded,
      children: [
        CompanyScope(
          builder: (context, companyId, picker) {
            final res = _res;
            final left = Glass(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  picker,
                  const SizedBox(height: 12),
                  Select<String>(
                    label: 'Funcionário identificado por',
                    value: _key,
                    items: const [('MATRICULA', 'Matrícula'), ('CPF', 'CPF')],
                    onChanged: (v) => setState(() {
                      _key = v ?? 'MATRICULA';
                      _res = null;
                    }),
                  ),
                  const SizedBox(height: 12),
                  GlassButton(
                    label: _file.isEmpty ? 'Escolher arquivo .csv ou .txt' : _file,
                    icon: Icons.upload_file_rounded,
                    kind: BtnKind.glass,
                    onPressed: () async {
                      final f = await pickFile(['csv', 'txt']);
                      if (f == null) return;
                      setState(() {
                        _content.text = decodeCsvBytes(f.$1);
                        _file = f.$2;
                        _res = null;
                      });
                    },
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _content,
                    maxLines: 8,
                    onChanged: (_) => setState(() => _res = null),
                    style: const TextStyle(fontFamily: 'monospace', fontSize: 13),
                    decoration: const InputDecoration(labelText: 'Ou cole aqui', hintText: 'matricula;data;hora\n1001;01/10/2026;08:00\n1001;01/10/2026;12:00', alignLabelWithHint: true),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Separador: ponto e vírgula, vírgula ou tabulação. Data dd/mm/aaaa ou aaaa-mm-dd; hora hh:mm. A primeira linha pode ser cabeçalho.',
                    style: TextStyle(color: t.subtle, fontSize: 12.5),
                  ),
                  const SizedBox(height: 14),
                  Wrap(
                    spacing: 8,
                    children: [
                      GlassButton(label: 'Conferir', kind: BtnKind.glass, loading: _running == true, onPressed: _content.text.trim().isEmpty ? null : () => _run(companyId!, true)),
                      GlassButton(
                        label: 'Importar ${res?['toImport'] ?? ''}',
                        icon: Icons.upload_rounded,
                        loading: _running == false,
                        onPressed: res == null || (res['toImport'] as num? ?? 0) == 0 || (res['imported'] as num? ?? 0) > 0 ? null : () => _run(companyId!, false),
                      ),
                    ],
                  ),
                ],
              ),
            );
            final right = Glass(
              child: res == null
                  ? const EmptyState(icon: Icons.fact_check_rounded, title: 'Confira o arquivo', body: 'Mostramos aqui o que entra, o que já existe e os erros por linha antes de gravar.')
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        ResponsiveGrid(
                          minItemWidth: 120,
                          children: [
                            StatTile(label: 'Linhas', value: '${res['total']}'),
                            StatTile(label: 'Novas', value: '${(res['imported'] as num? ?? 0) > 0 ? res['imported'] : res['toImport']}', color: t.success),
                            StatTile(label: 'Já existiam', value: '${res['duplicates']}'),
                            StatTile(label: 'Com erro', value: '${asList(res['errors']).length}', color: t.danger),
                          ],
                        ),
                        if ((res['imported'] as num? ?? 0) > 0)
                          Padding(
                            padding: const EdgeInsets.only(top: 12),
                            child: Text('${res['imported']} marcação(ões) gravada(s). Elas aparecem no espelho com a origem "Importação".', style: TextStyle(color: t.success)),
                          ),
                        if (asList(res['errors']).isNotEmpty) ...[
                          const SizedBox(height: 14),
                          const SectionTitle('Erros'),
                          for (final e in asList(res['errors'])) Text('Linha ${e['line']}: ${e['message']}', style: TextStyle(color: t.danger, fontSize: 13)),
                        ],
                        if (asList(res['preview']).isNotEmpty && (res['imported'] as num? ?? 0) == 0) ...[
                          const SizedBox(height: 14),
                          const SectionTitle('Prévia do que entra'),
                          for (final p in asList(res['preview'])) Text('${brDate(p['date'])} ${p['time']} — ${p['name']}', style: const TextStyle(fontSize: 13)),
                        ],
                      ],
                    ),
            );
            return isWide(context)
                ? Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(child: left),
                      const SizedBox(width: 14),
                      Expanded(child: right),
                    ],
                  )
                : Column(children: [left, const SizedBox(height: 14), right]);
          },
        ),
      ],
    );
  }
}
