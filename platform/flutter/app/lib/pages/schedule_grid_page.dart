// Escalas: quem trabalha em cada dia. Atribuir horário, lançar escala agendada e registrar trocas.
import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/glass.dart';
import '../core/schedules.dart';
import '../core/tokens.dart';
import '../widgets/company_scope.dart';
import '../widgets/masked.dart';
import '../widgets/structure_options.dart';
import '../widgets/ui.dart';

class ScheduleGridPage extends StatefulWidget {
  const ScheduleGridPage({super.key});
  @override
  State<ScheduleGridPage> createState() => _ScheduleGridPageState();
}

class _ScheduleGridPageState extends State<ScheduleGridPage> {
  final _today = todayIso();
  late String _start = mondayOf(_today);
  int _days = 14, _token = 0;
  String _dept = '', _group = '', _q = '';
  final _selected = <String>[];
  String? _companyId;
  List<Map<String, dynamic>> _rows = const [];

  String get _to => addDays(_start, _days - 1);
  String get _defaultFrom => _start.compareTo(_today) < 0 && _to.compareTo(_today) >= 0 ? _today : _start;

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final canAssign = api.can('schedules.schedules:manage'), canSchedule = api.can('schedules.scheduled:manage');
    return Stack(
      children: [
        PageScaffold(
          title: 'Escalas',
          subtitle: 'Quem trabalha em cada dia. Selecione funcionários para atribuir horário, lançar escala agendada ou registrar trocas.',
          icon: Icons.calendar_month_rounded,
          maxWidth: 1800,
          children: [
            CompanyScope(
              builder: (context, companyId, picker) {
                if (_companyId != companyId) {
                  _companyId = companyId;
                  _selected.clear();
                  _dept = '';
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
                        Glass(
                          radius: 999,
                          padding: const EdgeInsets.symmetric(horizontal: 4),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              IconButton(tooltip: 'Semana anterior', onPressed: () => setState(() => _start = addDays(_start, -7)), icon: const Icon(Icons.chevron_left_rounded)),
                              Text('${brDate(_start)} – ${brDate(_to)}', style: const TextStyle(fontWeight: FontWeight.w600)),
                              IconButton(tooltip: 'Próxima semana', onPressed: () => setState(() => _start = addDays(_start, 7)), icon: const Icon(Icons.chevron_right_rounded)),
                              TextButton(onPressed: () => setState(() => _start = mondayOf(_today)), child: const Text('Hoje')),
                            ],
                          ),
                        ),
                        GlassTabs(tabs: const ['7 dias', '14 dias', '28 dias'], index: [7, 14, 28].indexOf(_days), onChanged: (i) => setState(() => _days = [7, 14, 28][i])),
                        FutureBuilder(
                          future: StructureOptions.cached(companyId),
                          builder: (_, s) => Wrap(
                            spacing: 10,
                            runSpacing: 10,
                            children: [
                              Select<String>(
                                width: 220,
                                label: 'Departamento',
                                value: _dept,
                                items: [('', 'Todos'), ...deptOpts(s.data?.departments ?? const [])],
                                onChanged: (v) => setState(() => _dept = v ?? ''),
                              ),
                              if ((s.data?.groupings ?? const []).isNotEmpty)
                                Select<String>(width: 200, label: 'Agrupamento', value: _group, items: [('', 'Todos'), ...opts(s.data!.groupings)], onChanged: (v) => setState(() => _group = v ?? '')),
                            ],
                          ),
                        ),
                        SearchField(hint: 'Nome ou matrícula…', width: 220, onChanged: (v) => setState(() => _q = v)),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 14,
                      children: [
                        for (final (c, l, ring) in [
                          (t.brand.withValues(alpha: 0.2), 'Trabalho', false),
                          (t.hover, 'Folga', false),
                          (t.info.withValues(alpha: 0.18), 'Feriado', false),
                          (t.brand, 'Escala agendada', true),
                          (t.info, 'Troca', true),
                        ])
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                width: 12,
                                height: 12,
                                decoration: BoxDecoration(
                                  color: ring ? null : c,
                                  borderRadius: BorderRadius.circular(4),
                                  border: ring ? Border.all(color: c, width: 2) : null,
                                ),
                              ),
                              const SizedBox(width: 6),
                              Text(l, style: TextStyle(fontSize: 12, color: t.muted)),
                            ],
                          ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Async<Map<String, dynamic>>(
                      reloadToken: '$companyId|$_start|$_days|$_dept|$_group|$_q|$_token',
                      load: () => api.getMap('/schedule-grid', {'companyId': companyId, 'from': _start, 'to': _to, 'departmentId': _dept, 'groupingId': _group, 'search': _q}),
                      builder: (context, g, _) {
                        _rows = asList(g['rows']);
                        if (_rows.isEmpty) {
                          return Glass(
                            child: EmptyState(
                              icon: Icons.schedule_rounded,
                              title: 'Nenhum funcionário',
                              body: _q.isNotEmpty || _dept.isNotEmpty ? 'Nada com esses filtros.' : 'Cadastre funcionários nesta empresa para montar a escala.',
                            ),
                          );
                        }
                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            _Grid(
                              rows: _rows,
                              start: _start,
                              days: _days,
                              today: _today,
                              selected: _selected,
                              onToggle: (id) => setState(() => _selected.contains(id) ? _selected.remove(id) : _selected.add(id)),
                              onToggleAll: (v) => setState(() {
                                _selected.clear();
                                if (v) _selected.addAll(_rows.map((r) => r['employmentId'] as String));
                              }),
                              onCell: (name, d) => _cell(name, d, canSchedule),
                            ),
                            if (g['truncated'] == true)
                              Padding(
                                padding: const EdgeInsets.only(top: 8),
                                child: Text('Mostrando os primeiros 300 funcionários: use os filtros.', style: TextStyle(color: t.warning)),
                              ),
                            const SizedBox(height: 80),
                          ],
                        );
                      },
                    ),
                  ],
                );
              },
            ),
          ],
        ),
        AnimatedPositioned(
          duration: const Duration(milliseconds: 280),
          curve: Curves.easeOutBack,
          left: 0,
          right: 0,
          bottom: _selected.isEmpty ? -100 : 20,
          child: Center(
            child: Glass(
              strong: true,
              radius: 999,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Wrap(
                spacing: 8,
                runSpacing: 8,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  Text('${_selected.length} selecionado(s)', style: const TextStyle(fontWeight: FontWeight.w600)),
                  if (canAssign) GlassButton(label: 'Atribuir horário', icon: Icons.schedule_rounded, small: true, onPressed: () => _action('assign')),
                  if (canSchedule) GlassButton(label: 'Escala agendada', icon: Icons.event_available_rounded, small: true, kind: BtnKind.glass, onPressed: () => _action('override')),
                  if (canSchedule && _selected.length <= 2)
                    GlassButton(label: _selected.length == 2 ? 'Trocar escala' : 'Trocar folga', icon: Icons.swap_horiz_rounded, small: true, kind: BtnKind.glass, onPressed: () => _action('swap')),
                  IconButton(tooltip: 'Limpar seleção', onPressed: () => setState(_selected.clear), icon: const Icon(Icons.close_rounded)),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Future<void> _action(String kind) async {
    final ids = [..._selected];
    final ok = await showGlassDialog<bool>(
      context,
      title: switch (kind) {
        'assign' => 'Atribuir horário',
        'override' => 'Escala agendada',
        _ => ids.length == 2 ? 'Troca de escala' : 'Troca de folga',
      },
      width: kind == 'override' ? 680 : 520,
      builder: (_) => switch (kind) {
        'assign' => _AssignForm(companyId: _companyId!, ids: ids),
        'override' => _OverrideForm(ids: ids, from: _defaultFrom),
        _ => _SwapForm(rows: _rows, ids: ids, date: _defaultFrom),
      },
    );
    if (ok == true && mounted) {
      setState(() {
        _selected.clear();
        _token++;
      });
    }
  }

  Future<void> _cell(String name, Map<String, dynamic> d, bool canSchedule) async {
    final t = context.sp;
    final removed = await showGlassDialog<bool>(
      context,
      title: '$name · ${weekdayNames[weekdayOf('${d['date']}')]} ${dm('${d['date']}')}',
      width: 460,
      builder: (ctx) {
        Widget row(String k, Object? v) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Row(
            children: [
              SizedBox(
                width: 150,
                child: Text(k, style: TextStyle(color: t.subtle)),
              ),
              Expanded(child: Text('${v ?? '—'}')),
            ],
          ),
        );
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              d['isWorkday'] == true ? (d['start'] != null ? '${d['start']} – ${d['end']}' : hours(d['expectedMinutes'])) : (d['isHoliday'] == true ? 'Feriado' : 'Folga'),
              style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800),
            ),
            if (d['isWorkday'] == true)
              Text(
                '${hours(d['expectedMinutes'])} previstas${(d['breakMinutes'] as num? ?? 0) > 0 ? ' · intervalo de ${d['breakMinutes']} min' : ''}${d['overnight'] == true ? ' · atravessa a meia-noite' : ''}',
                style: TextStyle(color: t.muted),
              ),
            const SizedBox(height: 12),
            if (d['holidayName'] != null) row('Feriado', d['holidayName']),
            row('Horário atribuído', d['scheduleName']),
            row(
              'Origem do dia',
              d['origin'] == 'TROCA'
                  ? 'Troca'
                  : d['origin'] == 'AGENDADA'
                  ? 'Escala agendada'
                  : 'Horário',
            ),
            if (d['note'] != null) row('Observação', d['note']),
            if (d['overrideId'] != null && canSchedule) ...[
              const SizedBox(height: 16),
              GlassButton(
                label: 'Remover lançamento deste dia',
                icon: Icons.delete_outline_rounded,
                kind: BtnKind.danger,
                onPressed: () async {
                  if (await act(ctx, () => api.delete('/schedule-overrides/${d['overrideId']}'), success: 'Lançamento removido: o dia volta ao horário normal') && ctx.mounted) {
                    Navigator.pop(ctx, true);
                  }
                },
              ),
            ],
          ],
        );
      },
    );
    if (removed == true && mounted) setState(() => _token++);
  }
}

