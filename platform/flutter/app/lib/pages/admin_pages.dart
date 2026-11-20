// Administração: bloqueios de acesso, plano e uso, aparelhos do app e login pela rede (LDAP/AD).
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/glass.dart';
import '../core/tokens.dart';
import '../widgets/ui.dart';

class BlocksPage extends StatefulWidget {
  const BlocksPage({super.key});
  @override
  State<BlocksPage> createState() => _BlocksPageState();
}

class _BlocksPageState extends State<BlocksPage> {
  bool _ended = false;
  int _token = 0;
  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final canManage = api.can('admin.users:manage');
    final state = {'ACTIVE': ('Vigente', t.danger), 'SCHEDULED': ('Agendado', t.brand), 'ENDED': ('Encerrado', t.muted), 'REVOKED': ('Revogado', t.muted)};
    return PageScaffold(
      title: 'Bloqueios de acesso',
      subtitle: 'Usuários impedidos de entrar por um período, com motivo. Para bloquear alguém, abra o usuário em Administração › Usuários.',
      icon: Icons.block_rounded,
      actions: [GlassButton(label: 'Ir para Usuários', kind: BtnKind.glass, onPressed: () => context.go('/usuarios'))],
      children: [
        Row(
          children: [
            Checkbox(value: _ended, onChanged: (v) => setState(() => _ended = v ?? false)),
            const Text('Mostrar encerrados e revogados'),
          ],
        ),
        const SizedBox(height: 8),
        Async<List<Map<String, dynamic>>>(
          reloadToken: '$_ended|$_token',
          load: () => api.getList('/access-blocks', {'includeEnded': '$_ended'}),
          builder: (context, rows, _) => GlassTable<Map<String, dynamic>>(
            rows: rows,
            empty: EmptyState(icon: Icons.block_rounded, title: 'Nenhum bloqueio', body: _ended ? 'Ainda não houve bloqueios.' : 'Nenhum usuário bloqueado agora.'),
            columns: [
              Col('Usuário', (b) => txt('${asMap(b['user'])['displayName']} · ${asMap(b['user'])['email']}', bold: true), flex: 4, primary: true),
              Col('Motivo e período', (b) => txt('${b['reason']} · ${brDateTime(b['startsAt'])} até ${b['endsAt'] == null ? 'indeterminado' : brDateTime(b['endsAt'])}', muted: true), flex: 5),
              Col('Situação', (b) => Pill(state[b['state']]?.$1 ?? '${b['state']}', color: state[b['state']]?.$2), flex: 2),
            ],
            actions: canManage
                ? (b) => [
                    if (b['state'] == 'ACTIVE' || b['state'] == 'SCHEDULED')
                      TextButton(
                        onPressed: () async {
                          if (await act(context, () => api.delete('/users/${asMap(b['user'])['id']}/blocks/${b['id']}'), success: 'Bloqueio encerrado') && mounted) setState(() => _token++);
                        },
                        child: const Text('Encerrar'),
                      ),
                  ]
                : null,
          ),
        ),
      ],
    );
  }
}

