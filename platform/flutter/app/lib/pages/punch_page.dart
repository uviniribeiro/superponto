// Registrar ponto (REP-P): marcação com desafio anti-robô, cerca virtual opcional e comprovante.
import 'dart:async';

import 'package:geolocator/geolocator.dart';
import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/glass.dart';
import '../core/timesheet.dart';
import '../core/tokens.dart';
import '../widgets/ui.dart';

const _labels = ['Entrada', 'Saída para o intervalo', 'Volta do intervalo', 'Saída'];

class PunchPage extends StatefulWidget {
  const PunchPage({super.key});
  @override
  State<PunchPage> createState() => _PunchPageState();
}

class _PunchPageState extends State<PunchPage> {
  String? _employment;
  Map<String, dynamic>? _receipt;
  bool _busy = false;
  int _token = 0;

  Future<Map<String, Object?>?> _position() async {
    try {
      if (!await Geolocator.isLocationServiceEnabled()) return null;
      var p = await Geolocator.checkPermission();
      if (p == LocationPermission.denied) p = await Geolocator.requestPermission();
      if (p == LocationPermission.denied || p == LocationPermission.deniedForever) return null;
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 10)),
      );
      return {'latitude': pos.latitude, 'longitude': pos.longitude, 'accuracy': pos.accuracy.round()};
    } catch (_) {
      return null;
    }
  }

  Future<void> _punch(Map<String, dynamic>? emp) async {
    setState(() => _busy = true);
    try {
      final ch = asMap(await api.post('/punch/challenge'));
      final loc = emp?['geofence'] != null ? await _position() : null;
      final r = asMap(await api.post('/punch', {'token': ch['token'], 'employmentId': _employment, ...?loc}));
      if (!mounted) return;
      setState(() {
        _receipt = r;
        _token++;
      });
    } catch (e) {
      if (mounted) toast(context, '$e', error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    return PageScaffold(
      title: 'Registrar ponto',
      subtitle: 'Marque entrada, intervalo e saída. Cada marcação gera um comprovante e não pode ser apagada.',
      icon: Icons.fingerprint_rounded,
      maxWidth: 1100,
      children: [
        Async<Map<String, dynamic>>(
          reloadToken: _token,
          load: () => api.getMap('/punch/me'),
          builder: (context, me, _) {
            final emps = asList(me['employments']);
            if (emps.isEmpty) {
              return const Glass(
                child: EmptyState(icon: Icons.person_off_rounded, title: 'Sem vínculo para marcar', body: 'Seu usuário não está ligado a um funcionário ativo.'),
              );
            }
            _employment ??= emps.first['id'] as String;
            final emp = emps.where((e) => e['id'] == _employment).firstOrNull;
            final today = asList(me['punches']).where((p) => p['employmentId'] == _employment).toList();
            final main = Glass(
              padding: const EdgeInsets.all(28),
              child: Column(
                children: [
                  const _Clock(),
                  if (emps.length > 1) ...[
                    const SizedBox(height: 14),
                    Select<String>(
                      label: 'Vínculo',
                      value: _employment,
                      items: [for (final e in emps) (e['id'] as String, '${e['company']} · matrícula ${e['registration']}')],
                      onChanged: (v) => setState(() => _employment = v),
                    ),
                  ],
                  const SizedBox(height: 26),
                  _PunchButton(busy: _busy, label: _labels.elementAtOrNull(today.length) ?? 'Marcação extra', onTap: () => _punch(emp)),
                  const SizedBox(height: 22),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(emp?['geofence'] != null ? Icons.place_rounded : Icons.verified_user_rounded, size: 16, color: t.muted),
                      const SizedBox(width: 6),
                      Flexible(
                        child: Text(
                          emp?['geofence'] != null
                              ? 'Precisa estar a até ${asMap(emp!['geofence'])['radiusM']} m de ${asMap(emp['geofence'])['name']}: o aparelho vai pedir sua localização'
                              : 'Marcação protegida contra robôs e repetição',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: t.muted, fontSize: 13),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            );
            final side = Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                AnimatedSwitcher(
                  duration: const Duration(milliseconds: 300),
                  child: _receipt == null ? const SizedBox.shrink() : _Receipt(key: ValueKey(_receipt!['id']), r: _receipt!),
                ),
                Glass(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const SectionTitle('Hoje'),
                      if (today.isEmpty)
                        Text('Nenhuma marcação hoje.', style: TextStyle(color: t.subtle))
                      else
                        for (var i = 0; i < today.length; i++)
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 6),
                            child: Row(
                              children: [
                                CircleAvatar(
                                  radius: 13,
                                  backgroundColor: t.brand.withValues(alpha: 0.18),
                                  child: Text(
                                    '${i + 1}',
                                    style: TextStyle(color: t.brand, fontSize: 12, fontWeight: FontWeight.w700),
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(child: Text(_labels.elementAtOrNull(i) ?? 'Extra')),
                                Text(
                                  '${today[i]['time']}',
                                  style: const TextStyle(fontWeight: FontWeight.w700, fontFeatures: [FontFeature.tabularFigures()]),
                                ),
                                const SizedBox(width: 10),
                                Pill(sourceLabel[today[i]['source']] ?? '${today[i]['source']}'),
                              ],
                            ),
                          ),
                    ],
                  ),
                ),
              ],
            );
            return isWide(context)
                ? Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(flex: 3, child: main),
                      const SizedBox(width: 14),
                      Expanded(flex: 2, child: side),
                    ],
                  )
                : Column(children: [main, const SizedBox(height: 14), side]);
          },
        ),
      ],
    );
  }
}

