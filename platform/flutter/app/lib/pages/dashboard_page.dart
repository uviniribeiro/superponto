import 'dart:math' as math;

import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/glass.dart';
import '../core/tokens.dart';
import '../widgets/ui.dart';

const _scope = {'NATIONAL': 'Nacional', 'STATE': 'Estadual', 'MUNICIPAL': 'Municipal', 'COMPANY': 'Empresa'};
const _monthsShort = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

class DashboardPage extends StatelessWidget {
  const DashboardPage({super.key});

  @override
  Widget build(BuildContext context) {
    final me = api.me!;
    final now = DateTime.now();
    final greeting = now.hour < 12
        ? 'Bom dia'
        : now.hour < 18
        ? 'Boa tarde'
        : 'Boa noite';
    final first = me.displayName.split(' ').first;
    const wd = ['segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado', 'domingo'];
    final date = '${wd[now.weekday - 1]}, ${now.day} de ${months[now.month - 1].toLowerCase()}';
    final hasTenant = api.activeTenant != null;
    return PageScaffold(
      title: '$greeting, $first',
      subtitle: date,
      actions: [
        if (me.can('time.records:create')) GlassButton(label: 'Registrar ponto', icon: Icons.fingerprint_rounded, onPressed: () => context.go('/ponto/registrar')),
        if (me.can('people.employments:read') && hasTenant) GlassButton(label: 'Funcionários', icon: Icons.groups_rounded, kind: BtnKind.glass, onPressed: () => context.go('/funcionarios')),
      ],
      children: [
        if (hasTenant) const AnnouncementsBanner(),
        if (!hasTenant)
          ResponsiveGrid(
            children: [StatTile(label: 'Permissões', value: '${me.permissions.length}', icon: Icons.key_rounded, hint: 'Liberadas para o seu perfil')],
          )
        else
          Async<Map<String, dynamic>>(
            load: () => api.getMap('/dashboard/summary'),
            builder: (context, s, _) => _Body(s: s),
          ),
      ],
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({required this.s});
  final Map<String, dynamic> s;
  @override
  Widget build(BuildContext context) {
    final me = api.me!;
    final e = s['employees'] == null ? null : asMap(s['employees']);
    final st = s['structure'] == null ? null : asMap(s['structure']);
    final ac = s['access'] == null ? null : asMap(s['access']);
    final hires = [for (final v in (e?['hires'] as List? ?? const [])) (v as num).toInt()];
    final actions = <(String, IconData, String, String)>[
      if (me.can('time.calculations:read')) ('/ponto/diario', Icons.today_rounded, 'Espelho diário', 'Quem marcou hoje'),
      if (me.can('people.employments:import')) ('/funcionarios/importar', Icons.upload_file_rounded, 'Importar planilha', 'CSV com conferência'),
      if (me.can('org.holidays:read')) ('/feriados', Icons.event_rounded, 'Feriados', 'Gerados todo 1º de janeiro'),
      if (me.can('reports.reports:read')) ('/relatorios', Icons.bar_chart_rounded, 'Relatórios', 'CSV, Excel e impressão'),
      if (me.can('admin.users:read')) ('/usuarios', Icons.people_alt_rounded, 'Usuários', 'Acessos e perfis'),
      ('/manual', Icons.menu_book_rounded, 'Manual', 'Como usar cada tela'),
    ];
    final wide = isWide(context);
    final hero = e == null ? null : _Hero(e: e, st: st);
    final cal = _CalendarCard(s: s);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (wide && hero != null)
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(flex: 3, child: hero),
                const SizedBox(width: 14),
                Expanded(flex: 2, child: cal),
              ],
            ),
          )
        else ...[
          ?hero,
          if (hero != null) const SizedBox(height: 14),
          cal,
        ],
        const SizedBox(height: 14),
        ResponsiveGrid(
          children: [
            if (e != null)
              StatTile(
                label: 'Funcionários ativos',
                value: '${e['active']}',
                icon: Icons.groups_rounded,
                hint: '${e['total']} vínculo(s) no total${hires.isNotEmpty && hires.last > 0 ? ' · +${hires.last} no mês' : ''}',
                onTap: () => context.go('/funcionarios'),
              ),
            if (st != null)
              StatTile(
                label: 'Empresas',
                value: '${st['companies']}',
                icon: Icons.business_rounded,
                color: context.sp.info,
                hint: st['departments'] != null ? '${st['departments']} departamento(s)' : 'Cadastradas',
                onTap: () => context.go('/empresas'),
              ),
            if (ac != null)
              StatTile(
                label: 'Usuários ativos',
                value: '${ac['users']}',
                icon: Icons.people_alt_rounded,
                color: context.sp.success,
                hint: (ac['activeBlocks'] as num? ?? 0) > 0 ? '${ac['activeBlocks']} bloqueio(s) em vigor' : 'Nenhum bloqueio em vigor',
                onTap: () => context.go('/usuarios'),
              ),
            StatTile(
              label: 'Permissões',
              value: '${me.permissions.length}',
              icon: Icons.key_rounded,
              color: context.sp.warning,
              hint: 'Liberadas para o seu perfil',
              onTap: () => context.go('/minha-conta'),
            ),
          ],
        ),
        const SizedBox(height: 14),
        ResponsiveGrid(
          minItemWidth: 220,
          children: [
            for (final (href, icon, title, hint) in actions)
              Glass(
                padding: const EdgeInsets.all(14),
                radius: 18,
                onTap: () => context.go(href),
                child: Row(
                  children: [
                    IconBubble(icon, size: 36),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
                          Text(
                            hint,
                            style: TextStyle(color: context.sp.subtle, fontSize: 12.5),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
        if (e != null) ...[const SizedBox(height: 14), _Movement(e: e)],
      ],
    );
  }
}

class _Hero extends StatelessWidget {
  const _Hero({required this.e, this.st});
  final Map<String, dynamic> e;
  final Map<String, dynamic>? st;
  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final active = (e['active'] as num? ?? 0).toInt();
    final complete = (e['complete'] as num? ?? 0).toInt();
    final pct = active == 0 ? 0 : (complete * 100 / active).round();
    final ink = t.onBrand;
    return ClipRRect(
      borderRadius: BorderRadius.circular(SpTokens.radius),
      child: Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [t.brandStrong, t.brand, t.brandDeep]),
          boxShadow: [BoxShadow(color: t.brand.withValues(alpha: 0.3), blurRadius: 40, offset: const Offset(0, 16))],
        ),
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Positioned(
              right: -40,
              top: -60,
              child: Container(
                width: 200,
                height: 200,
                decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.white.withValues(alpha: 0.18)),
              ),
            ),
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '$active vínculo(s) ativo(s)${st != null ? ' · ${st!['companies']} empresa(s)' : ''}',
                        style: TextStyle(color: ink.withValues(alpha: 0.7), fontWeight: FontWeight.w600, fontSize: 13),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Cadastros prontos para o ponto',
                        style: TextStyle(color: ink, fontSize: 24, fontWeight: FontWeight.w800, letterSpacing: -0.6, height: 1.15),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        active > 0 ? '$complete de $active funcionários ativos têm cargo e departamento definidos.' : 'Cadastre o primeiro funcionário para começar.',
                        style: TextStyle(color: ink.withValues(alpha: 0.75), height: 1.4),
                      ),
                      const SizedBox(height: 16),
                      Wrap(
                        spacing: 24,
                        runSpacing: 8,
                        children: [
                          for (final (v, l) in [(active, 'ativos'), (st?['departments'], 'departamentos'), (st?['positions'], 'cargos')])
                            if (v != null)
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    '$v',
                                    style: TextStyle(color: ink, fontSize: 22, fontWeight: FontWeight.w800),
                                  ),
                                  Text(l, style: TextStyle(color: ink.withValues(alpha: 0.65), fontSize: 12)),
                                ],
                              ),
                        ],
                      ),
                    ],
                  ),
                ),
                if (MediaQuery.sizeOf(context).width > 520) ...[const SizedBox(width: 16), _Ring(percent: pct, ink: ink)],
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Ring extends StatelessWidget {
  const _Ring({required this.percent, required this.ink});
  final int percent;
  final Color ink;
  @override
  Widget build(BuildContext context) => TweenAnimationBuilder<double>(
    tween: Tween(begin: 0, end: percent / 100),
    duration: const Duration(milliseconds: 1400),
    curve: Curves.easeOutCubic,
    builder: (_, v, _) => SizedBox.square(
      dimension: 130,
      child: CustomPaint(
        painter: _RingPainter(v, ink),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                '${(v * 100).round()}%',
                style: TextStyle(color: ink, fontSize: 26, fontWeight: FontWeight.w800),
              ),
              Text('completos', style: TextStyle(color: ink.withValues(alpha: 0.65), fontSize: 12)),
            ],
          ),
        ),
      ),
    ),
  );
}

