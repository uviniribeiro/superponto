// Relatórios: catálogo por categoria, filtros, montador, exportação Excel/CSV e impressão (PDF pelo navegador).
import 'dart:convert';

import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/glass.dart';
import '../core/save_file.dart';
import '../core/timesheet.dart';
import '../core/tokens.dart';
import '../widgets/company_scope.dart';
import '../widgets/structure_options.dart';
import '../widgets/ui.dart';

String fmtCell(Object? v, String? type) {
  if (v == null || v == '') return '';
  switch (type) {
    case 'minutes':
      final m = (v is num ? v : num.tryParse('$v') ?? 0).toInt();
      return hhmm(m);
    case 'percent':
      return '${((v is num ? v : num.tryParse('$v') ?? 0) * 100).toStringAsFixed(1).replaceAll('.', ',')}%';
    case 'date':
      return brDate(v);
    case 'datetime':
      return brDateTime(v);
    case 'number':
      final n = v is num ? v : num.tryParse('$v') ?? 0;
      return n == n.roundToDouble() ? n.toInt().toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => '.') : n.toString().replaceAll('.', ',');
    default:
      return '$v';
  }
}

const _custom = {'key': 'customizado', 'title': 'Montador de relatório', 'category': 'Personalizado', 'description': 'Escolha os campos (uma linha por funcionário e dia).', 'period': 'required'};

class ReportsPage extends StatefulWidget {
  const ReportsPage({super.key});
  @override
  State<ReportsPage> createState() => _ReportsPageState();
}

class _ReportsPageState extends State<ReportsPage> {
  late final Future<Map<String, dynamic>> _catalog = api.getMap('/reports');
  String _key = 'horas-trabalhadas', _q = '', _dept = '', _group = '';
  bool _includeSub = true;
  late var _period = monthRange(DateTime(todayBr().year, todayBr().month - 1));
  List<String> _fields = ['name', 'date', 'punches', 'worked', 'balance', 'flags'];
  Map<String, dynamic>? _result;
  String? _busy;

  Map<String, Object?> _body(String? companyId, Map<String, dynamic> def) => {
    'companyId': companyId,
    if (def['period'] != 'none') ...{'from': _period.from, 'to': _period.to},
    if (_dept.isNotEmpty) ...{'departmentId': _dept, 'includeSubdepartments': _includeSub},
    if (_group.isNotEmpty) 'groupingId': _group,
    if (_key == 'customizado') 'fields': _fields,
  };

  void _quick(String k) {
    final t = todayIso();
    setState(() {
      _period = switch (k) {
        'today' => (from: t, to: t),
        'last7' => (from: addDays(t, -6), to: t),
        'thisMonth' => (from: monthRange(todayBr()).from, to: t),
        _ => monthRange(DateTime(todayBr().year, todayBr().month - 1)),
      };
    });
  }

