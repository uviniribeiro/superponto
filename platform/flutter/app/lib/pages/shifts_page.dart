// Plantões (saúde): escala de plantonistas por unidade, cobertura, status, trocas com aprovação. Só dados administrativos.
import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/glass.dart';
import '../core/schedules.dart' show validHm, toMin;
import '../core/timesheet.dart';
import '../core/tokens.dart';
import '../widgets/company_options.dart';
import '../widgets/company_scope.dart';
import '../widgets/masked.dart';
import '../widgets/ui.dart';

const _kind = {'DAY': 'Diurno', 'NIGHT': 'Noturno', 'H12': '12 horas', 'H24': '24 horas', 'ON_CALL': 'Sobreaviso', 'EXTRA': 'Extra', 'COVERAGE': 'Cobertura'};
const _st = {'SCHEDULED': 'Escalado', 'CONFIRMED': 'Confirmado', 'IN_PROGRESS': 'Em plantão', 'COMPLETED': 'Concluído', 'ABSENT': 'Faltou', 'SUBSTITUTED': 'Substituído'};

class ShiftsPage extends StatefulWidget {
  const ShiftsPage({super.key});
  @override
  State<ShiftsPage> createState() => _ShiftsPageState();
}

class _ShiftsPageState extends State<ShiftsPage> {
  String _start = todayIso();
  String? _unit, _company;
  int _token = 0;
  Future<CompanyOptions>? _opt;

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final manage = api.can('health.shifts:manage');
    final end = addDays(_start, 6);
    return PageScaffold(
      title: 'Plantões',
      subtitle: 'Escala de plantonistas por unidade: cobertura, conflitos de horário e trocas com aprovação. Só dados administrativos.',
      icon: Icons.medical_services_rounded,
      children: [
        CompanyScope(
          builder: (context, companyId, picker) {
            if (_company != companyId) {
              _company = companyId;
              _unit = null;
              _opt = CompanyOptions.load(companyId!);
            }
            return FutureBuilder<CompanyOptions>(
              future: _opt,
              builder: (context, os) {
                if (!os.hasData) return const Loading();
                final o = os.data!;
                if (o.units.isEmpty) {
                  return const Glass(
                    child: EmptyState(icon: Icons.place_rounded, title: 'Cadastre uma unidade', body: 'Em Organização › Unidades e locais (ex.: Pronto-socorro, UTI).'),
                  );
                }
                _unit ??= o.units.first.$1;
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Wrap(
                      spacing: 10,
                      runSpacing: 10,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        picker,
                        Select<String>(width: 240, label: 'Unidade', value: _unit, items: o.units, onChanged: (v) => setState(() => _unit = v)),
                        Glass(
                          radius: 999,
                          padding: const EdgeInsets.symmetric(horizontal: 4),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              IconButton(tooltip: 'Semana anterior', onPressed: () => setState(() => _start = addDays(_start, -7)), icon: const Icon(Icons.chevron_left_rounded)),
                              Text('${brDate(_start)} a ${brDate(end)}', style: const TextStyle(fontWeight: FontWeight.w600)),
                              IconButton(tooltip: 'Próxima semana', onPressed: () => setState(() => _start = addDays(_start, 7)), icon: const Icon(Icons.chevron_right_rounded)),
                            ],
                          ),
                        ),
                        if (manage) GlassButton(label: 'Novo plantão', icon: Icons.add_rounded, onPressed: () => _create()),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Async<List<Map<String, dynamic>>>(
                      reloadToken: '$_unit|$_start|$_token',
                      load: () => api.getList('/health/shifts', {'unitId': _unit, 'from': _start, 'to': end}),
                      builder: (context, shifts, _) {
                        if (shifts.isEmpty) {
                          return const Glass(
                            child: EmptyState(
                              icon: Icons.monitor_heart_rounded,
                              title: 'Nenhum plantão nesta semana',
                              body: 'Crie os plantões (pode repetir por vários dias) e escale os profissionais.',
                            ),
                          );
                        }
                        final missing = shifts.fold<num>(0, (s, x) => s + (x['missing'] as num? ?? 0));
                        final required = shifts.fold<num>(0, (s, x) => s + (x['requiredProfessionals'] as num? ?? 0));
                        final covered = shifts.fold<num>(0, (s, x) => s + (x['covered'] as num? ?? 0));
                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            ResponsiveGrid(
                              minItemWidth: 200,
                              children: [
                                StatTile(label: 'Plantões na semana', value: '${shifts.length}', icon: Icons.event_note_rounded),
                                StatTile(
                                  label: 'Cobertura',
                                  value: required == 0 ? '—' : '${(covered * 100 / required).round()}%',
                                  icon: Icons.verified_rounded,
                                  color: missing == 0 ? t.success : t.warning,
                                ),
                                StatTile(label: 'Vagas sem plantonista', value: '$missing', icon: Icons.person_search_rounded, color: missing == 0 ? t.success : t.danger),
                              ],
                            ),
                            const SizedBox(height: 14),
                            ResponsiveGrid(
                              minItemWidth: 340,
                              children: [for (final s in shifts) _ShiftCard(s: s, manage: manage, employees: o.employees, onChanged: () => setState(() => _token++))],
                            ),
                          ],
                        );
                      },
                    ),
                  ],
                );
              },
            );
          },
        ),
      ],
    );
  }

  Future<void> _create() async {
    final ok = await showGlassDialog<bool>(
      context,
      title: 'Novo plantão',
      width: 560,
      builder: (_) => _ShiftForm(unitId: _unit!, date: _start),
    );
    if (ok == true && mounted) setState(() => _token++);
  }
}

