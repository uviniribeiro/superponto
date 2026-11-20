// Educação: cursos, disciplinas, períodos, turmas, professores e grade; aulas do dia e resumo do mês por professor.
import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/glass.dart';
import '../core/schedules.dart' show validHm, weekdayNames;
import '../core/timesheet.dart';
import '../core/tokens.dart';
import '../widgets/company_options.dart';
import '../widgets/company_scope.dart';
import '../widgets/masked.dart';
import '../widgets/ui.dart';

const _st = {'SCHEDULED': 'Prevista', 'HELD': 'Dada', 'NOT_HELD': 'Não dada', 'SUBSTITUTED': 'Substituída', 'CANCELLED': 'Cancelada'};
const _shifts = [('', '—'), ('MANHA', 'Manhã'), ('TARDE', 'Tarde'), ('NOITE', 'Noite'), ('INTEGRAL', 'Integral')];

class EducationPage extends StatefulWidget {
  const EducationPage({super.key});
  @override
  State<EducationPage> createState() => _EducationPageState();
}

class _EducationPageState extends State<EducationPage> {
  int _tab = 0, _token = 0;
  String _date = todayIso();
  String? _company;
  Future<CompanyOptions>? _opt;

  @override
  Widget build(BuildContext context) {
    final manage = api.can('education.academic:manage');
    return PageScaffold(
      title: 'Educação',
      subtitle: 'Cursos, disciplinas, turmas, professores e grade horária; registro das aulas do dia e resumo de aulas por professor.',
      icon: Icons.school_rounded,
      children: [
        CompanyScope(
          builder: (context, companyId, picker) {
            if (_company != companyId) {
              _company = companyId;
              _opt = CompanyOptions.load(companyId!);
            }
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    picker,
                    GlassTabs(tabs: const ['Turmas e grade', 'Aulas do dia', 'Resumo do mês'], index: _tab, onChanged: (i) => setState(() => _tab = i)),
                    if (_tab != 0) DateField(label: _tab == 1 ? 'Dia' : 'Mês de', value: _date, width: 170, onChanged: (v) => setState(() => _date = v ?? _date)),
                  ],
                ),
                const SizedBox(height: 14),
                FutureBuilder<CompanyOptions>(
                  future: _opt,
                  builder: (context, os) {
                    if (!os.hasData) return const Loading();
                    final o = os.data!;
                    return switch (_tab) {
                      0 => Async<Map<String, dynamic>>(
                        reloadToken: '$companyId|$_token',
                        load: () => api.getMap('/education', {'companyId': companyId}),
                        builder: (context, ov, _) => _Classes(ov: ov, o: o, companyId: companyId!, manage: manage, onChanged: () => setState(() => _token++)),
                      ),
                      1 => Async<List<Map<String, dynamic>>>(
                        reloadToken: '$companyId|$_date|$_token',
                        load: () => api.getList('/education/day', {'companyId': companyId, 'date': _date}),
                        builder: (context, day, _) => _Day(day: day, date: _date, employees: o.employees, onChanged: () => setState(() => _token++)),
                      ),
                      _ => Async<List<Map<String, dynamic>>>(
                        reloadToken: '$companyId|${_date.substring(0, 7)}|$_token',
                        load: () {
                          final r = monthRange(DateTime.parse(_date));
                          return api.getList('/education/summary', {'companyId': companyId, 'from': r.from, 'to': r.to});
                        },
                        builder: (context, sum, _) => GlassTable<Map<String, dynamic>>(
                          rows: sum,
                          empty: const EmptyState(icon: Icons.menu_book_rounded, title: 'Nenhuma aula registrada no mês', body: 'Registre as aulas em Aulas do dia.'),
                          columns: [
                            Col('Professor', (r) => txt('${r['teacher']} · ${r['registration']}', bold: true), flex: 4, primary: true),
                            Col('Dadas', (r) => txt(r['held']), numeric: true),
                            Col('Não dadas', (r) => txt(r['notHeld']), numeric: true),
                            Col('Substituído', (r) => txt(r['substitutedOut']), numeric: true),
                            Col('Substituiu', (r) => txt(r['substitutedIn']), numeric: true),
                            Col('Horas-aula', (r) => txt(hhmm(r['minutes'])), numeric: true),
                          ],
                        ),
                      ),
                    };
                  },
                ),
              ],
            );
          },
        ),
      ],
    );
  }
}

class _Classes extends StatelessWidget {
  const _Classes({required this.ov, required this.o, required this.companyId, required this.manage, required this.onChanged});
  final Map<String, dynamic> ov;
  final CompanyOptions o;
  final String companyId;
  final bool manage;
  final VoidCallback onChanged;

