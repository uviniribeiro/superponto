// Usuários (quem acessa e com qual perfil) e perfis com permissões por recurso.
import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/glass.dart';
import '../core/schedules.dart' show validHm, weekdayNames;
import '../core/tokens.dart';
import '../widgets/masked.dart';
import '../widgets/ui.dart';

String _initials(String n) => n.split(RegExp(r'\s+')).where((p) => p.isNotEmpty).take(2).map((p) => p[0].toUpperCase()).join();

class UsersPage extends StatefulWidget {
  const UsersPage({super.key});
  @override
  State<UsersPage> createState() => _UsersPageState();
}

class _UsersPageState extends State<UsersPage> {
  String _q = '';
  int _token = 0;

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final canManage = api.can('admin.users:manage');
    return PageScaffold(
      title: 'Usuários',
      subtitle: 'Quem acessa o sistema e com qual perfil.',
      icon: Icons.people_alt_rounded,
      actions: [if (canManage) GlassButton(label: 'Novo usuário', icon: Icons.person_add_rounded, onPressed: () => _edit(null))],
      children: [
        SearchField(hint: 'Buscar por nome ou e-mail…', onChanged: (v) => setState(() => _q = v)),
        const SizedBox(height: 14),
        Async<Map<String, dynamic>>(
          reloadToken: '$_q|$_token',
          load: () => api.getMap('/users', {'pageSize': 200, 'search': _q}),
          builder: (context, page, _) {
            final rows = asList(page['data']);
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text('${page['total'] ?? rows.length} usuário(s)', style: TextStyle(color: t.muted)),
                ),
                GlassTable<Map<String, dynamic>>(
                  rows: rows,
                  empty: EmptyState(icon: Icons.people_alt_rounded, title: _q.isEmpty ? 'Nenhum usuário' : 'Nada encontrado'),
                  onTap: canManage ? (u) => u['editable'] == true ? _edit(u) : toast(context, 'O usuário de suporte não pode ser editado', error: true) : null,
                  columns: [
                    Col(
                      'Usuário',
                      (u) => Row(
                        children: [
                          CircleAvatar(
                            radius: 17,
                            backgroundColor: t.brand.withValues(alpha: 0.18),
                            child: u['isSupport'] == true
                                ? Icon(Icons.lock_rounded, size: 16, color: t.brand)
                                : Text(
                                    _initials('${u['displayName']}'),
                                    style: TextStyle(color: t.brand, fontWeight: FontWeight.w700, fontSize: 12),
                                  ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  '${u['displayName']}${u['isSelf'] == true ? ' (você)' : ''}',
                                  style: const TextStyle(fontWeight: FontWeight.w600),
                                  overflow: TextOverflow.ellipsis,
                                ),
                                Text(
                                  '${u['email']}',
                                  style: TextStyle(color: t.subtle, fontSize: 12),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      flex: 4,
                      primary: true,
                    ),
                    Col('Situação', (u) {
                      final b = u['activeBlock'] == null ? null : asMap(u['activeBlock']);
                      final days = (u['accessWeekdays'] as List? ?? const []);
                      return txt(
                        '${b != null
                            ? 'Bloqueado: ${b['reason']}'
                            : u['isActive'] == true
                            ? (u['lastLoginAt'] != null ? 'Último acesso ${brDateTime(u['lastLoginAt'])}' : 'Nunca entrou')
                            : 'Acesso desativado'}${days.isNotEmpty ? ' · ${days.map((d) => weekdayNames[(d as num).toInt()]).join(', ')}' : ''}',
                        muted: true,
                      );
                    }, flex: 3),
                    Col(
                      'Perfis',
                      (u) => Wrap(
                        spacing: 4,
                        runSpacing: 4,
                        children: [
                          if (u['isSupport'] == true) Pill('Suporte e treinamento', color: t.info),
                          if (u['authSource'] == 'LDAP') Pill('LDAP', color: t.warning),
                          for (final r in asList(u['roles'])) Pill('${r['name']}', color: t.brand),
                        ],
                      ),
                      flex: 3,
                    ),
                  ],
                  actions: canManage
                      ? (u) => u['editable'] != true
                            ? [
                                Tooltip(
                                  message: 'O usuário de suporte não pode ser editado',
                                  child: Icon(Icons.lock_rounded, size: 18, color: t.subtle),
                                ),
                              ]
                            : [
                                if (u['lastLoginAt'] == null)
                                  RowAction(Icons.mail_rounded, 'Reenviar convite', () => act(context, () => api.post('/users/${u['id']}/invite'), success: 'Convite reenviado por e-mail')),
                                if (u['isSelf'] != true)
                                  RowAction(Icons.delete_outline_rounded, 'Excluir', () async {
                                    if (!await confirm(
                                          context,
                                          title: 'Excluir usuário?',
                                          body: '${u['displayName']} perde o acesso imediatamente. O histórico fica na auditoria.',
                                          confirmLabel: 'Excluir',
                                        ) ||
                                        !context.mounted) {
                                      return;
                                    }
                                    if (await act(context, () => api.delete('/users/${u['id']}'), success: 'Usuário excluído') && mounted) setState(() => _token++);
                                  }, danger: true),
                              ]
                      : null,
                ),
              ],
            );
          },
        ),
      ],
    );
  }

  Future<void> _edit(Map<String, dynamic>? u) async {
    final roles = await run(context, () => api.getList('/roles'));
    if (roles == null || !mounted) return;
    final ok = await showGlassDialog<bool>(
      context,
      title: u == null ? 'Novo usuário' : 'Editar usuário',
      width: 640,
      builder: (_) => _UserForm(user: u, roles: roles),
    );
    if (ok == true && mounted) setState(() => _token++);
  }
}

