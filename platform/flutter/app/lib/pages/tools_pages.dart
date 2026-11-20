// Ferramentas: avisos, e-mails agendados, textos personalizados e central de ajuda (calculadora de horas e perguntas).
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/glass.dart';
import '../core/schedules.dart' show validHm, weekdayNames;
import '../core/tokens.dart';
import '../widgets/company_scope.dart';
import '../widgets/masked.dart';
import '../widgets/structure_options.dart';
import '../widgets/ui.dart';

String _isoBr(String date, String time) => DateTime.parse('${date}T$time:00-03:00').toUtc().toIso8601String();

// ───────────── Avisos ─────────────
class AnnouncementsPage extends StatefulWidget {
  const AnnouncementsPage({super.key});
  @override
  State<AnnouncementsPage> createState() => _AnnouncementsPageState();
}

class _AnnouncementsPageState extends State<AnnouncementsPage> {
  int _token = 0;
  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    return PageScaffold(
      title: 'Avisos',
      subtitle: 'Recados para os funcionários: aparecem na visão geral de quem está no público escolhido, com registro de quem leu.',
      icon: Icons.campaign_rounded,
      actions: [GlassButton(label: 'Novo aviso', icon: Icons.add_rounded, onPressed: () => _edit(null))],
      children: [
        Async<(List<Map<String, dynamic>>, List<Map<String, dynamic>>, StructureOptions)>(
          reloadToken: _token,
          load: () async => (await api.getList('/announcements'), await loadCompanies(), await StructureOptions.cached(null)),
          builder: (context, d, _) {
            final (list, companies, opt) = d;
            if (list.isEmpty) {
              return const Glass(
                child: EmptyState(icon: Icons.campaign_rounded, title: 'Nenhum aviso', body: 'Publique um recado: feriado, mudança de escala, campanha interna…'),
              );
            }
            final now = DateTime.now();
            return Column(
              children: [
                for (final a in list)
                  Builder(
                    builder: (_) {
                      final st = DateTime.parse('${a['startsAt']}').isAfter(now)
                          ? 'Agendado'
                          : a['endsAt'] != null && !DateTime.parse('${a['endsAt']}').isAfter(now)
                          ? 'Encerrado'
                          : 'No ar';
                      return Glass(
                        margin: const EdgeInsets.only(bottom: 10),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Wrap(
                                    spacing: 8,
                                    crossAxisAlignment: WrapCrossAlignment.center,
                                    children: [
                                      Text('${a['title']}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                                      if (a['level'] == 'IMPORTANT') Pill('Importante', color: t.warning),
                                      Pill(st, color: st == 'No ar' ? t.success : t.muted),
                                    ],
                                  ),
                                  const SizedBox(height: 4),
                                  Text('${a['body']}', style: TextStyle(color: t.muted)),
                                  const SizedBox(height: 4),
                                  Text(
                                    '${brDateTime(a['startsAt'])}${a['endsAt'] != null ? ' até ${brDateTime(a['endsAt'])}' : ''} · ${a['companyId'] != null ? (companies.where((c) => c['id'] == a['companyId']).map(companyName).firstOrNull ?? 'Empresa') : 'Todas as empresas'}${a['groupingId'] != null ? ' · ${opt.groupings.where((g) => g['id'] == a['groupingId']).firstOrNull?['name'] ?? 'Agrupamento'}' : ''}',
                                    style: TextStyle(color: t.subtle, fontSize: 12),
                                  ),
                                ],
                              ),
                            ),
                            TextButton.icon(onPressed: () => _reads(a), icon: const Icon(Icons.people_rounded, size: 16), label: Text('${a['reads'] ?? 0} leram')),
                            RowAction(Icons.edit_rounded, 'Editar', () => _edit(a)),
                            RowAction(Icons.delete_outline_rounded, 'Excluir', () async {
                              if (!await confirm(context, title: 'Excluir aviso?', body: '"${a['title']}" deixa de aparecer para os funcionários.', confirmLabel: 'Excluir') || !context.mounted) {
                                return;
                              }
                              if (await act(context, () => api.delete('/announcements/${a['id']}'), success: 'Aviso removido') && mounted) setState(() => _token++);
                            }, danger: true),
                          ],
                        ),
                      );
                    },
                  ),
              ],
            );
          },
        ),
      ],
    );
  }

  Future<void> _reads(Map<String, dynamic> a) => showGlassDialog<void>(
    context,
    title: 'Quem leu: ${a['title']}',
    width: 520,
    builder: (_) => Async<List<Map<String, dynamic>>>(
      load: () => api.getList('/announcements/${a['id']}/reads'),
      builder: (context, rows, _) => rows.isEmpty
          ? Text('Ninguém confirmou a leitura ainda.', style: TextStyle(color: context.sp.subtle))
          : Column(
              children: [
                for (final r in rows)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text('${asMap(r['user'])['displayName'] ?? '—'}'),
                    subtitle: Text('${asMap(r['user'])['email'] ?? ''}'),
                    trailing: Text(brDateTime(r['readAt'])),
                  ),
              ],
            ),
    ),
  );

  Future<void> _edit(Map<String, dynamic>? a) async {
    final ok = await showGlassDialog<bool>(
      context,
      title: a == null ? 'Novo aviso' : 'Editar aviso',
      width: 600,
      builder: (_) => _AnnForm(a: a),
    );
    if (ok == true && mounted) setState(() => _token++);
  }
}

