// Regras de apuração: tolerâncias, percentuais e faixas de extra, adicional noturno, intervalo e arredondamento.
import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/glass.dart';
import '../core/schedules.dart';
import '../core/tokens.dart';
import '../widgets/company_scope.dart';
import '../widgets/masked.dart';
import '../widgets/ui.dart';

const defaultRules = <String, dynamic>{
  'markToleranceMinutes': 5,
  'dailyToleranceMinutes': 10,
  'roundingMinutes': 0,
  'roundingMode': 'nearest',
  'overtimePercent': {'normal': 50, 'night': 50, 'rest': 100, 'holiday': 100, 'break': 50},
  'nightStart': '22:00',
  'nightEnd': '05:00',
  'reducedNightHour': true,
  'minBreakMinutes': 60,
  'autoDeductBreak': false,
  'dailyOvertimeLimitMinutes': 120,
  'discountAbsences': true,
};

class RulesPage extends StatefulWidget {
  const RulesPage({super.key});
  @override
  State<RulesPage> createState() => _RulesPageState();
}

class _RulesPageState extends State<RulesPage> {
  int _token = 0;
  @override
  Widget build(BuildContext context) {
    final canManage = api.can('schedules.timetables:manage');
    final t = context.sp;
    return PageScaffold(
      title: 'Regras de apuração',
      subtitle: 'Tolerâncias, percentuais e faixas de hora extra, adicional noturno e intervalo usados no cálculo do ponto.',
      icon: Icons.speed_rounded,
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
                  if (canManage) GlassButton(label: 'Nova regra', icon: Icons.add_rounded, onPressed: () => _edit(companyId!, null)),
                ],
              ),
              const SizedBox(height: 14),
              Async<List<Map<String, dynamic>>>(
                reloadToken: '$companyId|$_token',
                load: () => api.getList('/rule-sets', {'companyId': companyId}),
                builder: (context, rows, _) => rows.isEmpty
                    ? const Glass(
                        child: EmptyState(
                          icon: Icons.balance_rounded,
                          title: 'Nenhuma regra',
                          body: 'Sem regra cadastrada, o cálculo usa a CLT: tolerância 5/10 min, extra 50%, descanso e feriado 100%, noturno 22h–5h com hora reduzida.',
                        ),
                      )
                    : Column(
                        children: [
                          for (final r in rows)
                            Glass(
                              margin: const EdgeInsets.only(bottom: 10),
                              onTap: canManage ? () => _edit(companyId!, r) : null,
                              child: Row(
                                children: [
                                  IconBubble(r['isDefault'] == true ? Icons.star_rounded : Icons.balance_rounded, color: r['isDefault'] == true ? t.brand : t.info),
                                  const SizedBox(width: 14),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            Flexible(
                                              child: Text('${r['name']}', style: const TextStyle(fontWeight: FontWeight.w700)),
                                            ),
                                            if (r['isDefault'] == true) ...[const SizedBox(width: 8), Pill('padrão', color: t.brand)],
                                          ],
                                        ),
                                        Text(_summary(asMap(r['rules'])), style: TextStyle(color: t.muted, fontSize: 12.5)),
                                      ],
                                    ),
                                  ),
                                  Pill('${r['inUse'] ?? 0} em uso', color: t.info),
                                  if (canManage) RowAction(Icons.delete_outline_rounded, 'Excluir', () => _remove(r), danger: true),
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

  String _summary(Map<String, dynamic> r) {
    final p = asMap(r['overtimePercent']);
    final bands = asList(r['overtimeBands']);
    return 'Tolerância ${r['markToleranceMinutes']}/${r['dailyToleranceMinutes']} min · extra ${bands.isNotEmpty ? bands.map((b) => '${b['percent']}%').join('→') : '${p['normal']}%'} · feriado ${p['holiday']}% · noturno ${r['nightStart']}–${r['nightEnd']}${r['reducedNightHour'] == true ? ' reduzida' : ''}';
  }

  Future<void> _edit(String companyId, Map<String, dynamic>? row) async {
    final ok = await showGlassDialog<bool>(
      context,
      title: row == null ? 'Nova regra de apuração' : 'Editar regra',
      width: 760,
      builder: (_) => _RuleForm(companyId: companyId, row: row),
    );
    if (ok == true && mounted) setState(() => _token++);
  }

  Future<void> _remove(Map<String, dynamic> r) async {
    if (!await confirm(context, title: 'Excluir regra?', body: '"${r['name']}" deixa de aparecer. Regras em uso ou a regra padrão não podem ser excluídas.', confirmLabel: 'Excluir') || !mounted) {
      return;
    }
    if (await act(context, () => api.delete('/rule-sets/${r['id']}'), success: 'Regra excluída') && mounted) setState(() => _token++);
  }
}

class _RuleForm extends StatefulWidget {
  const _RuleForm({required this.companyId, this.row});
  final String companyId;
  final Map<String, dynamic>? row;
  @override
  State<_RuleForm> createState() => _RuleFormState();
}

class _RuleFormState extends State<_RuleForm> {
  late final _name = TextEditingController(text: widget.row?['name'] as String?);
  late bool _default = widget.row?['isDefault'] == true;
  late final Map<String, dynamic> _r = {
    ...defaultRules,
    ...asMap(widget.row?['rules']),
    'overtimePercent': {...asMap(defaultRules['overtimePercent']), ...asMap(asMap(widget.row?['rules'])['overtimePercent'])},
  };
  late bool _bands = asList(_r['overtimeBands']).isNotEmpty;
  late List<Map<String, dynamic>> _bandList = asList(_r['overtimeBands']).isNotEmpty
      ? [for (final b in asList(_r['overtimeBands'])) Map<String, dynamic>.from(b)]
      : [
          {'upToMinutes': 120, 'percent': 50},
          {'upToMinutes': null, 'percent': 100},
        ];
  bool _busy = false;

