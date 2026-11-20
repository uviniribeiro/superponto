// Horários: jornadas semanais e escalas em ciclo (12x36, 6x1, 4x2…), com intervalo, in itinere e mobilidade.
import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/glass.dart';
import '../core/schedules.dart';
import '../core/tokens.dart';
import '../widgets/company_scope.dart';
import '../widgets/masked.dart';
import '../widgets/ui.dart';

class TimetablesPage extends StatefulWidget {
  const TimetablesPage({super.key});
  @override
  State<TimetablesPage> createState() => _TimetablesPageState();
}

class _TimetablesPageState extends State<TimetablesPage> {
  int _token = 0;

  @override
  Widget build(BuildContext context) {
    final canManage = api.can('schedules.timetables:manage');
    final t = context.sp;
    return PageScaffold(
      title: 'Horários',
      subtitle: 'Jornadas semanais e escalas em ciclo (12x36, 6x1, 4x2…), com intervalo, in itinere e mobilidade. Depois, atribua em Escalas.',
      icon: Icons.schedule_rounded,
      children: [
        CompanyScope(
          builder: (context, companyId, picker) => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Wrap(
                spacing: 12,
                runSpacing: 12,
                alignment: WrapAlignment.spaceBetween,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  picker,
                  if (canManage) GlassButton(label: 'Novo horário', icon: Icons.add_rounded, onPressed: () => _edit(companyId!, null)),
                ],
              ),
              const SizedBox(height: 14),
              Async<List<Map<String, dynamic>>>(
                reloadToken: '$companyId|$_token',
                load: () => api.getList('/work-schedules', {'companyId': companyId}),
                builder: (context, rows, _) {
                  if (rows.isEmpty) {
                    return const Glass(
                      child: EmptyState(icon: Icons.schedule_rounded, title: 'Nenhum horário', body: 'Crie o primeiro a partir de um modelo pronto (comercial, 12x36, 6x1…).'),
                    );
                  }
                  return ResponsiveGrid(
                    minItemWidth: 460,
                    children: [
                      for (final s in rows)
                        Glass(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Row(
                                children: [
                                  const IconBubble(Icons.schedule_rounded, size: 36),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            Flexible(
                                              child: Text(
                                                '${s['name']}',
                                                style: const TextStyle(fontWeight: FontWeight.w700),
                                                overflow: TextOverflow.ellipsis,
                                              ),
                                            ),
                                            if (s['code'] != null) ...[const SizedBox(width: 6), Pill('${s['code']}')],
                                            if (s['active'] == false) ...[const SizedBox(width: 6), Pill('inativo', color: t.danger)],
                                          ],
                                        ),
                                        Text(
                                          [
                                            scheduleTypes[s['type']] ?? s['type'],
                                            '${hours(s['weeklyMinutes'])} por semana',
                                            if (s['considerHolidays'] != true) 'trabalha em feriado',
                                            if ((s['inItinereMinutes'] as num? ?? 0) > 0) 'in itinere ${s['inItinereMinutes']} min',
                                            if ((s['entryMobilityMinutes'] as num? ?? 0) > 0) 'entrada móvel ${s['entryMobilityMinutes']} min',
                                            if (s['ruleSet'] != null) 'regra ${asMap(s['ruleSet'])['name']}',
                                          ].join(' · '),
                                          style: TextStyle(color: t.muted, fontSize: 12.5),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Pill('${s['inUse'] ?? 0} em uso', color: t.info),
                                ],
                              ),
                              const SizedBox(height: 12),
                              _Strip(s: s),
                              if (canManage)
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.end,
                                  children: [
                                    TextButton.icon(onPressed: () => _edit(companyId!, s), icon: const Icon(Icons.edit_rounded, size: 16), label: const Text('Editar')),
                                    TextButton.icon(
                                      onPressed: () => _edit(companyId!, {...s, 'id': null, 'name': '${s['name']} (cópia)', 'code': null}),
                                      icon: const Icon(Icons.copy_rounded, size: 16),
                                      label: const Text('Duplicar'),
                                    ),
                                    RowAction(Icons.delete_outline_rounded, 'Excluir', () => _remove(s), danger: true),
                                  ],
                                ),
                            ],
                          ),
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

  Future<void> _edit(String companyId, Map<String, dynamic>? row) async {
    final ok = await showGlassDialog<bool>(
      context,
      title: row == null ? 'Novo horário' : (row['id'] == null ? 'Duplicar horário' : 'Editar horário'),
      width: 860,
      builder: (_) => _ScheduleForm(companyId: companyId, row: row),
    );
    if (ok == true && mounted) setState(() => _token++);
  }

  Future<void> _remove(Map<String, dynamic> s) async {
    if ((s['inUse'] as num? ?? 0) > 0) return toast(context, '"${s['name']}" está em uso por ${s['inUse']} funcionário(s): atribua outro horário antes.', error: true);
    if (!await confirm(context, title: 'Excluir horário?', body: '"${s['name']}" deixa de aparecer. O histórico fica na auditoria.', confirmLabel: 'Excluir') || !mounted) return;
    if (await act(context, () => api.delete('/work-schedules/${s['id']}'), success: 'Horário excluído') && mounted) setState(() => _token++);
  }
}

class _Strip extends StatelessWidget {
  const _Strip({required this.s});
  final Map<String, dynamic> s;
  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final cyclic = cyclicTypes.contains(s['type']);
    final days = asList(s['days']);
    final ordered = cyclic
        ? ([...days]..sort((a, b) => (a['dayIndex'] as num).compareTo(b['dayIndex'] as num)))
        : [
            for (final i in [1, 2, 3, 4, 5, 6, 0]) ...days.where((d) => d['dayIndex'] == i),
          ];
    return Wrap(
      spacing: 6,
      runSpacing: 6,
      children: [
        for (final d in ordered.take(14))
          Tooltip(
            message: d['isWorkday'] == true ? '${d['startTime'] ?? ''}–${d['endTime'] ?? ''}' : 'Folga',
            child: Container(
              width: 54,
              padding: const EdgeInsets.symmetric(vertical: 6),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(12),
                color: d['isWorkday'] == true ? t.brand.withValues(alpha: 0.12) : t.hover,
                border: Border.all(color: d['isWorkday'] == true ? t.brand.withValues(alpha: 0.3) : t.border),
              ),
              child: Column(
                children: [
                  Text(cyclic ? 'D${(d['dayIndex'] as num) + 1}' : weekdayNames[(d['dayIndex'] as num).toInt()], style: TextStyle(fontSize: 11, color: t.subtle)),
                  Text(
                    d['isWorkday'] == true ? '${d['startTime'] ?? hours(d['expectedMinutes'])}' : 'folga',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: d['isWorkday'] == true ? t.fg : t.subtle),
                  ),
                ],
              ),
            ),
          ),
        if (ordered.length > 14)
          Padding(
            padding: const EdgeInsets.all(8),
            child: Text('+${ordered.length - 14}', style: TextStyle(color: t.subtle)),
          ),
      ],
    );
  }
}

class _ScheduleForm extends StatefulWidget {
  const _ScheduleForm({required this.companyId, this.row});
  final String companyId;
  final Map<String, dynamic>? row;
  @override
  State<_ScheduleForm> createState() => _ScheduleFormState();
}

class _ScheduleFormState extends State<_ScheduleForm> {
  Map<String, dynamic>? get row => widget.row;
  late final _name = TextEditingController(text: row?['name'] as String?);
  late final _code = TextEditingController(text: row?['code'] as String?);
  late String _type = row?['type'] as String? ?? 'FIXED';
  late int? _cycle = (row?['cycleDays'] as num?)?.toInt();
  late bool _holidays = row?['considerHolidays'] as bool? ?? true;
  late bool _active = row?['active'] as bool? ?? true;
  late int _itinere = (row?['inItinereMinutes'] as num?)?.toInt() ?? 0;
  late int _entryMob = (row?['entryMobilityMinutes'] as num?)?.toInt() ?? 0;
  late int _breakMob = (row?['breakMobilityMinutes'] as num?)?.toInt() ?? 0;
  late String _ruleSet = row?['ruleSetId'] as String? ?? '';
  late List<Map<String, dynamic>> _days = row != null ? [for (final d in asList(row!['days'])) Map<String, dynamic>.from(d)] : preset('comercial').days;
  late final Future<List<Map<String, dynamic>>> _ruleSets = api.getList('/rule-sets', {'companyId': widget.companyId});
  bool _busy = false;
  int _gen = 0;