class _AnnForm extends StatefulWidget {
  const _AnnForm({this.a});
  final Map<String, dynamic>? a;
  @override
  State<_AnnForm> createState() => _AnnFormState();
}

class _AnnFormState extends State<_AnnForm> {
  Map<String, dynamic>? get a => widget.a;
  late final _title = TextEditingController(text: a?['title'] as String?), _body = TextEditingController(text: a?['body'] as String?);
  late final DateTime _s = toBr(a == null ? DateTime.now() : DateTime.parse('${a!['startsAt']}'));
  late String _sDate = isoDate(_s), _sTime = '${two(_s.hour)}:${two(_s.minute)}';
  late String? _eDate = a?['endsAt'] == null ? null : isoDate(toBr(DateTime.parse('${a!['endsAt']}')));
  late String _eTime = a?['endsAt'] == null ? '23:59' : '${two(toBr(DateTime.parse('${a!['endsAt']}')).hour)}:${two(toBr(DateTime.parse('${a!['endsAt']}')).minute)}';
  late String _company = '${a?['companyId'] ?? ''}', _group = '${a?['groupingId'] ?? ''}';
  late bool _important = a?['level'] == 'IMPORTANT', _ack = a?['requireAck'] == true;
  bool _busy = false;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      TextField(
        controller: _title,
        maxLength: 120,
        decoration: const InputDecoration(labelText: 'Título *', counterText: ''),
      ),
      const SizedBox(height: 12),
      TextField(
        controller: _body,
        maxLines: 6,
        maxLength: 5000,
        decoration: const InputDecoration(labelText: 'Mensagem *', alignLabelWithHint: true),
      ),
      const SizedBox(height: 8),
      FormGrid(
        children: [
          DateField(label: 'Início', value: _sDate, onChanged: (v) => setState(() => _sDate = v ?? _sDate)),
          TextFormField(
            initialValue: _sTime,
            inputFormatters: [MaskFormatter(maskTime)],
            decoration: const InputDecoration(labelText: 'Hora de início'),
            onChanged: (v) => _sTime = v,
          ),
          DateField(label: 'Fim (opcional)', value: _eDate, clearable: true, onChanged: (v) => setState(() => _eDate = v)),
          TextFormField(
            initialValue: _eTime,
            inputFormatters: [MaskFormatter(maskTime)],
            decoration: const InputDecoration(labelText: 'Hora do fim'),
            onChanged: (v) => _eTime = v,
          ),
        ],
      ),
      const SizedBox(height: 12),
      FutureBuilder(
        future: Future.wait([loadCompanies(), StructureOptions.cached(null).then((o) => o.groupings)]),
        builder: (_, s) => FormGrid(
          children: [
            Select<String>(
              label: 'Empresa',
              value: _company,
              items: [('', 'Todas'), for (final c in s.data?[0] ?? const <Map<String, dynamic>>[]) (c['id'] as String, companyName(c))],
              onChanged: (v) => setState(() => _company = v ?? ''),
            ),
            Select<String>(label: 'Agrupamento', value: _group, items: [('', 'Todos'), ...opts(s.data?[1] ?? const [])], onChanged: (v) => setState(() => _group = v ?? '')),
          ],
        ),
      ),
      CheckboxListTile(contentPadding: EdgeInsets.zero, value: _important, onChanged: (v) => setState(() => _important = v ?? false), title: const Text('Importante (aparece em destaque)')),
      CheckboxListTile(contentPadding: EdgeInsets.zero, value: _ack, onChanged: (v) => setState(() => _ack = v ?? false), title: const Text('Pedir confirmação de leitura')),
      const SizedBox(height: 12),
      Align(
        alignment: Alignment.centerRight,
        child: GlassButton(
          label: 'Salvar',
          loading: _busy,
          onPressed: () async {
            if (_title.text.trim().isEmpty || _body.text.trim().isEmpty) return toast(context, 'Preencha título e mensagem', error: true);
            if (!validHm(_sTime) || (_eDate != null && !validHm(_eTime))) return toast(context, 'Horas no formato HH:MM', error: true);
            final body = {
              'title': _title.text.trim(),
              'body': _body.text.trim(),
              'level': _important ? 'IMPORTANT' : 'INFO',
              'companyId': _company.isEmpty ? null : _company,
              'groupingId': _group.isEmpty ? null : _group,
              'startsAt': _isoBr(_sDate, _sTime),
              'endsAt': _eDate == null ? null : _isoBr(_eDate!, _eTime),
              'requireAck': _ack,
            };
            setState(() => _busy = true);
            final ok = await act(context, () => a == null ? api.post('/announcements', body) : api.put('/announcements/${a!['id']}', body), success: 'Aviso salvo');
            if (!mounted) return;
            setState(() => _busy = false);
            if (ok) Navigator.pop(this.context, true);
          },
        ),
      ),
    ],
  );
}

