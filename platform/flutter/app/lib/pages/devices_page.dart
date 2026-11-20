// Equipamentos (REP): status de comunicação, comandos, funcionários no relógio, AFD e agente local.
import 'dart:async';
import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/csv.dart';
import '../core/format.dart';
import '../core/glass.dart';
import '../core/save_file.dart';
import '../core/tokens.dart';
import '../widgets/company_options.dart';
import '../widgets/company_scope.dart';
import '../widgets/pick.dart';
import '../widgets/ui.dart';

const _ord = {'P1510_2009': 'Portaria 1.510', 'P373_2011': 'Portaria 373 (REP-A)', 'P671_2021': 'Portaria 671'};
const _action = {
  'SET_DATETIME': 'Enviar data e hora',
  'SET_EMPLOYER': 'Enviar empregador',
  'SYNC_EMPLOYEES': 'Enviar funcionários e digitais',
  'UPSERT_EMPLOYEE': 'Enviar funcionário',
  'UPSERT_FINGERPRINT': 'Enviar digital',
  'DELETE_FINGERPRINTS': 'Remover digital',
  'RECEIVE_EMPLOYEES': 'Receber funcionários',
  'RECEIVE_FINGERPRINTS': 'Receber digitais',
  'RECEIVE_EMPLOYER': 'Receber empregador',
  'COLLECT_RECORDS': 'Coletar registros',
};
const _jobLabel = {'QUEUED': 'Na fila', 'RUNNING': 'Executando', 'SUCCEEDED': 'Concluído', 'FAILED': 'Falhou', 'CANCELLED': 'Cancelado'};

String since(Object? v) {
  if (v == null) return 'nunca';
  final m = DateTime.now().difference(DateTime.parse('$v')).inMinutes;
  if (m < 1) return 'agora';
  if (m < 60) return 'há $m min';
  if (m < 1440) return 'há ${(m / 60).round()} h';
  return 'há ${(m / 1440).round()} d';
}

(String, Color) _status(BuildContext c, Object? s) => switch (s) {
  'ONLINE' => ('Comunicando', c.sp.success),
  'OFFLINE' => ('Sem comunicação', c.sp.danger),
  'PENDING' => ('Aguardando agente', c.sp.warning),
  'ERROR' => ('Erro', c.sp.danger),
  'DISABLED' => ('Desativado', c.sp.muted),
  _ => ('$s', c.sp.muted),
};

class DevicesPage extends StatefulWidget {
  const DevicesPage({super.key});
  @override
  State<DevicesPage> createState() => _DevicesPageState();
}

class _DevicesPageState extends State<DevicesPage> {
  String _group = '';
  int _token = 0;
  late final Timer _timer = Timer.periodic(const Duration(seconds: 30), (_) => mounted ? setState(() => _token++) : null);

