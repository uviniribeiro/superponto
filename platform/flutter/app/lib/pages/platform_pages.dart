// Plataforma (equipe SuperPonto): clientes, plano de cada cliente e planos com limites.
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/csv.dart' show stripAccents;
import '../core/format.dart';
import '../core/glass.dart';
import '../core/tokens.dart';
import '../widgets/masked.dart';
import '../widgets/ui.dart';

const limitLabel = {'limit.employments': 'Funcionários ativos', 'limit.devices': 'Equipamentos', 'limit.users': 'Usuários'};
const _tenantStatus = {'TRIAL': 'Em teste', 'ACTIVE': 'Ativo', 'SUSPENDED': 'Suspenso', 'CANCELLED': 'Cancelado'};

String slugify(String v) {
  final s = stripAccents(v.toLowerCase()).replaceAll(RegExp(r'[^a-z0-9]+'), '-').replaceAll(RegExp(r'^-+|-+$'), '');
  return s.length > 64 ? s.substring(0, 64) : s;
}

Widget _restricted() => const PageScaffold(
  title: 'Acesso restrito',
  children: [
    Glass(
      child: EmptyState(icon: Icons.verified_user_rounded, title: 'Acesso restrito', body: 'Esta área é exclusiva da equipe SuperPonto.'),
    ),
  ],
);

class TenantsPage extends StatefulWidget {
  const TenantsPage({super.key});
  @override
  State<TenantsPage> createState() => _TenantsPageState();
}

class _TenantsPageState extends State<TenantsPage> {
  String _q = '';
  int _token = 0;

