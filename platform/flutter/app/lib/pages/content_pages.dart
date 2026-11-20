// Manual do sistema e Conformidade MTE (mesmo conteúdo da web, empacotado no app).
import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../core/glass.dart';
import '../core/tokens.dart';
import '../widgets/ui.dart';

Future<Map<String, dynamic>> _json(String name) async => (jsonDecode(await rootBundle.loadString('assets/content/$name.json')) as Map).cast<String, dynamic>();

class ManualPage extends StatefulWidget {
  const ManualPage({super.key});
  @override
  State<ManualPage> createState() => _ManualPageState();
}

class _ManualPageState extends State<ManualPage> {
  final _keys = <String, GlobalKey>{};
  String _q = '';

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    return Async<Map<String, dynamic>>(
      load: () => _json('manual'),
      builder: (context, d, _) {
        final sections = asList(d['sections']).where((s) => _q.isEmpty || jsonEncode(s).toLowerCase().contains(_q.toLowerCase())).toList();
        final index = Glass(
          padding: const EdgeInsets.all(10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (final s in sections)
                ListTile(
                  dense: true,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  title: Text('${s['title']}'),
                  onTap: () {
                    final c = _keys[s['id']]?.currentContext;
                    if (c != null) Scrollable.ensureVisible(c, duration: const Duration(milliseconds: 400), curve: Curves.easeOutCubic);
                  },
                ),
            ],
          ),
        );
        final body = Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (final s in sections)
              Glass(
                key: _keys.putIfAbsent('${s['id']}', GlobalKey.new),
                margin: const EdgeInsets.only(bottom: 14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: 8,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Text('${s['title']}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                        Pill('${s['audience']}', color: t.info),
                      ],
                    ),
                    const SizedBox(height: 8),
                    for (final p in (s['body'] as List? ?? const []))
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Text('$p', style: TextStyle(color: t.muted, height: 1.5)),
                      ),
                    if ((s['steps'] as List?)?.isNotEmpty == true)
                      for (var i = 0; i < (s['steps'] as List).length; i++)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 4),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              CircleAvatar(
                                radius: 11,
                                backgroundColor: t.brand.withValues(alpha: 0.2),
                                child: Text(
                                  '${i + 1}',
                                  style: TextStyle(color: t.brand, fontSize: 11, fontWeight: FontWeight.w700),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(child: Text('${(s['steps'] as List)[i]}', style: const TextStyle(height: 1.45))),
                            ],
                          ),
                        ),
                    if ((s['tips'] as List?)?.isNotEmpty == true)
                      Glass(
                        margin: const EdgeInsets.only(top: 10),
                        radius: 14,
                        tint: t.brand,
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Dica',
                              style: TextStyle(color: t.brand, fontWeight: FontWeight.w700),
                            ),
                            for (final tip in s['tips'] as List)
                              Padding(
                                padding: const EdgeInsets.only(top: 4),
                                child: Text('$tip', style: const TextStyle(height: 1.45)),
                              ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
          ],
        );
        return PageScaffold(
          title: 'Manual do sistema',
          subtitle: '${d['version']}',
          icon: Icons.menu_book_rounded,
          actions: [SearchField(hint: 'Buscar no manual…', onChanged: (v) => setState(() => _q = v))],
          children: [
            if (sections.isEmpty)
              const Glass(
                child: EmptyState(icon: Icons.search_off_rounded, title: 'Nada encontrado no manual'),
              ),
            if (sections.isNotEmpty)
              isWide(context)
                  ? Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SizedBox(width: 280, child: index),
                        const SizedBox(width: 14),
                        Expanded(child: body),
                      ],
                    )
                  : body,
          ],
        );
      },
    );
  }
}

class CompliancePage extends StatefulWidget {
  const CompliancePage({super.key});
  @override
  State<CompliancePage> createState() => _CompliancePageState();
}

