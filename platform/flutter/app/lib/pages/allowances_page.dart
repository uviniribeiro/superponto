// Abonos em lote, afastamentos (atestado, férias…) e sobreaviso.
import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/glass.dart';
import '../core/schedules.dart' show validHm;
import '../core/timesheet.dart';
import '../core/tokens.dart';
import '../widgets/employee_picker.dart';
import '../widgets/masked.dart';
import '../widgets/ui.dart';

class AllowancesPage extends StatefulWidget {
  const AllowancesPage({super.key});
  @override
  State<AllowancesPage> createState() => _AllowancesPageState();
}

class _AllowancesPageState extends State<AllowancesPage> {
  int _tab = 0, _token = 0;
  late String _from = addDays(monthRange(todayBr()).from, -31), _to = monthRange(todayBr()).to;

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final canManage = api.can('time.allowances:create');
    final leave = {for (final (k, l) in leaveTypes) k: l};
    return PageScaffold(
      title: 'Abonos e afastamentos',
      subtitle: 'Abonos em lote (dia inteiro ou minutos), afastamentos como atestado e férias, e sobreaviso.',
      icon: Icons.healing_rounded,
      actions: [
        if (canManage) ...[
          GlassButton(label: 'Sobreaviso', kind: BtnKind.glass, onPressed: () => _form('oncall')),
          GlassButton(label: 'Afastamento', icon: Icons.healing_rounded, kind: BtnKind.glass, onPressed: () => _form('leave')),
          GlassButton(label: 'Abono', icon: Icons.add_rounded, onPressed: () => _form('allowance')),
        ],
      ],
      children: [
        Wrap(
          spacing: 12,
          runSpacing: 12,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            GlassTabs(tabs: const ['Abonos', 'Afastamentos'], index: _tab, onChanged: (i) => setState(() => _tab = i)),
            DateField(label: 'De', value: _from, width: 170, onChanged: (v) => setState(() => _from = v ?? _from)),
            DateField(label: 'Até', value: _to, width: 170, onChanged: (v) => setState(() => _to = v ?? _to)),
          ],
        ),
        const SizedBox(height: 14),
        Async<List<Map<String, dynamic>>>(
          reloadToken: '$_tab|$_from|$_to|$_token',
          load: () => api.getList(_tab == 0 ? '/allowances' : '/leaves', {'from': _from, 'to': _to}),
          builder: (context, rows, _) => GlassTable<Map<String, dynamic>>(
            rows: rows,
            empty: EmptyState(icon: Icons.healing_rounded, title: 'Nada no período', body: _tab == 0 ? 'Nenhum abono lançado.' : 'Nenhum afastamento.'),
            columns: [
              Col(_tab == 0 ? 'Dia' : 'Período', (r) => txt(_tab == 0 ? brDate(r['date']) : '${brDate(r['startDate'])} – ${brDate(r['endDate'])}', bold: true), flex: 2),
              Col('Funcionário', (r) => txt('${asMap(r['employment'])['name']} · ${asMap(r['employment'])['registration']}'), flex: 3, primary: true),
              Col(
                'Detalhe',
                (r) => txt(
                  _tab == 0
                      ? '${asMap(r['justification'])['name']} · ${r['fullDay'] == true ? 'dia inteiro' : '${r['minutes']} min'}${asMap(r['justification'])['disregardsDebits'] == false ? ' · só justifica' : ''}${r['note'] != null ? ' · ${r['note']}' : ''}'
                      : '${leave[r['type']] ?? r['type']}${r['note'] != null ? ' · ${r['note']}' : ''}',
                  muted: true,
                ),
                flex: 4,
              ),
            ],
            actions: canManage
                ? (r) => [
                    RowAction(Icons.delete_outline_rounded, 'Remover', () async {
                      if (!await confirm(context, title: 'Remover?', body: 'O espelho volta a calcular o dia sem este lançamento.', confirmLabel: 'Remover') || !context.mounted) return;
                      if (await act(context, () => api.delete('${_tab == 0 ? '/allowances' : '/leaves'}/${r['id']}'), success: 'Removido') && mounted) setState(() => _token++);
                    }, danger: true),
                  ]
                : null,
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 10),
          child: Text('Sobreaviso aparece no espelho de cada funcionário.', style: TextStyle(color: t.subtle, fontSize: 12.5)),
        ),
      ],
    );
  }

  Future<void> _form(String kind) async {
    final ok = await showGlassDialog<bool>(
      context,
      title: switch (kind) {
        'allowance' => 'Lançar abono',
        'leave' => 'Registrar afastamento',
        _ => 'Lançar sobreaviso',
      },
      width: 640,
      builder: (_) => switch (kind) {
        'allowance' => const _AllowanceForm(),
        'leave' => const _LeaveForm(),
        _ => const _OnCallForm(),
      },
    );
    if (ok == true && mounted) setState(() => _token++);
  }
}