class _ShiftCard extends StatelessWidget {
  const _ShiftCard({required this.s, required this.manage, required this.employees, required this.onChanged});
  final Map<String, dynamic> s;
  final bool manage;
  final List<(String, String)> employees;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final req = (s['requiredProfessionals'] as num? ?? 1).toInt();
    final cov = (s['covered'] as num? ?? 0).toInt();
    final starts = toBr(DateTime.parse('${s['startsAt']}'));
    final as = asList(s['assignments']);
    return Glass(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${wdShort[starts.weekday % 7]} ${two(starts.day)}/${two(starts.month)} · ${brTime(s['startsAt'])}–${brTime(s['endsAt'])}',
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    Text('${_kind[s['kind']] ?? s['kind']} · $cov/$req profissional(is)', style: TextStyle(color: t.muted, fontSize: 12.5)),
                  ],
                ),
              ),
              if (manage) RowAction(Icons.person_add_alt_1_rounded, 'Escalar profissional', () => _assign(context)),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: LinearProgressIndicator(value: req == 0 ? 0 : (cov / req).clamp(0, 1), minHeight: 6, backgroundColor: t.hover, color: cov >= req ? t.success : t.warning),
          ),
          const SizedBox(height: 8),
          if (as.isEmpty) Text('Sem plantonista', style: TextStyle(color: t.danger, fontSize: 13)),
          for (final a in as)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Wrap(
                spacing: 6,
                runSpacing: 4,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  Text('${a['name']}', style: TextStyle(decoration: a['status'] == 'SUBSTITUTED' ? TextDecoration.lineThrough : null)),
                  if (manage && !['SUBSTITUTED', 'COMPLETED'].contains(a['status']))
                    PopupMenuButton<String>(
                      tooltip: 'Situação',
                      onSelected: (v) async {
                        if (await act(context, () => api.post('/health/assignments/${a['id']}/status', {'status': v}))) onChanged();
                      },
                      itemBuilder: (_) => [
                        for (final k in ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'ABSENT']) PopupMenuItem(value: k, child: Text(_st[k]!)),
                      ],
                      child: Pill('${_st[a['status']] ?? a['status']} ▾', color: _color(context, a['status'])),
                    )
                  else
                    Pill(_st[a['status']] ?? '${a['status']}', color: _color(context, a['status'])),
                  if (manage && a['pendingSubstitution'] != null) ...[
                    TextButton(
                      onPressed: () async {
                        if (await act(context, () => api.post('/health/substitutions/${a['pendingSubstitution']}/decide', {'approve': true}), success: 'Troca aprovada')) onChanged();
                      },
                      child: const Text('Aprovar troca'),
                    ),
                    TextButton(
                      onPressed: () async {
                        if (await act(context, () => api.post('/health/substitutions/${a['pendingSubstitution']}/decide', {'approve': false}), success: 'Troca recusada')) onChanged();
                      },
                      child: const Text('Recusar'),
                    ),
                  ],
                  if (manage && a['pendingSubstitution'] == null && ['SCHEDULED', 'CONFIRMED'].contains(a['status'])) RowAction(Icons.repeat_rounded, 'Pedir troca', () => _substitute(context, a)),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Color _color(BuildContext c, Object? s) => switch (s) {
    'CONFIRMED' || 'COMPLETED' => c.sp.success,
    'IN_PROGRESS' => c.sp.info,
    'ABSENT' => c.sp.danger,
    'SUBSTITUTED' => c.sp.muted,
    _ => c.sp.brand,
  };

  Future<void> _assign(BuildContext context) async {
    final taken = {
      for (final a in asList(s['assignments']))
        if (a['status'] != 'SUBSTITUTED') a['employmentId'],
    };
    String id = '';
    final ok = await showGlassDialog<bool>(
      context,
      title: 'Escalar profissional',
      width: 480,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, set) => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('${brDateTime(s['startsAt'])} – ${brTime(s['endsAt'])}', style: TextStyle(color: ctx.sp.muted)),
            const SizedBox(height: 12),
            Select<String>(label: 'Profissional', value: id, items: [('', 'Escolha…'), ...employees.where((e) => !taken.contains(e.$1))], onChanged: (v) => set(() => id = v ?? '')),
            const SizedBox(height: 16),
            Align(
              alignment: Alignment.centerRight,
              child: GlassButton(
                label: 'Escalar',
                onPressed: id.isEmpty
                    ? null
                    : () async {
                        if (await act(ctx, () => api.post('/health/shifts/${s['id']}/assign', {'employmentId': id}), success: 'Profissional escalado') && ctx.mounted) Navigator.pop(ctx, true);
                      },
              ),
            ),
          ],
        ),
      ),
    );
    if (ok == true) onChanged();
  }

  Future<void> _substitute(BuildContext context, Map<String, dynamic> a) async {
    String sub = '';
    final reason = TextEditingController();
    final ok = await showGlassDialog<bool>(
      context,
      title: 'Troca: ${a['name']}',
      width: 480,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, set) => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Select<String>(label: 'Substituto', value: sub, items: [('', 'Substituto…'), ...employees.where((e) => e.$1 != a['employmentId'])], onChanged: (v) => set(() => sub = v ?? '')),
            const SizedBox(height: 12),
            TextField(
              controller: reason,
              maxLines: 2,
              decoration: const InputDecoration(labelText: 'Motivo da troca'),
            ),
            const SizedBox(height: 16),
            Align(
              alignment: Alignment.centerRight,
              child: GlassButton(
                label: 'Pedir troca',
                onPressed: () async {
                  if (sub.isEmpty || reason.text.trim().length < 5) return toast(ctx, 'Escolha o substituto e explique o motivo (mín. 5 caracteres)', error: true);
                  if (await act(
                        ctx,
                        () => api.post('/health/assignments/${a['id']}/substitution', {'substituteEmploymentId': sub, 'reason': reason.text.trim()}),
                        success: 'Troca pedida: aprove na lista',
                      ) &&
                      ctx.mounted) {
                    Navigator.pop(ctx, true);
                  }
                },
              ),
            ),
          ],
        ),
      ),
    );
    if (ok == true) onChanged();
  }
}