  @override
  void dispose() {
    _timer.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final canManage = api.can('devices.devices:manage'), canCmd = api.can('devices.commands:execute');
    return PageScaffold(
      title: 'Equipamentos',
      subtitle: 'Relógios de ponto (REP), com status de comunicação, comandos de envio e recebimento, funcionários no relógio e arquivos.',
      icon: Icons.router_rounded,
      children: [
        CompanyScope(
          builder: (context, companyId, picker) => Async<List<Map<String, dynamic>>>(
            reloadToken: '$companyId|$_token',
            load: () => api.getList('/devices', {'companyId': companyId}),
            builder: (context, devices, _) {
              final groups = {for (final d in devices) ?d['groupName'] as String?}.toList()..sort();
              final shown = devices.where((d) => _group.isEmpty || d['groupName'] == _group).toList();
              final online = devices.where((d) => d['status'] == 'ONLINE').length, offline = devices.where((d) => d['status'] == 'OFFLINE').length;
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      picker,
                      if (canManage) GlassButton(label: 'Novo equipamento', icon: Icons.add_rounded, onPressed: () => _edit(companyId!, null)),
                    ],
                  ),
                  const SizedBox(height: 14),
                  ResponsiveGrid(
                    minItemWidth: 200,
                    children: [
                      StatTile(label: 'Equipamentos', value: '${devices.length}', icon: Icons.router_rounded),
                      StatTile(label: 'Comunicando', value: '$online', icon: Icons.wifi_rounded, color: t.success),
                      StatTile(label: 'Sem comunicação', value: '$offline', icon: Icons.wifi_off_rounded, color: offline > 0 ? t.danger : t.muted),
                    ],
                  ),
                  if (groups.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        ChoiceChip(label: const Text('Todos'), selected: _group.isEmpty, onSelected: (_) => setState(() => _group = '')),
                        for (final g in groups) ChoiceChip(label: Text(g), selected: _group == g, onSelected: (_) => setState(() => _group = g)),
                        if (_group.isNotEmpty && canCmd) GlassButton(label: 'Comando para o grupo', icon: Icons.send_rounded, small: true, kind: BtnKind.glass, onPressed: () => _groupCmd(companyId!)),
                      ],
                    ),
                  ],
                  const SizedBox(height: 14),
                  if (shown.isEmpty)
                    const Glass(
                      child: EmptyState(icon: Icons.router_rounded, title: 'Nenhum equipamento', body: 'Cadastre os relógios desta empresa para enviar funcionários e coletar marcações.'),
                    )
                  else
                    ResponsiveGrid(
                      minItemWidth: 360,
                      children: [
                        for (final d in shown)
                          Builder(
                            builder: (context) {
                              final (label, color) = _status(context, d['status']);
                              return Glass(
                                onTap: () => _open(d, canCmd, canManage),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.stretch,
                                  children: [
                                    Row(
                                      children: [
                                        Stack(
                                          clipBehavior: Clip.none,
                                          children: [
                                            const IconBubble(Icons.router_rounded),
                                            Positioned(
                                              right: -2,
                                              top: -2,
                                              child: Container(
                                                width: 12,
                                                height: 12,
                                                decoration: BoxDecoration(
                                                  color: color,
                                                  shape: BoxShape.circle,
                                                  border: Border.all(color: t.bg, width: 2),
                                                  boxShadow: [BoxShadow(color: color.withValues(alpha: 0.6), blurRadius: 6)],
                                                ),
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(width: 12),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Text('${d['name']}', style: const TextStyle(fontWeight: FontWeight.w700)),
                                              Text('$label · ${since(d['lastSeenAt'])}${d['groupName'] != null ? ' · ${d['groupName']}' : ''}', style: TextStyle(color: color, fontSize: 12.5)),
                                              Text(
                                                '${_ord[d['ordinance']] ?? d['ordinance']}${d['manufacturer'] != null ? ' · ${d['manufacturer']}${d['modelName'] != null ? ' ${d['modelName']}' : ''}' : ''}${d['unit'] != null ? ' · ${asMap(d['unit'])['name']}' : ''}',
                                                style: TextStyle(color: t.subtle, fontSize: 12),
                                              ),
                                            ],
                                          ),
                                        ),
                                        if (canManage) ...[
                                          RowAction(Icons.edit_rounded, 'Editar', () => _edit(companyId!, d)),
                                          RowAction(Icons.delete_outline_rounded, 'Excluir', () => _remove(d), danger: true),
                                        ],
                                      ],
                                    ),
                                    const SizedBox(height: 10),
                                    Wrap(
                                      spacing: 6,
                                      runSpacing: 6,
                                      children: [
                                        if ((d['pendingJobs'] as num? ?? 0) > 0) Pill('${d['pendingJobs']} na fila', color: t.brand),
                                        if ((d['failedJobs'] as num? ?? 0) > 0) Pill('${d['failedJobs']} com falha', color: t.danger),
                                        if (d['hasAgentKey'] != true) Pill('sem agente', color: t.warning),
                                        if (d['lastSyncAt'] != null) Pill('sincronizado ${since(d['lastSyncAt'])}', color: t.info),
                                      ],
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
                      ],
                    ),
                ],
              );
            },
          ),
        ),
      ],
    );
  }

  Future<void> _remove(Map<String, dynamic> d) async {
    if (!await confirm(
          context,
          title: 'Excluir equipamento?',
          body: '"${d['name']}" deixa de aparecer, a chave do agente para de funcionar e os comandos na fila são cancelados. As marcações já recebidas continuam.',
          confirmLabel: 'Excluir',
        ) ||
        !mounted) {
      return;
    }
    if (await act(context, () => api.delete('/devices/${d['id']}'), success: 'Equipamento excluído') && mounted) setState(() => _token++);
  }

