// /v1/users, /v1/roles, /v1/permissions, /v1/access-blocks: usuários do cliente, perfis e bloqueios.
// Regra do suporte: oculto da lista para os usuários do cliente; com o suporte logado, aparece, mas não é editável.
import '../app.dart';
import '../auth/auth_user.dart';
import '../auth/users.dart';
import '../db.dart';
import '../generated/catalog.dart';
import '../http.dart';
import '../limits.dart';
import '../validate.dart';

final _weekdays = const Arr(Num(int: true, min: 0, max: 6), max: 7).map((v) => ({...(v as List).cast<int>()}.toList()..sort()));
final _roleIds = const Arr(uuid, min: 1, max: 10, message: 'Escolha ao menos um perfil');

/// Login da v1 (usuário + CNPJ da empresa + senha): único dentro do cliente.
final _username = Str(trim: true, max: 60, pattern: RegExp(r'^[A-Za-z0-9][A-Za-z0-9._-]{1,59}$'), patternMessage: 'Usuário: 2 a 60 letras, números, ponto, hífen ou sublinhado, sem espaços')
    .map((v) => (v as String).toLowerCase());

final userCreate = Obj({
  'email': email,
  'username': _username.optional,
  'displayName': const Str(trim: true, min: 2, max: 200),
  'roleIds': _roleIds,
  'accessWeekdays': _weekdays.optional,
  'mustChangePassword': const Bool().optional,
  'authSource': const Enum(['LOCAL', 'LDAP']).optional,
});
final userUpdate = Obj({
  'username': _username.nullish,
  'displayName': const Str(trim: true, min: 2, max: 200).optional,
  'isActive': const Bool().optional,
  'roleIds': _roleIds.optional,
  'accessWeekdays': _weekdays.optional,
  'mustChangePassword': const Bool().optional,
  'authSource': const Enum(['LOCAL', 'LDAP']).optional,
  'personId': uuid.nullish,
});
final roleSchema = Obj({
  'name': const Str(trim: true, min: 2, max: 80),
  'description': const Str(trim: true, max: 300).optional,
  'permissions': Arr(Str(pattern: RegExp(r'^[a-z]+\.[a-z]+:[a-z]+$')), min: 1, max: 200, message: 'Escolha ao menos uma permissão'),
});
final blockSchema = Obj({'reason': const Str(trim: true, min: 3, max: 300, message: 'Informe o motivo'), 'startsAt': const DateTimeS(), 'endsAt': const DateTimeS().optional})
    .check((v) => v['endsAt'] == null || (v['endsAt']! as DateTime).isAfter(v['startsAt']! as DateTime), 'O fim do bloqueio deve ser depois do início', path: ['endsAt']);

/// Catálogo de permissões agrupado por módulo → recurso → ação.
List<Map<String, Object?>> permissionCatalog(bool includePlatform) {
  final modules = <String, Map<String, Object?>>{};
  for (final e in permissions.entries) {
    final parts = e.key.split(':');
    final resource = parts[0], action = parts[1];
    final mod = resource.split('.').first;
    if (mod == 'platform' && !includePlatform) continue;
    final m = modules.putIfAbsent(mod, () => {'key': mod, 'label': moduleLabels[mod] ?? mod, 'resources': <String, Map<String, Object?>>{}});
    final res = (m['resources']! as Map<String, Map<String, Object?>>).putIfAbsent(
      resource,
      () => {'key': resource, 'label': resourceLabels[resource] ?? resource, 'available': availableResources.contains(resource), 'actions': <Object?>[]},
    );
    (res['actions']! as List<Object?>).add({'permission': e.key, 'action': action, 'label': actionLabels[action] ?? action, 'description': e.value});
  }
  return [
    for (final m in modules.values) {...m, 'resources': (m['resources']! as Map<String, Map<String, Object?>>).values.toList()},
  ];
}

String _slug(String v) {
  const from = 'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ';
  const to = 'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN';
  final sb = StringBuffer();
  for (final ch in v.split('')) {
    final i = from.indexOf(ch);
    sb.write(i >= 0 ? to[i] : ch);
  }
  var s = sb.toString().toLowerCase().replaceAll(RegExp('[^a-z0-9]+'), '_').replaceAll(RegExp(r'^_+|_+$'), '');
  if (s.length > 50) s = s.substring(0, 50);
  return s.isEmpty ? 'perfil' : s;
}