  Future<void> _dialog(BuildContext context, String kind, Map<String, String> data) async {
    const titles = {'course': 'Novo curso', 'subject': 'Nova disciplina', 'period': 'Novo período letivo', 'class': 'Nova turma', 'assign': 'Alocar professor', 'slot': 'Horário na grade'};
    final ok = await showGlassDialog<bool>(
      context,
      title: titles[kind]!,
      width: 520,
      builder: (_) => _EduForm(kind: kind, data: data, ov: ov, o: o, companyId: companyId),
    );
    if (ok == true) onChanged();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final periods = asList(ov['periods']), courses = asList(ov['courses']), subjects = asList(ov['subjects']), classes = asList(ov['classes']);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (manage)
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              GlassButton(label: 'Período letivo', icon: Icons.add_rounded, kind: BtnKind.glass, small: true, onPressed: () => _dialog(context, 'period', {'name': '${DateTime.now().year}'})),
              GlassButton(label: 'Curso', icon: Icons.add_rounded, kind: BtnKind.glass, small: true, onPressed: () => _dialog(context, 'course', {})),
              GlassButton(label: 'Disciplina', icon: Icons.add_rounded, kind: BtnKind.glass, small: true, onPressed: () => _dialog(context, 'subject', {})),
              GlassButton(
                label: 'Turma',
                icon: Icons.add_rounded,
                small: true,
                onPressed: periods.isEmpty || o.units.isEmpty ? null : () => _dialog(context, 'class', {'periodId': '${periods.first['id']}', 'unitId': o.units.first.$1}),
              ),
            ],
          ),
        const SizedBox(height: 8),
        Text(
          '${periods.length} período(s) · ${courses.length} curso(s) · ${subjects.length} disciplina(s)${o.units.isEmpty ? ' · cadastre uma unidade em Organização › Unidades' : ''}',
          style: TextStyle(color: t.muted, fontSize: 13),
        ),
        const SizedBox(height: 12),
        if (classes.isEmpty)
          const Glass(
            child: EmptyState(icon: Icons.menu_book_rounded, title: 'Nenhuma turma', body: 'Crie o período letivo, as disciplinas e as turmas; depois aloque os professores e monte a grade.'),
          )
        else
          ResponsiveGrid(
            minItemWidth: 420,
            children: [
              for (final c in classes)
                Glass(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        children: [
                          const IconBubble(Icons.groups_2_rounded, size: 36),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('${c['name']}', style: const TextStyle(fontWeight: FontWeight.w700)),
                                Text(
                                  [c['course'], (c['shift'] as String?)?.toLowerCase(), periods.where((p) => p['id'] == c['periodId']).firstOrNull?['name']].whereType<Object>().join(' · '),
                                  style: TextStyle(color: t.subtle, fontSize: 12.5),
                                ),
                              ],
                            ),
                          ),
                          if (manage)
                            TextButton.icon(
                              onPressed: () => _dialog(context, 'assign', {'classId': '${c['id']}', 'validFrom': todayIso()}),
                              icon: const Icon(Icons.add_rounded, size: 16),
                              label: const Text('Professor'),
                            ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      for (final a in asList(c['assignments']))
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 6),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text.rich(
                                      TextSpan(
                                        children: [
                                          TextSpan(
                                            text: '${a['subject']}',
                                            style: const TextStyle(fontWeight: FontWeight.w600),
                                          ),
                                          TextSpan(
                                            text: ' · ${a['teacher']}',
                                            style: TextStyle(color: t.muted),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                  if (manage)
                                    TextButton(
                                      onPressed: () => _dialog(context, 'slot', {'assignmentId': '${a['id']}', 'weekday': '1', 'startTime': '07:30', 'endTime': '08:20'}),
                                      child: const Text('+ horário'),
                                    ),
                                ],
                              ),
                              Wrap(
                                spacing: 6,
                                runSpacing: 6,
                                children: [
                                  for (final s in asList(a['slots']))
                                    InputChip(
                                      label: Text('${weekdayNames[(s['weekday'] as num).toInt()]} ${s['startTime']}–${s['endTime']}', style: const TextStyle(fontSize: 12)),
                                      onDeleted: manage
                                          ? () async {
                                              if (await act(context, () => api.delete('/education/slots/${s['id']}'))) onChanged();
                                            }
                                          : null,
                                    ),
                                  if (asList(a['slots']).isEmpty)
                                    Text('sem horário na grade${a['weeklyLessons'] != null ? ' (${a['weeklyLessons']} aulas/semana)' : ''}', style: TextStyle(color: t.warning, fontSize: 12.5)),
                                ],
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
  }
}

class _EduForm extends StatefulWidget {
  const _EduForm({required this.kind, required this.data, required this.ov, required this.o, required this.companyId});
  final String kind, companyId;
  final Map<String, String> data;
  final Map<String, dynamic> ov;
  final CompanyOptions o;
  @override
  State<_EduForm> createState() => _EduFormState();
}

class _EduFormState extends State<_EduForm> {
  late final Map<String, String> d = {...widget.data};
  bool _busy = false;

  Widget _sel(String k, String label, List<(String, String)> opts, {bool required = true}) =>
      Select<String>(label: label, value: d[k] ?? '', items: [('', required ? 'Escolha…' : 'Nenhum'), ...opts], onChanged: (v) => setState(() => d[k] = v ?? ''));

  List<(String, String)> _o(String key) => [for (final x in asList(widget.ov[key])) (x['id'] as String, '${x['name']}')];

  Future<void> _save() async {
    String? n(String k) => (d[k] ?? '').isEmpty ? null : d[k];
    final missing = switch (widget.kind) {
      'course' || 'subject' => (d['name'] ?? '').trim().length < 2,
      'period' => (d['name'] ?? '').trim().length < 2 || n('startsOn') == null || n('endsOn') == null,
      'class' => (d['name'] ?? '').trim().length < 2 || n('periodId') == null || n('unitId') == null,
      'assign' => n('subjectId') == null || n('employmentId') == null || n('validFrom') == null,
      _ => !validHm(d['startTime'] ?? '') || !validHm(d['endTime'] ?? ''),
    };
    if (missing) return toast(context, 'Preencha os campos obrigatórios', error: true);
    final (path, body) = switch (widget.kind) {
      'course' => ('/education/courses', {'companyId': widget.companyId, 'name': d['name']!.trim()}),
      'subject' => (
        '/education/subjects',
        {'companyId': widget.companyId, 'name': d['name']!.trim(), 'courseId': n('courseId'), 'weeklyLessons': n('weeklyLessons') == null ? null : int.parse(d['weeklyLessons']!)},
      ),
      'period' => ('/education/periods', {'companyId': widget.companyId, 'name': d['name']!.trim(), 'startsOn': d['startsOn'], 'endsOn': d['endsOn']}),
      'class' => ('/education/classes', {'unitId': d['unitId'], 'periodId': d['periodId'], 'courseId': n('courseId'), 'name': d['name']!.trim(), 'shift': n('shift')}),
      'assign' => ('/education/assignments', {'classId': d['classId'], 'subjectId': d['subjectId'], 'employmentId': d['employmentId'], 'validFrom': d['validFrom']}),
      _ => ('/education/slots', {'assignmentId': d['assignmentId'], 'weekday': int.parse(d['weekday'] ?? '1'), 'startTime': d['startTime'], 'endTime': d['endTime']}),
    };
    setState(() => _busy = true);
    final ok = await act(context, () => api.post(path, body), success: 'Salvo');
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) Navigator.pop(context, true);
  }

  @override
  Widget build(BuildContext context) {
    final k = widget.kind;
    Widget gap() => const SizedBox(height: 12);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (['course', 'subject', 'period', 'class'].contains(k)) ...[
          TextFormField(
            initialValue: d['name'],
            decoration: const InputDecoration(labelText: 'Nome *'),
            onChanged: (v) => d['name'] = v,
          ),
          gap(),
        ],
        if (k == 'subject') ...[
          _sel('courseId', 'Curso', _o('courses'), required: false),
          gap(),
          TextFormField(
            inputFormatters: digitsOnly(2),
            decoration: const InputDecoration(labelText: 'Aulas por semana'),
            onChanged: (v) => d['weeklyLessons'] = v,
          ),
        ],
        if (k == 'period')
          FormGrid(
            children: [
              DateField(label: 'Início *', value: d['startsOn'], onChanged: (v) => setState(() => d['startsOn'] = v ?? '')),
              DateField(label: 'Fim *', value: d['endsOn'], onChanged: (v) => setState(() => d['endsOn'] = v ?? '')),
            ],
          ),
        if (k == 'class') ...[
          _sel('periodId', 'Período letivo', _o('periods')),
          gap(),
          _sel('unitId', 'Unidade', widget.o.units),
          gap(),
          _sel('courseId', 'Curso', _o('courses'), required: false),
          gap(),
          Select<String>(label: 'Turno', value: d['shift'] ?? '', items: _shifts, onChanged: (v) => setState(() => d['shift'] = v ?? '')),
        ],
        if (k == 'assign') ...[
          _sel('subjectId', 'Disciplina', _o('subjects')),
          gap(),
          _sel('employmentId', 'Professor', widget.o.employees),
          gap(),
          DateField(label: 'A partir de', value: d['validFrom'], onChanged: (v) => setState(() => d['validFrom'] = v ?? '')),
        ],
        if (k == 'slot') ...[
          Select<String>(label: 'Dia', value: d['weekday'] ?? '1', items: [for (var i = 0; i < 7; i++) ('$i', weekdayNames[i])], onChanged: (v) => setState(() => d['weekday'] = v ?? '1')),
          gap(),
          FormGrid(
            children: [
              TextFormField(
                initialValue: d['startTime'],
                inputFormatters: [MaskFormatter(maskTime)],
                decoration: const InputDecoration(labelText: 'Início'),
                onChanged: (v) => d['startTime'] = v,
              ),
              TextFormField(
                initialValue: d['endTime'],
                inputFormatters: [MaskFormatter(maskTime)],
                decoration: const InputDecoration(labelText: 'Fim'),
                onChanged: (v) => d['endTime'] = v,
              ),
            ],
          ),
        ],
        const SizedBox(height: 18),
        Align(
          alignment: Alignment.centerRight,
          child: GlassButton(label: 'Salvar', loading: _busy, onPressed: _save),
        ),
      ],
    );
  }
}