  bool get cyclic => cyclicTypes.contains(_type);
  bool get flexible => _type == 'FLEXIBLE';
  String? get editId => row?['id'] as String?;

  void _apply(String k) {
    final p = preset(k);
    setState(() {
      _type = p.type;
      _cycle = p.cycleDays;
      _days = p.days;
      _holidays = p.considerHolidays;
      _gen++;
    });
  }

  void _setCycle(int n) => setState(() {
    _cycle = n;
    _days = [for (var i = 0; i < n; i++) _days.where((d) => d['dayIndex'] == i).firstOrNull ?? offDay(i)];
    _gen++;
  });

  void _changeType(String t) => setState(() {
    if (cyclicTypes.contains(t) && !cyclic) {
      _cycle = 2;
      _days = [workDay(0, '07:00', '19:00'), offDay(1)];
    } else if (!cyclicTypes.contains(t) && cyclic) {
      _cycle = null;
      _days = preset(t == 'FLEXIBLE' ? 'flex' : 'comercial').days;
    }
    _type = t;
    _gen++;
  });

  int get _weekly {
    final total = _days.fold<int>(0, (s, d) => s + dayExpected(d));
    return cyclic && (_cycle ?? 0) > 0 ? (total * 7 / _cycle!).round() : total;
  }

  Future<void> _save() async {
    if (_name.text.trim().length < 3) return toast(context, 'Nome: mínimo de 3 caracteres', error: true);
    for (final d in _days) {
      if (d['isWorkday'] == true && !flexible && (!validHm('${d['startTime']}') || !validHm('${d['endTime']}'))) {
        return toast(context, 'Preencha entrada e saída (HH:MM) de todos os dias trabalhados', error: true);
      }
    }
    final body = <String, Object?>{
      'name': _name.text.trim(),
      'code': _code.text.trim().isEmpty ? null : _code.text.trim(),
      'type': _type,
      'cycleDays': cyclic ? _cycle : null,
      'considerHolidays': _holidays,
      'inItinereMinutes': _itinere,
      'entryMobilityMinutes': _entryMob,
      'breakMobilityMinutes': _breakMob,
      'ruleSetId': _ruleSet.isEmpty ? null : _ruleSet,
      'active': _active,
      'days': [
        for (final d in _days)
          {
            'dayIndex': d['dayIndex'],
            'isWorkday': d['isWorkday'] == true,
            'breakMinutes': d['isWorkday'] == true ? (d['breakMinutes'] ?? 0) : 0,
            if (d['isWorkday'] == true && !flexible) ...{'startTime': d['startTime'], 'endTime': d['endTime'], 'breakStart': validHm('${d['breakStart']}') ? d['breakStart'] : null},
            if (d['isWorkday'] == true && flexible) 'expectedMinutes': d['expectedMinutes'] ?? 0,
          },
      ],
    };
    setState(() => _busy = true);
    final ok = await act(
      context,
      () => editId != null ? api.patch('/work-schedules/$editId', body) : api.post('/work-schedules', {...body, 'companyId': widget.companyId}),
      success: editId != null ? 'Horário atualizado' : 'Horário criado',
    );
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) Navigator.pop(context, true);
  }