class _Clock extends StatefulWidget {
  const _Clock();
  @override
  State<_Clock> createState() => _ClockState();
}

class _ClockState extends State<_Clock> {
  late final Timer _timer = Timer.periodic(const Duration(seconds: 1), (_) => setState(() {}));
  @override
  void dispose() {
    _timer.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final n = toBr(DateTime.now());
    const wd = ['segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado', 'domingo'];
    return Column(
      children: [
        Text.rich(
          TextSpan(
            children: [
              TextSpan(text: '${two(n.hour)}:${two(n.minute)}'),
              TextSpan(
                text: ':${two(n.second)}',
                style: TextStyle(color: t.subtle, fontSize: 34),
              ),
            ],
          ),
          style: TextStyle(fontSize: 64, fontWeight: FontWeight.w800, letterSpacing: -2, color: t.fg, fontFeatures: const [FontFeature.tabularFigures()]),
        ),
        Text('${wd[n.weekday - 1]}, ${n.day} de ${months[n.month - 1].toLowerCase()} · horário de Brasília', style: TextStyle(color: t.muted)),
      ],
    );
  }
}

class _PunchButton extends StatefulWidget {
  const _PunchButton({required this.busy, required this.label, required this.onTap});
  final bool busy;
  final String label;
  final VoidCallback onTap;
  @override
  State<_PunchButton> createState() => _PunchButtonState();
}

class _PunchButtonState extends State<_PunchButton> with SingleTickerProviderStateMixin {
  late final AnimationController _pulse = AnimationController(vsync: this, duration: const Duration(milliseconds: 2400))..repeat();
  bool _down = false;
  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    return Semantics(
      button: true,
      label: 'Marcar agora',
      child: GestureDetector(
        onTapDown: (_) => setState(() => _down = true),
        onTapCancel: () => setState(() => _down = false),
        onTapUp: (_) => setState(() => _down = false),
        onTap: widget.busy ? null : widget.onTap,
        child: MouseRegion(
          cursor: SystemMouseCursors.click,
          child: AnimatedScale(
            scale: _down ? 0.94 : 1,
            duration: const Duration(milliseconds: 140),
            child: SizedBox.square(
              dimension: 220,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  AnimatedBuilder(
                    animation: _pulse,
                    builder: (_, _) => Container(
                      width: 180 + 40 * _pulse.value,
                      height: 180 + 40 * _pulse.value,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: t.brand.withValues(alpha: 0.25 * (1 - _pulse.value)),
                      ),
                    ),
                  ),
                  Container(
                    width: 180,
                    height: 180,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [t.brandStrong, t.brand, t.brandDeep]),
                      boxShadow: [BoxShadow(color: t.brand.withValues(alpha: 0.45), blurRadius: 40, offset: const Offset(0, 14))],
                      border: Border.all(color: Colors.white.withValues(alpha: 0.4), width: 1.5),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        widget.busy ? SizedBox.square(dimension: 46, child: CircularProgressIndicator(color: t.onBrand, strokeWidth: 3)) : Icon(Icons.fingerprint_rounded, size: 58, color: t.onBrand),
                        const SizedBox(height: 6),
                        Text(
                          widget.busy ? 'Registrando…' : 'Marcar agora',
                          style: TextStyle(color: t.onBrand, fontWeight: FontWeight.w800, fontSize: 16),
                        ),
                        Text(widget.label, style: TextStyle(color: t.onBrand.withValues(alpha: 0.7), fontSize: 12)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Receipt extends StatelessWidget {
  const _Receipt({super.key, required this.r});
  final Map<String, dynamic> r;
  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final rows = [
      ('Funcionário', '${r['employee']} · matrícula ${r['registration']}'),
      ('Empresa', '${r['company']}${r['cnpj'] != null ? ' · CNPJ ${fmtCnpj(r['cnpj'])}' : ''}'),
      ('Data e hora', '${brDate(r['date'])} às ${r['time']}'),
      if (r['nsr'] != null) ('NSR', '${r['nsr']}'),
      if (r['appDevice'] != null) ('Aparelho', '${r['appDevice']}'),
    ];
    return Glass(
      margin: const EdgeInsets.only(bottom: 14),
      tint: t.success,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(Icons.check_circle_rounded, color: t.success),
              const SizedBox(width: 8),
              const Text('Comprovante de marcação', style: TextStyle(fontWeight: FontWeight.w700)),
            ],
          ),
          const SizedBox(height: 10),
          for (final (k, v) in rows)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 3),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 100,
                    child: Text(k, style: TextStyle(color: t.subtle, fontSize: 13)),
                  ),
                  Expanded(child: Text(v)),
                ],
              ),
            ),
          const SizedBox(height: 8),
          SelectableText(
            'Código: ${r['hash']}',
            style: TextStyle(color: t.muted, fontSize: 12, fontFamily: 'monospace'),
          ),
          if (r['footer'] != null)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text('${r['footer']}', style: TextStyle(color: t.subtle, fontSize: 12)),
            ),
        ],
      ),
    );
  }
}