  Future<void> _go(String k, Future<void> Function() f) async {
    setState(() => _busy = k);
    try {
      await f();
    } catch (e) {
      if (mounted) toast(context, '$e', error: true);
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final canExport = api.can('reports.reports:export');
    return PageScaffold(
      title: 'Relatórios',
      subtitle: 'Escolha o relatório, filtre por empresa, período, departamento e agrupamento, e exporte em Excel, CSV ou PDF (impressão).',
      icon: Icons.bar_chart_rounded,
      maxWidth: 1600,
      children: [
        CompanyScope(
          builder: (context, companyId, picker) => FutureBuilder<Map<String, dynamic>>(
            future: _catalog,
            builder: (context, cs) {
              if (cs.hasError) return ErrorView(cs.error!);
              if (!cs.hasData) return const Loading();
              final all = [...asList(cs.data!['reports']), _custom];
              final def = all.where((r) => r['key'] == _key).firstOrNull ?? all.first;
              final cats = <String, List<Map<String, dynamic>>>{};
              for (final r in all.where((x) => _q.isEmpty || '${x['title']}'.toLowerCase().contains(_q.toLowerCase()) || '${x['description']}'.toLowerCase().contains(_q.toLowerCase()))) {
                cats.putIfAbsent('${r['category']}', () => []).add(r);
              }
              final nav = Glass(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    SearchField(hint: 'Buscar relatório…', width: 400, onChanged: (v) => setState(() => _q = v)),
                    const SizedBox(height: 8),
                    for (final e in cats.entries) ...[
                      Padding(
                        padding: const EdgeInsets.fromLTRB(8, 12, 8, 4),
                        child: Text(
                          e.key.toUpperCase(),
                          style: TextStyle(fontSize: 11, color: t.subtle, fontWeight: FontWeight.w600, letterSpacing: 0.6),
                        ),
                      ),
                      for (final r in e.value)
                        ListTile(
                          dense: true,
                          selected: r['key'] == _key,
                          selectedTileColor: t.brand.withValues(alpha: 0.12),
                          selectedColor: t.brand,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          leading: r['key'] == 'customizado' ? const Icon(Icons.auto_fix_high_rounded, size: 18) : null,
                          title: Text('${r['title']}'),
                          onTap: () => setState(() {
                            _key = '${r['key']}';
                            _result = null;
                          }),
                        ),
                    ],
                  ],
                ),
              );
              final filters = Glass(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text('${def['title']}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                    Text('${def['description']}', style: TextStyle(color: t.muted)),
                    const SizedBox(height: 14),
                    picker,
                    const SizedBox(height: 12),
                    if (def['period'] != 'none') ...[
                      FormGrid(
                        children: [
                          DateField(label: 'De', value: _period.from, onChanged: (v) => setState(() => _period = (from: v ?? _period.from, to: _period.to))),
                          DateField(label: 'Até', value: _period.to, onChanged: (v) => setState(() => _period = (from: _period.from, to: v ?? _period.to))),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 6,
                        children: [
                          for (final (k, l) in [('today', 'Hoje'), ('last7', '7 dias'), ('thisMonth', 'Este mês'), ('lastMonth', 'Mês passado')])
                            ActionChip(label: Text(l), onPressed: () => _quick(k)),
                        ],
                      ),
                      const SizedBox(height: 12),
                    ],
                    FutureBuilder(
                      future: StructureOptions.cached(companyId),
                      builder: (_, s) => FormGrid(
                        children: [
                          Select<String>(
                            label: 'Departamento',
                            value: _dept,
                            items: [('', 'Todos os departamentos'), ...deptOpts(s.data?.departments ?? const [])],
                            onChanged: (v) => setState(() => _dept = v ?? ''),
                          ),
                          Select<String>(
                            label: 'Agrupamento',
                            value: _group,
                            items: [('', 'Todos os agrupamentos'), ...opts(s.data?.groupings ?? const [])],
                            onChanged: (v) => setState(() => _group = v ?? ''),
                          ),
                        ],
                      ),
                    ),
                    if (_dept.isNotEmpty)
                      Row(
                        children: [
                          Checkbox(value: _includeSub, onChanged: (v) => setState(() => _includeSub = v ?? true)),
                          const Text('Incluir subdepartamentos'),
                        ],
                      ),
                    if (_key == 'customizado') ...[
                      const SizedBox(height: 12),
                      FieldLabel('Campos (${_fields.length})'),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: [
                          for (final f in asList(cs.data!['builderFields']))
                            FilterChip(
                              label: Text('${f['label']}'),
                              selected: _fields.contains(f['key']),
                              onSelected: (v) => setState(() => v ? _fields = [..._fields, '${f['key']}'] : _fields = _fields.where((x) => x != f['key']).toList()),
                            ),
                        ],
                      ),
                    ],
                    const SizedBox(height: 16),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        GlassButton(
                          label: 'Gerar',
                          icon: Icons.play_arrow_rounded,
                          loading: _busy == 'run',
                          onPressed: () => _go('run', () async {
                            final r = asMap(await api.post('/reports/$_key/run', _body(companyId, def)));
                            if (mounted) setState(() => _result = r);
                          }),
                        ),
                        if (canExport)
                          for (final f in ['xlsx', 'csv'])
                            GlassButton(
                              label: f == 'xlsx' ? 'Excel' : 'CSV',
                              icon: f == 'xlsx' ? Icons.grid_on_rounded : Icons.description_rounded,
                              kind: BtnKind.glass,
                              loading: _busy == f,
                              onPressed: () => _go(f, () async {
                                final r = asMap(await api.post('/reports/$_key/export', _body(companyId, def), {'format': f}));
                                final path = await saveBytes(base64Decode('${r['base64']}'), '${r['filename']}', mime: '${r['mime']}');
                                if (mounted) toast(this.context, 'Arquivo salvo: $path');
                              }),
                            ),
                        if (_result != null)
                          GlassButton(
                            label: 'Imprimir / PDF',
                            icon: Icons.print_rounded,
                            kind: BtnKind.glass,
                            onPressed: () async {
                              final companies = await loadCompanies();
                              final c = companies.where((x) => x['id'] == companyId).firstOrNull;
                              final path = await printHtml(_html(_result!, c == null ? '' : '${c['legalName']}', def), '${_key}_${_period.from}.html');
                              if (context.mounted) toast(context, 'Relatório aberto para impressão: $path');
                            },
                          ),
                      ],
                    ),
                  ],
                ),
              );
              final res = _result == null
                  ? const Glass(
                      child: EmptyState(icon: Icons.bar_chart_rounded, title: 'Escolha os filtros e gere', body: 'O resultado aparece aqui; exporte em Excel ou CSV, ou imprima em PDF.'),
                    )
                  : _ResultTable(r: _result!);
              final main = Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [filters, const SizedBox(height: 14), res]);
              return isWide(context)
                  ? Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SizedBox(width: 300, child: nav),
                        const SizedBox(width: 14),
                        Expanded(child: main),
                      ],
                    )
                  : Column(children: [nav, const SizedBox(height: 14), main]);
            },
          ),
        ),
      ],
    );
  }

  String _html(Map<String, dynamic> r, String company, Map<String, dynamic> def) {
    String esc(String s) => const HtmlEscape().convert(s);
    final cols = asList(r['columns']);
    final rows = asList(r['rows']);
    final totals = asMap(r['totals']);
    bool num_(Object? ty) => ty == 'minutes' || ty == 'number' || ty == 'percent';
    final b = StringBuffer()
      ..write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc('${r['title']}')}</title>')
      ..write(
        '<style>body{font-family:system-ui,sans-serif;margin:24px;color:#111}h1{font-size:18px;margin:0}p{color:#555;margin:4px 0 16px}table{border-collapse:collapse;width:100%;font-size:11px}th,td{border-bottom:1px solid #ddd;padding:4px 6px;text-align:left}th{background:#fcc419}td.n,th.n{text-align:right}tfoot td{font-weight:700}</style></head><body>',
      )
      ..write(
        '<h1>${esc('${r['title']}')}</h1><p>${esc(company)}${def['period'] != 'none' ? ' · ${brDate(_period.from)} a ${brDate(_period.to)}' : ''} · gerado em ${brDateTime(r['generatedAt'])}</p>',
      )
      ..write('<table><thead><tr>');
    for (final c in cols) {
      b.write('<th${num_(c['type']) ? ' class="n"' : ''}>${esc('${c['label']}')}</th>');
    }
    b.write('</tr></thead><tbody>');
    for (final row in rows) {
      b.write('<tr>');
      for (final c in cols) {
        b.write('<td${num_(c['type']) ? ' class="n"' : ''}>${esc(fmtCell(row[c['key']], c['type'] as String?))}</td>');
      }
      b.write('</tr>');
    }
    b.write('</tbody>');
    if (totals.isNotEmpty) {
      b.write('<tfoot><tr>');
      for (var i = 0; i < cols.length; i++) {
        final k = cols[i]['key'];
        b.write('<td${num_(cols[i]['type']) ? ' class="n"' : ''}>${i == 0 ? 'Total' : (totals.containsKey(k) ? esc(fmtCell(totals[k], cols[i]['type'] as String?)) : '')}</td>');
      }
      b.write('</tr></tfoot>');
    }
    b.write('</table><script>window.onload=()=>window.print()</script></body></html>');
    return b.toString();
  }
}