  Widget _num(String label, int value, ValueChanged<int> onChanged, {String? hint, int max = 600}) => TextFormField(
    initialValue: '$value',
    keyboardType: TextInputType.number,
    inputFormatters: digitsOnly(3),
    onChanged: (v) => onChanged((int.tryParse(v) ?? 0).clamp(0, max)),
    decoration: InputDecoration(labelText: label, helperText: hint, helperMaxLines: 2),
  );

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final ordered = [..._days]..sort((a, b) => cyclic ? (a['dayIndex'] as int).compareTo(b['dayIndex'] as int) : (((a['dayIndex'] as int) + 6) % 7).compareTo(((b['dayIndex'] as int) + 6) % 7));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (row == null) ...[
          const FieldLabel('Começar de um modelo'),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [for (final (k, l) in schedulePresets) ActionChip(label: Text(l), onPressed: () => _apply(k))],
          ),
          const SizedBox(height: 16),
        ],
        FormGrid(
          columns: 3,
          children: [
            TextField(
              controller: _name,
              decoration: const InputDecoration(labelText: 'Nome *', hintText: 'Ex.: Comercial 44h'),
            ),
            TextField(
              controller: _code,
              maxLength: 20,
              decoration: const InputDecoration(labelText: 'Código', hintText: 'H01', counterText: ''),
            ),
            Select<String>(label: 'Tipo', value: _type, items: [for (final e in scheduleTypes.entries) (e.key, e.value)], onChanged: (v) => _changeType(v ?? 'FIXED')),
            if (cyclic) _num('Dias do ciclo', _cycle ?? 2, (n) => _setCycle(n.clamp(2, 62)), hint: 'Ex.: 12x36 = 2; 6x1 = 7; 4x2 = 6', max: 62),
          ],
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(child: FieldLabel(cyclic ? 'Dias do ciclo' : 'Dias da semana')),
            Text('Carga semanal${cyclic ? ' média' : ''}: ', style: TextStyle(color: t.muted, fontSize: 13)),
            Text(hours(_weekly), style: const TextStyle(fontWeight: FontWeight.w700)),
            if (_weekly > 2640) ...[const SizedBox(width: 6), Pill('acima de 44h', color: t.warning)],
          ],
        ),
        Glass(
          padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 12),
          radius: SpTokens.radiusSm,
          child: Column(
            children: [
              for (final d in ordered)
                _DayRow(
                  key: ValueKey('$_gen-${d['dayIndex']}'),
                  d: d,
                  label: cyclic ? 'Dia ${(d['dayIndex'] as int) + 1}' : weekdayNames[d['dayIndex'] as int],
                  flexible: flexible,
                  onChanged: (nd) => setState(() => _days = [for (final x in _days) x['dayIndex'] == nd['dayIndex'] ? nd : x]),
                ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        const SectionTitle('Configuração avançada'),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          value: _holidays,
          onChanged: (v) => setState(() => _holidays = v),
          title: const Text('Feriado vira folga'),
          subtitle: Text('Desmarque em escalas 12x36 e plantões, que seguem o ciclo no feriado', style: TextStyle(color: t.subtle, fontSize: 12)),
        ),
        FormGrid(
          columns: 3,
          children: [
            _num('Hora in itinere (min)', _itinere, (n) => _itinere = n, hint: 'Somada nos dias trabalhados, se a convenção prevê'),
            _num('Mobilidade da entrada (min)', _entryMob, (n) => _entryMob = n, hint: 'A saída prevista acompanha a entrada'),
            _num('Mobilidade do intervalo (min)', _breakMob, (n) => _breakMob = n, hint: 'Antes ou depois do início previsto'),
          ],
        ),
        const SizedBox(height: 14),
        FutureBuilder(
          future: _ruleSets,
          builder: (_, s) => Select<String>(
            label: 'Regra de apuração',
            value: _ruleSet,
            items: [('', 'Padrão da empresa'), for (final r in s.data ?? const <Map<String, dynamic>>[]) (r['id'] as String, '${r['name']}${r['isDefault'] == true ? ' (padrão)' : ''}')],
            onChanged: (v) => setState(() => _ruleSet = v ?? ''),
          ),
        ),
        if (editId != null) SwitchListTile(contentPadding: EdgeInsets.zero, value: _active, onChanged: (v) => setState(() => _active = v), title: const Text('Ativo (pode ser atribuído)')),
        const SizedBox(height: 20),
        Align(
          alignment: Alignment.centerRight,
          child: GlassButton(label: editId != null ? 'Salvar horário' : 'Criar horário', icon: Icons.check_rounded, loading: _busy, onPressed: _save),
        ),
      ],
    );
  }
}