class _UserForm extends StatefulWidget {
  const _UserForm({this.user, required this.roles});
  final Map<String, dynamic>? user;
  final List<Map<String, dynamic>> roles;
  @override
  State<_UserForm> createState() => _UserFormState();
}

class _UserFormState extends State<_UserForm> {
  Map<String, dynamic>? get u => widget.user;
  bool get self => u?['isSelf'] == true;
  late final _name = TextEditingController(text: u?['displayName'] as String?), _email = TextEditingController(text: u?['email'] as String?);
  late bool _active = u?['isActive'] as bool? ?? true, _mustChange = u?['mustChangePassword'] == true;
  late final List<String> _roles = [for (final r in asList(u?['roles'])) r['id'] as String];
  late final List<int> _days = [for (final d in (u?['accessWeekdays'] as List? ?? const [])) (d as num).toInt()];
  late String _source = '${u?['authSource'] ?? 'LOCAL'}';
  late ({String id, String name})? _person = u?['personId'] == null ? null : (id: u!['personId'] as String, name: '${asMap(u!['person'])['fullName'] ?? 'Funcionário'}');
  String _q = '';
  bool _busy = false;

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final ldap = _source == 'LDAP';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: _name,
          decoration: const InputDecoration(labelText: 'Nome *'),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _email,
          enabled: u == null,
          keyboardType: TextInputType.emailAddress,
          decoration: InputDecoration(
            labelText: 'E-mail *',
            helperText: u != null
                ? 'O e-mail é o login e não pode ser trocado'
                : ldap
                ? 'O e-mail precisa ser o mesmo do diretório da organização'
                : 'O usuário recebe um convite para criar a própria senha',
          ),
        ),
        if (!self) ...[
          const SizedBox(height: 14),
          const FieldLabel('Forma de login'),
          GlassTabs(tabs: const ['Senha do SuperPonto', 'Rede da organização (LDAP)'], index: ldap ? 1 : 0, onChanged: (i) => setState(() => _source = i == 1 ? 'LDAP' : 'LOCAL')),
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(
              ldap
                  ? 'A senha é conferida no Active Directory/LDAP configurado em "Login pela rede".'
                  : u?['authSource'] == 'LDAP'
                  ? 'Ao salvar, o usuário recebe um convite para criar uma senha própria.'
                  : 'O usuário cria a própria senha pelo convite enviado por e-mail.',
              style: TextStyle(color: t.subtle, fontSize: 12.5),
            ),
          ),
        ],
        if (u != null && !self) SwitchListTile(contentPadding: EdgeInsets.zero, value: _active, onChanged: (v) => setState(() => _active = v), title: const Text('Acesso ativo')),
        const SizedBox(height: 10),
        const FieldLabel('Perfis de acesso'),
        for (final r in widget.roles)
          CheckboxListTile(
            dense: true,
            contentPadding: EdgeInsets.zero,
            value: _roles.contains(r['id']),
            onChanged: (v) => setState(() => v == true ? _roles.add(r['id'] as String) : _roles.remove(r['id'])),
            title: Row(
              children: [
                Flexible(child: Text('${r['name']}')),
                if (r['isSystem'] != true) ...[const SizedBox(width: 6), Pill('personalizado', color: t.info)],
              ],
            ),
            subtitle: r['description'] == null ? null : Text('${r['description']}', style: TextStyle(color: t.subtle, fontSize: 12)),
          ),
        if (u != null) ...[
          const SizedBox(height: 10),
          const FieldLabel('Funcionário ligado'),
          if (_person != null)
            Row(
              children: [
                Expanded(child: Text(_person!.name)),
                TextButton(onPressed: () => setState(() => _person = null), child: const Text('Desligar')),
              ],
            )
          else ...[
            SearchField(hint: 'Buscar funcionário por nome, matrícula ou CPF…', width: 600, onChanged: (v) => setState(() => _q = v)),
            if (_q.length > 1)
              Async<List<Map<String, dynamic>>>(
                reloadToken: _q,
                load: () => api.getList('/employees', {'pageSize': 8, 'search': _q}),
                builder: (context, list, _) => Column(
                  children: [
                    for (final e in list)
                      ListTile(
                        dense: true,
                        title: Text('${e['socialName'] ?? e['fullName']} · ${e['registration']}'),
                        onTap: () => setState(() {
                          _person = (id: e['personId'] as String, name: '${e['socialName'] ?? e['fullName']} · ${e['registration']}');
                          _q = '';
                        }),
                      ),
                  ],
                ),
              ),
          ],
          Text('Com o vínculo, o usuário marca ponto pelo navegador, vê o próprio espelho e abre solicitações.', style: TextStyle(color: t.subtle, fontSize: 12.5)),
        ],
        if (!self) ...[
          const SizedBox(height: 14),
          const FieldLabel('Dias com acesso'),
          Wrap(
            spacing: 6,
            children: [
              for (var i = 0; i < 7; i++)
                FilterChip(
                  label: Text(weekdayNames[i]),
                  selected: _days.contains(i),
                  onSelected: (v) => setState(() {
                    v ? _days.add(i) : _days.remove(i);
                    _days.sort();
                  }),
                ),
            ],
          ),
          Text(_days.isNotEmpty ? 'Fora desses dias o login é recusado (horário de Brasília).' : 'Nenhum dia marcado: acesso todos os dias.', style: TextStyle(color: t.subtle, fontSize: 12.5)),
        ],
        if (!self && !ldap)
          SwitchListTile(contentPadding: EdgeInsets.zero, value: _mustChange, onChanged: (v) => setState(() => _mustChange = v), title: const Text('Pedir troca de senha no próximo acesso')),
        const SizedBox(height: 16),
        Align(
          alignment: Alignment.centerRight,
          child: GlassButton(
            label: u != null ? 'Salvar alterações' : 'Criar usuário',
            loading: _busy,
            onPressed: () async {
              if (_name.text.trim().length < 2) return toast(context, 'Informe o nome', error: true);
              if (u == null && !RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(_email.text.trim())) return toast(context, 'E-mail inválido', error: true);
              if (_roles.isEmpty) return toast(context, 'Escolha ao menos um perfil', error: true);
              setState(() => _busy = true);
              final ok = await act(
                context,
                () => u != null
                    ? api.patch('/users/${u!['id']}', {
                        'displayName': _name.text.trim(),
                        'isActive': _active,
                        'roleIds': _roles,
                        'accessWeekdays': _days,
                        'mustChangePassword': ldap ? false : _mustChange,
                        'personId': _person?.id,
                        if (!self) 'authSource': _source,
                      })
                    : api.post('/users', {
                        'displayName': _name.text.trim(),
                        'email': _email.text.trim(),
                        'roleIds': _roles,
                        'accessWeekdays': _days,
                        'mustChangePassword': ldap ? false : _mustChange,
                        'authSource': _source,
                      }),
                success: u != null
                    ? 'Usuário atualizado'
                    : ldap
                    ? 'Usuário criado: ele entra com a senha da rede da organização'
                    : 'Usuário criado: o convite para definir a senha foi enviado por e-mail',
              );
              if (!mounted) return;
              setState(() => _busy = false);
              if (ok) Navigator.pop(this.context, true);
            },
          ),
        ),
        if (u != null && !self) ...[const SizedBox(height: 20), _Blocks(user: u!)],
      ],
    );
  }
}

