// Feriados nacionais, estaduais e municipais (pelo endereço de cada empresa) e os feriados próprios da empresa.
import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/glass.dart';
import '../core/tokens.dart';
import '../widgets/company_scope.dart';
import '../widgets/ui.dart';

const _movable = {
  'CARNIVAL_MONDAY': 'Segunda de Carnaval',
  'CARNIVAL_TUESDAY': 'Terça de Carnaval',
  'ASH_WEDNESDAY': 'Quarta-feira de Cinzas',
  'GOOD_FRIDAY': 'Sexta-feira da Paixão',
  'CORPUS_CHRISTI': 'Corpus Christi',
};

class HolidaysPage extends StatefulWidget {
  const HolidaysPage({super.key});
  @override
  State<HolidaysPage> createState() => _HolidaysPageState();
}

class _HolidaysPageState extends State<HolidaysPage> {
  int _year = DateTime.now().year;
  int _token = 0;

  @override
  Widget build(BuildContext context) {
    final canEdit = api.can('org.companies:update');
    return PageScaffold(
      title: 'Feriados',
      subtitle: 'Nacionais, estaduais e municipais cadastrados automaticamente pelo endereço de cada empresa; o próximo ano é gerado antes de 1º de janeiro.',
      icon: Icons.event_rounded,
      children: [
        CompanyScope(
          builder: (context, companyId, picker) => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Wrap(
                spacing: 12,
                runSpacing: 12,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  picker,
                  Glass(
                    radius: 999,
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(tooltip: 'Ano anterior', onPressed: () => setState(() => _year--), icon: const Icon(Icons.chevron_left_rounded)),
                        Text('$_year', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                        IconButton(tooltip: 'Próximo ano', onPressed: () => setState(() => _year++), icon: const Icon(Icons.chevron_right_rounded)),
                      ],
                    ),
                  ),
                  if (canEdit) GlassButton(label: 'Feriado da empresa', icon: Icons.add_rounded, onPressed: () => _add(companyId!)),
                ],
              ),
              const SizedBox(height: 14),
              Async<Map<String, dynamic>>(
                reloadToken: '$companyId|$_year|$_token',
                load: () => api.getMap('/companies/$companyId/holidays', {'year': _year}),
                builder: (context, data, _) => _List(data: data, companyId: companyId!, canEdit: canEdit, onChanged: () => setState(() => _token++)),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> _add(String companyId) async {
    final ok = await showGlassDialog<bool>(
      context,
      title: 'Feriado da empresa',
      builder: (_) => _RuleForm(companyId: companyId),
    );
    if (ok == true && mounted) setState(() => _token++);
  }
}

class _List extends StatelessWidget {
  const _List({required this.data, required this.companyId, required this.canEdit, required this.onChanged});
  final Map<String, dynamic> data;
  final String companyId;
  final bool canEdit;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final hs = asList(data['holidays']);
    final loc = asMap(data['location']);
    final off = hs.where((h) => h['workday'] != true).length;
    final weekOff = hs.where((h) => h['workday'] != true && DateTime.parse('${h['date']}T12:00:00Z').weekday < 6).length;
    final scope = {'NATIONAL': ('Nacional', t.brand), 'STATE': ('Estadual', t.info), 'MUNICIPAL': ('Municipal', const Color(0xFFA78BFA)), 'COMPANY': ('Da empresa', t.success)};
    final byMonth = <int, List<Map<String, dynamic>>>{};
    for (final h in hs) {
      byMonth.putIfAbsent(int.parse('${h['date']}'.substring(5, 7)) - 1, () => []).add(h);
    }
    Future<void> override(Map<String, dynamic> h, bool? workday) async {
      if (await act(
        context,
        () => workday == null ? api.delete('/companies/$companyId/holiday-overrides/${h['date']}') : api.put('/companies/$companyId/holiday-overrides', {'date': h['date'], 'workday': workday}),
      )) {
        onChanged();
      }
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('$off dias de folga · $weekOff em dias úteis', style: TextStyle(color: t.muted)),
        const SizedBox(height: 10),
        if (loc['ibge'] == null)
          Glass(
            margin: const EdgeInsets.only(bottom: 12),
            tint: t.warning,
            padding: const EdgeInsets.all(14),
            child: const Text('Esta empresa não tem CEP cadastrado: só aparecem os feriados nacionais. Preencha o CEP em Empresas para incluir os estaduais e municipais.'),
          )
        else if (loc['municipalBase'] != true)
          Glass(
            margin: const EdgeInsets.only(bottom: 12),
            tint: t.info,
            padding: const EdgeInsets.all(14),
            child: Text(
              '${loc['city']}/${loc['state']} ainda não está na base de feriados municipais do SuperPonto. Cadastre os feriados da cidade (aniversário, padroeiro, Corpus Christi) em "Feriado da empresa": eles se repetem todo ano.',
            ),
          ),
        ResponsiveGrid(
          minItemWidth: 380,
          children: [
            for (final e in byMonth.entries)
              Glass(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    SectionTitle(months[e.key]),
                    for (final h in e.value)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              width: 48,
                              padding: const EdgeInsets.symmetric(vertical: 6),
                              decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), color: h['workday'] == true ? t.hover : t.brand.withValues(alpha: 0.15)),
                              child: Column(
                                children: [
                                  Text(
                                    '${h['date']}'.substring(8),
                                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 17, color: h['workday'] == true ? t.muted : t.brand),
                                  ),
                                  Text(weekdaysShort[DateTime.parse('${h['date']}T12:00:00Z').weekday % 7], style: TextStyle(fontSize: 11, color: t.subtle)),
                                ],
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    '${h['name']}',
                                    style: TextStyle(fontWeight: FontWeight.w600, decoration: h['workday'] == true ? TextDecoration.lineThrough : null),
                                  ),
                                  const SizedBox(height: 4),
                                  Wrap(
                                    spacing: 6,
                                    runSpacing: 4,
                                    children: [
                                      Pill(scope[h['scope']]?.$1 ?? '${h['scope']}', color: scope[h['scope']]?.$2),
                                      if (h['kind'] == 'OPTIONAL') Pill('Ponto facultativo', color: t.warning),
                                      if (h['review'] == true)
                                        Tooltip(
                                          message: 'Base inicial do SuperPonto: confira com a lei local',
                                          child: Pill('confira', color: t.danger),
                                        ),
                                      if (h['overridden'] == true) Pill(h['workday'] == true ? 'Trabalho definido pela empresa' : 'Folga definida pela empresa', color: t.success),
                                    ],
                                  ),
                                  if (h['basis'] != null)
                                    Padding(
                                      padding: const EdgeInsets.only(top: 4),
                                      child: Text('${h['basis']}', style: TextStyle(color: t.subtle, fontSize: 12)),
                                    ),
                                  if (canEdit)
                                    Wrap(
                                      spacing: 4,
                                      children: [
                                        TextButton.icon(
                                          onPressed: () => override(h, h['workday'] != true),
                                          icon: Icon(h['workday'] == true ? Icons.coffee_rounded : Icons.work_rounded, size: 16),
                                          label: Text(h['workday'] == true ? 'Dar folga' : 'Trabalhar neste dia'),
                                        ),
                                        if (h['overridden'] == true)
                                          TextButton.icon(onPressed: () => override(h, null), icon: const Icon(Icons.restart_alt_rounded, size: 16), label: const Text('Padrão')),
                                        if (h['ruleId'] != null)
                                          TextButton.icon(
                                            onPressed: () async {
                                              if (await act(context, () => api.delete('/companies/$companyId/holiday-rules/${h['ruleId']}'), success: 'Feriado removido')) onChanged();
                                            },
                                            icon: Icon(Icons.delete_outline_rounded, size: 16, color: t.danger),
                                            label: Text('Remover', style: TextStyle(color: t.danger)),
                                          ),
                                      ],
                                    ),
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
        ),
      ],
    );
  }
}