mixin _Submit<T extends StatefulWidget> on State<T> {
  bool busy = false;
  Future<void> submit(Future<Object?> Function() f, String Function(Map<String, dynamic>) msg) async {
    setState(() => busy = true);
    try {
      final r = await f();
      if (!mounted) return;
      toast(context, msg(asMap(r)));
      Navigator.pop(context, true);
    } catch (e) {
      if (mounted) toast(context, '$e', error: true);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }
}

class _AllowanceForm extends StatefulWidget {
  const _AllowanceForm();
  @override
  State<_AllowanceForm> createState() => _AllowanceFormState();
}

class _AllowanceFormState extends State<_AllowanceForm> with _Submit {
  List<PickedEmployee> _emps = [];
  String _from = todayIso(), _to = todayIso(), _just = '', _minutes = '';
  bool _fullDay = true, _onlyWorkdays = true;
  final _note = TextEditingController();
  late final _justs = api.getList('/justifications', {'pageSize': 200});

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      MultiEmployeePicker(value: _emps, onChanged: (v) => setState(() => _emps = v)),
      const SizedBox(height: 14),
      FutureBuilder(
        future: _justs,
        builder: (_, s) => Select<String>(
          label: 'Justificativa',
          value: _just,
          items: [
            ('', 'Escolha…'),
            for (final j in (s.data ?? const <Map<String, dynamic>>[]).where((j) => j['active'] != false))
              (
                j['id'] as String,
                '${j['name']}${j['disregardsDebits'] == true ? '' : ' (só justifica)'}${j['usageLimit'] != null ? ' · até ${j['usageLimit']}/${j['limitPeriod'] == 'YEAR' ? 'ano' : 'mês'}' : ''}',
              ),
          ],
          onChanged: (v) => setState(() => _just = v ?? ''),
        ),
      ),
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
      Wrap(
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          Checkbox(value: _fullDay, onChanged: (v) => setState(() => _fullDay = v ?? true)),
          const Text('Dia inteiro'),
          const SizedBox(width: 10),
          if (!_fullDay)
            SizedBox(
              width: 110,
              child: TextField(
                inputFormatters: digitsOnly(4),
                onChanged: (v) => setState(() => _minutes = v),
                decoration: const InputDecoration(hintText: 'minutos'),
              ),
            ),
          const SizedBox(width: 10),
          Checkbox(value: _onlyWorkdays, onChanged: (v) => setState(() => _onlyWorkdays = v ?? true)),
          const Text('Só dias de trabalho'),
        ],
      ),
      const SizedBox(height: 10),
      TextField(
        controller: _note,
        maxLength: 300,
        decoration: const InputDecoration(labelText: 'Observação', counterText: ''),
      ),
      const SizedBox(height: 18),
      Align(
        alignment: Alignment.centerRight,
        child: GlassButton(
          label: 'Lançar abono',
          loading: busy,
          onPressed: _emps.isEmpty || _just.isEmpty || (!_fullDay && _minutes.isEmpty)
              ? null
              : () => submit(
                  () => api.post('/allowances', {
                    'employmentIds': [for (final e in _emps) e.id],
                    'from': _from,
                    'to': _to,
                    'justificationId': _just,
                    'fullDay': _fullDay,
                    'onlyWorkdays': _onlyWorkdays,
                    if (_note.text.trim().isNotEmpty) 'note': _note.text.trim(),
                    if (!_fullDay) 'minutes': int.parse(_minutes),
                  }),
                  (r) => '${r['created']} abono(s) lançado(s)',
                ),
        ),
      ),
    ],
  );
}