  Future<void> _edit(String companyId, Map<String, dynamic>? d) async {
    final ok = await showGlassDialog<bool>(
      context,
      title: d == null ? 'Novo equipamento' : 'Editar equipamento',
      width: 720,
      builder: (_) => _DeviceForm(companyId: companyId, row: d),
    );
    if (ok == true && mounted) setState(() => _token++);
  }

  Future<void> _open(Map<String, dynamic> d, bool canCmd, bool canManage) async {
    await showGlassDialog<void>(
      context,
      title: '${d['name']}',
      width: 820,
      builder: (_) => _DeviceDetail(d: d, canCmd: canCmd, canManage: canManage),
    );
    if (mounted) setState(() => _token++);
  }

  Future<void> _groupCmd(String companyId) async {
    var action = 'SET_DATETIME';
    await showGlassDialog<void>(
      context,
      title: 'Comando para o grupo $_group',
      width: 460,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, set) => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Select<String>(
              label: 'Comando',
              value: action,
              items: [
                for (final a in ['SYNC_EMPLOYEES', 'SET_DATETIME', 'SET_EMPLOYER', 'COLLECT_RECORDS', 'RECEIVE_EMPLOYEES', 'RECEIVE_FINGERPRINTS']) (a, _action[a]!),
              ],
              onChanged: (v) => set(() => action = v ?? action),
            ),
            const SizedBox(height: 8),
            Text('Vai para todos os equipamentos ativos do grupo.', style: TextStyle(color: ctx.sp.subtle)),
            const SizedBox(height: 16),
            Align(
              alignment: Alignment.centerRight,
              child: GlassButton(
                label: 'Enviar',
                icon: Icons.send_rounded,
                onPressed: () async {
                  try {
                    final r = asMap(await api.post('/devices/group-command', {'companyId': companyId, 'groupName': _group, 'action': action}));
                    final ok = asList(r['results']).where((x) => x['ok'] == true).length;
                    if (ctx.mounted) {
                      toast(ctx, 'Comando enviado a $ok de ${r['devices']} equipamento(s)');
                      Navigator.pop(ctx);
                    }
                  } catch (e) {
                    if (ctx.mounted) toast(ctx, '$e', error: true);
                  }
                },
              ),
            ),
          ],
        ),
      ),
    );
    if (mounted) setState(() => _token++);
  }
}

class _DeviceForm extends StatefulWidget {
  const _DeviceForm({required this.companyId, this.row});
  final String companyId;
  final Map<String, dynamic>? row;
  @override
  State<_DeviceForm> createState() => _DeviceFormState();
}

class _DeviceFormState extends State<_DeviceForm> {
  Map<String, dynamic>? get r => widget.row;
  late final _c = {
    for (final k in ['name', 'serialNumber', 'repNumber', 'manufacturer', 'modelName', 'host', 'port', 'groupName']) k: TextEditingController(text: r?[k] == null ? '' : '${r![k]}'),
    'collect': TextEditingController(text: '${r?['collectIntervalMinutes'] ?? 10}'),
    'emails': TextEditingController(text: ((r?['alertEmails'] as List?) ?? const []).join(', ')),
  };
  late String _ordV = '${r?['ordinance'] ?? 'P671_2021'}', _unit = '${r?['unitId'] ?? ''}';
  late bool _active = r == null || r!['status'] != 'DISABLED';
  late final Future<CompanyOptions> _opt = CompanyOptions.load(widget.companyId);
  bool _busy = false;

