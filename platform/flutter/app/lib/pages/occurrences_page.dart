// Ocorrências operacionais com histórico; faltas, atrasos e marcações incompletas podem ser geradas do espelho diário.
import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/glass.dart';
import '../core/tokens.dart';
import '../widgets/company_options.dart';
import '../widgets/company_scope.dart';
import '../widgets/ui.dart';

const _type = {
  'ABSENCE': 'Falta',
  'LATE': 'Atraso',
  'EARLY_LEAVE': 'Saída antecipada',
  'MISSING_RECORD': 'Marcação incompleta',
  'OVERTIME': 'Hora extra',
  'INSUFFICIENT_BREAK': 'Intervalo curto',
  'UNCOVERED_SHIFT': 'Plantão descoberto',
  'INCOMPLETE_TEAM': 'Equipe incompleta',
  'OPERATIONAL_ISSUE': 'Problema operacional',
  'PROFESSIONAL_SWAP': 'Troca de profissional',
  'SCHEDULE_CHANGE': 'Mudança de escala',
  'EQUIPMENT_UNAVAILABLE': 'Equipamento indisponível',
  'OTHER': 'Outro',
};
const _status = {'OPEN': 'Aberta', 'IN_PROGRESS': 'Em tratamento', 'RESOLVED': 'Resolvida', 'DISMISSED': 'Descartada'};
const _action = {'CREATE': 'Registrada', 'START': 'Em tratamento', 'RESOLVE': 'Resolvida', 'DISMISS': 'Descartada', 'REOPEN': 'Reaberta', 'COMMENT': 'Comentário'};
const _tabs = [('ACTIVE', 'Abertas'), ('RESOLVED', 'Resolvidas'), ('DISMISSED', 'Descartadas')];

class OccurrencesPage extends StatefulWidget {
  const OccurrencesPage({super.key});
  @override
  State<OccurrencesPage> createState() => _OccurrencesPageState();
}

