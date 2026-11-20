// Espelho de ponto: dia a dia com previsto, marcações, trabalhado, saldo e ocorrências; ajustes, abonos e ciência.
import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/glass.dart';
import '../core/timesheet.dart';
import '../core/tokens.dart';
import '../widgets/employee_picker.dart';
import '../widgets/masked.dart';
import '../widgets/ui.dart';
import '../core/schedules.dart' show validHm;

class MirrorPage extends StatefulWidget {
  const MirrorPage({super.key});
  @override
  State<MirrorPage> createState() => _MirrorPageState();
}

class _MirrorPageState extends State<MirrorPage> {
  PickedEmployee? _emp;
  DateTime _month = DateTime(todayBr().year, todayBr().month);
  int _token = 0;
  late final Future<String> _footer = api.getList('/custom-texts').then((l) => '${l.where((x) => x['key'] == 'MIRROR_FOOTER').firstOrNull?['text'] ?? ''}', onError: (_) => '');

  @override
  Widget build(BuildContext context) {
    final team = api.can('time.calculations:read');
    final range = monthRange(_month);
    return PageScaffold(
      title: team ? 'Espelho de ponto' : 'Meu espelho',
      subtitle: 'Dia a dia: horário previsto, marcações, horas trabalhadas, saldo e ocorrências. Toque num dia para ajustar ou abonar.',
      icon: Icons.receipt_long_rounded,
      actions: [
        if (team) EmployeePicker(value: _emp, onChanged: (v) => setState(() => _emp = v)),
        MonthPicker(month: _month, onChanged: (m) => setState(() => _month = m)),
      ],
      children: [
        if (team && _emp == null)
          const Glass(
            child: EmptyState(icon: Icons.receipt_long_rounded, title: 'Escolha um funcionário', body: 'Use a busca acima para abrir o espelho do mês.'),
          )
        else
          Async<Map<String, dynamic>>(
            reloadToken: '${_emp?.id}|${range.from}|$_token',
            load: () => team ? api.getMap('/timesheet', {'employmentId': _emp!.id, 'from': range.from, 'to': range.to}) : api.getMap('/timesheet/me', {'from': range.from, 'to': range.to}),
            builder: (context, m, _) => _MirrorView(m: m, team: team, footer: _footer, range: range, onChanged: () => setState(() => _token++)),
          ),
      ],
    );
  }
}

class _MirrorView extends StatelessWidget {
  const _MirrorView({required this.m, required this.team, required this.footer, required this.range, required this.onChanged});
  final Map<String, dynamic> m;
  final bool team;
  final Future<String> footer;
  final ({String from, String to}) range;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final s = asMap(m['summary']);
    final emp = asMap(m['employment']);
    final days = asList(m['days']);
    final byPct = asList(s['overtimeByPercent']);
    final today = todayIso();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ResponsiveGrid(
          minItemWidth: 170,
          children: [
            StatTile(label: 'Previsto', value: hhmm(s['expectedMinutes'])),
            StatTile(label: 'Trabalhado', value: hhmm(s['workedMinutes'])),
            StatTile(label: 'Saldo', value: hhmm(s['balanceMinutes'], signed: true), color: (s['balanceMinutes'] as num? ?? 0) < 0 ? t.danger : t.success),
            StatTile(label: 'Extras', value: hhmm(s['overtimeMinutes']), hint: byPct.isEmpty ? null : byPct.map((o) => '${o['percent']}%').join('/')),
            StatTile(label: 'Noturno', value: hhmm(s['nightReducedMinutes'])),
            StatTile(label: 'Faltas', value: '${s['absenceDays'] ?? 0} dia(s)'),
          ],
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            if ((s['incompleteDays'] as num? ?? 0) > 0) Pill('${s['incompleteDays']} dia(s) com marcação ímpar', color: t.danger),
            if ((s['pendingAdjustments'] as num? ?? 0) > 0) Pill('${s['pendingAdjustments']} ajuste(s) aguardando aprovação', color: t.brand),
            if ((s['unauthorizedOvertimeMinutes'] as num? ?? 0) > 0) Pill('${hhmm(s['unauthorizedOvertimeMinutes'])} de extra sem autorização', color: t.warning),
            if ((s['onCallMinutes'] as num? ?? 0) > 0) Pill('Sobreaviso ${hhmm(s['onCallMinutes'])} (paga ${hhmm(s['onCallPaidMinutes'])})', color: t.info),
          ],
        ),
        const SizedBox(height: 14),
        Glass(
          padding: const EdgeInsets.all(8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 10, 12, 8),
                child: Text.rich(
                  TextSpan(
                    children: [
                      TextSpan(
                        text: '${emp['name']}',
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                      TextSpan(
                        text: ' · matrícula ${emp['registration']}',
                        style: TextStyle(color: t.muted),
                      ),
                    ],
                  ),
                ),
              ),
              for (final d in days) _DayRow(d: d, today: d['date'] == today, onTap: () => _open(context, d)),
              FutureBuilder(
                future: footer,
                builder: (_, f) => (f.data ?? '').isEmpty
                    ? const SizedBox.shrink()
                    : Padding(
                        padding: const EdgeInsets.all(12),
                        child: Text(f.data!, style: TextStyle(color: t.subtle, fontSize: 12)),
                      ),
              ),
            ],
          ),
        ),
        if (!team) ...[const SizedBox(height: 14), MirrorAck(from: range.from, to: range.to, employmentId: emp['id'] as String)],
      ],
    );
  }

  Future<void> _open(BuildContext context, Map<String, dynamic> d) async {
    final changed = await showGlassDialog<bool>(
      context,
      title: '${wdShort[weekdayOf('${d['date']}')]} ${dm('${d['date']}')}',
      width: 620,
      builder: (_) => _DayActions(d: d, employmentId: asMap(m['employment'])['id'] as String, canAdjust: api.can('time.adjustments:create'), canAllow: api.can('time.allowances:create')),
    );
    if (changed == true) onChanged();
  }
}