class _RingPainter extends CustomPainter {
  _RingPainter(this.v, this.ink);
  final double v;
  final Color ink;
  @override
  void paint(Canvas canvas, Size size) {
    final c = size.center(Offset.zero);
    final r = size.width / 2 - 8;
    final base = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 10
      ..color = ink.withValues(alpha: 0.12);
    canvas.drawCircle(c, r, base);
    canvas.drawArc(
      Rect.fromCircle(center: c, radius: r),
      -math.pi / 2,
      2 * math.pi * v,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 10
        ..strokeCap = StrokeCap.round
        ..color = Colors.white,
    );
  }

  @override
  bool shouldRepaint(_RingPainter o) => o.v != v;
}

class _CalendarCard extends StatelessWidget {
  const _CalendarCard({required this.s});
  final Map<String, dynamic> s;
  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final today = DateTime.parse('${s['today']}T12:00:00Z');
    final dow = today.weekday % 7;
    final holidays = asList(s['holidays']);
    return Glass(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Text(
                two(today.day),
                style: TextStyle(fontSize: 40, fontWeight: FontWeight.w800, color: t.brand, height: 1),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('${_monthsShort[today.month - 1]} ${today.year}', style: const TextStyle(fontWeight: FontWeight.w600)),
                    Text(holidays.isEmpty ? 'sem feriados próximos' : '${holidays.length} feriado(s) próximo(s)', style: TextStyle(color: t.muted, fontSize: 12.5)),
                  ],
                ),
              ),
              IconButton(
                tooltip: 'Feriados',
                onPressed: () => context.go('/feriados'),
                icon: Icon(Icons.event_rounded, color: t.muted),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              for (var i = 0; i < 7; i++)
                Expanded(
                  child: Container(
                    margin: const EdgeInsets.symmetric(horizontal: 2),
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), color: i == dow ? t.brand : Colors.transparent),
                    child: Column(
                      children: [
                        Text(const ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'][i], style: TextStyle(fontSize: 11, color: i == dow ? t.onBrand : t.subtle)),
                        Text(
                          '${today.add(Duration(days: i - dow)).day}',
                          style: TextStyle(fontWeight: FontWeight.w700, color: i == dow ? t.onBrand : t.fg),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          if (holidays.isEmpty)
            Text(s['holidays'] == null ? 'Cadastre uma empresa para ver os feriados.' : 'Nenhum feriado nos próximos meses.', style: TextStyle(color: t.muted, fontSize: 13))
          else
            for (final h in holidays.take(4))
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 5),
                child: Row(
                  children: [
                    SizedBox(
                      width: 48,
                      child: Text(
                        brDate(h['date']).substring(0, 5),
                        style: TextStyle(color: t.brand, fontWeight: FontWeight.w700, fontSize: 13),
                      ),
                    ),
                    Expanded(child: Text('${h['name']}', overflow: TextOverflow.ellipsis)),
                    Text(_scope[h['scope']] ?? '${h['scope']}', style: TextStyle(color: t.subtle, fontSize: 12)),
                  ],
                ),
              ),
        ],
      ),
    );
  }
}