class _Blocks extends StatefulWidget {
  const _Blocks({required this.user});
  final Map<String, dynamic> user;
  @override
  State<_Blocks> createState() => _BlocksState();
}

class _BlocksState extends State<_Blocks> {
  late final List<Map<String, dynamic>> _blocks = [...asList(widget.user['accessBlocks'])];
  final _reason = TextEditingController();
  String _sDate = todayIso(), _sTime = '${two(toBr(DateTime.now()).hour)}:${two(toBr(DateTime.now()).minute)}', _eTime = '23:59';
  String? _eDate;

  String _iso(String d, String tm) => DateTime.parse('${d}T$tm:00-03:00').toUtc().toIso8601String();

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    return Glass(
      radius: SpTokens.radiusSm,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SectionTitle('Bloqueio de acesso'),
          for (final b in _blocks)
            Row(
              children: [
                Expanded(child: Text('${b['reason']} · ${brDateTime(b['startsAt'])} até ${b['endsAt'] == null ? 'indeterminado' : brDateTime(b['endsAt'])}')),
                TextButton(
                  onPressed: () async {
                    if (await act(context, () => api.delete('/users/${widget.user['id']}/blocks/${b['id']}'), success: 'Bloqueio encerrado')) setState(() => _blocks.remove(b));
                  },
                  child: const Text('Encerrar'),
                ),
              ],
            ),
          FormGrid(
            children: [
              DateField(label: 'Início', value: _sDate, onChanged: (v) => setState(() => _sDate = v ?? _sDate)),
              TextFormField(
                initialValue: _sTime,
                inputFormatters: [MaskFormatter(maskTime)],
                decoration: const InputDecoration(labelText: 'Hora'),
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
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _reason,
                  onChanged: (_) => setState(() {}),
                  decoration: const InputDecoration(hintText: 'Motivo (ex.: férias, afastamento)'),
                ),
              ),
              const SizedBox(width: 8),
              GlassButton(
                label: 'Bloquear',
                kind: BtnKind.danger,
                small: true,
                onPressed: _reason.text.trim().length < 3
                    ? null
                    : () async {
                        if (!validHm(_sTime) || (_eDate != null && !validHm(_eTime))) return toast(context, 'Horas no formato HH:MM', error: true);
                        try {
                          final b = asMap(
                            await api.post('/users/${widget.user['id']}/blocks', {
                              'reason': _reason.text.trim(),
                              'startsAt': _iso(_sDate, _sTime),
                              if (_eDate != null) 'endsAt': _iso(_eDate!, _eTime),
                            }),
                          );
                          if (!mounted) return;
                          setState(() {
                            _blocks.insert(0, b);
                            _reason.clear();
                          });
                          toast(this.context, 'Bloqueio registrado: as sessões do usuário são encerradas enquanto valer');
                        } catch (e) {
                          if (mounted) toast(this.context, '$e', error: true);
                        }
                      },
              ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text('Horários de Brasília.', style: TextStyle(color: t.subtle, fontSize: 12)),
          ),
        ],
      ),
    );
  }
}