  @override
  Widget build(BuildContext context) {
    if (api.me?.isPlatformAdmin != true) return _restricted();
    final t = context.sp;
    return PageScaffold(
      title: 'Clientes',
      subtitle: 'Organizações que usam o SuperPonto.',
      icon: Icons.verified_user_rounded,
      actions: [GlassButton(label: 'Novo cliente', icon: Icons.add_rounded, onPressed: _create)],
      children: [
        SearchField(hint: 'Buscar cliente…', onChanged: (v) => setState(() => _q = v)),
        const SizedBox(height: 14),
        Async<Map<String, dynamic>>(
          reloadToken: '$_q|$_token',
          load: () => api.getMap('/platform/tenants', {'pageSize': 100, 'search': _q}),
          builder: (context, page, _) {
            final rows = asList(page['data']);
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text('${page['total'] ?? rows.length} no total', style: TextStyle(color: t.muted)),
                ),
                GlassTable<Map<String, dynamic>>(
                  rows: rows,
                  empty: EmptyState(
                    icon: Icons.verified_user_rounded,
                    title: _q.isEmpty ? 'Nenhum cliente ainda' : 'Nada encontrado',
                    body: _q.isEmpty ? 'Crie a primeira organização.' : 'Tente outro termo.',
                  ),
                  onTap: (x) async {
                    await api.selectTenant(x['id'] as String);
                    if (context.mounted) context.go('/empresas');
                  },
                  columns: [
                    Col(
                      'Cliente',
                      (x) => Row(
                        children: [
                          CircleAvatar(
                            radius: 17,
                            backgroundColor: t.brand.withValues(alpha: 0.18),
                            child: Text(
                              '${x['name']}'.characters.first.toUpperCase(),
                              style: TextStyle(color: t.brand, fontWeight: FontWeight.w800),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('${x['name']}', style: const TextStyle(fontWeight: FontWeight.w600)),
                                Text('${x['slug']} · desde ${brDate(x['createdAt'])}', style: TextStyle(color: t.subtle, fontSize: 12)),
                              ],
                            ),
                          ),
                        ],
                      ),
                      flex: 5,
                      primary: true,
                    ),
                    Col(
                      'Situação',
                      (x) => Pill(
                        _tenantStatus[x['status']] ?? '${x['status']}',
                        color: switch (x['status']) {
                          'ACTIVE' => t.success,
                          'TRIAL' => t.info,
                          _ => t.danger,
                        },
                      ),
                      flex: 2,
                    ),
                  ],
                  actions: (x) => [TextButton(onPressed: () => _plan(x), child: const Text('Plano'))],
                ),
              ],
            );
          },
        ),
      ],
    );
  }

  Future<void> _plan(Map<String, dynamic> x) async {
    final ok = await showGlassDialog<bool>(
      context,
      title: 'Plano: ${x['name']}',
      width: 600,
      builder: (_) => TenantPlanForm(tenantId: x['id'] as String),
    );
    if (ok == true && mounted) setState(() => _token++);
  }

  Future<void> _create() async {
    final name = TextEditingController(), slug = TextEditingController(), doc = TextEditingController(), adminName = TextEditingController(), adminEmail = TextEditingController();
    var touched = false;
    final ok = await showGlassDialog<bool>(
      context,
      title: 'Novo cliente',
      width: 560,
      builder: (ctx) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            controller: name,
            decoration: const InputDecoration(labelText: 'Nome da organização *'),
            onChanged: (v) {
              if (!touched) slug.text = slugify(v);
            },
          ),
          const SizedBox(height: 12),
          TextField(
            controller: slug,
            decoration: const InputDecoration(labelText: 'Identificador *', helperText: 'Letras minúsculas, números e hífen'),
            onChanged: (v) {
              touched = true;
              final s = slugify(v);
              if (s != v) {
                slug.value = TextEditingValue(
                  text: s,
                  selection: TextSelection.collapsed(offset: s.length),
                );
              }
            },
          ),
          const SizedBox(height: 12),
          TextField(
            controller: doc,
            inputFormatters: [MaskFormatter(maskCnpjInput)],
            decoration: const InputDecoration(labelText: 'CNPJ do titular'),
          ),
          const SizedBox(height: 16),
          const SectionTitle('Primeiro administrador'),
          FormGrid(
            children: [
              TextField(
                controller: adminName,
                decoration: const InputDecoration(labelText: 'Nome *'),
              ),
              TextField(
                controller: adminEmail,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(labelText: 'E-mail *', helperText: 'Recebe o link para criar a senha'),
              ),
            ],
          ),
          const SizedBox(height: 18),
          Align(
            alignment: Alignment.centerRight,
            child: GlassButton(
              label: 'Criar cliente',
              onPressed: () async {
                final d = normCnpj(doc.text);
                if (name.text.trim().length < 2 || slug.text.isEmpty || adminName.text.trim().length < 2 || !adminEmail.text.contains('@')) {
                  return toast(ctx, 'Preencha os campos obrigatórios', error: true);
                }
                if (d.isNotEmpty && !validCnpj(d)) return toast(ctx, 'CNPJ do titular inválido', error: true);
                final ok = await act(
                  ctx,
                  () => api.post('/platform/tenants', {
                    'name': name.text.trim(),
                    'slug': slug.text,
                    if (d.isNotEmpty) 'document': d,
                    'admin': {'email': adminEmail.text.trim(), 'displayName': adminName.text.trim()},
                  }),
                  success: 'Cliente criado. O administrador recebeu o e-mail para definir a senha.',
                );
                if (ok && ctx.mounted) Navigator.pop(ctx, true);
              },
            ),
          ),
        ],
      ),
    );
    if (ok == true && mounted) setState(() => _token++);
  }
}

/// Plano do cliente: plano, situação, vigência e ajustes de limite deste contrato.
class TenantPlanForm extends StatefulWidget {
  const TenantPlanForm({super.key, required this.tenantId});
  final String tenantId;
  @override
  State<TenantPlanForm> createState() => _TenantPlanFormState();
}