class _Grid extends StatelessWidget {
  const _Grid({required this.rows, required this.start, required this.days, required this.today, required this.selected, required this.onToggle, required this.onToggleAll, required this.onCell});
  final List<Map<String, dynamic>> rows;
  final String start, today;
  final int days;
  final List<String> selected;
  final ValueChanged<String> onToggle;
  final ValueChanged<bool> onToggleAll;
  final void Function(String name, Map<String, dynamic> d) onCell;

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final dates = [for (var i = 0; i < days; i++) addDays(start, i)];
    final holidays = {
      for (final d in asList(rows.first['days']))
        if (d['holidayName'] != null) d['date']: d['holidayName'],
    };
    const nameW = 230.0, cellW = 70.0, totalW = 80.0;
    return Glass(
      padding: const EdgeInsets.all(12),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: SizedBox(
          width: nameW + cellW * days + totalW + 8,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  SizedBox(
                    width: nameW,
                    child: Row(
                      children: [
                        Checkbox(value: selected.length == rows.length && rows.isNotEmpty, onChanged: (v) => onToggleAll(v ?? false)),
                        Text(
                          'Funcionário',
                          style: TextStyle(color: t.subtle, fontSize: 12, fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ),
                  for (final d in dates)
                    Tooltip(
                      message: holidays[d] ?? '',
                      child: SizedBox(
                        width: cellW,
                        child: Column(
                          children: [
                            Text(weekdayNames[weekdayOf(d)], style: TextStyle(fontSize: 11, color: d == today ? t.brand : (holidays.containsKey(d) ? t.info : t.subtle))),
                            Text(
                              dm(d),
                              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: d == today ? t.brand : (holidays.containsKey(d) ? t.info : t.muted)),
                            ),
                          ],
                        ),
                      ),
                    ),
                  SizedBox(
                    width: totalW,
                    child: Text(
                      'Previsto',
                      textAlign: TextAlign.right,
                      style: TextStyle(color: t.subtle, fontSize: 12),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              for (final r in rows)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 2),
                  child: Row(
                    children: [
                      SizedBox(
                        width: nameW,
                        child: Row(
                          children: [
                            Checkbox(value: selected.contains(r['employmentId']), onChanged: (_) => onToggle(r['employmentId'] as String)),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    '${r['name']}',
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                                  ),
                                  Text(
                                    'Matrícula ${r['registration']}${asList(r['days']).lastOrNull?['scheduleName'] != null ? ' · ${asList(r['days']).last['scheduleName']}' : ' · sem horário'}',
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(color: t.subtle, fontSize: 11),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      for (final d in asList(r['days']))
                        SizedBox(
                          width: cellW,
                          child: Padding(
                            padding: const EdgeInsets.all(2),
                            child: _Cell(d: d, onTap: () => onCell('${r['name']}', d)),
                          ),
                        ),
                      SizedBox(
                        width: totalW,
                        child: Text(
                          hours(asList(r['days']).fold<num>(0, (s, d) => s + (d['expectedMinutes'] as num? ?? 0))),
                          textAlign: TextAlign.right,
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Cell extends StatelessWidget {
  const _Cell({required this.d, required this.onTap});
  final Map<String, dynamic> d;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final work = d['isWorkday'] == true, holiday = d['isHoliday'] == true;
    final ring = d['origin'] == 'AGENDADA'
        ? t.brand
        : d['origin'] == 'TROCA'
        ? t.info
        : null;
    return Material(
      type: MaterialType.transparency,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Container(
          height: 46,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            color: work
                ? t.brand.withValues(alpha: 0.16)
                : holiday
                ? t.info.withValues(alpha: 0.12)
                : null,
            border: Border.all(color: ring ?? (work || holiday ? Colors.transparent : t.border), width: ring != null ? 2 : 1),
          ),
          child: work
              ? (d['start'] != null
                    ? Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text('${d['start']}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600)),
                          Text('${d['end']}', style: TextStyle(fontSize: 11, color: t.muted)),
                        ],
                      )
                    : Text(hours(d['expectedMinutes']), style: const TextStyle(fontSize: 11)))
              : Text(holiday ? 'feriado' : 'folga', style: TextStyle(fontSize: 11, color: holiday ? t.info : t.subtle)),
        ),
      ),
    );
  }
}

class _AssignForm extends StatefulWidget {
  const _AssignForm({required this.companyId, required this.ids});
  final String companyId;
  final List<String> ids;
  @override
  State<_AssignForm> createState() => _AssignFormState();
}

class _AssignFormState extends State<_AssignForm> {
  late final _schedules = api.getList('/work-schedules', {'companyId': widget.companyId});
  String _id = '';
  String _validFrom = todayIso();
  String? _cycleStart;
  bool _busy = false;
  @override
  Widget build(BuildContext context) => FutureBuilder<List<Map<String, dynamic>>>(
    future: _schedules,
    builder: (context, s) {
      if (!s.hasData) return const Loading();
      final active = s.data!.where((x) => x['active'] != false).toList();
      final chosen = active.where((x) => x['id'] == _id).firstOrNull;
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('${widget.ids.length} funcionário(s) selecionado(s). A jornada anterior de cada um termina na véspera; o histórico é preservado.', style: TextStyle(color: context.sp.muted)),
          const SizedBox(height: 14),
          if (active.isEmpty)
            Text('Nenhum horário ativo nesta empresa: crie em Jornada › Horários.', style: TextStyle(color: context.sp.warning))
          else
            Select<String>(
              label: 'Horário',
              value: _id,
              items: [('', 'Escolha…'), for (final x in active) (x['id'] as String, '${x['name']}${x['code'] != null ? ' (${x['code']})' : ''} · ${hours(x['weeklyMinutes'])}/sem')],
              onChanged: (v) => setState(() => _id = v ?? ''),
            ),
          const SizedBox(height: 14),
          DateField(label: 'Vale a partir de', value: _validFrom, onChanged: (v) => setState(() => _validFrom = v ?? _validFrom)),
          if (chosen?['cycleDays'] != null) ...[
            const SizedBox(height: 14),
            DateField(
              label: 'Primeiro dia do ciclo de ${chosen!['cycleDays']} dias (padrão: a data de início)',
              value: _cycleStart,
              clearable: true,
              onChanged: (v) => setState(() => _cycleStart = v),
            ),
          ],
          const SizedBox(height: 20),
          Align(
            alignment: Alignment.centerRight,
            child: GlassButton(
              label: 'Atribuir horário',
              loading: _busy,
              onPressed: _id.isEmpty
                  ? null
                  : () async {
                      setState(() => _busy = true);
                      final r = await run(context, () => api.post('/schedule-assignments', {'employmentIds': widget.ids, 'scheduleId': _id, 'validFrom': _validFrom, 'cycleStart': ?_cycleStart}));
                      if (!mounted) return;
                      setState(() => _busy = false);
                      if (r != null) {
                        toast(this.context, 'Horário atribuído a ${asMap(r)['assigned']} funcionário(s)');
                        Navigator.pop(this.context, true);
                      }
                    },
            ),
          ),
        ],
      );
    },
  );
}

class _OverrideForm extends StatefulWidget {
  const _OverrideForm({required this.ids, required this.from});
  final List<String> ids;
  final String from;
  @override
  State<_OverrideForm> createState() => _OverrideFormState();
}

class _OverrideFormState extends State<_OverrideForm> {
  late String _from = widget.from, _to = widget.from;
  final _weekdays = <int>[];
  bool _work = true, _busy = false;
  String _start = '07:00', _end = '13:00', _breakStart = '';
  int _break = 0;
  final _note = TextEditingController();

  Widget _hm(String label, String value, ValueChanged<String> on) => TextFormField(
    initialValue: value,
    keyboardType: TextInputType.number,
    inputFormatters: [MaskFormatter(maskTime)],
    decoration: InputDecoration(labelText: label),
    onChanged: (v) => setState(() => on(v)),
  );

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Define trabalho ou folga em dias específicos para ${widget.ids.length} funcionário(s). Vale sobre o horário e sobre o feriado.', style: TextStyle(color: t.muted)),
        const SizedBox(height: 14),
        GlassTabs(tabs: const ['Trabalho', 'Folga'], index: _work ? 0 : 1, onChanged: (i) => setState(() => _work = i == 0)),
        const SizedBox(height: 14),
        FormGrid(
          children: [
            DateField(
              label: 'De',
              value: _from,
              onChanged: (v) => setState(() {
                _from = v ?? _from;
                if (_to.compareTo(_from) < 0) _to = _from;
              }),
            ),
            DateField(label: 'Até', value: _to, onChanged: (v) => setState(() => _to = v == null || v.compareTo(_from) < 0 ? _from : v)),
          ],
        ),
        const SizedBox(height: 14),
        const FieldLabel('Só nestes dias da semana'),
        Wrap(
          spacing: 6,
          children: [
            for (var i = 0; i < 7; i++) FilterChip(label: Text(weekdayNames[i]), selected: _weekdays.contains(i), onSelected: (v) => setState(() => v ? _weekdays.add(i) : _weekdays.remove(i))),
          ],
        ),
        Text(_weekdays.isEmpty ? 'Nenhum marcado: todos os dias do período.' : 'Os demais dias do período ficam como estão.', style: TextStyle(color: t.subtle, fontSize: 12)),
        if (_work) ...[
          const SizedBox(height: 14),
          FormGrid(
            columns: 4,
            children: [
              _hm('Entrada', _start, (v) => _start = v),
              _hm('Saída', _end, (v) => _end = v),
              TextFormField(
                initialValue: '0',
                inputFormatters: digitsOnly(3),
                decoration: const InputDecoration(labelText: 'Intervalo (min)'),
                onChanged: (v) => setState(() => _break = int.tryParse(v) ?? 0),
              ),
              _hm('Início do intervalo', '', (v) => _breakStart = v),
            ],
          ),
          if (validHm(_start) && validHm(_end))
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text('Jornada do dia: ${hours((span(_start, _end) - _break).clamp(0, 1440))}${toMin(_end) <= toMin(_start) ? ' (atravessa a meia-noite)' : ''}', style: TextStyle(color: t.brand)),
            ),
        ],
        const SizedBox(height: 14),
        TextField(
          controller: _note,
          maxLength: 300,
          decoration: const InputDecoration(labelText: 'Observação', hintText: 'Ex.: mutirão de vacinação', counterText: ''),
        ),
        const SizedBox(height: 18),
        Align(
          alignment: Alignment.centerRight,
          child: GlassButton(
            label: 'Lançar escala agendada',
            loading: _busy,
            onPressed: () async {
              if (_work && (!validHm(_start) || !validHm(_end))) return toast(context, 'Entrada e saída no formato HH:MM', error: true);
              setState(() => _busy = true);
              final r = await run(
                context,
                () => api.post('/schedule-overrides', {
                  'employmentIds': widget.ids,
                  'from': _from,
                  'to': _to,
                  'weekdays': _weekdays,
                  'isWorkday': _work,
                  if (_note.text.trim().isNotEmpty) 'note': _note.text.trim(),
                  if (_work) ...{'startTime': _start, 'endTime': _end, 'breakMinutes': _break, 'breakStart': validHm(_breakStart) ? _breakStart : null},
                }),
              );
              if (!mounted) return;
              setState(() => _busy = false);
              if (r != null) {
                toast(this.context, '${asMap(r)['created']} dia(s) lançado(s)');
                Navigator.pop(this.context, true);
              }
            },
          ),
        ),
      ],
    );
  }
}

class _SwapForm extends StatefulWidget {
  const _SwapForm({required this.rows, required this.ids, required this.date});
  final List<Map<String, dynamic>> rows;
  final List<String> ids;
  final String date;
  @override
  State<_SwapForm> createState() => _SwapFormState();
}

class _SwapFormState extends State<_SwapForm> {
  late String _date = widget.date, _workDate = widget.date, _offDate = addDays(widget.date, 1);
  final _note = TextEditingController();
  bool _busy = false;
  String _name(String id) => '${widget.rows.where((r) => r['employmentId'] == id).firstOrNull?['name'] ?? ''}';

  @override
  Widget build(BuildContext context) {
    final two = widget.ids.length == 2;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          two
              ? '${_name(widget.ids[0])} e ${_name(widget.ids[1])} trocam a escala do dia: cada um faz o horário do outro.'
              : '${_name(widget.ids[0])} folga num dia de trabalho e trabalha numa folga, no mesmo horário.',
          style: TextStyle(color: context.sp.muted),
        ),
        const SizedBox(height: 14),
        if (two)
          DateField(label: 'Dia', value: _date, onChanged: (v) => setState(() => _date = v ?? _date))
        else
          FormGrid(
            children: [
              DateField(label: 'Folgar em (dia de trabalho)', value: _workDate, onChanged: (v) => setState(() => _workDate = v ?? _workDate)),
              DateField(label: 'Trabalhar em (folga)', value: _offDate, onChanged: (v) => setState(() => _offDate = v ?? _offDate)),
            ],
          ),
        const SizedBox(height: 14),
        TextField(
          controller: _note,
          maxLength: 300,
          decoration: const InputDecoration(labelText: 'Motivo *', hintText: 'Ex.: pedido do funcionário, aprovado pela coordenação', counterText: ''),
        ),
        const SizedBox(height: 18),
        Align(
          alignment: Alignment.centerRight,
          child: GlassButton(
            label: 'Registrar troca',
            icon: Icons.swap_horiz_rounded,
            loading: _busy,
            onPressed: () async {
              if (_note.text.trim().length < 3) return toast(context, 'Informe o motivo (mínimo 3 caracteres)', error: true);
              setState(() => _busy = true);
              final ok = await act(
                context,
                () => api.post(
                  '/schedule-overrides/swap',
                  two
                      ? {'kind': 'SHIFT', 'date': _date, 'employmentIdA': widget.ids[0], 'employmentIdB': widget.ids[1], 'note': _note.text.trim()}
                      : {'kind': 'DAY_OFF', 'employmentId': widget.ids[0], 'workDate': _workDate, 'offDate': _offDate, 'note': _note.text.trim()},
                ),
                success: 'Troca registrada',
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