// ───────────── E-mails agendados ─────────────
const _kinds = [
  ('ABSENCES', 'Faltas de ontem'),
  ('LATE', 'Atrasados agora (sem entrada)'),
  ('PENDING_ADJUSTMENTS', 'Ajustes aguardando aprovação'),
  ('PENDING_REQUESTS', 'Solicitações pendentes'),
  ('DEVICES_OFFLINE', 'Relógios sem comunicação'),
];

class EmailsPage extends StatefulWidget {
  const EmailsPage({super.key});
  @override
  State<EmailsPage> createState() => _EmailsPageState();
}

class _EmailsPageState extends State<EmailsPage> {
  int _token = 0;
  String? _sending;
  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    return PageScaffold(
      title: 'E-mails agendados',
      subtitle: 'Resumo diário por e-mail para o RH e gestores: faltas, atrasos, pendências e relógios sem comunicação.',
      icon: Icons.mark_email_read_rounded,
      children: [
        CompanyScope(
          builder: (context, companyId, picker) => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Wrap(
                spacing: 10,
                runSpacing: 10,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  picker,
                  GlassButton(label: 'Novo agendamento', icon: Icons.add_rounded, onPressed: () => _edit(companyId!, null)),
                ],
              ),
              const SizedBox(height: 14),
              Async<List<Map<String, dynamic>>>(
                reloadToken: '$companyId|$_token',
                load: () => api.getList('/notification-schedules', {'companyId': companyId}),
                builder: (context, list, _) => list.isEmpty
                    ? const Glass(
                        child: EmptyState(icon: Icons.mark_email_read_rounded, title: 'Nenhum e-mail agendado', body: 'Crie um resumo para receber todo dia no horário escolhido.'),
                      )
                    : Column(
                        children: [
                          for (final s in list)
                            Glass(
                              margin: const EdgeInsets.only(bottom: 10),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Wrap(
                                          spacing: 8,
                                          children: [
                                            Text('${s['name']}', style: const TextStyle(fontWeight: FontWeight.w700)),
                                            Pill(s['active'] == true ? 'Ativo' : 'Pausado', color: s['active'] == true ? t.success : t.muted),
                                          ],
                                        ),
                                        Text(
                                          '${s['time']} · ${(s['weekdays'] as List).isEmpty ? 'todos os dias' : (s['weekdays'] as List).map((d) => weekdayNames[(d as num).toInt()]).join(', ')} · ${(s['kinds'] as List).map((k) => _kinds.where((x) => x.$1 == k).firstOrNull?.$2 ?? k).join(', ')}',
                                          style: TextStyle(color: t.muted, fontSize: 13),
                                        ),
                                        Text(
                                          'Para: ${(s['recipients'] as List).join(', ')}${s['lastRunAt'] != null ? ' · último envio ${brDateTime(s['lastRunAt'])}' : ''}',
                                          style: TextStyle(color: t.subtle, fontSize: 12),
                                        ),
                                      ],
                                    ),
                                  ),
                                  TextButton.icon(onPressed: () => _preview(s), icon: const Icon(Icons.visibility_rounded, size: 16), label: const Text('Prévia')),
                                  TextButton.icon(
                                    onPressed: _sending == s['id']
                                        ? null
                                        : () async {
                                            setState(() => _sending = s['id'] as String);
                                            try {
                                              final r = asMap(await api.post('/notification-schedules/${s['id']}/send'));
                                              if (!mounted) return;
                                              toast(this.context, 'Enviado para ${r['sent']} de ${r['recipients']} destinatário(s)');
                                              setState(() => _token++);
                                            } catch (e) {
                                              if (mounted) toast(this.context, '$e', error: true);
                                            } finally {
                                              if (mounted) setState(() => _sending = null);
                                            }
                                          },
                                    icon: const Icon(Icons.send_rounded, size: 16),
                                    label: const Text('Enviar agora'),
                                  ),
                                  RowAction(Icons.edit_rounded, 'Editar', () => _edit(companyId!, s)),
                                  RowAction(Icons.delete_outline_rounded, 'Excluir', () async {
                                    if (!await confirm(context, title: 'Excluir agendamento?', body: '"${s['name']}" deixa de ser enviado.', confirmLabel: 'Excluir') || !context.mounted) return;
                                    if (await act(context, () => api.delete('/notification-schedules/${s['id']}'), success: 'Agendamento excluído') && mounted) setState(() => _token++);
                                  }, danger: true),
                                ],
                              ),
                            ),
                        ],
                      ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> _preview(Map<String, dynamic> s) => showGlassDialog<void>(
    context,
    title: 'Prévia: ${s['name']}',
    width: 700,
    builder: (_) => Async<Map<String, dynamic>>(
      load: () => api.getMap('/notification-schedules/${s['id']}/preview'),
      builder: (context, d, _) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('${d['company']} · ${brDate(d['date'])}', style: TextStyle(color: context.sp.muted)),
          const SizedBox(height: 10),
          for (final sec in asList(d['sections'])) ...[
            SectionTitle('${sec['title']}'),
            if ((sec['lines'] as List).isEmpty) Text('Nada a informar.', style: TextStyle(color: context.sp.subtle)),
            for (final l in sec['lines'] as List) Text('• $l'),
            const SizedBox(height: 12),
          ],
        ],
      ),
    ),
  );

  Future<void> _edit(String companyId, Map<String, dynamic>? s) async {
    final name = TextEditingController(text: '${s?['name'] ?? 'Resumo diário'}');
    final recipients = TextEditingController(text: s == null ? '' : (s['recipients'] as List).join(', '));
    var kinds = s == null ? ['ABSENCES', 'LATE'] : [for (final k in s['kinds'] as List) '$k'];
    var time = '${s?['time'] ?? '09:00'}';
    var days = s == null ? [1, 2, 3, 4, 5] : [for (final d in s['weekdays'] as List) (d as num).toInt()];
    var active = s?['active'] as bool? ?? true;
    final ok = await showGlassDialog<bool>(
      context,
      title: s == null ? 'Novo agendamento' : 'Editar agendamento',
      width: 560,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, set) => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: name,
              decoration: const InputDecoration(labelText: 'Nome *'),
            ),
            const SizedBox(height: 12),
            const FieldLabel('O que enviar'),
            for (final (k, l) in _kinds)
              CheckboxListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                value: kinds.contains(k),
                title: Text(l),
                onChanged: (v) => set(() => v == true ? kinds = [...kinds, k] : kinds = kinds.where((x) => x != k).toList()),
              ),
            TextFormField(
              initialValue: time,
              inputFormatters: [MaskFormatter(maskTime)],
              decoration: const InputDecoration(labelText: 'Horário (Brasília)'),
              onChanged: (v) => time = v,
            ),
            const SizedBox(height: 12),
            const FieldLabel('Dias'),
            Wrap(
              spacing: 6,
              children: [
                for (var i = 0; i < 7; i++)
                  FilterChip(label: Text(weekdayNames[i]), selected: days.contains(i), onSelected: (v) => set(() => v ? days = ([...days, i]..sort()) : days = days.where((x) => x != i).toList())),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              controller: recipients,
              maxLines: 3,
              decoration: const InputDecoration(labelText: 'Destinatários *', hintText: 'rh@empresa.com.br, gestor@empresa.com.br'),
            ),
            CheckboxListTile(contentPadding: EdgeInsets.zero, value: active, title: const Text('Ativo'), onChanged: (v) => set(() => active = v ?? true)),
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerRight,
              child: GlassButton(
                label: 'Salvar',
                onPressed: kinds.isEmpty
                    ? null
                    : () async {
                        final list = recipients.text.split(RegExp(r'[\s,;]+')).where((x) => x.isNotEmpty).toList();
                        if (name.text.trim().isEmpty || list.isEmpty || !validHm(time)) return toast(ctx, 'Preencha nome, horário (HH:MM) e destinatários', error: true);
                        final body = {'name': name.text.trim(), 'kinds': kinds, 'time': time, 'weekdays': days, 'recipients': list, 'active': active};
                        final ok = await act(
                          ctx,
                          () => s == null ? api.post('/notification-schedules', {...body, 'companyId': companyId}) : api.patch('/notification-schedules/${s['id']}', body),
                          success: 'Agendamento salvo',
                        );
                        if (ok && ctx.mounted) Navigator.pop(ctx, true);
                      },
              ),
            ),
          ],
        ),
      ),
    );
    if (ok == true && mounted) setState(() => _token++);
  }
}