class _TenantPlanFormState extends State<TenantPlanForm> {
  String _plan = '', _status = 'TRIALING', _end = isoDate(DateTime(todayBr().year, todayBr().month + 1, todayBr().day));
  final _over = {for (final k in limitLabel.keys) k: TextEditingController()};
  late final Future<(List<Map<String, dynamic>>, Map<String, dynamic>)> _f = () async {
    final r = (await api.getList('/platform/plans'), await api.getMap('/platform/tenants/${widget.tenantId}/subscription'));
    final s = r.$2['subscription'] == null ? null : asMap(r.$2['subscription']);
    if (s != null) {
      _plan = '${s['planId'] ?? ''}';
      _status = '${s['status'] ?? 'ACTIVE'}';
      _end = '${s['currentPeriodEnd']}'.substring(0, 10);
      for (final e in asMap(s['overrides']).entries) {
        _over[e.key]?.text = '${e.value}';
      }
    }
    return r;
  }();
  bool _busy = false;

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    return FutureBuilder(
      future: _f,
      builder: (context, s) {
        if (s.hasError) return ErrorView(s.error!);
        if (!s.hasData) return const Loading();
        final (plans, cur) = s.data!;
        final usage = asMap(cur['usage']), limits = asMap(cur['limits']);
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ResponsiveGrid(
              minItemWidth: 150,
              children: [for (final e in limitLabel.entries) StatTile(label: e.value, value: '${usage[e.key] ?? 0}${limits[e.key] != null ? ' / ${limits[e.key]}' : ''}')],
            ),
            const SizedBox(height: 14),
            Select<String>(
              label: 'Plano',
              value: _plan,
              items: [('', 'Escolha…'), for (final p in plans) (p['id'] as String, '${p['name']} — ${money(p['priceCents'])}/${p['interval'] == 'year' ? 'ano' : 'mês'}')],
              onChanged: (v) => setState(() => _plan = v ?? ''),
            ),
            const SizedBox(height: 12),
            FormGrid(
              children: [
                Select<String>(
                  label: 'Situação',
                  value: _status,
                  items: const [
                    ('TRIALING', 'Em teste'),
                    ('ACTIVE', 'Ativa'),
                    ('PAST_DUE', 'Pagamento atrasado'),
                    ('SUSPENDED', 'Suspensa (bloqueia o acesso)'),
                    ('CANCELLED', 'Cancelada (bloqueia o acesso)'),
                  ],
                  onChanged: (v) => setState(() => _status = v ?? 'ACTIVE'),
                ),
                DateField(label: 'Vigência até', value: _end, onChanged: (v) => setState(() => _end = v ?? _end)),
              ],
            ),
            const SizedBox(height: 12),
            const FieldLabel('Ajuste de limite só deste cliente (em branco = o do plano)'),
            FormGrid(
              columns: 3,
              children: [
                for (final e in limitLabel.entries)
                  TextField(
                    controller: _over[e.key],
                    inputFormatters: digitsOnly(7),
                    decoration: InputDecoration(labelText: e.value),
                  ),
              ],
            ),
            const SizedBox(height: 18),
            Align(
              alignment: Alignment.centerRight,
              child: GlassButton(
                label: 'Salvar',
                loading: _busy,
                onPressed: _plan.isEmpty
                    ? null
                    : () async {
                        setState(() => _busy = true);
                        final ok = await act(
                          context,
                          () => api.put('/platform/tenants/${widget.tenantId}/subscription', {
                            'planId': _plan,
                            'status': _status,
                            'currentPeriodEnd': _end,
                            'overrides': {
                              for (final e in _over.entries)
                                if (e.value.text.trim().isNotEmpty) e.key: int.parse(e.value.text.trim()),
                            },
                          }),
                          success: 'Plano do cliente salvo',
                        );
                        if (!mounted) return;
                        setState(() => _busy = false);
                        if (ok) Navigator.pop(this.context, true);
                      },
              ),
            ),
            Text('Suspensa ou cancelada bloqueia o acesso de todos os usuários do cliente.', style: TextStyle(color: t.subtle, fontSize: 12)),
          ],
        );
      },
    );
  }
}

class PlansPage extends StatefulWidget {
  const PlansPage({super.key});
  @override
  State<PlansPage> createState() => _PlansPageState();
}

