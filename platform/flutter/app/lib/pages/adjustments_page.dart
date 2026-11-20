// Ajustes de marcação: inclusões e desconsiderações aguardando aprovação. A marcação original nunca muda.
import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/glass.dart';
import '../core/tokens.dart';
import '../widgets/ui.dart';
import 'catalog_page.dart';

const _status = [('PENDING', 'Pendentes'), ('APPROVED', 'Aprovados'), ('REJECTED', 'Recusados'), ('CANCELLED', 'Cancelados')];

class AdjustmentsPage extends StatefulWidget {
  const AdjustmentsPage({super.key});
  @override
  State<AdjustmentsPage> createState() => _AdjustmentsPageState();
}

class _AdjustmentsPageState extends State<AdjustmentsPage> {
  int _i = 0, _token = 0;
  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final status = _status[_i].$1;
    final canApprove = api.can('time.adjustments:approve');
    return PageScaffold(
      title: 'Ajustes de marcação',
      subtitle: 'Inclusões e desconsiderações lançadas por quem não pode aprovar. A marcação original nunca é alterada.',
      icon: Icons.fact_check_rounded,
      children: [
        Align(
          alignment: Alignment.centerLeft,
          child: GlassTabs(tabs: [for (final s in _status) s.$2], index: _i, onChanged: (i) => setState(() => _i = i)),
        ),
        const SizedBox(height: 14),
        Async<List<Map<String, dynamic>>>(
          reloadToken: '$status|$_token',
          load: () => api.getList('/time-adjustments', {'status': status}),
          builder: (context, rows, _) => rows.isEmpty
              ? Glass(
                  child: EmptyState(icon: Icons.fact_check_rounded, title: 'Nada por aqui', body: status == 'PENDING' ? 'Nenhum ajuste aguardando aprovação.' : 'Nenhum ajuste nesta situação.'),
                )
              : Column(
                  children: [
                    for (final a in rows)
                      Glass(
                        margin: const EdgeInsets.only(bottom: 10),
                        padding: const EdgeInsets.all(16),
                        child: Row(
                          children: [
                            Pill(a['kind'] == 'INCLUDE' ? 'Incluir' : 'Desconsiderar', color: a['kind'] == 'INCLUDE' ? t.info : t.warning),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text.rich(
                                    TextSpan(
                                      children: [
                                        TextSpan(
                                          text: '${asMap(a['employee'])['name']}',
                                          style: const TextStyle(fontWeight: FontWeight.w600),
                                        ),
                                        TextSpan(
                                          text: ' · ${asMap(a['employee'])['registration']}',
                                          style: TextStyle(color: t.subtle),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Text(
                                    '${a['when'] != null ? '${brDate(asMap(a['when'])['date'])} às ${asMap(a['when'])['time']}' : ''} · ${a['justification']}',
                                    style: TextStyle(color: t.muted, fontSize: 13),
                                  ),
                                ],
                              ),
                            ),
                            if (status == 'PENDING' && canApprove) ...[
                              GlassButton(label: 'Aprovar', icon: Icons.check_rounded, small: true, onPressed: () => _decide(a, true)),
                              const SizedBox(width: 6),
                              GlassButton(label: 'Recusar', icon: Icons.close_rounded, small: true, kind: BtnKind.ghost, onPressed: () => _decide(a, false)),
                            ],
                          ],
                        ),
                      ),
                  ],
                ),
        ),
      ],
    );
  }

  Future<void> _decide(Map<String, dynamic> a, bool approve) async {
    if (await act(context, () => api.post('/time-adjustments/${a['id']}/decide', {'approve': approve}), success: approve ? 'Ajuste aprovado' : 'Ajuste recusado') && mounted) setState(() => _token++);
  }
}

final justificationsDef = CatalogDef(
  title: 'Justificativas',
  singular: 'Justificativa',
  feminine: true,
  path: 'justifications',
  icon: Icons.rule_rounded,
  description: 'Códigos usados em abonos, afastamentos e solicitações. "Abona" tira o débito; sem abonar, a falta fica justificada mas é descontada.',
  readPermission: 'time.calculations:read',
  managePermission: 'time.justifications:manage',
  fields: const [
    CField('name', 'Descrição', FType.text, required: true, max: 120, placeholder: 'Ex.: Atestado médico'),
    CField('code', 'Código', FType.text, max: 20, hint: 'Opcional; vai na exportação para a folha'),
    CField('disregardsDebits', 'Efeito', FType.select, options: [('true', 'Abona (não gera débito)'), ('false', 'Só justifica (desconta)')]),
    CField('usageLimit', 'Limite de uso por funcionário', FType.text, max: 3, hint: 'Vazio = sem limite'),
    CField('limitPeriod', 'Período do limite', FType.select, options: [('MONTH', 'Por mês'), ('YEAR', 'Por ano')]),
    CField('active', 'Ativa', FType.active),
  ],
  subtitle: (r) => [
    r['code'] != null ? 'Código ${r['code']}' : null,
    r['disregardsDebits'] == false ? 'só justifica' : 'abona',
    r['usageLimit'] != null ? 'até ${r['usageLimit']} por ${r['limitPeriod'] == 'YEAR' ? 'ano' : 'mês'}' : 'sem limite',
  ].whereType<String>().join(' · '),
);