// ───────────── Textos personalizados ─────────────
const _help = {
  'DASHBOARD_MESSAGE': 'Aparece no topo da visão geral para todos os usuários.',
  'PUNCH_RECEIPT_FOOTER': 'Impresso no comprovante de cada marcação pelo navegador ou app.',
  'MIRROR_FOOTER': 'Rodapé do espelho de ponto ao imprimir.',
  'MIRROR_ACK_TERM': 'Texto que o funcionário lê antes de dar ciência do espelho.',
};

class CustomTextsPage extends StatelessWidget {
  const CustomTextsPage({super.key});
  @override
  Widget build(BuildContext context) => PageScaffold(
    title: 'Textos personalizados',
    subtitle: 'Mensagens da sua organização no painel, no comprovante de marcação e no espelho. Deixe em branco para não mostrar.',
    icon: Icons.text_fields_rounded,
    children: [
      Async<List<Map<String, dynamic>>>(
        load: () => api.getList('/custom-texts'),
        builder: (context, list, _) => ResponsiveGrid(minItemWidth: 460, children: [for (final x in list) _TextCard(x: x)]),
      ),
    ],
  );
}

class _TextCard extends StatefulWidget {
  const _TextCard({required this.x});
  final Map<String, dynamic> x;
  @override
  State<_TextCard> createState() => _TextCardState();
}