class _PlansPageState extends State<PlansPage> {
  int _token = 0;
  @override
  Widget build(BuildContext context) {
    if (api.me?.isPlatformAdmin != true) return _restricted();
    final t = context.sp;
    return PageScaffold(
      title: 'Planos',
      subtitle: 'Preço e limites de cada plano. O plano de cada cliente é escolhido em Clientes. A cobrança em si fica com o meio de pagamento contratado.',
      icon: Icons.layers_rounded,
      actions: [GlassButton(label: 'Novo plano', icon: Icons.add_rounded, onPressed: () => _edit(null))],
      children: [
        Async<List<Map<String, dynamic>>>(
          reloadToken: _token,
          load: () => api.getList('/platform/plans'),
          builder: (context, list, _) => list.isEmpty
              ? const Glass(
                  child: EmptyState(icon: Icons.layers_rounded, title: 'Nenhum plano', body: 'Crie os planos com os limites de funcionários, equipamentos e usuários.'),
                )
              : ResponsiveGrid(
                  minItemWidth: 280,
                  children: [
                    for (final p in list)
                      Glass(
                        onTap: () => _edit(p),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text('${p['name']}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                                      Text('${p['key']}${p['isPublic'] == true ? '' : ' · privado'}', style: TextStyle(color: t.subtle, fontSize: 12)),
                                    ],
                                  ),
                                ),
                                Icon(Icons.edit_rounded, size: 18, color: t.muted),
                              ],
                            ),
                            const SizedBox(height: 10),
                            Text.rich(
                              TextSpan(
                                children: [
                                  TextSpan(
                                    text: money(p['priceCents']),
                                    style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: t.brand),
                                  ),
                                  TextSpan(
                                    text: '/${p['interval'] == 'year' ? 'ano' : 'mês'}',
                                    style: TextStyle(color: t.subtle),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 10),
                            for (final e in limitLabel.entries)
                              Padding(
                                padding: const EdgeInsets.symmetric(vertical: 2),
                                child: Row(
                                  children: [
                                    Expanded(
                                      child: Text(e.value, style: TextStyle(color: t.muted)),
                                    ),
                                    Text('${asMap(p['limits'])[e.key] ?? 'sem limite'}', style: const TextStyle(fontWeight: FontWeight.w600)),
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

  Future<void> _edit(Map<String, dynamic>? p) async {
    final key = TextEditingController(text: '${p?['key'] ?? ''}'), name = TextEditingController(text: '${p?['name'] ?? ''}');
    final price = TextEditingController(text: p == null ? '0' : ((p['priceCents'] as num) / 100).toStringAsFixed(2).replaceAll('.', ','));
    final limits = {for (final k in limitLabel.keys) k: TextEditingController(text: asMap(p?['limits'])[k] == null ? '' : '${asMap(p?['limits'])[k]}')};
    var interval = '${p?['interval'] ?? 'month'}';
    var isPublic = p?['isPublic'] as bool? ?? true;
    final ok = await showGlassDialog<bool>(
      context,
      title: p == null ? 'Novo plano' : 'Editar plano',
      width: 560,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, set) => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (p == null) ...[
              TextField(
                controller: key,
                decoration: const InputDecoration(labelText: 'Identificador *', helperText: 'letras minúsculas, números e hífen'),
              ),
              const SizedBox(height: 12),
            ],
            TextField(
              controller: name,
              decoration: const InputDecoration(labelText: 'Nome *'),
            ),
            const SizedBox(height: 12),
            FormGrid(
              children: [
                TextField(
                  controller: price,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(labelText: 'Preço (R\$) *'),
                ),
                Select<String>(label: 'Cobrança', value: interval, items: const [('month', 'Mensal'), ('year', 'Anual')], onChanged: (v) => set(() => interval = v ?? 'month')),
              ],
            ),
            const SizedBox(height: 12),
            const FieldLabel('Limites (em branco = sem limite)'),
            FormGrid(
              columns: 3,
              children: [
                for (final e in limitLabel.entries)
                  TextField(
                    controller: limits[e.key],
                    inputFormatters: digitsOnly(7),
                    decoration: InputDecoration(labelText: e.value),
                  ),
              ],
            ),
            CheckboxListTile(contentPadding: EdgeInsets.zero, value: isPublic, onChanged: (v) => set(() => isPublic = v ?? true), title: const Text('Plano público (oferecido a novos clientes)')),
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerRight,
              child: GlassButton(
                label: 'Salvar',
                onPressed: () async {
                  final cents = ((num.tryParse(price.text.replaceAll('.', '').replaceAll(',', '.')) ?? -1) * 100).round();
                  if (name.text.trim().length < 2 || cents < 0 || (p == null && !RegExp(r'^[a-z0-9-]{2,40}$').hasMatch(key.text.trim()))) {
                    return toast(ctx, 'Confira identificador, nome e preço', error: true);
                  }
                  final body = {
                    'name': name.text.trim(),
                    'priceCents': cents,
                    'interval': interval,
                    'isPublic': isPublic,
                    'limits': {for (final e in limits.entries) e.key: e.value.text.trim().isEmpty ? null : int.parse(e.value.text.trim())},
                  };
                  final ok = await act(ctx, () => p == null ? api.post('/platform/plans', {...body, 'key': key.text.trim()}) : api.put('/platform/plans/${p['id']}', body), success: 'Plano salvo');
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