class PlanUsagePage extends StatelessWidget {
  const PlanUsagePage({super.key});
  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    const status = {'TRIALING': 'Em teste', 'ACTIVE': 'Ativa', 'PAST_DUE': 'Pagamento atrasado'};
    return PageScaffold(
      title: 'Plano e uso',
      subtitle: 'Seu plano no SuperPonto e quanto de cada limite está em uso.',
      icon: Icons.layers_rounded,
      children: [
        Async<Map<String, dynamic>>(
          load: () => api.getMap('/subscription'),
          builder: (context, d, _) {
            final plan = d['plan'] == null ? null : asMap(d['plan']);
            final limits = asMap(d['limits']), usage = asMap(d['usage']), labels = asMap(d['labels']);
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (plan == null)
                  const Glass(
                    child: EmptyState(icon: Icons.layers_rounded, title: 'Sem plano contratado', body: 'Sua organização não tem limites configurados.'),
                  )
                else
                  Glass(
                    child: Row(
                      children: [
                        const IconBubble(Icons.workspace_premium_rounded, size: 52),
                        const SizedBox(width: 14),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Plano', style: TextStyle(color: t.subtle)),
                            Text('${plan['name']}', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
                            Text('${status[plan['status']] ?? plan['status']} · vigente até ${brDate(plan['currentPeriodEnd'])}', style: TextStyle(color: t.muted)),
                          ],
                        ),
                      ],
                    ),
                  ),
                const SizedBox(height: 14),
                ResponsiveGrid(
                  minItemWidth: 260,
                  children: [
                    for (final e in labels.entries)
                      Builder(
                        builder: (_) {
                          final max = limits[e.key] as num?;
                          final used = usage[e.key] as num? ?? 0;
                          final pct = max == null || max == 0 ? 0.0 : (used / max).clamp(0, 1).toDouble();
                          return Glass(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('${e.value}', style: TextStyle(color: t.muted)),
                                const SizedBox(height: 4),
                                Text.rich(
                                  TextSpan(
                                    children: [
                                      TextSpan(
                                        text: '$used',
                                        style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800),
                                      ),
                                      if (max != null)
                                        TextSpan(
                                          text: ' de $max',
                                          style: TextStyle(color: t.subtle),
                                        ),
                                    ],
                                  ),
                                ),
                                const SizedBox(height: 8),
                                if (max != null)
                                  ClipRRect(
                                    borderRadius: BorderRadius.circular(99),
                                    child: LinearProgressIndicator(value: pct, minHeight: 8, backgroundColor: t.hover, color: pct > 0.9 ? t.danger : t.brand),
                                  )
                                else
                                  Text('sem limite', style: TextStyle(color: t.subtle)),
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
      ],
    );
  }
}

class AppDevicesAdminPage extends StatefulWidget {
  const AppDevicesAdminPage({super.key});
  @override
  State<AppDevicesAdminPage> createState() => _AppDevicesAdminPageState();
}

class _AppDevicesAdminPageState extends State<AppDevicesAdminPage> {
  int _token = 0;
  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    return PageScaffold(
      title: 'Aparelhos do app',
      subtitle: 'Celulares e tablets liberados pelos funcionários para marcar o ponto. Revogue um aparelho perdido ou trocado.',
      icon: Icons.phonelink_lock_rounded,
      children: [
        Async<List<Map<String, dynamic>>>(
          reloadToken: _token,
          load: () => api.getList('/app-devices'),
          builder: (context, list, _) => GlassTable<Map<String, dynamic>>(
            rows: list,
            empty: const EmptyState(icon: Icons.smartphone_rounded, title: 'Nenhum aparelho liberado', body: 'Cada funcionário libera o seu em Meus aparelhos.'),
            columns: [
              Col('Usuário', (d) => txt('${asMap(d['user'])['displayName'] ?? '—'} · ${asMap(d['user'])['email'] ?? ''}', bold: true), flex: 4, primary: true),
              Col('Aparelho', (d) => txt(d['name']), flex: 2),
              Col('Liberado', (d) => txt(brDateTime(d['approvedAt']), muted: true), flex: 2),
              Col('Último uso', (d) => txt(d['lastUsedAt'] == null ? '—' : brDateTime(d['lastUsedAt']), muted: true), flex: 2),
              Col('Situação', (d) => Pill(d['revokedAt'] != null ? 'Revogado' : 'Ativo', color: d['revokedAt'] != null ? t.muted : t.success), flex: 1),
            ],
            actions: (d) => [
              if (d['revokedAt'] == null)
                RowAction(Icons.delete_outline_rounded, 'Revogar', () async {
                  if (!await confirm(context, title: 'Revogar aparelho?', body: '${d['name']} de ${asMap(d['user'])['displayName'] ?? ''} não poderá mais marcar o ponto.', confirmLabel: 'Revogar') ||
                      !context.mounted) {
                    return;
                  }
                  if (await act(context, () => api.post('/app-devices/${d['id']}/revoke'), success: 'Aparelho revogado') && mounted) setState(() => _token++);
                }, danger: true),
            ],
          ),
        ),
      ],
    );
  }
}

const _presets = [
  ('Active Directory (e-mail)', '(&(objectClass=user)(mail={email}))', 'Busca a conta do AD pelo e-mail'),
  ('Active Directory (login)', '(&(objectClass=user)(sAMAccountName={login}))', 'Usa a parte antes do @ como login de rede'),
  ('OpenLDAP', '(mail={email})', 'Busca pelo atributo mail'),
];

class LdapPage extends StatefulWidget {
  const LdapPage({super.key});
  @override
  State<LdapPage> createState() => _LdapPageState();
}

class _LdapPageState extends State<LdapPage> {
  int _token = 0;
  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    if (!api.can('admin.ldap:manage')) {
      return const PageScaffold(
        title: 'Login pela rede',
        children: [
          Glass(
            child: EmptyState(icon: Icons.lan_rounded, title: 'Sem permissão', body: 'Peça ao administrador a permissão “Login por LDAP/AD”.'),
          ),
        ],
      );
    }
    return PageScaffold(
      title: 'Login pela rede',
      subtitle: 'Usuários entram com o mesmo e-mail e senha da rede da organização (Active Directory ou OpenLDAP).',
      icon: Icons.lan_rounded,
      children: [
        Async<Map<String, dynamic>>(
          reloadToken: _token,
          load: () => api.getMap('/ldap-config'),
          builder: (context, cfg, _) {
            final form = Glass(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 10,
                        height: 10,
                        decoration: BoxDecoration(shape: BoxShape.circle, color: cfg['enabled'] == true ? t.success : t.muted),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        cfg['configured'] == true ? (cfg['enabled'] == true ? 'Ativado' : 'Configurado, desativado') : 'Ainda não configurado',
                        style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  _LdapForm(key: ValueKey(cfg['updatedAt']), cfg: cfg, onSaved: () => setState(() => _token++)),
                ],
              ),
            );
            final side = Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Glass(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const SectionTitle('Testar'),
                      Text('Usa a configuração salva.', style: TextStyle(color: t.subtle, fontSize: 12.5)),
                      const SizedBox(height: 10),
                      if (cfg['configured'] == true) const _Tester() else Text('Salve a configuração para testar.', style: TextStyle(color: t.muted)),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                Glass(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SectionTitle('Como funciona'),
                      for (final s in [
                        'Em Usuários, marque a forma de login “Rede da organização (LDAP)”.',
                        'A senha é conferida no diretório a cada login; o SuperPonto não guarda a senha desses usuários.',
                        'Perfis, dias de acesso e bloqueios continuam valendo.',
                        'Na nuvem, o servidor precisa ter endereço público com TLS; diretório só na rede interna exige instalação própria.',
                      ])
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 3),
                          child: Text('• $s', style: TextStyle(color: t.muted)),
                        ),
                    ],
                  ),
                ),
              ],
            );
            return isWide(context)
                ? Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(flex: 3, child: form),
                      const SizedBox(width: 14),
                      Expanded(flex: 2, child: side),
                    ],
                  )
                : Column(children: [form, const SizedBox(height: 14), side]);
          },
        ),
      ],
    );
  }
}