class _RuleForm extends StatefulWidget {
  const _RuleForm({required this.companyId});
  final String companyId;
  @override
  State<_RuleForm> createState() => _RuleFormState();
}

class _RuleFormState extends State<_RuleForm> {
  final _name = TextEditingController();
  int _mode = 0;
  String? _date;
  String _movableKey = 'CARNIVAL_MONDAY', _kind = 'HOLIDAY';
  bool _busy = false;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      TextField(
        controller: _name,
        autofocus: true,
        decoration: const InputDecoration(labelText: 'Nome *', hintText: 'Ex.: Aniversário da cidade, Padroeira'),
      ),
      const SizedBox(height: 14),
      GlassTabs(tabs: const ['Data fixa', 'Data móvel'], index: _mode, onChanged: (i) => setState(() => _mode = i)),
      const SizedBox(height: 14),
      if (_mode == 0)
        DateField(label: 'Dia e mês (o ano não importa)', value: _date, onChanged: (v) => setState(() => _date = v))
      else
        Select<String>(
          label: 'Feriado móvel (calculado pela Páscoa)',
          value: _movableKey,
          items: [for (final e in _movable.entries) (e.key, e.value)],
          onChanged: (v) => setState(() => _movableKey = v ?? _movableKey),
        ),
      const SizedBox(height: 14),
      Select<String>(label: 'Tipo', value: _kind, items: const [('HOLIDAY', 'Feriado (folga)'), ('OPTIONAL', 'Ponto facultativo')], onChanged: (v) => setState(() => _kind = v ?? 'HOLIDAY')),
      const SizedBox(height: 22),
      Align(
        alignment: Alignment.centerRight,
        child: GlassButton(
          label: 'Cadastrar feriado',
          loading: _busy,
          onPressed: () async {
            final name = _name.text.trim();
            if (name.length < 2) return toast(context, 'Informe o nome do feriado', error: true);
            if (_mode == 0 && _date == null) return toast(context, 'Escolha o dia e o mês', error: true);
            final body = <String, Object?>{
              'name': name,
              'kind': _kind,
              if (_mode == 1) 'movable': _movableKey else ...{'month': int.parse(_date!.substring(5, 7)), 'day': int.parse(_date!.substring(8, 10))},
            };
            setState(() => _busy = true);
            final ok = await act(context, () => api.post('/companies/${widget.companyId}/holiday-rules', body), success: 'Feriado cadastrado: ele se repete todo ano');
            if (!mounted) return;
            setState(() => _busy = false);
            if (ok) Navigator.pop(this.context, true);
          },
        ),
      ),
    ],
  );
}