class _DayRow extends StatelessWidget {
  const _DayRow({super.key, required this.d, required this.label, required this.flexible, required this.onChanged});
  final Map<String, dynamic> d;
  final String label;
  final bool flexible;
  final ValueChanged<Map<String, dynamic>> onChanged;

  Widget _hm(BuildContext context, String key, String hint) => SizedBox(
    width: 74,
    child: TextFormField(
      initialValue: d[key] as String? ?? '',
      textAlign: TextAlign.center,
      keyboardType: TextInputType.number,
      inputFormatters: [MaskFormatter(maskTime)],
      decoration: InputDecoration(hintText: hint, contentPadding: const EdgeInsets.symmetric(horizontal: 6, vertical: 10)),
      onChanged: (v) {
        if (validHm(v)) {
          onChanged({...d, key: v});
        } else if (v.isEmpty) {
          onChanged({...d, key: null});
        }
      },
    ),
  );

  Widget _min(String key, {double width = 64}) => SizedBox(
    width: width,
    child: TextFormField(
      initialValue: '${d[key] ?? 0}',
      textAlign: TextAlign.center,
      keyboardType: TextInputType.number,
      inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(4)],
      decoration: const InputDecoration(contentPadding: EdgeInsets.symmetric(horizontal: 6, vertical: 10)),
      onChanged: (v) => onChanged({...d, key: int.tryParse(v) ?? 0}),
    ),
  );

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final work = d['isWorkday'] == true;
    final night = work && validHm('${d['startTime']}') && validHm('${d['endTime']}') && toMin(d['endTime'] as String) <= toMin(d['startTime'] as String);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Wrap(
        spacing: 8,
        runSpacing: 6,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          SizedBox(
            width: 56,
            child: Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
          ),
          FilterChip(
            label: Text(work ? 'Trabalha' : 'Folga'),
            selected: work,
            selectedColor: t.brand.withValues(alpha: 0.2),
            checkmarkColor: t.brand,
            onSelected: (v) => onChanged({
              ...d,
              'isWorkday': v,
              if (v && !flexible && d['startTime'] == null) ...{'startTime': '08:00', 'endTime': '17:00', 'breakMinutes': 60},
            }),
          ),
          if (work && flexible) ...[Text('Carga', style: TextStyle(color: t.muted)), _min('expectedMinutes', width: 74), Text('min', style: TextStyle(color: t.muted))],
          if (work && !flexible) ...[
            _hm(context, 'startTime', 'entrada'),
            Text('às', style: TextStyle(color: t.muted)),
            _hm(context, 'endTime', 'saída'),
            if (night)
              Tooltip(
                message: 'Vira a noite',
                child: Icon(Icons.nightlight_round, size: 16, color: t.info),
              ),
            Text('intervalo', style: TextStyle(color: t.muted)),
            _min('breakMinutes'),
            Text('min às', style: TextStyle(color: t.muted)),
            _hm(context, 'breakStart', '--:--'),
          ],
          Text(
            hours(dayExpected(d)),
            style: TextStyle(color: t.brand, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}