// ───────────── Perfis e permissões ─────────────
class RolesPage extends StatefulWidget {
  const RolesPage({super.key});
  @override
  State<RolesPage> createState() => _RolesPageState();
}

class _RolesPageState extends State<RolesPage> {
  int _token = 0;
  Map<String, dynamic>? _draft;
  Set<String> _perms = {};
  final _name = TextEditingController(), _desc = TextEditingController();
  bool _busy = false;

  void _select(Map<String, dynamic> r) => setState(() {
    _draft = r;
    _perms = {for (final p in r['permissions'] as List? ?? const []) '$p'};
    _name.text = '${r['name'] ?? ''}';
    _desc.text = '${r['description'] ?? ''}';
  });

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final canManage = api.can('admin.roles:manage');
    return PageScaffold(
      title: 'Perfis e permissões',
      subtitle: 'Cada recurso do sistema tem permissões separadas (ver, criar, editar, excluir, aprovar…). Monte perfis sob medida.',
      icon: Icons.key_rounded,
      actions: [
        if (canManage)
          GlassButton(
            label: 'Novo perfil',
            icon: Icons.add_rounded,
            onPressed: () => _select({'id': null, 'name': '', 'description': '', 'permissions': <String>[], 'editable': true, 'isSystem': false}),
          ),
      ],
      children: [
        Async<(List<Map<String, dynamic>>, List<Map<String, dynamic>>)>(
          reloadToken: _token,
          load: () async => (await api.getList('/roles'), await api.getList('/permissions')),
          builder: (context, data, _) {
            final (roles, catalog) = data;
            if (_draft == null && roles.isNotEmpty) {
              final first = roles.where((r) => r['key'] == 'company_admin').firstOrNull ?? roles.first;
              WidgetsBinding.instance.addPostFrameCallback((_) => mounted && _draft == null ? _select(first) : null);
              return const Loading();
            }
            final d = _draft!;
            final readOnly = d['editable'] != true || !canManage;
            final total = catalog.fold<int>(0, (n, m) => n + asList(m['resources']).fold<int>(0, (k, r) => k + asList(r['actions']).length));
            final list = Glass(
              padding: const EdgeInsets.all(10),
              child: Column(
                children: [
                  for (final r in roles)
                    ListTile(
                      dense: true,
                      selected: d['id'] == r['id'],
                      selectedTileColor: t.brand.withValues(alpha: 0.12),
                      selectedColor: t.brand,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      title: Text('${r['name']}'),
                      leading: Icon(r['isSystem'] == true ? Icons.lock_rounded : Icons.tune_rounded, size: 18),
                      trailing: Pill('${r['users'] ?? 0}'),
                      onTap: () => _select(r),
                    ),
                ],
              ),
            );
            final editor = Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Glass(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      FormGrid(
                        children: [
                          TextField(
                            controller: _name,
                            enabled: !readOnly,
                            onChanged: (_) => setState(() {}),
                            decoration: const InputDecoration(labelText: 'Nome do perfil', hintText: 'Ex.: Recepção'),
                          ),
                          TextField(
                            controller: _desc,
                            enabled: !readOnly,
                            decoration: const InputDecoration(labelText: 'Descrição'),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          Text('${_perms.length} de $total permissões', style: TextStyle(color: t.muted)),
                          if (d['isSystem'] == true && canManage)
                            GlassButton(
                              label: 'Criar perfil a partir deste',
                              icon: Icons.copy_rounded,
                              small: true,
                              kind: BtnKind.glass,
                              onPressed: () => setState(() {
                                _draft = {...d, 'id': null, 'editable': true, 'isSystem': false};
                                _name.text = '${d['name']} (cópia)';
                              }),
                            ),
                          if (!readOnly && d['id'] != null)
                            GlassButton(
                              label: 'Excluir',
                              icon: Icons.delete_outline_rounded,
                              small: true,
                              kind: BtnKind.danger,
                              onPressed: () async {
                                if (!await confirm(context, title: 'Excluir perfil?', body: 'Só é possível excluir perfis sem usuários.', confirmLabel: 'Excluir') || !context.mounted) return;
                                if (await act(context, () => api.delete('/roles/${d['id']}'), success: 'Perfil excluído') && mounted) {
                                  setState(() {
                                    _draft = null;
                                    _token++;
                                  });
                                }
                              },
                            ),
                          if (!readOnly)
                            GlassButton(
                              label: d['id'] != null ? 'Salvar perfil' : 'Criar perfil',
                              icon: Icons.save_rounded,
                              small: true,
                              loading: _busy,
                              onPressed: _name.text.trim().length < 2 || _perms.isEmpty
                                  ? null
                                  : () async {
                                      setState(() => _busy = true);
                                      try {
                                        final body = {'name': _name.text.trim(), if (_desc.text.trim().isNotEmpty) 'description': _desc.text.trim(), 'permissions': _perms.toList()};
                                        final r = d['id'] != null ? await api.patch('/roles/${d['id']}', body) : await api.post('/roles', body);
                                        if (!mounted) return;
                                        toast(this.context, d['id'] != null ? 'Perfil salvo: vale a partir do próximo acesso de cada usuário' : 'Perfil criado');
                                        final id = asMap(r)['id'] ?? d['id'];
                                        setState(() {
                                          _draft = {...d, 'id': id, 'name': _name.text.trim(), 'permissions': _perms.toList()};
                                          _token++;
                                        });
                                      } catch (e) {
                                        if (mounted) toast(this.context, '$e', error: true);
                                      } finally {
                                        if (mounted) setState(() => _busy = false);
                                      }
                                    },
                            ),
                        ],
                      ),
                      if (d['isSystem'] == true)
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text('Perfil do sistema: não pode ser alterado. Use "Criar perfil a partir deste" para personalizar.', style: TextStyle(color: t.subtle, fontSize: 12.5)),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                for (final m in catalog)
                  Builder(
                    builder: (_) {
                      final all = [
                        for (final r in asList(m['resources']))
                          for (final a in asList(r['actions'])) '${a['permission']}',
                      ];
                      final on = all.where(_perms.contains).length;
                      return Glass(
                        margin: const EdgeInsets.only(bottom: 12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            SectionTitle(
                              '${m['label']}  $on/${all.length}',
                              trailing: readOnly
                                  ? null
                                  : TextButton(
                                      onPressed: () => setState(() => on < all.length ? _perms.addAll(all) : _perms.removeAll(all)),
                                      child: Text(on < all.length ? 'Marcar tudo' : 'Desmarcar tudo'),
                                    ),
                            ),
                            for (final r in asList(m['resources']))
                              Padding(
                                padding: const EdgeInsets.symmetric(vertical: 6),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text('${r['label']}', style: const TextStyle(fontWeight: FontWeight.w600)),
                                    if (r['available'] == false) Text('módulo em construção na V2', style: TextStyle(color: t.subtle, fontSize: 12)),
                                    Wrap(
                                      spacing: 6,
                                      runSpacing: 6,
                                      children: [
                                        for (final a in asList(r['actions']))
                                          Tooltip(
                                            message: '${a['description'] ?? ''}',
                                            child: FilterChip(
                                              label: Text('${a['label']}', style: const TextStyle(fontSize: 12.5)),
                                              selected: _perms.contains(a['permission']),
                                              selectedColor: t.brand.withValues(alpha: 0.2),
                                              checkmarkColor: t.brand,
                                              onSelected: readOnly ? null : (v) => setState(() => v ? _perms.add('${a['permission']}') : _perms.remove(a['permission'])),
                                            ),
                                          ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                          ],
                        ),
                      );
                    },
                  ),
              ],
            );
            return isWide(context)
                ? Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SizedBox(width: 280, child: list),
                      const SizedBox(width: 14),
                      Expanded(child: editor),
                    ],
                  )
                : Column(children: [list, const SizedBox(height: 14), editor]);
          },
        ),
      ],
    );
  }
}
