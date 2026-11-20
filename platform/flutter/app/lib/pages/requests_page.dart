// Solicitações (ajuste, justificativa, troca de folga, hora extra) com aprovação em etapas; e os fluxos de aprovação.
import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/glass.dart';
import '../core/schedules.dart' show validHm;
import '../core/timesheet.dart';
import '../core/tokens.dart';
import '../widgets/company_scope.dart';
import '../widgets/masked.dart';
import '../widgets/ui.dart';

const _types = [
  ('RECORD_CORRECTION', 'Esqueci de marcar', 'Inclui uma marcação no dia'),
  ('ABSENCE_JUSTIFICATION', 'Justificar falta ou atraso', 'Vira abono quando aprovado'),
  ('SCHEDULE_CHANGE', 'Trocar folga', 'Trabalhar numa folga e folgar num dia de trabalho'),
  ('OVERTIME_AUTHORIZATION', 'Autorização de hora extra', 'Pedido prévio para fazer extra'),
  ('OTHER', 'Outro pedido', 'Declarações e assuntos gerais'),
];

String _describe(Map<String, dynamic> r) {
  final p = asMap(r['payload']);
  return switch (r['type']) {
    'RECORD_CORRECTION' => 'Marcação às ${p['time']} em ${brDate(r['refDate'])}',
    'ABSENCE_JUSTIFICATION' => '${p['fullDay'] == false ? '${p['minutes']} min' : 'Dia inteiro'} em ${brDate(r['refDate'])}',
    'SCHEDULE_CHANGE' => 'Folgar em ${brDate(r['refDate'])} e trabalhar em ${brDate(p['offDate'])}',
    'OVERTIME_AUTHORIZATION' => 'Até ${hhmm(p['maxMinutes'])} de extra em ${brDate(r['refDate'])}',
    _ => '${p['subject'] ?? ''}',
  };
}

class RequestsPage extends StatefulWidget {
  const RequestsPage({super.key});
  @override
  State<RequestsPage> createState() => _RequestsPageState();
}