class _DayRow extends StatelessWidget {
  const _DayRow({required this.d, required this.today, required this.onTap});
  final Map<String, dynamic> d;
  final bool today;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final e = asMap(d['expected']);
    final r = d['result'] == null ? null : asMap(d['result']);
    final leave = d['leave'] == null ? null : asMap(d['leave']);
    final allowance = d['allowance'] == null ? null : asMap(d['allowance']);
    final bal = (r?['balanceMinutes'] as num? ?? 0).toInt();
    final expected = leave != null
        ? '${leave['label']}'
        : e['isHoliday'] == true
        ? '${e['holidayName'] ?? 'Feriado'}'
        : e['isWorkday'] == true
        ? (e['start'] != null ? '${e['start']}–${e['end']}' : hhmm(e['expectedMinutes']))
        : 'folga';
    final flags = [
      for (final f in (r?['flags'] as List? ?? const []))
        if (f != 'WITHIN_TOLERANCE' && !(f == 'LEAVE_FULL' && allowance != null)) '$f',
    ];
    final punches = Wrap(
      spacing: 4,
      runSpacing: 4,
      children: [
        for (final p in asList(d['punches']))
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(6),
              color: p['status'] == 'INCLUDED' ? t.info.withValues(alpha: 0.15) : t.hover,
              border: p['status'] == 'PENDING_INCLUDE' ? Border.all(color: t.brand.withValues(alpha: 0.6)) : null,
            ),
            child: Text(
              '${p['time']}',
              style: TextStyle(
                fontSize: 12,
                fontFeatures: const [FontFeature.tabularFigures()],
                color: p['status'] == 'INCLUDED' ? t.info : (p['status'] == 'DISREGARDED' ? t.subtle : t.fg),
                decoration: '${p['status']}'.contains('DISREGARD') ? TextDecoration.lineThrough : null,
              ),
            ),
          ),
      ],
    );
    final occ = Wrap(
      spacing: 4,
      runSpacing: 4,
      children: [
        if (allowance != null) Pill('${allowance['justification']}', color: t.success),
        for (final f in flags) Pill(flagLabel[f] ?? f, color: badFlags.contains(f) ? t.danger : t.muted),
      ],
    );
    final wide = isWide(context);
    return Material(
      type: MaterialType.transparency,
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            color: today ? t.brand.withValues(alpha: 0.07) : null,
            border: Border(bottom: BorderSide(color: t.border)),
          ),
          child: wide
              ? Row(
                  children: [
                    SizedBox(
                      width: 90,
                      child: Row(
                        children: [
                          Text(
                            dm('${d['date']}'),
                            style: TextStyle(fontWeight: FontWeight.w700, color: today ? t.brand : t.fg),
                          ),
                          const SizedBox(width: 4),
                          Text(wdShort[weekdayOf('${d['date']}')], style: TextStyle(color: t.subtle, fontSize: 12)),
                          if (d['closed'] == true) Icon(Icons.lock_rounded, size: 13, color: t.subtle),
                        ],
                      ),
                    ),
                    SizedBox(
                      width: 130,
                      child: Text(
                        expected,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(color: t.muted, fontSize: 13),
                      ),
                    ),
                    Expanded(flex: 3, child: punches),
                    SizedBox(width: 70, child: Text(r != null && (r['workedMinutes'] as num? ?? 0) > 0 ? hhmm(r['workedMinutes']) : '—', textAlign: TextAlign.right)),
                    SizedBox(
                      width: 70,
                      child: Text(
                        bal != 0 ? hhmm(bal, signed: true) : '',
                        textAlign: TextAlign.right,
                        style: TextStyle(fontWeight: FontWeight.w700, color: bal > 0 ? t.success : t.danger),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(flex: 3, child: occ),
                  ],
                )
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          '${dm('${d['date']}')} ${wdShort[weekdayOf('${d['date']}')]}',
                          style: TextStyle(fontWeight: FontWeight.w700, color: today ? t.brand : t.fg),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            expected,
                            style: TextStyle(color: t.muted, fontSize: 12.5),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (bal != 0)
                          Text(
                            hhmm(bal, signed: true),
                            style: TextStyle(fontWeight: FontWeight.w700, color: bal > 0 ? t.success : t.danger),
                          ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    punches,
                    if (flags.isNotEmpty || allowance != null) ...[const SizedBox(height: 6), occ],
                  ],
                ),
        ),
      ),
    );
  }
}