class _OccurrencesPageState extends State<OccurrencesPage> {
  int _tab = 0, _token = 0;
  String _genDate = addDays(todayIso(), -1);
  bool _gen = false;
  String? _company;
  Future<CompanyOptions>? _opt;

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final manage = api.can('operational.occurrences:manage');
    return PageScaffold(
      title: 'Ocorrências',
      subtitle: 'Registre e trate ocorrências da operação, com histórico. Faltas, atrasos e marcações incompletas podem ser geradas do espelho diário.',
      icon: Icons.assignment_late_rounded,
      children: [
        CompanyScope(
          builder: (context, companyId, picker) {
            if (_company != companyId) {
              _company = companyId;
              _opt = CompanyOptions.load(companyId!);
            }
            return FutureBuilder<CompanyOptions>(
              future: _opt,
              builder: (context, os) {
                final o = os.data;
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Wrap(
                      spacing: 10,
                      runSpacing: 10,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        picker,
                        GlassTabs(tabs: [for (final x in _tabs) x.$2], index: _tab, onChanged: (i) => setState(() => _tab = i)),
                        if (manage) ...[
                          DateField(label: 'Dia', value: _genDate, width: 160, onChanged: (v) => setState(() => _genDate = v ?? _genDate)),
                          GlassButton(
                            label: 'Gerar do espelho',
                            icon: Icons.auto_fix_high_rounded,
                            kind: BtnKind.glass,
                            loading: _gen,
                            onPressed: () async {
                              setState(() => _gen = true);
                              try {
                                final r = asMap(await api.post('/operational/occurrences/generate', {'companyId': companyId, 'date': _genDate}));
                                if (!mounted) return;
                                setState(() => _token++);
                                toast(this.context, '${r['created']} criada(s), ${r['skipped']} já existiam${(r['noUnit'] as num? ?? 0) > 0 ? ', ${r['noUnit']} sem unidade no cadastro' : ''}');
                              } catch (e) {
                                if (mounted) toast(this.context, '$e', error: true);
                              } finally {
                                if (mounted) setState(() => _gen = false);
                              }
                            },
                          ),
                          GlassButton(label: 'Nova ocorrência', icon: Icons.add_rounded, onPressed: o == null || o.units.isEmpty ? null : () => _create(o)),
                        ],
                      ],
                    ),
                    const SizedBox(height: 14),
                    Async<List<Map<String, dynamic>>>(
                      reloadToken: '${_tabs[_tab].$1}|$_token',
                      load: () => api.getList('/operational/occurrences', {'status': _tabs[_tab].$1}),
                      builder: (context, list, _) {
                        if (list.isEmpty) {
                          return const Glass(
                            child: EmptyState(icon: Icons.assignment_turned_in_rounded, title: 'Nenhuma ocorrência', body: 'Nada para tratar aqui.'),
                          );
                        }
                        final byType = <String, int>{};
                        for (final x in list) {
                          byType['${x['type']}'] = (byType['${x['type']}'] ?? 0) + 1;
                        }
                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Wrap(spacing: 6, runSpacing: 6, children: [for (final e in byType.entries) Pill('${_type[e.key] ?? e.key}: ${e.value}', color: t.info)]),
                            const SizedBox(height: 12),
                            for (final x in list)
                              Glass(
                                margin: const EdgeInsets.only(bottom: 10),
                                padding: const EdgeInsets.all(16),
                                onTap: () => _open(x, manage),
                                child: Row(
                                  children: [
                                    Pill(_type[x['type']] ?? '${x['type']}', color: t.warning),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text('${x['title']}', style: const TextStyle(fontWeight: FontWeight.w600)),
                                          Text(
                                            '${x['unit']} · ${brDateTime(x['occurredAt'])}${x['responsible'] != null ? ' · resp. ${x['responsible']}' : ''}',
                                            style: TextStyle(color: t.subtle, fontSize: 12.5),
                                          ),
                                        ],
                                      ),
                                    ),
                                    Pill(
                                      _status[x['status']] ?? '${x['status']}',
                                      color: switch (x['status']) {
                                        'OPEN' => t.danger,
                                        'IN_PROGRESS' => t.brand,
                                        'RESOLVED' => t.success,
                                        _ => t.muted,
                                      },
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
              },
            );
          },
        ),
      ],
    );
  }

  Future<void> _create(CompanyOptions o) async {
    String unit = o.units.first.$1, type = 'OPERATIONAL_ISSUE', emp = '';
    final title = TextEditingController(), desc = TextEditingController();
    final ok = await showGlassDialog<bool>(
      context,
      title: 'Nova ocorrência',
      width: 560,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, set) => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Select<String>(label: 'Unidade', value: unit, items: o.units, onChanged: (v) => set(() => unit = v ?? unit)),
            const SizedBox(height: 12),
            Select<String>(label: 'Tipo', value: type, items: [for (final e in _type.entries) (e.key, e.value)], onChanged: (v) => set(() => type = v ?? type)),
            const SizedBox(height: 12),
            TextField(
              controller: title,
              decoration: const InputDecoration(labelText: 'Título *'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: desc,
              maxLines: 3,
              decoration: const InputDecoration(labelText: 'Descrição', alignLabelWithHint: true),
            ),
            const SizedBox(height: 12),
            Select<String>(label: 'Funcionário envolvido (opcional)', value: emp, items: [('', 'Nenhum'), ...o.employees], onChanged: (v) => set(() => emp = v ?? '')),
            const SizedBox(height: 18),
            Align(
              alignment: Alignment.centerRight,
              child: GlassButton(
                label: 'Registrar',
                onPressed: () async {
                  if (title.text.trim().length < 3) return toast(ctx, 'Título: mínimo de 3 caracteres', error: true);
                  final ok = await act(
                    ctx,
                    () => api.post('/operational/occurrences', {
                      'unitId': unit,
                      'type': type,
                      'title': title.text.trim(),
                      'description': desc.text.trim().isEmpty ? null : desc.text.trim(),
                      'employmentId': emp.isEmpty ? null : emp,
                      'occurredAt': DateTime.now().toUtc().toIso8601String(),
                    }),
                    success: 'Ocorrência registrada',
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

  Future<void> _open(Map<String, dynamic> x, bool manage) async {
    final notes = TextEditingController();
    final ok = await showGlassDialog<bool>(
      context,
      title: '${x['title']}',
      width: 580,
      builder: (ctx) {
        final t = ctx.sp;
        Future<void> doAct(String a) async {
          if ((a == 'RESOLVE' || a == 'DISMISS' || a == 'COMMENT') && notes.text.trim().isEmpty) return toast(ctx, 'Escreva a observação', error: true);
          if (await act(ctx, () => api.post('/operational/occurrences/${x['id']}/actions', {'action': a, if (notes.text.trim().isNotEmpty) 'notes': notes.text.trim()})) && ctx.mounted) {
            Navigator.pop(ctx, true);
          }
        }

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('${_type[x['type']] ?? x['type']} · ${x['unit']}${x['employment'] != null ? ' · ${x['employment']}' : ''}', style: TextStyle(color: t.muted)),
            if (x['description'] != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text('${x['description']}')),
            const SizedBox(height: 14),
            const SectionTitle('Histórico'),
            for (final e in asList(x['events']))
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.circle, size: 8, color: t.brand),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text.rich(
                            TextSpan(
                              children: [
                                TextSpan(
                                  text: _action[e['action']] ?? '${e['action']}',
                                  style: const TextStyle(fontWeight: FontWeight.w600),
                                ),
                                TextSpan(
                                  text: '  ${brDateTime(e['at'])} · ${e['by']}',
                                  style: TextStyle(color: t.subtle, fontSize: 12),
                                ),
                              ],
                            ),
                          ),
                          if (e['notes'] != null) Text('${e['notes']}', style: TextStyle(color: t.muted)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            if (manage) ...[
              const SizedBox(height: 12),
              TextField(
                controller: notes,
                maxLines: 2,
                decoration: const InputDecoration(labelText: 'Observação (obrigatória para resolver ou descartar)'),
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  if (x['status'] == 'OPEN') GlassButton(label: 'Iniciar tratamento', kind: BtnKind.glass, small: true, onPressed: () => doAct('START')),
                  if (['OPEN', 'IN_PROGRESS'].contains(x['status'])) ...[
                    GlassButton(label: 'Resolver', small: true, onPressed: () => doAct('RESOLVE')),
                    GlassButton(label: 'Descartar', kind: BtnKind.ghost, small: true, onPressed: () => doAct('DISMISS')),
                  ],
                  if (['RESOLVED', 'DISMISSED'].contains(x['status'])) GlassButton(label: 'Reabrir', kind: BtnKind.glass, small: true, onPressed: () => doAct('REOPEN')),
                  GlassButton(label: 'Comentar', kind: BtnKind.ghost, small: true, onPressed: () => doAct('COMMENT')),
                ],
              ),
            ],
          ],
        );
      },
    );
    if (ok == true && mounted) setState(() => _token++);
  }
}