class _LeaveForm extends StatefulWidget {
  const _LeaveForm();
  @override
  State<_LeaveForm> createState() => _LeaveFormState();
}

class _LeaveFormState extends State<_LeaveForm> with _Submit {
  List<PickedEmployee> _emps = [];
  String _type = 'MEDICAL', _start = todayIso(), _end = todayIso();
  final _note = TextEditingController();

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      MultiEmployeePicker(value: _emps, single: true, onChanged: (v) => setState(() => _emps = v)),
      const SizedBox(height: 14),
      Select<String>(label: 'Tipo', value: _type, items: leaveTypes, onChanged: (v) => setState(() => _type = v ?? 'MEDICAL')),
      const SizedBox(height: 14),
      FormGrid(
        children: [
          DateField(
            label: 'Início',
            value: _start,
            onChanged: (v) => setState(() {
              _start = v ?? _start;
              if (_end.compareTo(_start) < 0) _end = _start;
            }),
          ),
          DateField(label: 'Fim', value: _end, onChanged: (v) => setState(() => _end = v == null || v.compareTo(_start) < 0 ? _start : v)),
        ],
      ),
      const SizedBox(height: 14),
      TextField(
        controller: _note,
        maxLength: 300,
        decoration: const InputDecoration(labelText: 'Observação', helperText: 'Não registre o CID ou diagnóstico: é dado sensível (LGPD)', counterText: ''),
      ),
      const SizedBox(height: 18),
      Align(
        alignment: Alignment.centerRight,
        child: GlassButton(
          label: 'Registrar afastamento',
          loading: busy,
          onPressed: _emps.isEmpty
              ? null
              : () => submit(
                  () => api.post('/leaves', {'employmentId': _emps.first.id, 'type': _type, 'startDate': _start, 'endDate': _end, if (_note.text.trim().isNotEmpty) 'note': _note.text.trim()}),
                  (_) => 'Afastamento registrado',
                ),
        ),
      ),
    ],
  );
}

class _OnCallForm extends StatefulWidget {
  const _OnCallForm();
  @override
  State<_OnCallForm> createState() => _OnCallFormState();
}

class _OnCallFormState extends State<_OnCallForm> with _Submit {
  List<PickedEmployee> _emps = [];
  String _date = todayIso(), _start = '18:00', _end = '06:00';
  final _note = TextEditingController();

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Text('Horas em que o funcionário fica à disposição fora do local de trabalho (CLT art. 244 §2º). Aparecem no espelho, pagas à razão de 1/3.', style: TextStyle(color: context.sp.muted)),
      const SizedBox(height: 14),
      MultiEmployeePicker(value: _emps, onChanged: (v) => setState(() => _emps = v)),
      const SizedBox(height: 14),
      FormGrid(
        columns: 3,
        children: [
          DateField(label: 'Dia', value: _date, onChanged: (v) => setState(() => _date = v ?? _date)),
          TextFormField(
            initialValue: _start,
            inputFormatters: [MaskFormatter(maskTime)],
            decoration: const InputDecoration(labelText: 'Início'),
            onChanged: (v) => setState(() => _start = v),
          ),
          TextFormField(
            initialValue: _end,
            inputFormatters: [MaskFormatter(maskTime)],
            decoration: const InputDecoration(labelText: 'Fim'),
            onChanged: (v) => setState(() => _end = v),
          ),
        ],
      ),
      const SizedBox(height: 14),
      TextField(
        controller: _note,
        maxLength: 300,
        decoration: const InputDecoration(labelText: 'Observação', counterText: ''),
      ),
      const SizedBox(height: 18),
      Align(
        alignment: Alignment.centerRight,
        child: GlassButton(
          label: 'Lançar sobreaviso',
          loading: busy,
          onPressed: _emps.isEmpty || !validHm(_start) || !validHm(_end)
              ? null
              : () => submit(
                  () => api.post('/on-call', {
                    'employmentIds': [for (final e in _emps) e.id],
                    'date': _date,
                    'startTime': _start,
                    'endTime': _end,
                    if (_note.text.trim().isNotEmpty) 'note': _note.text.trim(),
                  }),
                  (r) => 'Sobreaviso de ${((r['minutes'] as num? ?? 0) / 60).round()}h lançado para ${r['created']} funcionário(s)',
                ),
        ),
      ),
    ],
  );
}