class _DayActions extends StatefulWidget {
  const _DayActions({required this.d, required this.employmentId, required this.canAdjust, required this.canAllow});
  final Map<String, dynamic> d;
  final String employmentId;
  final bool canAdjust, canAllow;
  @override
  State<_DayActions> createState() => _DayActionsState();
}

class _DayActionsState extends State<_DayActions> {
  final _just = TextEditingController();
  String _time = '';
  String _justId = '';
  bool _fullDay = true;
  String _minutes = '';
  late final Future<List<Map<String, dynamic>>> _justs = widget.canAllow ? api.getList('/justifications', {'pageSize': 200}) : Future.value(const []);

  Future<void> _do(Future<Object?> Function() f, String Function(Map<String, dynamic>) msg) async {
    try {
      final r = asMap(await f());
      if (!mounted) return;
      toast(context, msg(r));
      Navigator.pop(context, true);
    } catch (e) {
      if (mounted) toast(context, '$e', error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final d = widget.d;
    final r = d['result'] == null ? null : asMap(d['result']);
    final e = asMap(d['expected']);
    final allowance = d['allowance'] == null ? null : asMap(d['allowance']);
    final closed = d['closed'] == true;
    final justOk = _just.text.trim().length >= 5;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            for (final (k, v) in [('Previsto', hhmm(r?['expectedMinutes'] ?? e['expectedMinutes'])), ('Trabalhado', hhmm(r?['workedMinutes'])), ('Saldo', hhmm(r?['balanceMinutes'], signed: true))])
              Expanded(
                child: Glass(
                  margin: const EdgeInsets.only(right: 8),
                  padding: const EdgeInsets.all(12),
                  radius: 16,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(k, style: TextStyle(color: t.subtle, fontSize: 12)),
                      Text(v, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
                    ],
                  ),
                ),
              ),
          ],
        ),
        if ((r?['flags'] as List?)?.isNotEmpty == true) ...[
          const SizedBox(height: 10),
          Wrap(spacing: 6, runSpacing: 6, children: [for (final f in r!['flags'] as List) Pill(flagLabel[f] ?? '$f', color: badFlags.contains(f) ? t.danger : t.muted)]),
        ],
        if ((r?['unauthorizedOvertimeMinutes'] as num? ?? 0) > 0)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text('${hhmm(r!['unauthorizedOvertimeMinutes'])} de extra sem autorização prévia (continua sendo paga; confira).', style: TextStyle(color: t.warning, fontSize: 13)),
          ),
        const SizedBox(height: 16),
        const SectionTitle('Marcações'),
        if (asList(d['punches']).isEmpty) Text('Sem marcações neste dia.', style: TextStyle(color: t.subtle)),
        for (final p in asList(d['punches']))
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(
              children: [
                Text(
                  '${p['time']}',
                  style: TextStyle(fontWeight: FontWeight.w700, decoration: '${p['status']}'.contains('DISREGARD') ? TextDecoration.lineThrough : null),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    '${sourceLabel[p['source']] ?? p['source']}${p['status'] != 'ORIGINAL' ? ' · ${punchStatusLabel[p['status']] ?? ''}' : ''}${p['justification'] != null ? ' · ${p['justification']}' : ''}',
                    style: TextStyle(color: t.muted, fontSize: 12.5),
                  ),
                ),
                if (!closed && widget.canAdjust && p['status'] == 'ORIGINAL')
                  Tooltip(
                    message: justOk ? '' : 'Escreva a justificativa abaixo',
                    child: TextButton(
                      onPressed: justOk
                          ? () => _do(
                              () => api.post('/time-adjustments', {'kind': 'DISREGARD', 'employmentId': widget.employmentId, 'timeRecordId': p['id'], 'justification': _just.text.trim()}),
                              (a) => a['status'] == 'APPROVED' ? 'Marcação desconsiderada' : 'Pedido enviado para aprovação',
                            )
                          : null,
                      child: const Text('Desconsiderar'),
                    ),
                  ),
                if (!closed && widget.canAdjust && p['adjustmentId'] != null && '${p['status']}'.startsWith('PENDING'))
                  RowAction(Icons.close_rounded, 'Cancelar ajuste', () => _do(() => api.delete('/time-adjustments/${p['adjustmentId']}'), (_) => 'Ajuste cancelado'), danger: true),
              ],
            ),
          ),
        const SizedBox(height: 14),
        if (closed)
          Row(
            children: [
              Icon(Icons.lock_rounded, size: 16, color: t.muted),
              const SizedBox(width: 6),
              Expanded(
                child: Text('Período fechado: reabra o fechamento para ajustar.', style: TextStyle(color: t.muted)),
              ),
            ],
          )
        else ...[
          if (widget.canAdjust) ...[
            const SectionTitle('Incluir ou desconsiderar'),
            TextField(
              controller: _just,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(labelText: 'Justificativa', hintText: 'Ex.: esqueceu de marcar a saída', helperText: 'Obrigatória (mín. 5 caracteres); fica no histórico'),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                SizedBox(
                  width: 140,
                  child: TextField(
                    keyboardType: TextInputType.number,
                    inputFormatters: [MaskFormatter(maskTime)],
                    onChanged: (v) => setState(() => _time = v),
                    decoration: const InputDecoration(labelText: 'Horário a incluir', hintText: 'HH:MM'),
                  ),
                ),
                const SizedBox(width: 10),
                GlassButton(
                  label: 'Incluir',
                  icon: Icons.add_rounded,
                  small: true,
                  onPressed: validHm(_time) && justOk
                      ? () => _do(
                          () => api.post('/time-adjustments', {'kind': 'INCLUDE', 'employmentId': widget.employmentId, 'date': d['date'], 'time': _time, 'justification': _just.text.trim()}),
                          (a) => a['status'] == 'APPROVED' ? 'Marcação incluída' : 'Inclusão enviada para aprovação',
                        )
                      : null,
                ),
              ],
            ),
            const SizedBox(height: 18),
          ],
          if (widget.canAllow) ...[
            const SectionTitle('Abono'),
            if (allowance != null)
              Row(
                children: [
                  Expanded(
                    child: Text(
                      '${allowance['justification']} · ${allowance['fullDay'] == true ? 'dia inteiro' : '${allowance['minutes']} min'}${allowance['disregardsDebits'] == true ? '' : ' (sem abonar)'}',
                    ),
                  ),
                  TextButton(onPressed: () => _do(() => api.delete('/allowances/${allowance['id']}'), (_) => 'Abono removido'), child: const Text('Remover')),
                ],
              )
            else
              FutureBuilder(
                future: _justs,
                builder: (_, s) {
                  final list = (s.data ?? const <Map<String, dynamic>>[]).where((j) => j['active'] != false).toList();
                  if (s.hasData && list.isEmpty) return Text('Cadastre justificativas em Ponto › Justificativas.', style: TextStyle(color: t.subtle));
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Select<String>(
                        label: 'Justificativa',
                        value: _justId,
                        items: [
                          ('', 'Escolha…'),
                          for (final j in list)
                            (j['id'] as String, '${j['name']}${j['disregardsDebits'] == true ? '' : ' (só justifica)'}${j['usageLimit'] != null ? ' · limite ${j['usageLimit']}' : ''}'),
                        ],
                        onChanged: (v) => setState(() => _justId = v ?? ''),
                      ),
                      Row(
                        children: [
                          Checkbox(value: _fullDay, onChanged: (v) => setState(() => _fullDay = v ?? true)),
                          const Text('Dia inteiro'),
                          const SizedBox(width: 12),
                          if (!_fullDay)
                            SizedBox(
                              width: 110,
                              child: TextField(
                                inputFormatters: digitsOnly(4),
                                onChanged: (v) => setState(() => _minutes = v),
                                decoration: const InputDecoration(hintText: 'minutos'),
                              ),
                            ),
                          const Spacer(),
                          GlassButton(
                            label: 'Abonar',
                            small: true,
                            onPressed: _justId.isNotEmpty && (_fullDay || _minutes.isNotEmpty)
                                ? () => _do(
                                    () => api.post('/allowances', {
                                      'employmentIds': [widget.employmentId],
                                      'from': d['date'],
                                      'to': d['date'],
                                      'justificationId': _justId,
                                      'fullDay': _fullDay,
                                      'onlyWorkdays': false,
                                      if (!_fullDay) 'minutes': int.parse(_minutes),
                                    }),
                                    (_) => 'Dia abonado',
                                  )
                                : null,
                          ),
                        ],
                      ),
                    ],
                  );
                },
              ),
          ],
        ],
      ],
    );
  }
}