class _RequestsPageState extends State<RequestsPage> {
  int _tab = 0, _token = 0;
  bool _autoInbox = false;

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final canAll = api.can('requests.requests:read');
    final paths = ['/requests/mine', '/requests/inbox', if (canAll) '/requests'];
    return PageScaffold(
      title: 'Solicitações',
      subtitle: 'Pedidos de ajuste, justificativa, troca de folga e hora extra, com aprovação em etapas. Ao aprovar a última etapa, o sistema aplica o pedido.',
      icon: Icons.forum_rounded,
      actions: [GlassButton(label: 'Nova solicitação', icon: Icons.add_comment_rounded, onPressed: _create)],
      children: [
        FutureBuilder(
          future: api.getList('/requests/inbox').catchError((_) => <Map<String, dynamic>>[]),
          builder: (_, s) {
            final n = s.data?.length ?? 0;
            return Align(
              alignment: Alignment.centerLeft,
              child: GlassTabs(tabs: ['Minhas', 'Para aprovar${n > 0 ? ' ($n)' : ''}', if (canAll) 'Todas'], index: _tab, onChanged: (i) => setState(() => _tab = i)),
            );
          },
        ),
        const SizedBox(height: 14),
        Async<List<Map<String, dynamic>>>(
          reloadToken: '$_tab|$_token',
          load: () async {
            final l = await api.getList(paths[_tab]);
            if (_tab == 0 && l.isEmpty && !_autoInbox) {
              _autoInbox = true;
              final inbox = await api.getList('/requests/inbox');
              if (inbox.isNotEmpty) {
                WidgetsBinding.instance.addPostFrameCallback((_) => mounted ? setState(() => _tab = 1) : null);
              }
            }
            return l;
          },
          builder: (context, rows, _) => rows.isEmpty
              ? Glass(
                  child: EmptyState(icon: Icons.inbox_rounded, title: _tab == 1 ? 'Nada para aprovar' : 'Nenhuma solicitação', body: _tab == 0 ? 'Use "Nova solicitação" para pedir um ajuste.' : null),
                )
              : Column(
                  children: [
                    for (final r in rows)
                      _RequestCard(
                        r: r,
                        actions: _tab == 1
                            ? [
                                GlassButton(label: 'Aprovar', icon: Icons.check_rounded, small: true, onPressed: () => _decide(r, 'APPROVED')),
                                GlassButton(label: 'Recusar', icon: Icons.close_rounded, small: true, kind: BtnKind.ghost, onPressed: () => _reject(r)),
                              ]
                            : _tab == 0 && r['status'] == 'PENDING'
                            ? [
                                GlassButton(
                                  label: 'Cancelar',
                                  small: true,
                                  kind: BtnKind.ghost,
                                  onPressed: () async {
                                    if (await act(context, () => api.post('/requests/${r['id']}/cancel'), success: 'Solicitação cancelada') && mounted) setState(() => _token++);
                                  },
                                ),
                              ]
                            : const [],
                      ),
                  ],
                ),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 8),
          child: Text('Pedidos aprovados aparecem no espelho de ponto.', style: TextStyle(color: t.subtle, fontSize: 12.5)),
        ),
      ],
    );
  }

  Future<void> _decide(Map<String, dynamic> r, String decision, [String? comment]) async {
    if (await act(
          context,
          () => api.post('/requests/${r['id']}/decide', {'decision': decision, if (comment != null && comment.isNotEmpty) 'comment': comment}),
          success: decision == 'APPROVED' ? 'Aprovada' : 'Recusada',
        ) &&
        mounted) {
      setState(() => _token++);
    }
  }

  Future<void> _reject(Map<String, dynamic> r) async {
    final c = await promptText(context, title: 'Recusar solicitação', label: 'Motivo da recusa', confirmLabel: 'Recusar');
    if (c == null) return;
    if (c.length < 3) {
      if (mounted) toast(context, 'Motivo: mínimo de 3 caracteres', error: true);
      return;
    }
    await _decide(r, 'REJECTED', c);
  }

  Future<void> _create() async {
    final ok = await showGlassDialog<bool>(context, title: 'Nova solicitação', width: 620, builder: (_) => const _NewRequest());
    if (ok == true && mounted) {
      setState(() {
        _tab = 0;
        _token++;
      });
    }
  }
}

class _RequestCard extends StatelessWidget {
  const _RequestCard({required this.r, required this.actions});
  final Map<String, dynamic> r;
  final List<Widget> actions;
  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final status = {
      'PENDING': ('Pendente', t.brand),
      'APPROVED': ('Aprovada', t.success),
      'REJECTED': ('Recusada', t.danger),
      'CANCELLED': ('Cancelada', t.muted),
      'NEEDS_INFO': ('Aguardando informação', t.warning),
    }[r['status']];
    final steps = asList(r['steps']);
    final decisions = asList(r['decisions']);
    return Glass(
      margin: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text.rich(
                      TextSpan(
                        children: [
                          TextSpan(
                            text: '${r['typeLabel']}',
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                          TextSpan(
                            text: ' · ${asMap(r['employee'])['name']} (${asMap(r['employee'])['registration']})',
                            style: TextStyle(color: t.subtle),
                          ),
                        ],
                      ),
                    ),
                    Text(_describe(r)),
                    Text(
                      '“${r['justification']}”',
                      style: TextStyle(color: t.muted, fontStyle: FontStyle.italic),
                    ),
                  ],
                ),
              ),
              Pill(status?.$1 ?? '${r['status']}', color: status?.$2),
            ],
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              for (var i = 0; i < steps.length; i++)
                Builder(
                  builder: (_) {
                    final d = decisions.where((x) => x['step'] == i).firstOrNull;
                    final c = d?['decision'] == 'APPROVED'
                        ? t.success
                        : d?['decision'] == 'REJECTED'
                        ? t.danger
                        : i == r['currentStep'] && r['status'] == 'PENDING'
                        ? t.brand
                        : t.subtle;
                    return Pill('${i + 1}. ${steps[i]['label']}', color: c);
                  },
                ),
              const SizedBox(width: 8),
              ...actions,
            ],
          ),
          for (final d in decisions.where((d) => d['comment'] != null))
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text('Etapa ${(d['step'] as num) + 1}: ${d['comment']}', style: TextStyle(color: t.muted, fontSize: 12.5)),
            ),
        ],
      ),
    );
  }
}

