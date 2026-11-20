// Fechamento do ponto: calcular, fechar (grava apuração e banco de horas), reabrir; gerar AEJ e AFD do REP-P.
import 'dart:convert';

import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/glass.dart';
import '../core/save_file.dart';
import '../core/timesheet.dart';
import '../core/tokens.dart';
import '../widgets/company_scope.dart';
import '../widgets/ui.dart';
import 'companies_page.dart' show RepPSettings;

class ClosingPage extends StatefulWidget {
  const ClosingPage({super.key});
  @override
  State<ClosingPage> createState() => _ClosingPageState();
}

class _ClosingPageState extends State<ClosingPage> {
  late final _prev = monthRange(DateTime(todayBr().year, todayBr().month - 1));
  late String _from = _prev.from, _to = _prev.to;
  Map<String, dynamic>? _calc;
  List<String> _aejWarnings = const [];
  String? _busy;
  int _token = 0;

  Future<void> _go(String key, Future<void> Function() f) async {
    setState(() => _busy = key);
    try {
      await f();
    } catch (e) {
      if (mounted) toast(context, '$e', error: true);
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final canManage = api.can('time.closings:manage');
    final canExport = api.can('reports.reports:export');
    return PageScaffold(
      title: 'Fechamento do ponto',
      subtitle: 'Calcule e confira; ao fechar, a apuração fica gravada, o banco de horas recebe créditos e débitos e o período não aceita mais alterações.',
      icon: Icons.lock_rounded,
      children: [
        CompanyScope(
          builder: (context, companyId, picker) {
            final c = _calc;
            final left = Glass(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  picker,
                  const SizedBox(height: 14),
                  const SectionTitle('Período'),
                  FormGrid(
                    children: [
                      DateField(label: 'De', value: _from, onChanged: (v) => setState(() => _from = v ?? _from)),
                      DateField(label: 'Até', value: _to, onChanged: (v) => setState(() => _to = v ?? _to)),
                    ],
                  ),
                  const SizedBox(height: 14),
                  if (!canManage)
                    Text('Você pode ver os fechamentos, mas não fechar ou reabrir.', style: TextStyle(color: t.muted))
                  else
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        GlassButton(
                          label: 'Calcular',
                          icon: Icons.calculate_rounded,
                          kind: BtnKind.glass,
                          loading: _busy == 'calc',
                          onPressed: () => _go('calc', () async {
                            final r = asMap(await api.post('/timesheet/calculate', {'companyId': companyId, 'from': _from, 'to': _to}));
                            if (!mounted) return;
                            setState(() => _calc = r);
                            toast(this.context, 'Apuração gravada: ${r['days']} dia(s) de ${r['employments']} funcionário(s)');
                          }),
                        ),
                        GlassButton(
                          label: 'Fechar período',
                          icon: Icons.lock_rounded,
                          loading: _busy == 'close',
                          onPressed: () async {
                            if (!await confirm(
                              context,
                              title: 'Fechar ${brDate(_from)} a ${brDate(_to)}?',
                              body: 'A apuração fica gravada, o banco de horas recebe os lançamentos e o período deixa de aceitar ajustes.',
                              confirmLabel: 'Fechar',
                              danger: false,
                            )) {
                              return;
                            }
                            await _go('close', () async {
                              final r = asMap(await api.post('/closings', {'companyId': companyId, 'periodStart': _from, 'periodEnd': _to}));
                              if (!mounted) return;
                              setState(() => _token++);
                              toast(this.context, 'Período fechado: ${r['employments']} funcionário(s), ${r['bankEntries']} lançamento(s) no banco');
                            });
                          },
                        ),
                        if (canExport)
                          GlassButton(
                            label: 'Gerar AEJ',
                            icon: Icons.file_download_rounded,
                            kind: BtnKind.glass,
                            loading: _busy == 'aej',
                            onPressed: () => _go('aej', () async {
                              final r = await api.getMap('/timesheet/aej', {'companyId': companyId, 'from': _from, 'to': _to});
                              final path = await saveBytes(utf8.encode('${r['content']}'), '${r['filename']}', mime: 'text/plain');
                              if (!mounted) return;
                              setState(() => _aejWarnings = [for (final w in (r['warnings'] as List? ?? const [])) '$w']);
                              final tot = asMap(r['totals']);
                              toast(this.context, 'AEJ gerado (${tot['marcacoes']} marcações, ${tot['vinculos']} vínculos): $path');
                            }),
                          ),
                        if (canExport)
                          GlassButton(
                            label: 'AFD do REP-P',
                            icon: Icons.file_download_rounded,
                            kind: BtnKind.glass,
                            loading: _busy == 'afd',
                            onPressed: () => _go('afd', () async {
                              final r = await api.getMap('/timesheet/afd-rep-p', {'companyId': companyId, 'from': _from, 'to': _to});
                              final path = await saveBytes(base64Decode('${r['base64']}'), '${r['filename']}', mime: '${r['mime'] ?? 'text/plain'}');
                              if (!mounted) return;
                              toast(this.context, 'AFD do REP-P: ${r['records']} registro(s) — $path');
                            }),
                          ),
                      ],
                    ),
                  if (_aejWarnings.isNotEmpty)
                    Glass(
                      margin: const EdgeInsets.only(top: 12),
                      tint: t.warning,
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          for (final w in _aejWarnings) Text('• $w', style: TextStyle(color: t.warning, fontSize: 13)),
                          const SizedBox(height: 6),
                          const Text('Confira o arquivo no validador do MTE e assine (CAdES, certificado ICP-Brasil da empresa) antes de entregar.', style: TextStyle(fontSize: 12.5)),
                        ],
                      ),
                    ),
                  if (c != null)
                    Glass(
                      margin: const EdgeInsets.only(top: 12),
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('${c['days']} dia(s) calculados de ${c['employments']} funcionário(s).', style: const TextStyle(fontWeight: FontWeight.w600)),
                          if ((c['pendingAdjustments'] as num? ?? 0) > 0) Text('${c['pendingAdjustments']} ajuste(s) pendente(s): resolva antes de fechar.', style: TextStyle(color: t.warning)),
                          if ((c['incompleteDays'] as num? ?? 0) > 0) Text('${c['incompleteDays']} dia(s) com marcação ímpar.', style: TextStyle(color: t.danger)),
                          if ((c['unauthorizedOvertimeMinutes'] as num? ?? 0) > 0) Text('${hhmm(c['unauthorizedOvertimeMinutes'])} de extra sem autorização.', style: TextStyle(color: t.warning)),
                        ],
                      ),
                    ),
                  const SizedBox(height: 18),
                  RepPSettings(key: ValueKey(companyId), companyId: companyId!, canEdit: api.can('admin.settings:manage')),
                ],
              ),
            );
            final right = Glass(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SectionTitle('Histórico'),
                  Async<List<Map<String, dynamic>>>(
                    reloadToken: '$companyId|$_token',
                    load: () => api.getList('/closings', {'companyId': companyId}),
                    builder: (context, rows, _) => rows.isEmpty
                        ? const EmptyState(icon: Icons.lock_rounded, title: 'Nenhum fechamento', body: 'Os períodos fechados aparecem aqui.')
                        : Column(
                            children: [
                              for (final c in rows)
                                ListTile(
                                  contentPadding: EdgeInsets.zero,
                                  leading: IconBubble(c['status'] == 'CLOSED' ? Icons.lock_rounded : Icons.lock_open_rounded, size: 36, color: c['status'] == 'CLOSED' ? t.success : t.warning),
                                  title: Text('${brDate(c['periodStart'])} a ${brDate(c['periodEnd'])}'),
                                  subtitle: Text(c['status'] == 'CLOSED' ? 'Fechado${c['closedAt'] != null ? ' em ${brDateTime(c['closedAt'])}' : ''}' : 'Reaberto: ${c['reopenReason'] ?? ''}'),
                                  trailing: canManage && c['status'] == 'CLOSED'
                                      ? TextButton.icon(onPressed: () => _reopen(c), icon: const Icon(Icons.lock_open_rounded, size: 16), label: const Text('Reabrir'))
                                      : null,
                                ),
                            ],
                          ),
                  ),
                ],
              ),
            );
            return isWide(context)
                ? Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(flex: 3, child: left),
                      const SizedBox(width: 14),
                      Expanded(flex: 2, child: right),
                    ],
                  )
                : Column(children: [left, const SizedBox(height: 14), right]);
          },
        ),
      ],
    );
  }

  Future<void> _reopen(Map<String, dynamic> c) async {
    final reason = await promptText(context, title: 'Reabrir período', label: 'Motivo (mínimo 5 caracteres)', confirmLabel: 'Reabrir');
    if (reason == null || !mounted) return;
    if (reason.length < 5) return toast(context, 'Motivo: mínimo de 5 caracteres', error: true);
    if (await act(context, () => api.post('/closings/${c['id']}/reopen', {'reason': reason}), success: 'Período reaberto; os lançamentos do banco desse fechamento foram desfeitos') && mounted) {
      setState(() => _token++);
    }
  }
}