class _TextCardState extends State<_TextCard> {
  late final _c = TextEditingController(text: '${widget.x['text'] ?? ''}');
  late String _saved = '${widget.x['text'] ?? ''}';
  bool _busy = false;
  @override
  Widget build(BuildContext context) => Glass(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('${widget.x['label']}', style: const TextStyle(fontWeight: FontWeight.w700)),
        Text(_help[widget.x['key']] ?? '', style: TextStyle(color: context.sp.subtle, fontSize: 12.5)),
        const SizedBox(height: 10),
        TextField(controller: _c, maxLines: 4, maxLength: 2000, onChanged: (_) => setState(() {})),
        Align(
          alignment: Alignment.centerRight,
          child: GlassButton(
            label: 'Salvar',
            icon: Icons.save_rounded,
            kind: BtnKind.glass,
            small: true,
            loading: _busy,
            onPressed: _c.text == _saved
                ? null
                : () async {
                    setState(() => _busy = true);
                    if (await act(context, () => api.put('/custom-texts/${widget.x['key']}', {'text': _c.text}), success: 'Texto salvo')) _saved = _c.text;
                    if (mounted) setState(() => _busy = false);
                  },
          ),
        ),
      ],
    ),
  );
}

// ───────────── Central de ajuda ─────────────
int? _parseHm(String v) {
  final m = RegExp(r'^(-)?(\d{1,4}):([0-5]\d)$').firstMatch(v.trim());
  if (m == null) return null;
  return (m[1] != null ? -1 : 1) * (int.parse(m[2]!) * 60 + int.parse(m[3]!));
}