class _NewRequest extends StatefulWidget {
  const _NewRequest();
  @override
  State<_NewRequest> createState() => _NewRequestState();
}

class _NewRequestState extends State<_NewRequest> {
  String _type = 'RECORD_CORRECTION', _ref = todayIso(), _time = '', _just = '', _minutes = '', _maxMinutes = '60';
  String? _offDate;
  bool _fullDay = true, _busy = false;
  final _subject = TextEditingController(), _text = TextEditingController();
  late final _justs = api.getList('/justifications', {'pageSize': 200}).catchError((_) => <Map<String, dynamic>>[]);

  Map<String, Object?>? _payload() => switch (_type) {
    'RECORD_CORRECTION' => validHm(_time) ? {'time': _time} : null,
    'ABSENCE_JUSTIFICATION' => _just.isEmpty || (!_fullDay && _minutes.isEmpty) ? null : {'justificationId': _just, 'fullDay': _fullDay, if (!_fullDay) 'minutes': int.parse(_minutes)},
    'SCHEDULE_CHANGE' => _offDate == null ? null : {'offDate': _offDate},
    'OVERTIME_AUTHORIZATION' => _maxMinutes.isEmpty ? null : {'maxMinutes': int.parse(_maxMinutes)},
    _ => _subject.text.trim().length < 3 ? null : {'subject': _subject.text.trim()},
  };

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final (k, l, h) in _types)
          Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Glass(
              radius: 16,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              tint: _type == k ? t.brand : null,
              onTap: () => setState(() => _type = k),
              child: Row(
                children: [
                  Icon(_type == k ? Icons.radio_button_checked_rounded : Icons.radio_button_off_rounded, color: _type == k ? t.brand : t.subtle, size: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(l, style: const TextStyle(fontWeight: FontWeight.w600)),
                        Text(h, style: TextStyle(color: t.subtle, fontSize: 12)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        const SizedBox(height: 10),
        if (_type != 'OTHER') DateField(label: _type == 'SCHEDULE_CHANGE' ? 'Dia em que quer folgar' : 'Dia', value: _ref, onChanged: (v) => setState(() => _ref = v ?? _ref)),
        const SizedBox(height: 12),
        if (_type == 'RECORD_CORRECTION')
          TextField(
            inputFormatters: [MaskFormatter(maskTime)],
            onChanged: (v) => setState(() => _time = v),
            decoration: const InputDecoration(labelText: 'Horário que faltou', hintText: 'HH:MM'),
          ),
        if (_type == 'ABSENCE_JUSTIFICATION') ...[
          FutureBuilder(
            future: _justs,
            builder: (_, s) => Select<String>(
              label: 'Motivo',
              value: _just,
              items: [('', 'Motivo…'), for (final j in (s.data ?? const <Map<String, dynamic>>[]).where((j) => j['active'] != false)) (j['id'] as String, '${j['name']}')],
              onChanged: (v) => setState(() => _just = v ?? ''),
            ),
          ),
          Row(
            children: [
              Checkbox(value: _fullDay, onChanged: (v) => setState(() => _fullDay = v ?? true)),
              const Text('Dia inteiro'),
              const SizedBox(width: 12),
              if (!_fullDay)
                SizedBox(
                  width: 120,
                  child: TextField(
                    inputFormatters: digitsOnly(4),
                    onChanged: (v) => setState(() => _minutes = v),
                    decoration: const InputDecoration(hintText: 'minutos'),
                  ),
                ),
            ],
          ),
        ],
        if (_type == 'SCHEDULE_CHANGE') DateField(label: 'Folga em que vai trabalhar', value: _offDate, onChanged: (v) => setState(() => _offDate = v)),
        if (_type == 'OVERTIME_AUTHORIZATION')
          TextFormField(
            initialValue: _maxMinutes,
            inputFormatters: digitsOnly(4),
            onChanged: (v) => setState(() => _maxMinutes = v),
            decoration: InputDecoration(labelText: 'Máximo de extra (minutos)', helperText: hhmm(int.tryParse(_maxMinutes) ?? 0)),
          ),
        if (_type == 'OTHER')
          TextField(
            controller: _subject,
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(labelText: 'Assunto'),
          ),
        const SizedBox(height: 12),
        TextField(
          controller: _text,
          maxLines: 3,
          maxLength: 500,
          onChanged: (_) => setState(() {}),
          decoration: const InputDecoration(labelText: 'Explique', alignLabelWithHint: true),
        ),
        const SizedBox(height: 16),
        Align(
          alignment: Alignment.centerRight,
          child: GlassButton(
            label: 'Enviar',
            icon: Icons.send_rounded,
            loading: _busy,
            onPressed: _payload() == null || _text.text.trim().length < 5
                ? null
                : () async {
                    setState(() => _busy = true);
                    final ok = await act(
                      context,
                      () => api.post('/requests', {'type': _type, if (_type != 'OTHER') 'refDate': _ref, 'payload': _payload(), 'justification': _text.text.trim()}),
                      success: 'Solicitação enviada',
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

const _flowTypes = [
  ('RECORD_CORRECTION', 'Inclusão de marcação'),
  ('ABSENCE_JUSTIFICATION', 'Justificativa de falta/atraso'),
  ('SCHEDULE_CHANGE', 'Troca de folga'),
  ('OVERTIME_AUTHORIZATION', 'Autorização de hora extra'),
  ('OTHER', 'Outros pedidos'),
];
const _approvers = [('SUPERVISOR', 'Superior imediato'), ('ROLE', 'Quem tem o perfil…'), ('PERMISSION', 'Quem pode aprovar solicitações')];

class FlowsPage extends StatelessWidget {
  const FlowsPage({super.key});
  @override
  Widget build(BuildContext context) {
    final canManage = api.can('requests.flows:manage');
    return PageScaffold(
      title: 'Fluxos de aprovação',
      subtitle: 'Quem aprova cada tipo de solicitação, em até 5 etapas (ex.: superior imediato e depois o RH). Sem fluxo, aprova quem tem a permissão de aprovar solicitações.',
      icon: Icons.alt_route_rounded,
      children: [
        CompanyScope(
          builder: (context, companyId, picker) => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              picker,
              const SizedBox(height: 14),
              Async<(List<Map<String, dynamic>>, List<Map<String, dynamic>>)>(
                reloadToken: companyId,
                load: () async =>
                    (await api.getList('/approval-flows', {'companyId': companyId}), canManage ? await api.getList('/roles').catchError((_) => <Map<String, dynamic>>[]) : <Map<String, dynamic>>[]),
                builder: (context, d, _) => ResponsiveGrid(
                  minItemWidth: 520,
                  children: [
                    for (final ty in _flowTypes)
                      _FlowEditor(
                        key: ValueKey('$companyId${ty.$1}'),
                        companyId: companyId!,
                        type: ty,
                        flow: d.$1.where((f) => f['requestType'] == ty.$1).firstOrNull,
                        roles: d.$2,
                        canManage: canManage,
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'O superior imediato é definido no cadastro do funcionário; o usuário dele precisa estar ligado ao funcionário em Usuários.',
                style: TextStyle(color: context.sp.subtle, fontSize: 12.5),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _FlowEditor extends StatefulWidget {
  const _FlowEditor({super.key, required this.companyId, required this.type, required this.flow, required this.roles, required this.canManage});
  final String companyId;
  final (String, String) type;
  final Map<String, dynamic>? flow;
  final List<Map<String, dynamic>> roles;
  final bool canManage;
  @override
  State<_FlowEditor> createState() => _FlowEditorState();
}

class _FlowEditorState extends State<_FlowEditor> {
  late List<Map<String, dynamic>> _steps = widget.flow != null
      ? [for (final s in asList(widget.flow!['steps'])) Map<String, dynamic>.from(s)]
      : [
          {'label': 'Aprovação', 'approver': 'PERMISSION'},
        ];
  late bool _active = widget.flow?['isActive'] as bool? ?? true;
  bool _busy = false;
  int _gen = 0;

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final f = widget.flow;
    return Glass(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SectionTitle(
            widget.type.$2,
            trailing: Pill(
              f == null
                  ? 'Padrão: 1 etapa'
                  : f['isActive'] == true
                  ? 'Ativo'
                  : 'Desativado',
              color: f?['isActive'] == true ? t.success : t.muted,
            ),
          ),
          for (var i = 0; i < _steps.length; i++)
            Padding(
              key: ValueKey('$_gen-$i'),
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 12,
                    backgroundColor: t.brand.withValues(alpha: 0.2),
                    child: Text('${i + 1}', style: TextStyle(color: t.brand, fontSize: 12)),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    flex: 3,
                    child: TextFormField(
                      initialValue: '${_steps[i]['label']}',
                      enabled: widget.canManage,
                      onChanged: (v) => _steps[i]['label'] = v,
                      decoration: const InputDecoration(labelText: 'Etapa'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    flex: 3,
                    child: Select<String>(
                      label: 'Quem aprova',
                      value: '${_steps[i]['approver']}',
                      items: _approvers,
                      onChanged: widget.canManage
                          ? (v) => setState(() {
                              _steps[i]['approver'] = v;
                              _steps[i].remove('roleId');
                            })
                          : null,
                    ),
                  ),
                  if (_steps[i]['approver'] == 'ROLE') ...[
                    const SizedBox(width: 8),
                    Expanded(
                      flex: 2,
                      child: Select<String>(
                        label: 'Perfil',
                        value: '${_steps[i]['roleId'] ?? ''}',
                        items: [('', 'Perfil…'), for (final r in widget.roles) (r['id'] as String, '${r['name']}')],
                        onChanged: widget.canManage ? (v) => setState(() => _steps[i]['roleId'] = v) : null,
                      ),
                    ),
                  ],
                  if (widget.canManage && _steps.length > 1)
                    RowAction(
                      Icons.delete_outline_rounded,
                      'Remover etapa',
                      () => setState(() {
                        _steps.removeAt(i);
                        _gen++;
                      }),
                      danger: true,
                    ),
                ],
              ),
            ),
          if (widget.canManage)
            Row(
              children: [
                if (_steps.length < 5)
                  TextButton.icon(
                    onPressed: () => setState(
                      () => _steps = [
                        ..._steps,
                        {'label': 'Etapa ${_steps.length + 1}', 'approver': 'PERMISSION'},
                      ],
                    ),
                    icon: const Icon(Icons.add_rounded, size: 16),
                    label: const Text('Etapa'),
                  ),
                const Spacer(),
                Checkbox(value: _active, onChanged: (v) => setState(() => _active = v ?? true)),
                const Text('Ativo'),
                const SizedBox(width: 10),
                GlassButton(
                  label: 'Salvar',
                  small: true,
                  loading: _busy,
                  onPressed: () async {
                    if (_steps.any((s) => s['approver'] == 'ROLE' && (s['roleId'] ?? '') == '')) return toast(context, 'Escolha o perfil das etapas "Quem tem o perfil…"', error: true);
                    setState(() => _busy = true);
                    await act(
                      context,
                      () => api.put('/approval-flows', {'companyId': widget.companyId, 'requestType': widget.type.$1, 'steps': _steps, 'isActive': _active}),
                      success: 'Fluxo de "${widget.type.$2}" salvo',
                    );
                    if (mounted) setState(() => _busy = false);
                  },
                ),
              ],
            ),
        ],
      ),
    );
  }
}