class _Day extends StatelessWidget {
  const _Day({required this.day, required this.date, required this.employees, required this.onChanged});
  final List<Map<String, dynamic>> day;
  final String date;
  final List<(String, String)> employees;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final canSession = api.can('education.sessions:manage');
    Future<void> rec(Map<String, dynamic> l, String status, [String? sub]) async {
      if (await act(context, () => api.post('/education/sessions', {'date': date, 'scheduleId': l['scheduleId'], 'status': status, 'substituteEmploymentId': ?sub}))) onChanged();
    }

    final held = day.where((l) => l['status'] == 'HELD' || l['status'] == 'SUBSTITUTED').length;
    final notHeld = day.where((l) => l['status'] == 'NOT_HELD').length;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (day.isNotEmpty) ...[
          ResponsiveGrid(
            minItemWidth: 180,
            children: [
              StatTile(label: 'Aulas previstas', value: '${day.length}', icon: Icons.event_note_rounded),
              StatTile(label: 'Dadas', value: '$held', icon: Icons.check_circle_rounded, color: t.success),
              StatTile(label: 'Não dadas', value: '$notHeld', icon: Icons.cancel_rounded, color: t.danger),
            ],
          ),
          const SizedBox(height: 14),
        ],
        GlassTable<Map<String, dynamic>>(
          rows: day,
          empty: const EmptyState(icon: Icons.event_busy_rounded, title: 'Nenhuma aula prevista', body: 'A grade não tem aulas neste dia da semana.'),
          columns: [
            Col('Horário', (l) => txt('${l['startTime']}–${l['endTime']}', bold: true), flex: 2),
            Col('Turma', (l) => txt(l['className']), flex: 2),
            Col('Disciplina', (l) => txt(l['subject']), flex: 2, primary: true),
            Col('Professor', (l) => txt('${l['teacher']}${l['substitute'] != null ? ' · subst.: ${l['substitute']}' : ''}', muted: true), flex: 3),
            Col(
              'Situação',
              (l) => Pill(
                _st[l['status']] ?? '${l['status']}',
                color: switch (l['status']) {
                  'HELD' => t.success,
                  'NOT_HELD' => t.danger,
                  'SUBSTITUTED' => t.info,
                  _ => t.brand,
                },
              ),
              flex: 2,
            ),
          ],
          actions: canSession
              ? (l) => [
                  PopupMenuButton<String>(
                    tooltip: 'Registrar aula',
                    icon: Icon(Icons.more_horiz_rounded, color: t.muted),
                    onSelected: (v) async {
                      if (v != 'SUBSTITUTED') return rec(l, v);
                      String sub = '';
                      final ok = await showGlassDialog<bool>(
                        context,
                        title: 'Aula substituída',
                        width: 460,
                        builder: (ctx) => StatefulBuilder(
                          builder: (ctx, set) => Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Select<String>(label: 'Professor substituto', value: sub, items: [('', 'Escolha…'), ...employees], onChanged: (v) => set(() => sub = v ?? '')),
                              const SizedBox(height: 16),
                              Align(
                                alignment: Alignment.centerRight,
                                child: GlassButton(label: 'Salvar', onPressed: sub.isEmpty ? null : () => Navigator.pop(ctx, true)),
                              ),
                            ],
                          ),
                        ),
                      );
                      if (ok == true) await rec(l, 'SUBSTITUTED', sub);
                    },
                    itemBuilder: (_) => const [
                      PopupMenuItem(value: 'HELD', child: Text('Dada')),
                      PopupMenuItem(value: 'NOT_HELD', child: Text('Não dada')),
                      PopupMenuItem(value: 'SUBSTITUTED', child: Text('Substituída…')),
                    ],
                  ),
                ]
              : null,
        ),
      ],
    );
  }
}