  TextField _f(String k, String label, {String? hint, List<TextInputFormatter>? fmt}) => TextField(
    controller: _c[k],
    inputFormatters: fmt,
    decoration: InputDecoration(labelText: label, helperText: hint, helperMaxLines: 2),
  );

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      _f('name', 'Nome *'),
      const SizedBox(height: 12),
      FutureBuilder<CompanyOptions>(
        future: _opt,
        builder: (_, s) => FormGrid(
          children: [
            Select<String>(label: 'Portaria', value: _ordV, items: [for (final e in _ord.entries) (e.key, e.value)], onChanged: (v) => setState(() => _ordV = v ?? _ordV)),
            Select<String>(label: 'Unidade', value: _unit, items: [('', '—'), ...?s.data?.units], onChanged: (v) => setState(() => _unit = v ?? '')),
            _f('repNumber', 'Número do REP (fabricação)', hint: '17 dígitos; vai no AEJ', fmt: digitsOnly(17)),
            _f('serialNumber', 'Número de série'),
            _f('manufacturer', 'Fabricante', hint: 'Ex.: Control iD, Henry'),
            _f('modelName', 'Modelo'),
            _f('host', 'Endereço na rede (IP ou nome)', hint: 'Usado pelo agente local, dentro da rede do cliente'),
            _f('port', 'Porta', fmt: digitsOnly(5)),
            _f('groupName', 'Grupo de REP', hint: 'Comandos podem ir para o grupo inteiro'),
            _f('collect', 'Coletar a cada (min)', hint: '5 a 1440; o alerta dispara após 3 intervalos sem contato', fmt: digitsOnly(4)),
          ],
        ),
      ),
      const SizedBox(height: 12),
      _f('emails', 'E-mails de alerta', hint: 'Avisados quando o equipamento fica sem comunicação e quando volta'),
      SwitchListTile(contentPadding: EdgeInsets.zero, value: _active, onChanged: (v) => setState(() => _active = v), title: const Text('Ativo')),
      const SizedBox(height: 12),
      Align(
        alignment: Alignment.centerRight,
        child: GlassButton(
          label: r != null ? 'Salvar' : 'Cadastrar equipamento',
          loading: _busy,
          onPressed: () async {
            String v(String k) => _c[k]!.text.trim();
            String? o(String k) => v(k).isEmpty ? null : v(k);
            if (v('name').length < 2) return toast(context, 'Informe o nome', error: true);
            final body = {
              'name': v('name'),
              'ordinance': _ordV,
              'serialNumber': o('serialNumber'),
              'repNumber': o('repNumber'),
              'manufacturer': o('manufacturer'),
              'modelName': o('modelName'),
              'host': o('host'),
              'port': o('port') == null ? null : int.parse(v('port')),
              'groupName': o('groupName'),
              'collectIntervalMinutes': o('collect') == null ? null : int.parse(v('collect')),
              'alertEmails': v('emails').split(RegExp(r'[,;\s]+')).where((e) => e.isNotEmpty).toList(),
              'unitId': _unit.isEmpty ? null : _unit,
              'active': _active,
            };
            setState(() => _busy = true);
            final ok = await act(
              context,
              () => r != null ? api.patch('/devices/${r!['id']}', body) : api.post('/devices', {...body, 'companyId': widget.companyId}),
              success: r != null ? 'Equipamento atualizado' : 'Equipamento cadastrado',
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

class _DeviceDetail extends StatefulWidget {
  const _DeviceDetail({required this.d, required this.canCmd, required this.canManage});
  final Map<String, dynamic> d;
  final bool canCmd, canManage;
  @override
  State<_DeviceDetail> createState() => _DeviceDetailState();
}

class _DeviceDetailState extends State<_DeviceDetail> {
  int _tab = 0, _token = 0;
  String? _key;
  late String _from = '${todayIso().substring(0, 7)}-01', _to = todayIso();
  Timer? _poll;

  Map<String, dynamic> get d => widget.d;

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
  }

  void _setTab(int i) {
    _poll?.cancel();
    if (i == 1) _poll = Timer.periodic(const Duration(seconds: 5), (_) => mounted ? setState(() => _token++) : null);
    setState(() => _tab = i);
  }

  Future<void> _cmd(String a) async {
    try {
      final r = asMap(await api.post('/devices/${d['id']}/commands', {'action': a}));
      if (!mounted) return;
      toast(context, '${_action[a]}: ${r['queued']} comando(s) na fila');
      _setTab(1);
    } catch (e) {
      if (mounted) toast(context, '$e', error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final (label, color) = _status(context, d['status']);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Wrap(
          spacing: 8,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Pill(label, color: color),
            Text('último contato ${since(d['lastSeenAt'])}', style: TextStyle(color: t.muted)),
            Text('· ${_ord[d['ordinance']]}${d['repNumber'] != null ? ' · REP ${d['repNumber']}' : ''}', style: TextStyle(color: t.subtle)),
          ],
        ),
        const SizedBox(height: 12),
        GlassTabs(tabs: const ['Visão geral', 'Comandos', 'Funcionários', 'Arquivos', 'Agente local'], index: _tab, onChanged: _setTab),
        const SizedBox(height: 14),
        switch (_tab) {
          0 => Async<Map<String, dynamic>>(
            load: () => api.getMap('/devices/${d['id']}/stats', {'days': 14}),
            builder: (context, s, _) => _Overview(s: s, emails: (d['alertEmails'] as List?) ?? const []),
          ),
          1 => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (widget.canCmd)
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    for (final a in ['SYNC_EMPLOYEES', 'SET_DATETIME', 'SET_EMPLOYER', 'COLLECT_RECORDS', 'RECEIVE_EMPLOYEES', 'RECEIVE_FINGERPRINTS', 'RECEIVE_EMPLOYER'])
                      GlassButton(label: _action[a]!, icon: Icons.send_rounded, small: true, kind: BtnKind.glass, onPressed: d['status'] == 'DISABLED' ? null : () => _cmd(a)),
                  ],
                ),
              const SizedBox(height: 12),
              SectionTitle(
                'Fila',
                trailing: widget.canCmd && (d['failedJobs'] as num? ?? 0) > 0
                    ? TextButton.icon(
                        onPressed: () async {
                          try {
                            final r = asMap(await api.post('/devices/${d['id']}/jobs/retry'));
                            if (mounted) {
                              toast(this.context, '${r['retried']} comando(s) de volta à fila');
                              setState(() => _token++);
                            }
                          } catch (e) {
                            if (mounted) toast(this.context, '$e', error: true);
                          }
                        },
                        icon: const Icon(Icons.refresh_rounded, size: 16),
                        label: const Text('Tentar de novo as falhas'),
                      )
                    : null,
              ),
              Async<List<Map<String, dynamic>>>(
                reloadToken: _token,
                load: () => api.getList('/devices/${d['id']}/jobs'),
                builder: (context, jobs, _) => jobs.isEmpty
                    ? Text('Nenhum comando ainda.', style: TextStyle(color: t.subtle))
                    : Column(
                        children: [
                          for (final j in jobs)
                            Padding(
                              padding: const EdgeInsets.symmetric(vertical: 4),
                              child: Row(
                                children: [
                                  SizedBox(
                                    width: 100,
                                    child: Pill(
                                      _jobLabel[j['status']] ?? '${j['status']}',
                                      color: switch (j['status']) {
                                        'SUCCEEDED' => t.success,
                                        'FAILED' => t.danger,
                                        'RUNNING' => t.info,
                                        'CANCELLED' => t.muted,
                                        _ => t.brand,
                                      },
                                    ),
                                  ),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(_action[j['action']] ?? '${j['action']}'),
                                        if (j['lastError'] != null) Text('${j['lastError']}', style: TextStyle(color: t.danger, fontSize: 12)),
                                      ],
                                    ),
                                  ),
                                  Text(brDateTime(j['finishedAt'] ?? j['scheduledAt']), style: TextStyle(color: t.subtle, fontSize: 12)),
                                  if (widget.canCmd && (j['status'] == 'QUEUED' || j['status'] == 'FAILED'))
                                    RowAction(Icons.close_rounded, 'Cancelar', () async {
                                      if (await act(context, () => api.delete('/devices/${d['id']}/jobs/${j['id']}'))) setState(() => _token++);
                                    }, danger: true),
                                ],
                              ),
                            ),
                        ],
                      ),
              ),
              const SizedBox(height: 10),
              Text('O agente local busca a fila a cada minuto, executa no relógio e devolve o resultado.', style: TextStyle(color: t.subtle, fontSize: 12.5)),
            ],
          ),
          2 => Async<Map<String, dynamic>>(
            load: () => api.getMap('/devices/${d['id']}/roster'),
            builder: (context, r, _) => _Roster(r: r),
          ),
          3 => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (widget.canCmd) ...[
                const SectionTitle('Importar AFD (pendrive)'),
                Align(
                  alignment: Alignment.centerLeft,
                  child: GlassButton(
                    label: 'Escolher arquivo AFD (.txt)',
                    icon: Icons.upload_file_rounded,
                    kind: BtnKind.glass,
                    onPressed: () async {
                      final f = await pickFile(['txt']);
                      if (f == null || !mounted) return;
                      try {
                        final r = asMap(await api.post('/devices/${d['id']}/afd', {'content': decodeCsvBytes(f.$1)}));
                        if (mounted) toast(this.context, 'AFD: ${r['imported']} marcação(ões) nova(s), ${r['duplicates']} repetida(s), ${asList(r['unmatched']).length} sem funcionário');
                      } catch (e) {
                        if (mounted) toast(this.context, '$e', error: true);
                      }
                    },
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text('Reimportar o mesmo arquivo não duplica marcações.', style: TextStyle(color: t.subtle, fontSize: 12.5)),
                ),
                const SizedBox(height: 18),
              ],
              const SectionTitle('Exportar registros coletados'),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  DateField(label: 'De', value: _from, width: 170, onChanged: (v) => setState(() => _from = v ?? _from)),
                  DateField(label: 'Até', value: _to, width: 170, onChanged: (v) => setState(() => _to = v ?? _to)),
                  GlassButton(
                    label: 'Baixar',
                    icon: Icons.download_rounded,
                    kind: BtnKind.glass,
                    onPressed: () async {
                      try {
                        final r = await api.getMap('/devices/${d['id']}/afd-export', {'from': _from, 'to': _to});
                        if ((r['lines'] as num? ?? 0) == 0) {
                          if (mounted) toast(this.context, 'Nenhum registro coletado no período', error: true);
                          return;
                        }
                        final path = await saveBytes(utf8.encode('${r['content']}'), '${r['filename']}', mime: 'text/plain');
                        if (mounted) toast(this.context, 'Arquivo salvo: $path');
                      } catch (e) {
                        if (mounted) toast(this.context, '$e', error: true);
                      }
                    },
                  ),
                ],
              ),
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text('Linhas originais do AFD recebidas deste equipamento, em ordem de NSR (para conferência e auditoria).', style: TextStyle(color: t.subtle, fontSize: 12.5)),
              ),
            ],
          ),
          _ => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'O agente local roda num computador da rede do cliente, conversa com o relógio e com o SuperPonto pela internet (HTTPS). Ele se identifica com a chave deste equipamento.',
                style: TextStyle(color: t.muted),
              ),
              const SizedBox(height: 12),
              if (_key != null) ...[
                Text('Copie agora: a chave não aparece de novo.', style: TextStyle(color: t.warning)),
                const SizedBox(height: 6),
                Glass(
                  radius: 12,
                  padding: const EdgeInsets.all(12),
                  child: SelectableText(_key!, style: const TextStyle(fontFamily: 'monospace')),
                ),
                const SizedBox(height: 6),
                Align(
                  alignment: Alignment.centerLeft,
                  child: GlassButton(
                    label: 'Copiar',
                    icon: Icons.copy_rounded,
                    small: true,
                    kind: BtnKind.glass,
                    onPressed: () async {
                      await Clipboard.setData(ClipboardData(text: _key!));
                      if (mounted) toast(this.context, 'Copiado');
                    },
                  ),
                ),
              ] else
                Text(d['hasAgentKey'] == true ? 'Já existe uma chave. Gerar outra desliga a anterior.' : 'Nenhuma chave gerada ainda.'),
              const SizedBox(height: 12),
              if (widget.canManage)
                Align(
                  alignment: Alignment.centerLeft,
                  child: GlassButton(
                    label: d['hasAgentKey'] == true ? 'Trocar chave' : 'Gerar chave',
                    icon: Icons.key_rounded,
                    onPressed: () async {
                      try {
                        final r = asMap(await api.post('/devices/${d['id']}/agent-key'));
                        if (mounted) setState(() => _key = '${r['key']}');
                      } catch (e) {
                        if (mounted) toast(this.context, '$e', error: true);
                      }
                    },
                  ),
                ),
              const SizedBox(height: 14),
              Glass(
                radius: 12,
                padding: const EdgeInsets.all(12),
                child: SelectableText(
                  'POST /v1/agent/heartbeat · GET /v1/agent/jobs\nPOST /v1/agent/jobs/:id/result · POST /v1/agent/afd\nCabeçalho: X-Device-Key: <chave>',
                  style: TextStyle(fontFamily: 'monospace', fontSize: 12, color: t.muted),
                ),
              ),
            ],
          ),
        },
      ],
    );
  }
}