String _fmt(int m) => '${m < 0 ? '−' : ''}${m.abs() ~/ 60}:${two(m.abs() % 60)}';
String _dec(int m) => (m / 60).toStringAsFixed(2).replaceAll('.', ',');

const _faq = [
  (
    'Esqueci de marcar o ponto. E agora?',
    'Abra Solicitações e peça a inclusão da marcação com a justificativa. Depois de aprovada, ela aparece no espelho como incluída (I); a marcação original nunca é alterada.',
  ),
  (
    'Por que o dia aparece como falta se eu trabalhei?',
    'Confira se todas as marcações foram registradas (dia com número ímpar aparece como incompleto) e se há jornada atribuída para o dia. Se faltou marcação, peça o ajuste.',
  ),
  (
    'Como dou ciência do meu espelho?',
    'Em Meu espelho, escolha o período já encerrado e toque em "Dar ciência". Você pode concordar ou registrar uma ressalva. Depois de gravada, a ciência não pode ser alterada.',
  ),
  ('O que é o painel ao vivo?', 'Mostra, para quem tem acesso ao espelho, quem está trabalhando, em intervalo, atrasado sem marcação ou ainda vai entrar, atualizando a cada 30 segundos.'),
  ('Como libero meu celular para marcar?', 'Em Meus aparelhos, dê um nome ao aparelho e confirme com o código enviado ao seu e-mail. Você pode revogar quando trocar de celular.'),
];

class HelpPage extends StatefulWidget {
  const HelpPage({super.key});
  @override
  State<HelpPage> createState() => _HelpPageState();
}