  Widget _n(String label, String key, {String? hint, int? max, String? sub}) {
    final target = sub == null ? _r : asMap(_r['overtimePercent']);
    final k = sub ?? key;
    return TextFormField(
      initialValue: '${target[k] ?? 0}',
      keyboardType: TextInputType.number,
      inputFormatters: digitsOnly(4),
      decoration: InputDecoration(labelText: label, helperText: hint, helperMaxLines: 2),
      onChanged: (v) {
        var n = int.tryParse(v) ?? 0;
        if (max != null && n > max) n = max;
        if (sub == null) {
          _r[key] = n;
        } else {
          _r['overtimePercent'] = {...asMap(_r['overtimePercent']), sub: n};
        }
      },
    );
  }

  Widget _hm(String label, String key, String hint) => TextFormField(
    initialValue: '${_r[key]}',
    keyboardType: TextInputType.number,
    inputFormatters: [MaskFormatter(maskTime)],
    decoration: InputDecoration(labelText: label, helperText: hint),
    onChanged: (v) {
      if (validHm(v)) _r[key] = v;
    },
  );

  Widget _t(String label, String key, {String? hint}) => SwitchListTile(
    contentPadding: EdgeInsets.zero,
    value: _r[key] == true,
    onChanged: (v) => setState(() => _r[key] = v),
    title: Text(label),
    subtitle: hint == null ? null : Text(hint, style: TextStyle(color: context.sp.subtle, fontSize: 12)),
  );