class _Overview extends StatelessWidget {
  const _Overview({required this.s, required this.emails});
  final Map<String, dynamic> s;
  final List emails;
  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final days = asList(s['days']);
    final max = days.fold<num>(1, (m, d) => (d['records'] as num? ?? 0) > m ? d['records'] as num : m);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Registros por dia (14 dias) · ponto verde = houve contato', style: TextStyle(color: t.muted, fontSize: 13)),
        const SizedBox(height: 10),
        SizedBox(
          height: 130,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              for (final d in days)
                Expanded(
                  child: Tooltip(
                    message: '${brDate(d['day'])}: ${d['records']} registro(s), ${d['contacts']} contato(s)${(d['alerts'] as num? ?? 0) > 0 ? ', ${d['alerts']} alerta(s)' : ''}',
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        Expanded(
                          child: Align(
                            alignment: Alignment.bottomCenter,
                            child: FractionallySizedBox(
                              heightFactor: ((d['records'] as num? ?? 0) / max).clamp(0.03, 1).toDouble(),
                              child: Container(
                                margin: const EdgeInsets.symmetric(horizontal: 3),
                                decoration: BoxDecoration(color: t.brand, borderRadius: BorderRadius.circular(6)),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 4),
                        Container(
                          width: 6,
                          height: 6,
                          decoration: BoxDecoration(shape: BoxShape.circle, color: (d['contacts'] as num? ?? 0) > 0 ? t.success : t.hover),
                        ),
                        Text('${d['day']}'.substring(8), style: TextStyle(fontSize: 10, color: t.subtle)),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Text(
          'Alerta de sem comunicação após ${s['offlineAfterMinutes']} min sem contato${emails.isNotEmpty ? ', para ${emails.join(', ')}' : ' (nenhum e-mail cadastrado)'}.',
          style: TextStyle(color: t.muted, fontSize: 13),
        ),
        const SizedBox(height: 12),
        if (asList(s['recent']).isEmpty) Text('Sem contato ainda: instale o agente local.', style: TextStyle(color: t.subtle)),
        for (final l in asList(s['recent']))
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 3),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.circle, size: 8, color: l['level'] == 'ERROR' || l['level'] == 'WARN' ? t.danger : t.success),
                const SizedBox(width: 8),
                SizedBox(
                  width: 130,
                  child: Text(brDateTime(l['createdAt']), style: TextStyle(color: t.subtle, fontSize: 12)),
                ),
                Expanded(child: Text('${l['message']}', style: const TextStyle(fontSize: 13))),
              ],
            ),
          ),
      ],
    );
  }
}