class _HelpPageState extends State<HelpPage> {
  final _items = <(int, TextEditingController)>[(1, TextEditingController(text: '08:00')), (1, TextEditingController(text: '01:30'))];
  final _punches = TextEditingController(text: '08:00 12:00 13:00 17:48');

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final total = _items.fold<int>(0, (s, i) => s + i.$1 * (_parseHm(i.$2.text) ?? 0));
    final ts = _punches.text.split(RegExp(r'[\s,;]+')).where((x) => x.isNotEmpty).map(_parseHm).toList();
    int? worked;
    var odd = false;
    if (!ts.any((x) => x == null || x < 0 || x >= 1440)) {
      worked = 0;
      for (var i = 0; i + 1 < ts.length; i += 2) {
        var b = ts[i + 1]!;
        if (b < ts[i]!) b += 1440;
        worked = worked! + b - ts[i]!;
      }
      odd = ts.length.isOdd;
    }
    final calc = Glass(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SectionTitle('Somar e subtrair horas'),
          for (var i = 0; i < _items.length; i++)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Row(
                children: [
                  IconButton.filledTonal(
                    onPressed: () => setState(() => _items[i] = (-_items[i].$1, _items[i].$2)),
                    icon: Text(_items[i].$1 == 1 ? '+' : '−', style: const TextStyle(fontSize: 18)),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: _items[i].$2,
                      onChanged: (_) => setState(() {}),
                      decoration: InputDecoration(hintText: 'hh:mm', errorText: _parseHm(_items[i].$2.text) == null ? 'Use hh:mm' : null),
                    ),
                  ),
                  RowAction(Icons.delete_outline_rounded, 'Remover', () => setState(() => _items.removeAt(i)), danger: true),
                ],
              ),
            ),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: () => setState(() => _items.add((1, TextEditingController(text: '00:00')))),
              icon: const Icon(Icons.add_rounded),
              label: const Text('Linha'),
            ),
          ),
          Text.rich(
            TextSpan(
              children: [
                const TextSpan(text: 'Total: '),
                TextSpan(
                  text: _fmt(total),
                  style: TextStyle(fontWeight: FontWeight.w800, color: t.brand, fontSize: 18),
                ),
                TextSpan(
                  text: '  (${_dec(total)} em decimal · $total min)',
                  style: TextStyle(color: t.subtle),
                ),
              ],
            ),
          ),
        ],
      ),
    );
    final punches = Glass(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SectionTitle('Horas trabalhadas a partir das marcações'),
          TextField(
            controller: _punches,
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(labelText: 'Marcações do dia (entrada saída entrada saída…)'),
          ),
          const SizedBox(height: 10),
          if (worked == null)
            Text('Use horários no formato hh:mm separados por espaço.', style: TextStyle(color: t.danger))
          else
            Text.rich(
              TextSpan(
                children: [
                  const TextSpan(text: 'Trabalhado: '),
                  TextSpan(
                    text: _fmt(worked),
                    style: TextStyle(fontWeight: FontWeight.w800, color: t.brand, fontSize: 18),
                  ),
                  TextSpan(
                    text: '  (${_dec(worked)})',
                    style: TextStyle(color: t.subtle),
                  ),
                  if (odd)
                    TextSpan(
                      text: '\nNúmero ímpar de marcações: a última não foi contada.',
                      style: TextStyle(color: t.warning),
                    ),
                ],
              ),
            ),
          const SizedBox(height: 8),
          Text(
            'Saída menor que a entrada conta como virada da meia-noite. A apuração oficial (tolerâncias, intervalos, noturno) é feita pelo espelho de ponto.',
            style: TextStyle(color: t.subtle, fontSize: 12.5),
          ),
        ],
      ),
    );
    return PageScaffold(
      title: 'Central de ajuda',
      subtitle: 'Calculadora de horas, perguntas frequentes e atalhos para o manual.',
      icon: Icons.support_rounded,
      children: [
        const SectionTitle('Calculadora de horas'),
        isWide(context)
            ? Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: calc),
                  const SizedBox(width: 14),
                  Expanded(child: punches),
                ],
              )
            : Column(children: [calc, const SizedBox(height: 14), punches]),
        const SizedBox(height: 20),
        const SectionTitle('Perguntas frequentes'),
        Glass(
          padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 8),
          child: Column(
            children: [
              for (final (q, a) in _faq)
                ExpansionTile(
                  shape: const Border(),
                  title: Text(q, style: const TextStyle(fontWeight: FontWeight.w600)),
                  childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
                  children: [Text(a, style: TextStyle(color: t.muted, height: 1.45))],
                ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        Wrap(
          spacing: 8,
          children: [
            GlassButton(label: 'Manual completo', icon: Icons.menu_book_rounded, kind: BtnKind.glass, onPressed: () => context.go('/manual')),
            GlassButton(label: 'Conformidade MTE', icon: Icons.balance_rounded, kind: BtnKind.glass, onPressed: () => context.go('/conformidade')),
          ],
        ),
      ],
    );
  }
}