class _LdapForm extends StatefulWidget {
  const _LdapForm({super.key, required this.cfg, required this.onSaved});
  final Map<String, dynamic> cfg;
  final VoidCallback onSaved;
  @override
  State<_LdapForm> createState() => _LdapFormState();
}

class _LdapFormState extends State<_LdapForm> {
  Map<String, dynamic> get c => widget.cfg;
  late bool _enabled = c['enabled'] == true, _startTls = c['startTls'] == true, _insecure = c['allowInsecureTls'] == true;
  late final _url = TextEditingController(text: '${c['url'] ?? 'ldaps://'}');
  late final _bindDn = TextEditingController(text: '${c['bindDn'] ?? ''}');
  final _bindPw = TextEditingController();
  late final _baseDn = TextEditingController(text: '${c['baseDn'] ?? ''}');
  late final _filter = TextEditingController(text: '${c['userFilter'] ?? '(mail={email})'}');
  late final _timeout = TextEditingController(text: '${c['timeoutMs'] ?? 5000}');
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
          title: const Text('Login pela rede ativado'),
          subtitle: Text('Usuários marcados como LDAP entram com a senha da rede', style: TextStyle(color: t.subtle, fontSize: 12)),
        ),
        TextField(
          controller: _url,
          decoration: const InputDecoration(
            labelText: 'Servidor *',
            hintText: 'ldaps://ad.empresa.com.br:636',
            helperText: 'ldaps:// (porta 636) protege a senha no caminho; ldap:// só com STARTTLS',
            helperMaxLines: 2,
          ),
        ),
        FormGrid(
          children: [
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              value: _startTls,
              onChanged: (v) => setState(() => _startTls = v),
              title: const Text('STARTTLS'),
              subtitle: const Text('Cifra uma conexão ldap://'),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              value: _insecure,
              onChanged: (v) => setState(() => _insecure = v),
              title: const Text('Aceitar certificado próprio'),
              subtitle: const Text('Só para servidor interno sem certificado público'),
            ),
          ],
        ),
        TextField(
          controller: _baseDn,
          decoration: const InputDecoration(labelText: 'Base de busca (Base DN) *', hintText: 'OU=Usuarios,DC=empresa,DC=com,DC=br'),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _filter,
          decoration: const InputDecoration(labelText: 'Filtro do usuário *', helperText: '{email} = e-mail digitado no login; {login} = parte antes do @'),
        ),
        const SizedBox(height: 6),
        Wrap(
          spacing: 6,
          children: [
            for (final (l, v, h) in _presets)
              Tooltip(
                message: h,
                child: ActionChip(label: Text(l), onPressed: () => setState(() => _filter.text = v)),
              ),
          ],
        ),
        const SizedBox(height: 12),
        FormGrid(
          children: [
            TextField(
              controller: _bindDn,
              decoration: const InputDecoration(
                labelText: 'Conta de serviço (Bind DN)',
                hintText: 'CN=superponto,OU=Servicos,DC=empresa…',
                helperText: 'Só leitura no diretório; vazio = busca anônima',
              ),
            ),
            TextField(
              controller: _bindPw,
              obscureText: true,
              decoration: InputDecoration(
                labelText: 'Senha da conta de serviço',
                hintText: c['hasBindPassword'] == true ? '•••••••• (guardada)' : null,
                helperText: c['hasBindPassword'] == true ? 'Guardada cifrada; deixe vazio para manter' : 'Guardada cifrada no banco',
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _timeout,
          inputFormatters: digitsOnly(6),
          decoration: const InputDecoration(labelText: 'Tempo limite (ms)'),
        ),
        const SizedBox(height: 16),
        Align(
          alignment: Alignment.centerRight,
          child: GlassButton(
            label: 'Salvar configuração',
            loading: _busy,
            onPressed: () async {
              if (_url.text.trim().isEmpty || _baseDn.text.trim().isEmpty || _filter.text.trim().isEmpty) return toast(context, 'Preencha servidor, base de busca e filtro', error: true);
              setState(() => _busy = true);
              final ok = await act(
                context,
                () => api.put('/ldap-config', {
                  'enabled': _enabled,
                  'url': _url.text.trim(),
                  'startTls': _startTls,
                  'allowInsecureTls': _insecure,
                  'bindDn': _bindDn.text.trim().isEmpty ? null : _bindDn.text.trim(),
                  if (_bindPw.text.isNotEmpty) 'bindPassword': _bindPw.text,
                  'baseDn': _baseDn.text.trim(),
                  'userFilter': _filter.text.trim(),
                  'timeoutMs': int.tryParse(_timeout.text) ?? 5000,
                }),
                success: 'Configuração salva',
              );
              if (!mounted) return;
              setState(() => _busy = false);
              if (ok) widget.onSaved();
            },
          ),
        ),
      ],
    );
  }
}