class _Roster extends StatelessWidget {
  const _Roster({required this.r});
  final Map<String, dynamic> r;
  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final tot = asMap(r['totals']);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ResponsiveGrid(
          minItemWidth: 150,
          children: [
            StatTile(label: 'No cadastro', value: '${tot['registry'] ?? 0}'),
            StatTile(label: 'No relógio', value: '${tot['inDevice'] ?? 0}', color: t.success),
            StatTile(label: 'Faltando', value: '${tot['missing'] ?? 0}', color: t.danger),
            StatTile(label: 'Sobrando', value: '${tot['extra'] ?? 0}', color: t.warning),
          ],
        ),
        const SizedBox(height: 10),
        Text(
          '${r['receivedAt'] != null ? 'Lido do relógio em ${brDateTime(r['receivedAt'])}.' : 'O relógio ainda não foi lido: use "Receber funcionários".'} Identificação pela Portaria ${r['layout'] == '671' ? '671 (CPF)' : '1.510 (PIS)'}.',
          style: TextStyle(color: t.muted, fontSize: 13),
        ),
        const SizedBox(height: 10),
        for (final x in asList(r['rows']))
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(
              children: [
                Icon(Icons.circle, size: 9, color: x['inDevice'] == true ? t.success : (x['problem'] != null ? t.danger : t.warning)),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('${x['name']} · ${x['registration']}'),
                      if (x['problem'] != null) Text('${x['problem']}', style: TextStyle(color: t.danger, fontSize: 12)),
                    ],
                  ),
                ),
                Text('${x['fingerprints']} digital(is)', style: TextStyle(color: t.subtle, fontSize: 12)),
                if (x['lastSend'] != null) ...[const SizedBox(width: 8), Pill(_jobLabel[asMap(x['lastSend'])['status']] ?? '')],
              ],
            ),
          ),
        for (final x in asList(r['extra']))
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(
              children: [
                Icon(Icons.circle, size: 9, color: t.warning),
                const SizedBox(width: 8),
                Expanded(
                  child: Text('${x['name'] ?? 'Sem nome'} · ${x['workerId']} · no relógio, fora do cadastro', style: TextStyle(color: t.muted)),
                ),
              ],
            ),
          ),
      ],
    );
  }
}