/// Ciência eletrônica do espelho pelo próprio funcionário (de acordo ou com ressalva; não muda depois).
class MirrorAck extends StatefulWidget {
  const MirrorAck({super.key, required this.from, required this.to, required this.employmentId});
  final String from, to, employmentId;
  @override
  State<MirrorAck> createState() => _MirrorAckState();
}

class _MirrorAckState extends State<MirrorAck> {
  int _token = 0;
  String? _mode;
  final _comment = TextEditingController();

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final q = {'from': widget.from, 'to': widget.to, 'employmentId': widget.employmentId};
    return Async<Map<String, dynamic>>(
      reloadToken: _token,
      load: () => api.getMap('/timesheet/me/ack', q),
      loading: const SizedBox.shrink(),
      builder: (context, s, _) {
        final a = s['acknowledgment'] == null ? null : asMap(s['acknowledgment']);
        return Glass(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SectionTitle('Ciência do espelho'),
              if (a != null) ...[
                Row(
                  children: [
                    Icon(a['decision'] == 'AGREE' ? Icons.verified_user_rounded : Icons.gpp_maybe_rounded, color: a['decision'] == 'AGREE' ? t.success : t.warning),
                    const SizedBox(width: 8),
                    Expanded(child: Text('${a['decision'] == 'AGREE' ? 'Você deu ciência e concordou' : 'Você deu ciência com ressalva'} em ${brDateTime(a['createdAt'])}.')),
                  ],
                ),
                if (a['comment'] != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text('Ressalva: ${a['comment']}', style: TextStyle(color: t.muted)),
                  ),
                if (a['changedSince'] == true)
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text('O espelho mudou depois da sua ciência (ajuste ou abono posterior). O RH vê essa diferença.', style: TextStyle(color: t.warning)),
                  ),
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: SelectableText('Código: ${a['contentHash']}', style: TextStyle(color: t.subtle, fontSize: 12)),
                ),
              ] else if (s['canSign'] != true)
                Text('${s['reason'] ?? 'Indisponível'}: a ciência fica disponível depois do último dia do período.', style: TextStyle(color: t.muted))
              else if (_mode != null) ...[
                Text('${s['term']}', style: TextStyle(color: t.muted)),
                if (_mode == 'DISAGREE') ...[
                  const SizedBox(height: 10),
                  TextField(
                    controller: _comment,
                    maxLines: 3,
                    maxLength: 1000,
                    decoration: const InputDecoration(labelText: 'Explique o que está diferente'),
                  ),
                ],
                const SizedBox(height: 8),
                Text('Depois de registrada, a ciência não pode ser alterada.', style: TextStyle(color: t.warning, fontSize: 12.5)),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  children: [
                    GlassButton(
                      label: _mode == 'AGREE' ? 'Confirmar ciência' : 'Registrar com ressalva',
                      onPressed: () async {
                        if (_mode == 'DISAGREE' && _comment.text.trim().length < 5) return toast(context, 'Explique a ressalva (mínimo 5 caracteres)', error: true);
                        if (await act(
                          context,
                          () => api.post('/timesheet/me/ack', {...q, 'decision': _mode, if (_comment.text.trim().isNotEmpty) 'comment': _comment.text.trim()}),
                          success: 'Ciência registrada',
                        )) {
                          setState(() {
                            _mode = null;
                            _token++;
                          });
                        }
                      },
                    ),
                    GlassButton(label: 'Cancelar', kind: BtnKind.ghost, onPressed: () => setState(() => _mode = null)),
                  ],
                ),
              ] else
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    GlassButton(label: 'Dar ciência (de acordo)', onPressed: () => setState(() => _mode = 'AGREE')),
                    GlassButton(label: 'Dar ciência com ressalva', kind: BtnKind.glass, onPressed: () => setState(() => _mode = 'DISAGREE')),
                  ],
                ),
            ],
          ),
        );
      },
    );
  }
}