const _userCols =
    'u.id, u.email, u.username, u.display_name, u.is_active, u.is_support, u.last_login_at, u.created_at, u.access_weekdays, '
    'u.must_change_password, u.auth_source::text AS auth_source, u.person_id';

class UsersModule {
  UsersModule(this.app);
  final App app;
  Db get db => app.db;

  /// Usuário com pessoa, bloqueios vigentes e perfis (mesmo formato da API em Node).
  Future<void> _uniqueUsername(Tx tx, String tenantId, String username, [String? exceptId]) async {
    final other = await tx.one('SELECT id FROM users WHERE tenant_id = @t AND username = @u AND (@x::uuid IS NULL OR id <> @x::uuid)', {'t': tenantId, 'u': username, 'x': exceptId});
    if (other != null) throw conflict('Este usuário já existe neste cliente');
  }

  Future<List<Row>> _load(Tx tx, String where, Map<String, Object?> p, {String order = '', String limit = ''}) async {
    final users = await tx.query('SELECT $_userCols, pe.full_name AS person_full_name FROM users u LEFT JOIN people pe ON pe.id = u.person_id WHERE $where $order $limit', p);
    if (users.isEmpty) return users;
    final ids = [for (final u in users) u['id']! as String];
    final blocks = await tx.query(
      'SELECT * FROM (SELECT id, user_id, reason, starts_at, ends_at, row_number() OVER (PARTITION BY user_id ORDER BY starts_at DESC) AS n '
      'FROM user_access_blocks WHERE revoked_at IS NULL AND user_id::text = ANY(@ids)) b WHERE n <= 20 ORDER BY starts_at DESC',
      {'ids': ids},
    );
    final roles = await tx.query('SELECT ur.user_id, r.id, r.key, r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id::text = ANY(@ids) ORDER BY ur.created_at', {'ids': ids});
    return [
      for (final u in users)
        {
          for (final e in u.entries)
            if (e.key != 'personFullName') e.key: e.value,
          'person': u['personFullName'] == null ? null : {'fullName': u['personFullName']},
          'accessBlocks': [
            for (final b in blocks)
              if (b['userId'] == u['id']) {'id': b['id'], 'reason': b['reason'], 'startsAt': b['startsAt'], 'endsAt': b['endsAt']},
          ],
          'roles': [
            for (final r in roles)
              if (r['userId'] == u['id'])
                {
                  'role': {'id': r['id'], 'key': r['key'], 'name': r['name']},
                },
          ],
        },
    ];
  }

  Map<String, Object?> _shape(Row u, AuthUser viewer) {
    final now = DateTime.now();
    final blocks = [
      for (final b in u['accessBlocks']! as List)
        if ((b as Map)['endsAt'] == null || (b['endsAt'] as DateTime).isAfter(now)) b,
    ];
    final active = blocks.cast<Map<Object?, Object?>>().where((b) => !(b['startsAt']! as DateTime).isAfter(now)).firstOrNull;
    return {
      ...u,
      'accessBlocks': blocks,
      'activeBlock': active,
      'roles': [for (final r in u['roles']! as List) (r as Map)['role']],
      'editable': u['isSupport'] != true,
      'isSelf': u['id'] == viewer.id,
    };
  }

  Future<Row> _editable(Tx tx, String tenantId, AuthUser viewer, String id) async {
    final rows = await _load(tx, 'u.id = @id AND u.tenant_id = @t AND u.deleted_at IS NULL AND NOT u.is_platform_admin', {'id': id, 't': tenantId});
    final u = rows.firstOrNull;
    if (u == null || (u['isSupport'] == true && !viewer.isSupport)) throw notFound('Usuário não encontrado');
    if (u['isSupport'] == true) throw forbidden('O usuário de suporte não pode ser editado');
    return u;
  }

  Future<void> _requireLdap(Tx tx, String tenantId) async {
    if ((await tx.scalar<int>('SELECT count(*)::int FROM tenant_ldap_configs WHERE tenant_id = @t AND enabled', {'t': tenantId}) ?? 0) == 0) {
      throw badRequest('Ative o login por LDAP da organização antes de criar usuários LDAP');
    }
  }

  Future<List<String>> _assignableRoles(Tx tx, String tenantId, List<String> roleIds) async {
    final rows = await tx.query("SELECT id FROM roles WHERE id::text = ANY(@ids) AND deleted_at IS NULL AND (tenant_id = @t OR (tenant_id IS NULL AND is_system)) AND key <> 'super_admin'", {
      'ids': roleIds,
      't': tenantId,
    });
    if (rows.length != roleIds.toSet().length) throw badRequest('Perfil inválido');
    return [for (final r in rows) r['id']! as String];
  }

