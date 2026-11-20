// Espelho diário: como está a equipe no dia (presentes, atrasos, faltas, folgas, afastados).
import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/glass.dart';
import '../core/timesheet.dart';
import '../core/tokens.dart';
import '../widgets/company_scope.dart';
import '../widgets/ui.dart';

class DailyPage extends StatefulWidget {
  const DailyPage({super.key});
  @override
  State<DailyPage> createState() => _DailyPageState();
}

class _DailyPageState extends State<DailyPage> {
  String _date = todayIso();

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final sit = {
      'PRESENT': ('Presente', t.success),
      'LATE': ('Atrasado', t.warning),
      'ABSENT': ('Falta', t.danger),
      'INCOMPLETE': ('Marcação ímpar', t.danger),
      'OFF': ('Folga', t.muted),
      'LEAVE': ('Afastado', t.info),
      'ALLOWANCE': ('Abonado', t.info),
      'EXPECTED': ('Ainda não marcou', t.brand),
    };
    return PageScaffold(
      title: 'Espelho diário',
      subtitle: 'Como está a equipe no dia: quem marcou, quem atrasou, faltou, está de folga ou afastado.',
      icon: Icons.today_rounded,
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
                        IconButton(tooltip: 'Dia anterior', onPressed: () => setState(() => _date = addDays(_date, -1)), icon: const Icon(Icons.chevron_left_rounded)),
                        SizedBox(
                          width: 150,
                          child: TextButton(
                            onPressed: () async {
                              final d = await showDatePicker(context: context, initialDate: DateTime.parse(_date), firstDate: DateTime(2000), lastDate: DateTime(2100));
                              if (d != null) setState(() => _date = isoDate(d));
                            },
                            child: Text('${wdShort[weekdayOf(_date)]}, ${brDate(_date)}', style: const TextStyle(fontWeight: FontWeight.w600)),
                          ),
                        ),
                        IconButton(tooltip: 'Próximo dia', onPressed: () => setState(() => _date = addDays(_date, 1)), icon: const Icon(Icons.chevron_right_rounded)),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Async<Map<String, dynamic>>(
                reloadToken: '$companyId|$_date',
                load: () => api.getMap('/timesheet/daily', {'companyId': companyId, 'date': _date}),
                builder: (context, d, _) {
                  final tot = asMap(d['totals']);
                  final rows = asList(d['rows']);
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      ResponsiveGrid(
                        minItemWidth: 150,
                        children: [
                          for (final (k, v, c) in [
                            ('Presentes', tot['present'], t.success),
                            ('Atrasados', tot['late'], t.warning),
                            ('Faltas', tot['absent'], t.danger),
                            ('Marcação ímpar', tot['incomplete'], t.danger),
                            ('Ainda não marcaram', tot['expected'], t.brand),
                            ('Folga', tot['off'], t.muted),
                            ('Afastados/abonados', tot['leave'], t.info),
                          ])
                            StatTile(label: k, value: '${v ?? 0}', color: c),
                        ],
                      ),
                      const SizedBox(height: 14),
                      GlassTable<Map<String, dynamic>>(
                        rows: rows,
                        empty: const EmptyState(icon: Icons.event_available_rounded, title: 'Nenhum funcionário', body: 'Não há vínculos ativos nesta empresa no dia.'),
                        columns: [
                          Col(
                            'Funcionário',
                            (r) => Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  '${r['name']}',
                                  style: const TextStyle(fontWeight: FontWeight.w600),
                                  overflow: TextOverflow.ellipsis,
                                ),
                                Text('Matrícula ${r['registration']}', style: TextStyle(color: t.subtle, fontSize: 12)),
                              ],
                            ),
                            flex: 4,
                            primary: true,
                          ),
                          Col('Previsto', (r) {
                            final e = asMap(asMap(r['day'])['expected']);
                            return txt(
                              e['isWorkday'] == true
                                  ? (e['start'] != null ? '${e['start']}–${e['end']}' : hhmm(e['expectedMinutes']))
                                  : e['isHoliday'] == true
                                  ? 'feriado'
                                  : 'folga',
                              muted: true,
                            );
                          }, flex: 2),
                          Col(
                            'Marcações',
                            (r) => Wrap(
                              spacing: 4,
                              runSpacing: 4,
                              children: [
                                for (final p in asList(asMap(r['day'])['punches']))
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(color: t.hover, borderRadius: BorderRadius.circular(6)),
                                    child: Text('${p['time']}', style: const TextStyle(fontSize: 12, fontFeatures: [FontFeature.tabularFigures()])),
                                  ),
                              ],
                            ),
                            flex: 3,
                          ),
                          Col('Saldo', (r) {
                            final b = (asMap(asMap(r['day'])['result'])['balanceMinutes'] as num? ?? 0).toInt();
                            return Text(
                              b == 0 ? '' : hhmm(b, signed: true),
                              style: TextStyle(color: b > 0 ? t.success : t.danger, fontWeight: FontWeight.w600),
                            );
                          }, numeric: true),
                          Col('Situação', (r) {
                            final s = sit[r['situation']];
                            final flags = ((asMap(asMap(r['day'])['result'])['flags'] as List?) ?? const []).map((f) => flagLabel[f] ?? '$f').join(', ');
                            return Tooltip(
                              message: flags,
                              child: Pill(s?.$1 ?? '${r['situation']}', color: s?.$2),
                            );
                          }, flex: 2),
                        ],
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
}
