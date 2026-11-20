// Painel ao vivo: quem está trabalhando, em intervalo, atrasado ou ainda vai entrar. Atualiza a cada 30 s.
import 'dart:async';

import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/glass.dart';
import '../core/tokens.dart';
import '../widgets/company_scope.dart';
import '../widgets/ui.dart';

class LivePage extends StatefulWidget {
  const LivePage({super.key});
  @override
  State<LivePage> createState() => _LivePageState();
}

class _LivePageState extends State<LivePage> {
  String _filter = '';
  int _tick = 0;
  late final Timer _timer = Timer.periodic(const Duration(seconds: 30), (_) => setState(() => _tick++));

  @override
  void dispose() {
    _timer.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final order = [
      ('LATE_NOW', 'Atrasados agora', t.danger),
      ('WORKING', 'Trabalhando', t.success),
      ('ON_BREAK', 'Em intervalo', t.warning),
      ('NOT_YET', 'Ainda vão entrar', t.info),
      ('LEFT', 'Já saíram', t.subtle),
      ('ABSENT', 'Não vieram', t.danger.withValues(alpha: 0.6)),
      ('LEAVE', 'Afastados/abonados', const Color(0xFFA78BFA)),
      ('OFF', 'Folga', t.muted),
      ('NO_SCHEDULE', 'Sem jornada', const Color(0xFFFB923C)),
    ];
    int rank(Object? s) => order.indexWhere((o) => o.$1 == s);
    return PageScaffold(
      title: 'Painel ao vivo',
      subtitle: 'Quem está trabalhando, em intervalo, atrasado ou ainda vai entrar agora. Atualiza sozinho a cada 30 segundos.',
      icon: Icons.monitor_heart_rounded,
      children: [
        CompanyScope(
          builder: (context, companyId, picker) => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              picker,
              const SizedBox(height: 14),
              Async<Map<String, dynamic>>(
                reloadToken: '$companyId|$_tick',
                load: () => api.getMap('/live', {'companyId': companyId}),
                builder: (context, live, _) {
                  final tot = asMap(live['totals']);
                  final rows = asList(live['rows']).where((r) => _filter.isEmpty || r['state'] == _filter).toList()
                    ..sort((a, b) {
                      final c = rank(a['state']).compareTo(rank(b['state']));
                      return c != 0 ? c : '${a['name']}'.compareTo('${b['name']}');
                    });
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.refresh_rounded, size: 16, color: t.subtle),
                              const SizedBox(width: 4),
                              Text('${brDate(live['date'])} às ${live['time']}', style: TextStyle(color: t.subtle, fontSize: 12.5)),
                            ],
                          ),
                          ChoiceChip(label: Text('Todos (${asList(live['rows']).length})'), selected: _filter.isEmpty, onSelected: (_) => setState(() => _filter = '')),
                          for (final (k, l, c) in order)
                            if ((tot[k] as num? ?? 0) > 0)
                              ChoiceChip(
                                avatar: CircleAvatar(radius: 5, backgroundColor: c),
                                label: Text('$l ${tot[k]}'),
                                selected: _filter == k,
                                onSelected: (_) => setState(() => _filter = _filter == k ? '' : k),
                              ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      if (rows.isEmpty)
                        const Glass(
                          child: EmptyState(icon: Icons.monitor_heart_rounded, title: 'Ninguém nesta situação', body: 'Troque o filtro ou a empresa.'),
                        )
                      else
                        ResponsiveGrid(
                          minItemWidth: 280,
                          children: [
                            for (final r in rows)
                              Glass(
                                padding: const EdgeInsets.all(16),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Container(
                                      width: 10,
                                      height: 10,
                                      margin: const EdgeInsets.only(top: 5),
                                      decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        color: order[rank(r['state']).clamp(0, order.length - 1)].$3,
                                        boxShadow: [BoxShadow(color: order[rank(r['state']).clamp(0, order.length - 1)].$3.withValues(alpha: 0.6), blurRadius: 8)],
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            '${r['name']}',
                                            style: const TextStyle(fontWeight: FontWeight.w600),
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                          Text(
                                            'Mat. ${r['registration']}${r['expectedStart'] != null ? ' · previsto ${r['expectedStart']}–${r['expectedEnd']}' : ''}',
                                            style: TextStyle(color: t.subtle, fontSize: 12),
                                          ),
                                          const SizedBox(height: 4),
                                          Text(_label(r), style: const TextStyle(fontSize: 13)),
                                          if ((r['punches'] as List?)?.isNotEmpty == true)
                                            Text(
                                              (r['punches'] as List).join(' · '),
                                              style: TextStyle(color: t.muted, fontSize: 12, fontFeatures: const [FontFeature.tabularFigures()]),
                                            ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                          ],
                        ),
                    ],
                  );
                },
              ),
            ],
          ),
        ),
      ],
    );
  }

  String _label(Map<String, dynamic> r) {
    if (r['state'] != 'LATE_NOW') return '${r['label']}';
    final m = (r['lateMinutes'] as num? ?? 0).toInt();
    return '${r['label']} há ${m ~/ 60 > 0 ? '${m ~/ 60}h' : ''}${m % 60}min';
  }
}