class _CompliancePageState extends State<CompliancePage> {
  String _filter = 'todos';

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final style = {
      'feito': (Icons.check_circle_rounded, t.success),
      'andamento': (Icons.construction_rounded, t.brand),
      'planejado': (Icons.radio_button_unchecked_rounded, t.muted),
      'cliente': (Icons.business_rounded, t.info),
      'fornecedor': (Icons.schedule_rounded, t.warning),
    };
    return Async<Map<String, dynamic>>(
      load: () => _json('conformidade'),
      builder: (context, d, _) {
        final labels = asMap(d['statusLabel']);
        final groups = asList(d['groups']);
        final count = <String, int>{};
        var total = 0;
        for (final g in groups) {
          for (final i in asList(g['items'])) {
            count['${i['status']}'] = (count['${i['status']}'] ?? 0) + 1;
            total++;
          }
        }
        return PageScaffold(
          title: 'Conformidade MTE',
          subtitle: 'Exigências legais do registro de ponto e o que o SuperPonto já atende · revisado em ${d['lastReview']}',
          icon: Icons.balance_rounded,
          children: [
            ResponsiveGrid(
              minItemWidth: 200,
              children: [
                for (final (k, v) in [
                  ('feito', count['feito'] ?? 0),
                  ('andamento', count['andamento'] ?? 0),
                  ('planejado', count['planejado'] ?? 0),
                  ('fornecedor', (count['fornecedor'] ?? 0) + (count['cliente'] ?? 0)),
                ])
                  StatTile(label: k == 'fornecedor' ? 'Ações fora do software' : '${labels[k]}', value: '$v', hint: 'de $total exigências', icon: style[k]!.$1, color: style[k]!.$2),
              ],
            ),
            const SizedBox(height: 12),
            Text('${d['disclaimer']}', style: TextStyle(color: t.subtle, fontSize: 12.5)),
            const SizedBox(height: 14),
            Align(
              alignment: Alignment.centerLeft,
              child: GlassTabs(
                tabs: [
                  for (final f in ['todos', 'feito', 'andamento', 'planejado', 'fornecedor', 'cliente']) f == 'todos' ? 'Todas' : '${labels[f]}',
                ],
                index: ['todos', 'feito', 'andamento', 'planejado', 'fornecedor', 'cliente'].indexOf(_filter),
                onChanged: (i) => setState(() => _filter = ['todos', 'feito', 'andamento', 'planejado', 'fornecedor', 'cliente'][i]),
              ),
            ),
            const SizedBox(height: 14),
            for (final g in groups)
              Builder(
                builder: (_) {
                  final items = asList(g['items']).where((i) => _filter == 'todos' || i['status'] == _filter).toList();
                  if (items.isEmpty) return const SizedBox.shrink();
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 18),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text('${g['title']}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                        Padding(
                          padding: const EdgeInsets.only(top: 4, bottom: 10),
                          child: Text('${g['intro']}', style: TextStyle(color: t.muted)),
                        ),
                        ResponsiveGrid(
                          minItemWidth: 420,
                          children: [
                            for (final i in items)
                              Glass(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Expanded(
                                          child: Text('${i['title']}', style: const TextStyle(fontWeight: FontWeight.w700)),
                                        ),
                                        const SizedBox(width: 8),
                                        Pill('${labels[i['status']] ?? i['status']}', color: style[i['status']]?.$2),
                                      ],
                                    ),
                                    const SizedBox(height: 6),
                                    Text('${i['rule']}', style: TextStyle(color: t.muted, height: 1.45)),
                                    const SizedBox(height: 6),
                                    Text('Base legal: ${i['basis']}', style: TextStyle(color: t.subtle, fontSize: 12)),
                                    const SizedBox(height: 8),
                                    Text.rich(
                                      TextSpan(
                                        children: [
                                          TextSpan(
                                            text: 'No SuperPonto: ',
                                            style: TextStyle(color: t.brand, fontWeight: FontWeight.w600),
                                          ),
                                          TextSpan(text: '${i['howWe']}'),
                                        ],
                                      ),
                                      style: const TextStyle(height: 1.45),
                                    ),
                                  ],
                                ),
                              ),
                          ],
                        ),
                      ],
                    ),
                  );
                },
              ),
          ],
        );
      },
    );
  }
}