class _ShiftForm extends StatefulWidget {
  const _ShiftForm({required this.unitId, required this.date});
  final String unitId, date;
  @override
  State<_ShiftForm> createState() => _ShiftFormState();
}

class _ShiftFormState extends State<_ShiftForm> {
  late String _date = widget.date;
  String _start = '19:00', _end = '07:00', _kindV = 'NIGHT';
  int _req = 1, _repeat = 0;
  bool _busy = false;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      DateField(label: 'Data de início', value: _date, onChanged: (v) => setState(() => _date = v ?? _date)),
      const SizedBox(height: 12),
      FormGrid(
        children: [
          TextFormField(
            initialValue: _start,
            inputFormatters: [MaskFormatter(maskTime)],
            decoration: const InputDecoration(labelText: 'Entrada'),
            onChanged: (v) => setState(() => _start = v),
          ),
          TextFormField(
            initialValue: _end,
            inputFormatters: [MaskFormatter(maskTime)],
            decoration: const InputDecoration(labelText: 'Saída'),
            onChanged: (v) => setState(() => _end = v),
          ),
          Select<String>(label: 'Tipo', value: _kindV, items: [for (final e in _kind.entries) (e.key, e.value)], onChanged: (v) => setState(() => _kindV = v ?? 'NIGHT')),
          TextFormField(
            initialValue: '1',
            inputFormatters: digitsOnly(2),
            decoration: const InputDecoration(labelText: 'Profissionais'),
            onChanged: (v) => _req = (int.tryParse(v) ?? 1).clamp(1, 50),
          ),
          TextFormField(
            initialValue: '0',
            inputFormatters: digitsOnly(2),
            decoration: const InputDecoration(labelText: 'Repetir por mais (dias)'),
            onChanged: (v) => _repeat = (int.tryParse(v) ?? 0).clamp(0, 62),
          ),
        ],
      ),
      const SizedBox(height: 8),
      Text('Saída menor que a entrada termina no dia seguinte.', style: TextStyle(color: context.sp.subtle, fontSize: 12.5)),
      const SizedBox(height: 16),
      Align(
        alignment: Alignment.centerRight,
        child: GlassButton(
          label: 'Criar',
          loading: _busy,
          onPressed: () async {
            if (!validHm(_start) || !validHm(_end)) return toast(context, 'Entrada e saída no formato HH:MM', error: true);
            // Horário de Brasília (UTC−3) → UTC.
            final s = DateTime.parse('${_date}T$_start:00-03:00');
            var e = DateTime.parse('${_date}T$_end:00-03:00');
            if (toMin(_end) <= toMin(_start)) e = e.add(const Duration(days: 1));
            setState(() => _busy = true);
            try {
              final r = asMap(
                await api.post('/health/shifts', {
                  'unitId': widget.unitId,
                  'kind': _kindV,
                  'startsAt': s.toUtc().toIso8601String(),
                  'endsAt': e.toUtc().toIso8601String(),
                  'requiredProfessionals': _req,
                  'repeatDays': _repeat,
                }),
              );
              if (!mounted) return;
              toast(this.context, '${r['created']} plantão(ões) criado(s)');
              Navigator.pop(this.context, true);
            } catch (x) {
              if (mounted) toast(this.context, '$x', error: true);
            } finally {
              if (mounted) setState(() => _busy = false);
            }
          },
        ),
      ),
    ],
  );
}