  Future<void> _save() async {
    final name = _name.text.trim();
    if (name.length < 3) return toast(context, 'Nome: mínimo de 3 caracteres', error: true);
    final rules = {..._r}..remove('overtimeBands');
    if (_bands) rules['overtimeBands'] = _bandList;
    setState(() => _busy = true);
    final ok = await act(
      context,
      () => widget.row != null
          ? api.patch('/rule-sets/${widget.row!['id']}', {'name': name, if (_default) 'isDefault': true, 'rules': rules})
          : api.post('/rule-sets', {'companyId': widget.companyId, 'name': name, 'isDefault': _default, 'rules': rules}),
      success: 'Regra salva',
    );
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) Navigator.pop(context, true);
  }

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: _name,
          decoration: const InputDecoration(labelText: 'Nome *', hintText: 'Ex.: CLT padrão, Convenção da saúde'),
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          value: _default,
          onChanged: (v) => setState(() => _default = v),
          title: const Text('Regra padrão da empresa'),
          subtitle: Text('Usada pelos horários sem regra própria', style: TextStyle(color: t.subtle, fontSize: 12)),
        ),
        const SizedBox(height: 10),
        const SectionTitle('Tolerância (CLT art. 58 §1º)'),
        FormGrid(children: [_n('Por marcação (até 5 min)', 'markToleranceMinutes', max: 5), _n('No dia (até 10 min)', 'dailyToleranceMinutes', max: 10)]),
        const SizedBox(height: 18),
        const SectionTitle('Percentuais de hora extra'),
        FormGrid(
          columns: 3,
          children: [
            _n('Dia útil (%)', '', sub: 'normal', hint: 'Mínimo de 50% (CF art. 7º XVI)'),
            _n('Noturna (%)', '', sub: 'night'),
            _n('Intervalo suprimido (%)', '', sub: 'break'),
            _n('Descanso — DSR (%)', '', sub: 'rest'),
            _n('Feriado (%)', '', sub: 'holiday'),
            _n('Limite diário de extra (min)', 'dailyOvertimeLimitMinutes', hint: 'CLT art. 59: até 2h'),
          ],
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          value: _bands,
          onChanged: (v) => setState(() => _bands = v),
          title: const Text('Faixas de hora extra no dia útil'),
          subtitle: Text('Ex.: as 2 primeiras horas a 50% e o restante a 100%', style: TextStyle(color: t.subtle, fontSize: 12)),
        ),
        if (_bands)
          Glass(
            radius: SpTokens.radiusSm,
            padding: const EdgeInsets.all(12),
            child: Column(
              children: [
                for (var i = 0; i < _bandList.length; i++)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      children: [
                        SizedBox(
                          width: 70,
                          child: Text('Faixa ${i + 1}', style: const TextStyle(fontWeight: FontWeight.w600)),
                        ),
                        if (_bandList[i]['upToMinutes'] == null)
                          Expanded(
                            child: Text('restante das horas', style: TextStyle(color: t.muted)),
                          )
                        else
                          Expanded(
                            child: Row(
                              children: [
                                Text('até ', style: TextStyle(color: t.muted)),
                                SizedBox(
                                  width: 80,
                                  child: TextFormField(
                                    key: ValueKey('b$i-${_bandList.length}'),
                                    initialValue: '${_bandList[i]['upToMinutes']}',
                                    inputFormatters: digitsOnly(4),
                                    onChanged: (v) => _bandList[i]['upToMinutes'] = int.tryParse(v) ?? 0,
                                  ),
                                ),
                                Text(' min', style: TextStyle(color: t.muted)),
                              ],
                            ),
                          ),
                        Text('a ', style: TextStyle(color: t.muted)),
                        SizedBox(
                          width: 70,
                          child: TextFormField(
                            key: ValueKey('p$i-${_bandList.length}'),
                            initialValue: '${_bandList[i]['percent']}',
                            inputFormatters: digitsOnly(3),
                            onChanged: (v) => _bandList[i]['percent'] = int.tryParse(v) ?? 0,
                          ),
                        ),
                        Text(' %', style: TextStyle(color: t.muted)),
                        if (_bandList[i]['upToMinutes'] != null && _bandList.length > 2) RowAction(Icons.close_rounded, 'Remover faixa', () => setState(() => _bandList.removeAt(i)), danger: true),
                      ],
                    ),
                  ),
                if (_bandList.length < 5)
                  Align(
                    alignment: Alignment.centerLeft,
                    child: TextButton(
                      onPressed: () => setState(() {
                        final last = (_bandList.length >= 2 ? _bandList[_bandList.length - 2]['upToMinutes'] as int? : 0) ?? 0;
                        _bandList = [
                          ..._bandList.sublist(0, _bandList.length - 1),
                          {'upToMinutes': last + 60, 'percent': 75},
                          _bandList.last,
                        ];
                      }),
                      child: const Text('+ faixa'),
                    ),
                  ),
              ],
            ),
          ),
        const SizedBox(height: 18),
        const SectionTitle('Adicional noturno e intervalo'),
        FormGrid(
          columns: 3,
          children: [
            _hm('Noturno começa', 'nightStart', 'Urbano: 22h (CLT art. 73)'),
            _hm('Noturno termina', 'nightEnd', 'Urbano: 5h'),
            _n('Intervalo mínimo (min)', 'minBreakMinutes', hint: 'Jornada acima de 6h: 1h (art. 71)'),
          ],
        ),
        _t('Hora noturna reduzida (52min30s)', 'reducedNightHour'),
        _t('Descontar o intervalo previsto quando não houver marcação de intervalo', 'autoDeductBreak', hint: 'Só use com intervalo pré-assinalado (Portaria 671, art. 74 §2º da CLT)'),
        _t('Falta sem justificativa gera saldo negativo', 'discountAbsences'),
        const SizedBox(height: 14),
        const SectionTitle('Arredondamento'),
        FormGrid(
          children: [
            _n('Arredondar a cada (min, 0 = não)', 'roundingMinutes', max: 30),
            Select<String>(
              label: 'Modo',
              value: '${_r['roundingMode']}',
              items: const [('nearest', 'Mais próximo'), ('up', 'Para cima'), ('down', 'Para baixo')],
              onChanged: (v) => setState(() => _r['roundingMode'] = v ?? 'nearest'),
            ),
          ],
        ),
        const SizedBox(height: 22),
        Align(
          alignment: Alignment.centerRight,
          child: GlassButton(label: 'Salvar regra', icon: Icons.check_rounded, loading: _busy, onPressed: _save),
        ),
      ],
    );
  }
}