class _Tester extends StatefulWidget {
  const _Tester();
  @override
  State<_Tester> createState() => _TesterState();
}

class _TesterState extends State<_Tester> {
  final _email = TextEditingController(), _pw = TextEditingController();
  Map<String, dynamic>? _result;
  bool _busy = false;
  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: _email,
          keyboardType: TextInputType.emailAddress,
          decoration: const InputDecoration(labelText: 'E-mail de um usuário da rede'),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _pw,
          obscureText: true,
          decoration: const InputDecoration(labelText: 'Senha (opcional)', helperText: 'Sem senha: só confere se o usuário é encontrado. A senha não é guardada.', helperMaxLines: 2),
        ),
        const SizedBox(height: 12),
        Align(
          alignment: Alignment.centerLeft,
          child: GlassButton(
            label: 'Testar',
            icon: Icons.power_rounded,
            kind: BtnKind.glass,
            loading: _busy,
            onPressed: () async {
              if (_email.text.trim().isEmpty) return;
              setState(() => _busy = true);
              try {
                final r = asMap(await api.post('/ldap-config/test', {'email': _email.text.trim(), if (_pw.text.isNotEmpty) 'password': _pw.text}));
                setState(() => _result = r);
              } catch (e) {
                setState(() => _result = {'ok': false, 'message': '$e'});
              } finally {
                _pw.clear();
                if (mounted) setState(() => _busy = false);
              }
            },
          ),
        ),
        if (_result != null)
          Glass(
            margin: const EdgeInsets.only(top: 12),
            tint: _result!['ok'] == true ? t.success : t.danger,
            padding: const EdgeInsets.all(12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(_result!['ok'] == true ? Icons.check_circle_rounded : Icons.warning_rounded, color: _result!['ok'] == true ? t.success : t.danger),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('${_result!['message']}'),
                      if (_result!['dn'] != null) SelectableText('${_result!['dn']}', style: TextStyle(color: t.subtle, fontSize: 12)),
                    ],
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}