  Future<void> _setRoles(Tx tx, String userId, String tenantId, List<String> roleIds) async {
    for (final roleId in roleIds) {
      await tx.insert('user_roles', {'userId': userId, 'roleId': roleId, 'tenantId': tenantId, 'scope': 'TENANT'}, updatedAt: false);
    }
  }

  void routes() {
    final r = app.router;
    r.group('/v1', tag: 'administração', () {
      r.get('/users', permission: 'admin.users:read', (ctx) {
        final q = pageSchema.parse(ctx.query);
        final viewer = ctx.user, tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          final p = <String, Object?>{'t': tenantId};
          var where = 'u.tenant_id = @t AND u.deleted_at IS NULL AND NOT u.is_platform_admin${viewer.isSupport ? '' : ' AND NOT u.is_support'}';
          final s = q['search'] as String?;
          if (s != null && s.isNotEmpty) {
            where += ' AND (u.display_name ILIKE @s OR u.email ILIKE @s)';
            p['s'] = likePattern(s);
          }
          final page = q['page']! as int, size = q['pageSize']! as int;
          final rows = await _load(tx, where, p, order: 'ORDER BY u.is_support DESC, u.display_name ASC', limit: 'LIMIT $size OFFSET ${(page - 1) * size}');
          final total = await tx.scalar<int>('SELECT count(*)::int FROM users u WHERE $where', p);
          return {
            'data': [for (final u in rows) _shape(u, viewer)],
            'page': page,
            'pageSize': size,
            'total': total,
          };
        });
      });

      r.post('/users', permission: 'admin.users:manage', (ctx) async {
        final input = userCreate.parse(ctx.body);
        final actor = ctx.user, tenantId = ctx.tenant;
        final mail = normalizeEmail(input['email']! as String);
        // E-mail é único na plataforma inteira (sem revelar de qual cliente é a conta).
        if ((await db.asPlatform((tx) => tx.scalar<int>('SELECT count(*)::int FROM users WHERE email = @e', {'e': mail})) ?? 0) > 0) {
          throw conflict('Este e-mail já tem uma conta no SuperPonto');
        }
        final ldap = input['authSource'] == 'LDAP';
        final result = await db.forTenant(tenantId, (tx) async {
          final roleIds = await _assignableRoles(tx, tenantId, (input['roleIds']! as List).cast<String>());
          await assertLimit(tx, tenantId, 'limit.users');
          if (ldap) await _requireLdap(tx, tenantId);
          if (input['username'] != null) await _uniqueUsername(tx, tenantId, input['username']! as String);
          final user = await tx.insert('users', {
            'tenantId': tenantId,
            'email': mail,
            'username': input['username'],
            'displayName': input['displayName'],
            'accessWeekdays': (input['accessWeekdays'] as List?)?.cast<int>() ?? <int>[],
            'mustChangePassword': ldap ? false : (input['mustChangePassword'] ?? false),
            'authSource': ldap ? 'LDAP' : 'LOCAL',
          });
          await _setRoles(tx, user['id']! as String, tenantId, roleIds);
          final saved = (await _load(tx, 'u.id = @id', {'id': user['id']})).first;
          await app.audit.record(
            tx,
            tenantId: tenantId,
            actorUserId: actor.id,
            action: 'CREATE',
            entity: 'user',
            entityId: user['id'] as String?,
            after: {'email': mail, 'displayName': input['displayName'], 'roleIds': roleIds},
            meta: ctx.meta,
          );
          return _shape(saved, actor);
        });
        if (!ldap) app.passwordReset.request(mail); // convite: o usuário define a própria senha
        return result;
      });

      r.patch('/users/:id', permission: 'admin.users:manage', (ctx) async {
        final id = ctx.uuidParam('id');
        final input = userUpdate.parse(ctx.body);
        final actor = ctx.user, tenantId = ctx.tenant;
        String? invite;
        final result = await db.forTenant(tenantId, (tx) async {
          final before = await _editable(tx, tenantId, actor, id);
          if (id == actor.id && input['isActive'] == false) throw badRequest('Você não pode desativar o próprio usuário');
          if (input['roleIds'] != null) {
            final roleIds = await _assignableRoles(tx, tenantId, (input['roleIds']! as List).cast<String>());
            await tx.execute('DELETE FROM user_roles WHERE user_id = @u AND tenant_id = @t', {'u': id, 't': tenantId});
            await _setRoles(tx, id, tenantId, roleIds);
          }
          final days = (input['accessWeekdays'] as List?)?.cast<int>();
          if (id == actor.id && (days?.isNotEmpty ?? false)) throw badRequest('Você não pode limitar os dias do próprio acesso');
          final toLdap = input['authSource'] == 'LDAP' && before['authSource'] != 'LDAP';
          final toLocal = input['authSource'] == 'LOCAL' && before['authSource'] == 'LDAP';
          if (toLdap) {
            if (id == actor.id) throw badRequest('Você não pode mudar a forma de login do próprio usuário');
            await _requireLdap(tx, tenantId);
          }
          final personId = input['personId'] as String?;
          if (personId != null) {
            if (await tx.one('SELECT 1 FROM people WHERE id = @p', {'p': personId}) == null) throw notFound('Funcionário não encontrado');
            if (await tx.one('SELECT 1 FROM users WHERE person_id = @p AND id <> @id', {'p': personId, 'id': id}) != null) {
              throw conflict('Este funcionário já está ligado a outro usuário');
            }
          }
          if (input['username'] != null) await _uniqueUsername(tx, tenantId, input['username']! as String, id);
          final data = <String, Object?>{
            if (input.containsKey('username')) 'username': input['username'],
            if (input.containsKey('personId')) 'personId': personId,
            if (input['displayName'] != null) 'displayName': input['displayName'],
            if (input['isActive'] != null) 'isActive': input['isActive'],
            'accessWeekdays': ?days,
          };
          if (toLdap || (before['authSource'] == 'LDAP' && !toLocal)) {
            data['mustChangePassword'] = false;
          } else if (input['mustChangePassword'] != null) {
            data['mustChangePassword'] = input['mustChangePassword'];
          }
          if (toLdap) {
            data['authSource'] = 'LDAP';
            data['passwordHash'] = null;
          } else if (toLocal) {
            data['authSource'] = 'LOCAL';
          }
          await tx.update('users', id, data);
          if (toLocal) invite = before['email'] as String?;
          final after = (await _load(tx, 'u.id = @id', {'id': id})).first;
          await app.audit.record(
            tx,
            tenantId: tenantId,
            actorUserId: actor.id,
            action: 'UPDATE',
            entity: 'user',
            entityId: id,
            before: _shape(before, actor),
            after: _shape(after, actor),
            meta: ctx.meta,
          );
          return _shape(after, actor);
        });
        // Depois do commit: o convite precisa enxergar a conta já como senha própria.
        if (invite != null) app.passwordReset.request(invite!);
        return result;
      });

      r.delete('/users/:id', permission: 'admin.users:manage', status: 204, (ctx) {
        final id = ctx.uuidParam('id');
        final actor = ctx.user, tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          final before = await _editable(tx, tenantId, actor, id);
          if (id == actor.id) throw badRequest('Você não pode excluir o próprio usuário');
          await tx.update('users', id, {'deletedAt': DateTime.now(), 'isActive': false});
          await app.audit.record(tx, tenantId: tenantId, actorUserId: actor.id, action: 'DELETE', entity: 'user', entityId: id, before: _shape(before, actor), meta: ctx.meta);
          return null;
        });
      });

      r.post('/users/:id/invite', permission: 'admin.users:manage', status: 202, (ctx) async {
        final id = ctx.uuidParam('id');
        final actor = ctx.user, tenantId = ctx.tenant;
        final u = await db.forTenant(tenantId, (tx) => _editable(tx, tenantId, actor, id));
        app.passwordReset.request(u['email']! as String);
        return null;
      });

      r.get('/access-blocks', permission: 'admin.users:read', (ctx) {
        final q = Obj({
          'includeEnded': const Enum(['true', 'false']).def('false'),
        }).parse(ctx.query);
        final viewer = ctx.user, tenantId = ctx.tenant;
        final includeEnded = q['includeEnded'] == 'true';
        return db.forTenant(tenantId, (tx) async {
          final now = DateTime.now();
          final rows = await tx.query(
            'SELECT b.*, u.id AS u_id, u.display_name AS u_display_name, u.email AS u_email FROM user_access_blocks b '
            'JOIN users u ON u.id = b.user_id WHERE u.tenant_id = @t AND u.deleted_at IS NULL${viewer.isSupport ? '' : ' AND NOT u.is_support'}'
            '${includeEnded ? '' : ' AND b.revoked_at IS NULL AND (b.ends_at IS NULL OR b.ends_at > @now)'} ORDER BY b.starts_at DESC LIMIT 500',
            {'t': tenantId, 'now': now},
          );
          return [
            for (final b in rows)
              {
                for (final e in b.entries)
                  if (!e.key.startsWith('u') || !RegExp('^u[A-Z]').hasMatch(e.key)) e.key: e.value,
                'user': {'id': b['uId'], 'displayName': b['uDisplayName'], 'email': b['uEmail']},
                'state': b['revokedAt'] != null
                    ? 'REVOKED'
                    : b['endsAt'] != null && !(b['endsAt']! as DateTime).isAfter(now)
                    ? 'ENDED'
                    : (b['startsAt']! as DateTime).isAfter(now)
                    ? 'SCHEDULED'
                    : 'ACTIVE',
              },
          ];
        });
      });

      r.post('/users/:id/blocks', permission: 'admin.users:manage', (ctx) {
        final id = ctx.uuidParam('id');
        final input = blockSchema.parse(ctx.body);
        final actor = ctx.user, tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          await _editable(tx, tenantId, actor, id);
          if (id == actor.id) throw badRequest('Você não pode bloquear o próprio acesso');
          final b = await tx.insert('user_access_blocks', {
            'tenantId': tenantId,
            'userId': id,
            'reason': input['reason'],
            'startsAt': input['startsAt'],
            if (input['endsAt'] != null) 'endsAt': input['endsAt'],
            'createdById': actor.id,
          }, updatedAt: false);
          await app.audit.record(tx, tenantId: tenantId, actorUserId: actor.id, action: 'CREATE', entity: 'user_access_block', entityId: b['id'] as String?, after: b, meta: ctx.meta);
          return b;
        });
      });

      r.delete('/users/:id/blocks/:blockId', permission: 'admin.users:manage', status: 204, (ctx) {
        final id = ctx.uuidParam('id'), blockId = ctx.uuidParam('blockId');
        final actor = ctx.user, tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          await _editable(tx, tenantId, actor, id);
          final b = await tx.one('SELECT * FROM user_access_blocks WHERE id = @b AND user_id = @u AND revoked_at IS NULL', {'b': blockId, 'u': id});
          if (b == null) throw notFound('Bloqueio não encontrado');
          await tx.execute('UPDATE user_access_blocks SET revoked_at = now() WHERE id = @b', {'b': blockId});
          await app.audit.record(tx, tenantId: tenantId, actorUserId: actor.id, action: 'DELETE', entity: 'user_access_block', entityId: blockId, before: b, meta: ctx.meta);
          return null;
        });
      });

      r.get('/permissions', permission: 'admin.users:read', (ctx) => permissionCatalog(false));

      r.get('/roles', permission: 'admin.users:read', (ctx) {
        final tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          final roles = await tx.query(
            'SELECT r.id, r.key, r.name, r.description, r.is_system, r.tenant_id, '
            '(SELECT coalesce(array_agg(p.key ORDER BY p.key), ARRAY[]::text[]) FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE rp.role_id = r.id) AS permissions, '
            '(SELECT count(*)::int FROM user_roles ur JOIN users u ON u.id = ur.user_id WHERE ur.role_id = r.id AND ur.tenant_id = @t AND u.deleted_at IS NULL AND NOT u.is_support) AS users '
            "FROM roles r WHERE r.deleted_at IS NULL AND (r.tenant_id = @t OR (r.tenant_id IS NULL AND r.is_system)) AND r.key <> 'super_admin' "
            'ORDER BY r.is_system DESC, r.name ASC',
            {'t': tenantId},
          );
          return [
            for (final x in roles)
              {
                'id': x['id'],
                'key': x['key'],
                'name': x['name'],
                'description': x['description'],
                'isSystem': x['isSystem'],
                'editable': x['tenantId'] == tenantId,
                'permissions': x['permissions'],
                'users': x['users'],
              },
          ];
        });
      });

      Future<List<String>> permissionIds(Tx tx, List<String> keys) async {
        final unique = keys.toSet().toList();
        if (unique.any((k) => k.startsWith('platform.') || !permissions.containsKey(k))) throw badRequest('Permissão inválida');
        final rows = await tx.query('SELECT id FROM permissions WHERE key = ANY(@k)', {'k': unique});
        if (rows.length != unique.length) throw badRequest('Permissão inválida');
        return [for (final x in rows) x['id']! as String];
      }

      Future<Row> own(Tx tx, String tenantId, String id) async {
        final x = await tx.one('SELECT * FROM roles WHERE id = @id AND deleted_at IS NULL AND (tenant_id = @t OR (tenant_id IS NULL AND is_system))', {'id': id, 't': tenantId});
        if (x == null || x['key'] == 'super_admin') throw notFound('Perfil não encontrado');
        if (x['tenantId'] != tenantId) throw forbidden('Perfis do sistema não podem ser alterados; crie um perfil novo a partir dele');
        return x;
      }

      Future<void> setPermissions(Tx tx, String roleId, List<String> ids) async {
        for (final pid in ids) {
          await tx.execute('INSERT INTO role_permissions (role_id, permission_id) VALUES (@r, @p)', {'r': roleId, 'p': pid});
        }
      }

      r.post('/roles', permission: 'admin.roles:manage', (ctx) {
        final input = roleSchema.parse(ctx.body);
        final actor = ctx.user, tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          final ids = await permissionIds(tx, (input['permissions']! as List).cast<String>());
          var key = _slug(input['name']! as String);
          if (await tx.one('SELECT 1 FROM roles WHERE key = @k AND (tenant_id = @t OR tenant_id IS NULL)', {'k': key, 't': tenantId}) != null) {
            key = '${key}_${DateTime.now().millisecondsSinceEpoch.toRadixString(36)}';
          }
          if (await tx.one('SELECT 1 FROM roles WHERE tenant_id = @t AND name = @n AND deleted_at IS NULL', {'t': tenantId, 'n': input['name']}) != null) {
            throw conflict('Já existe um perfil com este nome');
          }
          final role = await tx.insert('roles', {'tenantId': tenantId, 'key': key, 'name': input['name'], if (input['description'] != null) 'description': input['description']}, updatedAt: false);
          await setPermissions(tx, role['id']! as String, ids);
          await app.audit.record(tx, tenantId: tenantId, actorUserId: actor.id, action: 'CREATE', entity: 'role', entityId: role['id'] as String?, after: input, meta: ctx.meta);
          return {'id': role['id'], 'key': key, 'name': role['name']};
        });
      });

      r.patch('/roles/:id', permission: 'admin.roles:manage', (ctx) {
        final id = ctx.uuidParam('id');
        final input = roleSchema.partial.parse(ctx.body);
        final actor = ctx.user, tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          final before = await own(tx, tenantId, id);
          final beforePerms = await tx.query('SELECT p.key FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE rp.role_id = @r', {'r': id});
          if (input['permissions'] != null) {
            final ids = await permissionIds(tx, (input['permissions']! as List).cast<String>());
            await tx.execute('DELETE FROM role_permissions WHERE role_id = @r', {'r': id});
            await setPermissions(tx, id, ids);
          }
          await tx.update('roles', id, {if (input['name'] != null) 'name': input['name'], if (input['description'] != null) 'description': input['description']}, updatedAt: false);
          await app.audit.record(
            tx,
            tenantId: tenantId,
            actorUserId: actor.id,
            action: 'UPDATE',
            entity: 'role',
            entityId: id,
            before: {
              'name': before['name'],
              'permissions': [for (final p in beforePerms) p['key']],
            },
            after: input,
            meta: ctx.meta,
          );
          return {'id': id};
        });
      });

      r.delete('/roles/:id', permission: 'admin.roles:manage', status: 204, (ctx) {
        final id = ctx.uuidParam('id');
        final actor = ctx.user, tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          final before = await own(tx, tenantId, id);
          final inUse = await tx.scalar<int>('SELECT count(*)::int FROM user_roles ur JOIN users u ON u.id = ur.user_id WHERE ur.role_id = @r AND u.deleted_at IS NULL', {'r': id}) ?? 0;
          if (inUse > 0) throw conflict('Há usuários com este perfil: troque o perfil deles antes de excluir');
          await tx.execute('UPDATE roles SET deleted_at = now() WHERE id = @r', {'r': id});
          await app.audit.record(tx, tenantId: tenantId, actorUserId: actor.id, action: 'DELETE', entity: 'role', entityId: id, before: {'name': before['name']}, meta: ctx.meta);
          return null;
        });
      });
    });
  }
}

String likePattern(String s) => '%${s.replaceAll(r'\', r'\\').replaceAll('%', r'\%').replaceAll('_', r'\_')}%';
