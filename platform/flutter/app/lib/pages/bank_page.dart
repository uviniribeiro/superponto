// Banco de horas: saldos, extrato com vencimentos, lançamentos manuais, zerar em lote, regras e compensação.
import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/glass.dart';
import '../core/timesheet.dart';
import '../core/tokens.dart';
import '../widgets/company_scope.dart';
import '../widgets/ui.dart';

const _txType = {'CREDIT': 'Crédito', 'DEBIT': 'Débito', 'EXPIRATION': 'Vencimento', 'ADJUSTMENT': 'Ajuste', 'PAYOUT': 'Pagamento', 'COMPENSATION': 'Compensação'};

int? parseHm(String v) {
  final m = RegExp(r'^(-)?(\d{1,4})(?::(\d{2}))?$').firstMatch(v.trim());
  if (m == null) return null;
  final t = int.parse(m[2]!) * 60 + int.parse(m[3] ?? '0');
  return m[1] != null ? -t : t;
}

class BankPage extends StatefulWidget {
  const BankPage({super.key});
  @override
  State<BankPage> createState() => _BankPageState();
}

class _BankPageState extends State<BankPage> {
  String _q = '';
  final _selected = <String>[];
  int _token = 0;

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final canManage = api.can('time.bank:manage'), canPolicy = api.can('time.compensation:manage');
    return PageScaffold(
      title: 'Banco de horas',
      subtitle: 'Saldos, extrato com vencimentos, lançamentos manuais e zerar em lote. Créditos e débitos entram no fechamento do ponto.',
      icon: Icons.savings_rounded,
      children: [
        CompanyScope(
          builder: (context, companyId, picker) => Async<(Map<String, dynamic>, List<Map<String, dynamic>>)>(
            reloadToken: '$companyId|$_token',
            load: () async => (await api.getMap('/bank/policy', {'companyId': companyId}), await api.getList('/bank/balances', {'companyId': companyId})),
            builder: (context, data, _) {
              final (policy, all) = data;
              final rows = all.where((b) => _q.isEmpty || '${b['name']}'.toLowerCase().contains(_q.toLowerCase()) || '${b['registration']}'.contains(_q)).toList();
              final pos = rows.fold<num>(0, (s, r) => (r['balanceMinutes'] as num) > 0 ? s + (r['balanceMinutes'] as num) : s);
              final neg = rows.fold<num>(0, (s, r) => (r['balanceMinutes'] as num) < 0 ? s + (r['balanceMinutes'] as num) : s);
              final names = all.where((b) => _selected.contains(b['employmentId'])).map((b) => '${b['name']}').join(', ');
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      picker,
                      if (canPolicy)
                        GlassButton(
                          label: 'Regras',
                          icon: Icons.tune_rounded,
                          kind: BtnKind.glass,
                          onPressed: () => _sheet('Regras do banco de horas', _PolicyForm(companyId: companyId!, policy: policy)),
                        ),
                      if (canManage)
                        GlassButton(
                          label: 'Zerar em lote',
                          icon: Icons.cleaning_services_rounded,
                          kind: BtnKind.glass,
                          onPressed: () => _sheet('Zerar em lote', _ResetForm(companyId: companyId!, ids: [..._selected])),
                        ),
                      if (canManage)
                        GlassButton(
                          label: 'Lançar',
                          icon: Icons.add_rounded,
                          onPressed: _selected.isEmpty ? null : () => _sheet('Lançamento no banco', _TxForm(ids: [..._selected], names: names)),
                        ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  ResponsiveGrid(
                    minItemWidth: 220,
                    children: [
                      StatTile(
                        label: 'Situação',
                        value: policy['enabled'] == true ? 'Ativo' : 'Desativado',
                        hint: policy['enabled'] == true ? (policy['expirationDays'] != null ? 'vence em ${policy['expirationDays']} dias' : 'sem vencimento') : null,
                        icon: Icons.savings_rounded,
                      ),
                      StatTile(label: 'Saldos positivos', value: hhmm(pos, signed: true), color: t.success, icon: Icons.trending_up_rounded),
                      StatTile(label: 'Saldos negativos', value: hhmm(neg, signed: true), color: t.danger, icon: Icons.trending_down_rounded),
                    ],
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      SearchField(hint: 'Buscar funcionário…', onChanged: (v) => setState(() => _q = v)),
                      const SizedBox(width: 12),
                      if (_selected.isNotEmpty) Pill('${_selected.length} selecionado(s)', color: t.brand),
                    ],
                  ),
                  const SizedBox(height: 10),
                  GlassTable<Map<String, dynamic>>(
                    rows: rows,
                    empty: const EmptyState(icon: Icons.savings_rounded, title: 'Nenhum funcionário', body: 'Cadastre funcionários nesta empresa.'),
                    onTap: (b) => showGlassDialog<void>(
                      context,
                      title: 'Extrato · ${b['name']}',
                      width: 640,
                      builder: (_) => StatementView(employmentId: b['employmentId'] as String),
                    ),
                    columns: [
                      if (canManage)
                        Col(
                          '',
                          (b) => Checkbox(
                            value: _selected.contains(b['employmentId']),
                            onChanged: (_) => setState(() => _selected.contains(b['employmentId']) ? _selected.remove(b['employmentId']) : _selected.add(b['employmentId'] as String)),
                          ),
                          flex: 1,
                        ),
                      Col('Funcionário', (b) => txt('${b['name']} · ${b['registration']}${b['status'] == 'TERMINATED' ? ' · desligado' : ''}', bold: true), flex: 6, primary: true),
                      Col(
                        'Saldo',
                        (b) {
                          final v = (b['balanceMinutes'] as num).toInt();
                          return Text(
                            hhmm(v, signed: true),
                            style: TextStyle(fontWeight: FontWeight.w700, color: v > 0 ? t.success : (v < 0 ? t.danger : t.muted)),
                          );
                        },
                        numeric: true,
                        flex: 2,
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

  Future<void> _sheet(String title, Widget child) async {
    final ok = await showGlassDialog<bool>(context, title: title, width: 600, builder: (_) => child);
    if (ok == true && mounted) {
      setState(() {
        _selected.clear();
        _token++;
      });
    }
  }
}

class _PolicyForm extends StatefulWidget {
  const _PolicyForm({required this.companyId, required this.policy});
  final String companyId;
  final Map<String, dynamic> policy;
  @override
  State<_PolicyForm> createState() => _PolicyFormState();
}

class _PolicyFormState extends State<_PolicyForm> {
  late Map<String, dynamic> p = widget.policy;
  late bool _enabled = p['enabled'] == true, _comp = p['compensationEnabled'] == true;
  late String _period = '${p['compensationPeriod'] ?? 'WEEK'}', _left = '${p['compensationLeftover'] ?? 'BANK'}';
  late final _exp = TextEditingController(text: p['expirationDays'] == null ? '' : '${p['expirationDays']}');
  late final _maxDaily = TextEditingController(text: p['maxDailyCreditMinutes'] == null ? '' : '${p['maxDailyCreditMinutes']}');
  late final _m50 = TextEditingController(text: '${asMap(p['creditMultipliers'])['50'] ?? ''}');
  late final _m100 = TextEditingController(text: '${asMap(p['creditMultipliers'])['100'] ?? ''}');
  bool _busy = false;

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          value: _enabled,
          onChanged: (v) => setState(() => _enabled = v),
          title: const Text('Banco de horas ativo'),
          subtitle: Text('No fechamento, o saldo de cada dia vira crédito ou débito', style: TextStyle(color: t.subtle, fontSize: 12)),
        ),
        TextField(
          controller: _exp,
          inputFormatters: digitsOnly(4),
          decoration: const InputDecoration(
            labelText: 'Créditos vencem em (dias)',
            helperText: 'Acordo individual: até 180 dias; convenção coletiva: até 1 ano (CLT art. 59). Vazio = não vence',
            helperMaxLines: 2,
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _maxDaily,
          inputFormatters: digitsOnly(4),
          decoration: const InputDecoration(labelText: 'Crédito máximo por dia (min)', helperText: 'Vazio = sem limite'),
        ),
        const SizedBox(height: 12),
        FormGrid(
          children: [
            TextField(
              controller: _m50,
              decoration: const InputDecoration(labelText: 'Multiplicador da extra 50%', hintText: '1', helperText: 'Ex.: 1,5 = 1h extra vale 1h30'),
            ),
            TextField(
              controller: _m100,
              decoration: const InputDecoration(labelText: 'Multiplicador da extra 100%', hintText: '1'),
            ),
          ],
        ),
        const SizedBox(height: 16),
        const SectionTitle('Banco de compensação'),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          value: _comp,
          onChanged: (v) => setState(() => _comp = v),
          title: const Text('Compensar dentro do período'),
          subtitle: Text('Horas a mais e a menos se compensam antes de ir para o banco (acordo de compensação)', style: TextStyle(color: t.subtle, fontSize: 12)),
        ),
        if (_comp)
          FormGrid(
            children: [
              Select<String>(label: 'Período', value: _period, items: const [('WEEK', 'Semanal'), ('MONTH', 'Mensal')], onChanged: (v) => setState(() => _period = v ?? 'WEEK')),
              Select<String>(label: 'Sobra positiva', value: _left, items: const [('BANK', 'Vai para o banco'), ('PAY', 'Paga como extra')], onChanged: (v) => setState(() => _left = v ?? 'BANK')),
            ],
          ),
        const SizedBox(height: 20),
        Align(
          alignment: Alignment.centerRight,
          child: GlassButton(
            label: 'Salvar regras',
            loading: _busy,
            onPressed: () async {
              num? n(String s) => s.trim().isEmpty ? null : num.tryParse(s.trim().replaceAll(',', '.'));
              setState(() => _busy = true);
              final ok = await act(
                context,
                () => api.put('/bank/policy', {
                  'companyId': widget.companyId,
                  'enabled': _enabled,
                  'expirationDays': n(_exp.text)?.toInt(),
                  'maxDailyCreditMinutes': n(_maxDaily.text)?.toInt(),
                  'creditMultipliers': {if (n(_m50.text) != null) '50': n(_m50.text), if (n(_m100.text) != null) '100': n(_m100.text)},
                  'compensationEnabled': _comp,
                  'compensationPeriod': _period,
                  'compensationLeftover': _left,
                }),
                success: 'Regras do banco salvas',
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

class _TxForm extends StatefulWidget {
  const _TxForm({required this.ids, required this.names});
  final List<String> ids;
  final String names;
  @override
  State<_TxForm> createState() => _TxFormState();
}

class _TxFormState extends State<_TxForm> {
  int _type = 0;
  String _amount = '', _ref = todayIso();
  final _desc = TextEditingController();
  bool _busy = false;
  static const _types = [('ADJUSTMENT', 'Ajuste (+/−)'), ('PAYOUT', 'Pagamento em folha'), ('COMPENSATION', 'Folga compensada')];

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final m = parseHm(_amount);
    final adj = _types[_type].$1 == 'ADJUSTMENT';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(widget.names, style: TextStyle(color: t.muted)),
        const SizedBox(height: 12),
        GlassTabs(tabs: [for (final x in _types) x.$2], index: _type, onChanged: (i) => setState(() => _type = i)),
        const SizedBox(height: 14),
        FormGrid(
          children: [
            TextField(
              onChanged: (v) => setState(() => _amount = v),
              decoration: InputDecoration(
                labelText: 'Horas',
                hintText: adj ? '-2:30 ou 4:00' : '8:00',
                helperText: m == null ? 'Formato h:mm' : (adj ? hhmm(m, signed: true) : '−${hhmm(m.abs())} do saldo'),
              ),
            ),
            DateField(label: 'Data de referência', value: _ref, onChanged: (v) => setState(() => _ref = v ?? _ref)),
          ],
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _desc,
          decoration: const InputDecoration(labelText: 'Descrição *', hintText: 'Ex.: pago na folha de março'),
        ),
        const SizedBox(height: 18),
        Align(
          alignment: Alignment.centerRight,
          child: GlassButton(
            label: 'Lançar',
            loading: _busy,
            onPressed: m == null || m == 0
                ? null
                : () async {
                    if (_desc.text.trim().length < 3) return toast(context, 'Descrição: mínimo de 3 caracteres', error: true);
                    setState(() => _busy = true);
                    final ok = await act(
                      context,
                      () => api.post('/bank/transactions', {'employmentIds': widget.ids, 'type': _types[_type].$1, 'minutes': m, 'refDate': _ref, 'description': _desc.text.trim()}),
                      success: 'Lançamento registrado',
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

class _ResetForm extends StatefulWidget {
  const _ResetForm({required this.companyId, required this.ids});
  final String companyId;
  final List<String> ids;
  @override
  State<_ResetForm> createState() => _ResetFormState();
}

class _ResetFormState extends State<_ResetForm> {
  int _type = 0;
  String _only = 'POSITIVE', _ref = todayIso();
  final _desc = TextEditingController();
  bool _busy = false;

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          '${widget.ids.isNotEmpty ? '${widget.ids.length} funcionário(s) selecionado(s).' : 'Todos os funcionários da empresa.'} Cada saldo recebe um lançamento contrário e fica zerado; o histórico fica no extrato.',
          style: TextStyle(color: t.muted),
        ),
        const SizedBox(height: 12),
        GlassTabs(
          tabs: const ['Pagar saldo positivo', 'Zerar (ajuste)'],
          index: _type,
          onChanged: (i) => setState(() {
            _type = i;
            if (i == 0) _only = 'POSITIVE';
          }),
        ),
        if (_type == 1) ...[
          const SizedBox(height: 12),
          Select<String>(
            label: 'Quais saldos',
            value: _only,
            items: const [('ALL', 'Positivos e negativos'), ('POSITIVE', 'Só positivos'), ('NEGATIVE', 'Só negativos')],
            onChanged: (v) => setState(() => _only = v ?? 'ALL'),
          ),
        ],
        const SizedBox(height: 12),
        DateField(label: 'Data de referência', value: _ref, onChanged: (v) => setState(() => _ref = v ?? _ref)),
        const SizedBox(height: 12),
        TextField(
          controller: _desc,
          decoration: const InputDecoration(labelText: 'Descrição *', hintText: 'Ex.: pagamento do banco no fechamento semestral'),
        ),
        const SizedBox(height: 18),
        Align(
          alignment: Alignment.centerRight,
          child: GlassButton(
            label: 'Zerar saldos',
            kind: BtnKind.danger,
            loading: _busy,
            onPressed: () async {
              if (_desc.text.trim().length < 3) return toast(context, 'Descrição: mínimo de 3 caracteres', error: true);
              setState(() => _busy = true);
              try {
                final r = asMap(
                  await api.post('/bank/reset', {
                    'companyId': widget.companyId,
                    if (widget.ids.isNotEmpty) 'employmentIds': widget.ids,
                    'type': _type == 0 ? 'PAYOUT' : 'ADJUSTMENT',
                    'only': _only,
                    'refDate': _ref,
                    'description': _desc.text.trim(),
                  }),
                );
                if (!mounted) return;
                toast(this.context, '${r['zeroed']} saldo(s) zerado(s), total ${hhmm(r['totalMinutes'], signed: true)}');
                Navigator.pop(this.context, true);
              } catch (e) {
                if (mounted) toast(this.context, '$e', error: true);
              } finally {
                if (mounted) setState(() => _busy = false);
              }
            },
          ),
        ),
      ],
    );
  }
}

/// Extrato (banco de horas) e prévia da compensação de um vínculo.
class StatementView extends StatefulWidget {
  const StatementView({super.key, required this.employmentId});
  final String employmentId;
  @override
  State<StatementView> createState() => _StatementViewState();
}

class _StatementViewState extends State<StatementView> {
  int _tab = 0;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      GlassTabs(tabs: const ['Banco de horas', 'Compensação'], index: _tab, onChanged: (i) => setState(() => _tab = i)),
      const SizedBox(height: 14),
      if (_tab == 0) BankStatement(employmentId: widget.employmentId) else _Compensation(employmentId: widget.employmentId),
    ],
  );
}

class BankStatement extends StatelessWidget {
  const BankStatement({super.key, required this.employmentId, this.mine = false});
  final String employmentId;
  final bool mine;
  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    return Async<Map<String, dynamic>>(
      load: () => api.getMap(mine ? '/bank/me' : '/bank/statement/$employmentId'),
      builder: (context, d, _) {
        final next = d['nextExpiration'] == null ? null : asMap(d['nextExpiration']);
        final txs = asList(d['transactions']);
        final bal = (d['balanceMinutes'] as num? ?? 0).toInt();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Glass(
              tint: bal >= 0 ? t.success : t.danger,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Saldo atual', style: TextStyle(color: t.muted)),
                  Text(
                    hhmm(bal, signed: true),
                    style: TextStyle(fontSize: 32, fontWeight: FontWeight.w800, color: bal >= 0 ? t.success : t.danger),
                  ),
                  if (next != null) Text('${hhmm(next['minutes'])} vencem em ${brDate(next['expiresOn'])}', style: TextStyle(color: t.warning)),
                ],
              ),
            ),
            const SizedBox(height: 12),
            if (txs.isEmpty)
              Text('Sem lançamentos.', style: TextStyle(color: t.subtle))
            else
              for (final x in txs)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(
                    children: [
                      SizedBox(
                        width: 50,
                        child: Text(brDate(x['refDate']).substring(0, 5), style: TextStyle(color: t.subtle)),
                      ),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(_txType[x['type']] ?? '${x['type']}', style: const TextStyle(fontWeight: FontWeight.w600)),
                            Text('${x['description'] ?? ''}${x['expiresOn'] != null ? ' · vence ${brDate(x['expiresOn'])}' : ''}', style: TextStyle(color: t.muted, fontSize: 12.5)),
                          ],
                        ),
                      ),
                      Text(
                        hhmm(x['minutes'], signed: true),
                        style: TextStyle(fontWeight: FontWeight.w700, color: (x['minutes'] as num) >= 0 ? t.success : t.danger),
                      ),
                      const SizedBox(width: 12),
                      SizedBox(
                        width: 64,
                        child: Text(
                          hhmm(x['balanceAfter'], signed: true),
                          textAlign: TextAlign.right,
                          style: TextStyle(color: t.subtle),
                        ),
                      ),
                    ],
                  ),
                ),
          ],
        );
      },
    );
  }
}

class _Compensation extends StatefulWidget {
  const _Compensation({required this.employmentId});
  final String employmentId;
  @override
  State<_Compensation> createState() => _CompensationState();
}

class _CompensationState extends State<_Compensation> {
  String _from = addDays(todayIso(), -56), _to = todayIso();
  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        FormGrid(
          children: [
            DateField(label: 'De', value: _from, onChanged: (v) => setState(() => _from = v ?? _from)),
            DateField(label: 'Até', value: _to, onChanged: (v) => setState(() => _to = v ?? _to)),
          ],
        ),
        const SizedBox(height: 12),
        Async<Map<String, dynamic>>(
          reloadToken: '$_from|$_to',
          load: () => api.getMap('/bank/compensation/${widget.employmentId}', {'from': _from, 'to': _to}),
          builder: (context, c, _) {
            final ps = asList(c['periods']);
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (c['enabled'] != true)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Text('Banco de compensação desativado nas regras (a prévia abaixo usa ${c['period'] == 'MONTH' ? 'mês' : 'semana'}).', style: TextStyle(color: t.warning)),
                  ),
                if (ps.isEmpty) Text('Sem dias apurados no período.', style: TextStyle(color: t.subtle)),
                for (final p in ps)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 5),
                    child: Row(
                      children: [
                        Expanded(child: Text(c['period'] == 'MONTH' ? '${p['key']}'.split('-').reversed.join('/') : 'Semana de ${brDate(p['key'])}')),
                        SizedBox(
                          width: 70,
                          child: Text(
                            hhmm(p['positive'], signed: true),
                            textAlign: TextAlign.right,
                            style: TextStyle(color: t.success),
                          ),
                        ),
                        SizedBox(
                          width: 70,
                          child: Text(
                            hhmm(p['negative'], signed: true),
                            textAlign: TextAlign.right,
                            style: TextStyle(color: t.danger),
                          ),
                        ),
                        SizedBox(
                          width: 110,
                          child: Text(
                            '${hhmm(p['net'], signed: true)}${(p['toPay'] as num? ?? 0) > 0 ? ' · pagar' : ''}',
                            textAlign: TextAlign.right,
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            );
          },
        ),
      ],
    );
  }
}

class MyBankPage extends StatelessWidget {
  const MyBankPage({super.key});
  @override
  Widget build(BuildContext context) => const PageScaffold(
    title: 'Meu banco de horas',
    subtitle: 'Seu saldo, os créditos com data de vencimento e cada lançamento (fechamentos, pagamentos e compensações).',
    icon: Icons.savings_rounded,
    maxWidth: 800,
    children: [BankStatement(employmentId: 'me', mine: true)],
  );
}