class _ResultTable extends StatelessWidget {
  const _ResultTable({required this.r});
  final Map<String, dynamic> r;
  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final cols = asList(r['columns']);
    final rows = asList(r['rows']);
    final totals = asMap(r['totals']);
    bool isNum(Object? ty) => ty == 'minutes' || ty == 'number' || ty == 'percent';
    return Glass(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text('${r['title']}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
              ),
              Text('${rows.length} linha(s) · gerado em ${brDateTime(r['generatedAt'])}', style: TextStyle(color: t.subtle, fontSize: 12)),
            ],
          ),
          const SizedBox(height: 10),
          if (rows.isEmpty)
            const EmptyState(icon: Icons.bar_chart_rounded, title: 'Nada encontrado', body: 'Nenhuma linha com esses filtros.')
          else
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: DataTable(
                headingRowHeight: 40,
                dataRowMinHeight: 34,
                dataRowMaxHeight: 52,
                columnSpacing: 22,
                headingTextStyle: TextStyle(color: t.subtle, fontWeight: FontWeight.w600, fontSize: 12),
                columns: [for (final c in cols) DataColumn(label: Text('${c['label']}'), numeric: isNum(c['type']))],
                rows: [
                  for (final row in rows.take(3000))
                    DataRow(
                      cells: [
                        for (final c in cols)
                          DataCell(
                            Text(
                              fmtCell(row[c['key']], c['type'] as String?),
                              style: TextStyle(
                                fontSize: 13,
                                color: c['type'] == 'minutes' && ((row[c['key']] as num?) ?? 0) < 0 ? t.danger : null,
                                fontFeatures: isNum(c['type']) ? const [FontFeature.tabularFigures()] : null,
                              ),
                            ),
                          ),
                      ],
                    ),
                  if (totals.isNotEmpty)
                    DataRow(
                      color: WidgetStatePropertyAll(t.brand.withValues(alpha: 0.08)),
                      cells: [
                        for (var i = 0; i < cols.length; i++)
                          DataCell(
                            Text(
                              i == 0 ? 'Total' : (totals.containsKey(cols[i]['key']) ? fmtCell(totals[cols[i]['key']], cols[i]['type'] as String?) : ''),
                              style: const TextStyle(fontWeight: FontWeight.w700),
                            ),
                          ),
                      ],
                    ),
                ],
              ),
            ),
          if (rows.length > 3000)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text('Mostrando 3.000 de ${rows.length} linhas: exporte em Excel ou CSV para ver tudo.', style: TextStyle(color: t.warning)),
            ),
        ],
      ),
    );
  }
}