class _Movement extends StatelessWidget {
  const _Movement({required this.e});
  final Map<String, dynamic> e;
  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final ms = (e['months'] as List? ?? const []).cast<String>();
    final hires = [for (final v in (e['hires'] as List? ?? const [])) (v as num).toInt()];
    final terms = [for (final v in (e['terminations'] as List? ?? const [])) (v as num).toInt()];
    final max = [1, ...hires, ...terms].reduce(math.max);
    return Glass(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SectionTitle(
            'Movimentação',
            trailing: Wrap(
              spacing: 12,
              children: [
                for (final (c, l) in [(t.brand, 'Admissões'), (t.muted, 'Desligamentos')])
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(color: c, shape: BoxShape.circle),
                      ),
                      const SizedBox(width: 6),
                      Text(l, style: TextStyle(fontSize: 12, color: t.muted)),
                    ],
                  ),
              ],
            ),
          ),
          Text('Admissões e desligamentos nos últimos 6 meses', style: TextStyle(color: t.muted, fontSize: 13)),
          const SizedBox(height: 16),
          SizedBox(
            height: 140,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                for (var i = 0; i < ms.length; i++)
                  Expanded(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        Expanded(
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              for (final (v, c) in [(i < hires.length ? hires[i] : 0, t.brand), (i < terms.length ? terms[i] : 0, t.muted.withValues(alpha: 0.5))])
                                Tooltip(
                                  message: '$v',
                                  child: TweenAnimationBuilder<double>(
                                    tween: Tween(begin: 0, end: math.max(0.03, v / max)),
                                    duration: Duration(milliseconds: 700 + i * 60),
                                    curve: Curves.easeOutCubic,
                                    builder: (_, f, _) => LayoutBuilder(
                                      builder: (_, cons) => Container(
                                        width: 12,
                                        height: cons.maxHeight * f,
                                        margin: const EdgeInsets.symmetric(horizontal: 2),
                                        decoration: BoxDecoration(color: c, borderRadius: BorderRadius.circular(6)),
                                      ),
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(_monthsShort[int.parse(ms[i].substring(5, 7)) - 1], style: TextStyle(fontSize: 12, color: t.subtle)),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Mensagem do cliente e avisos vigentes, com "li e entendi".
class AnnouncementsBanner extends StatefulWidget {
  const AnnouncementsBanner({super.key});
  @override
  State<AnnouncementsBanner> createState() => _AnnouncementsBannerState();
}

class _AnnouncementsBannerState extends State<AnnouncementsBanner> {
  late Future<(String, List<Map<String, dynamic>>)> _f = _load();

  Future<(String, List<Map<String, dynamic>>)> _load() async {
    final texts = await api.getList('/custom-texts').catchError((_) => <Map<String, dynamic>>[]);
    final msg = texts.where((t) => t['key'] == 'DASHBOARD_MESSAGE').map((t) => '${t['text'] ?? ''}').firstOrNull ?? '';
    final anns = await api.getList('/announcements/active').catchError((_) => <Map<String, dynamic>>[]);
    return (msg, anns.where((a) => a['readAt'] == null || a['level'] == 'IMPORTANT').toList());
  }

  @override
  Widget build(BuildContext context) => FutureBuilder(
    future: _f,
    builder: (context, s) {
      final d = s.data;
      if (d == null || (d.$1.isEmpty && d.$2.isEmpty)) return const SizedBox.shrink();
      final t = context.sp;
      return Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: Column(
          children: [
            if (d.$1.isNotEmpty)
              Glass(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(14),
                tint: t.info,
                child: Row(
                  children: [
                    Icon(Icons.info_outline_rounded, color: t.info),
                    const SizedBox(width: 12),
                    Expanded(child: Text(d.$1)),
                  ],
                ),
              ),
            for (final a in d.$2)
              Glass(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(14),
                tint: a['level'] == 'IMPORTANT' ? t.warning : t.brand,
                child: Row(
                  children: [
                    Icon(Icons.campaign_rounded, color: a['level'] == 'IMPORTANT' ? t.warning : t.brand),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('${a['title']}', style: const TextStyle(fontWeight: FontWeight.w600)),
                          Text('${a['body']}', style: TextStyle(color: t.muted)),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    if (a['readAt'] != null)
                      Pill('Lido', color: t.success)
                    else
                      GlassButton(
                        small: true,
                        kind: BtnKind.glass,
                        label: a['requireAck'] == true ? 'Li e entendi' : 'Ok',
                        onPressed: () async {
                          await run(context, () => api.post('/announcements/${a['id']}/read'));
                          setState(() => _f = _load());
                        },
                      ),
                  ],
                ),
              ),
          ],
        ),
      );
    },
  );
}
