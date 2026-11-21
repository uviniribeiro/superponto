// /v1/platform/tenants: administração global (equipe SuperPonto) e usuário de suporte de cada cliente.
import 'dart:math';

import '../app.dart';
import '../auth/users.dart';
import '../db.dart';
import '../http.dart';
import '../validate.dart';

final _createTenant = Obj({
  'name': const Str(trim: true, min: 2, max: 200),
  'slug': Str(trim: true, lower: true, pattern: RegExp(r'^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$'), patternMessage: 'Use letras minúsculas, números e hífen'),
  'document': cnpj.optional,
  // Sem e-mail, o administrador entra só por usuário (admin) + CNPJ + senha inicial, como na v1.
  'admin': Obj({'email': email.optional, 'displayName': const Str(trim: true, min: 2, max: 200).optional}).optional,
});

final _updateTenant = Obj({
  'name': const Str(trim: true, min: 2, max: 200).optional,
  'status': const Enum(['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED']).optional,
});
final _reset = Obj({'who': const Enum(['admin', 'support'])});

final _rng = Random.secure();

/// Senha inicial legível (sem caracteres ambíguos), mostrada uma única vez ao Super Admin.
String initialPassword() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  final b = StringBuffer();
  for (var i = 0; i < 12; i++) {
    b.write(abc[_rng.nextInt(abc.length)]);
  }
  return '$b#${10 + _rng.nextInt(89)}';
}

/// Endereço do suporte de um cliente: `suporte+slug@dominio`.
String supportEmailFor(String base, String slug) {
  final parts = base.toLowerCase().split('@');
  return '${parts[0]}+$slug@${parts[1]}';
}

class SupportProvisioning {
  SupportProvisioning(this.app);
  final App app;

  /// Garante o usuário de suporte do cliente dentro de uma transação já aberta. Idempotente.
  Future<({String id, String email, bool created})> ensureInTx(Tx tx, String tenantId, String slug, {String? passwordHash}) async {
    final existing = await tx.one('SELECT id, email, username FROM users WHERE tenant_id = @t AND is_support AND deleted_at IS NULL LIMIT 1', {'t': tenantId});
    final taken = await tx.one("SELECT 1 FROM users WHERE tenant_id = @t AND username = 'suporte'", {'t': tenantId}) != null;
    if (existing != null) {
      // Login da v1: usuário "suporte" + CNPJ (clientes antigos ganham o usuário se estiver livre).
      if (existing['username'] == null && !taken) await tx.execute("UPDATE users SET username = 'suporte', updated_at = now() WHERE id = @id", {'id': existing['id']});
      return (id: existing['id']! as String, email: existing['email']! as String, created: false);
    }
    final email = supportEmailFor(app.config.supportEmail, slug);
    final roleId = await tx.scalar<String>("SELECT id FROM roles WHERE tenant_id IS NULL AND key = 'company_admin'");
    final user = await tx.insert('users', {
      'tenantId': tenantId,
      'email': email,
      'username': taken ? null : 'suporte',
      'displayName': 'Suporte SuperPonto',
      'isSupport': true,
      if (passwordHash != null) ...{'passwordHash': passwordHash, 'mustChangePassword': true},
    });
    await tx.insert('user_roles', {'userId': user['id'], 'roleId': roleId, 'tenantId': tenantId, 'scope': 'TENANT'}, updatedAt: false);
    return (id: user['id']! as String, email: email, created: true);
  }

  void sendAccess(String email) {
    if (!email.endsWith('.local')) app.passwordReset.request(email);
  }

  /// Clientes antigos sem usuário de suporte recebem um na subida do servidor.
  Future<int> backfill() async {
    final tenants = await app.db.asPlatform(
      (tx) => tx.query(
        'SELECT id, slug FROM tenants t WHERE deleted_at IS NULL AND (NOT EXISTS (SELECT 1 FROM users u WHERE u.tenant_id = t.id AND u.is_support AND u.deleted_at IS NULL) '
        'OR EXISTS (SELECT 1 FROM users u WHERE u.tenant_id = t.id AND u.is_support AND u.deleted_at IS NULL AND u.username IS NULL))',
      ),
    );
    var created = 0;
    for (final t in tenants) {
      final r = await app.db.asPlatform((tx) => ensureInTx(tx, t['id']! as String, t['slug']! as String));
      if (r.created) {
        created++;
        sendAccess(r.email);
      }
    }
    return created;
  }
}

void platformTenantsRoutes(App app, SupportProvisioning support) {
  final r = app.router;
  r.group('/v1/platform/tenants', tag: 'plataforma', () {
    r.get('', permission: 'platform.tenants:manage', (ctx) {
      final q = pageSchema.parse(ctx.query);
      return app.db.asPlatform((tx) async {
        final search = q['search'] as String?;
        final p = <String, Object?>{if (search != null && search.isNotEmpty) 's': '%${search.replaceAll('%', r'\%').replaceAll('_', r'\_')}%'};
        final w = 'deleted_at IS NULL${p.isEmpty ? '' : ' AND name ILIKE @s'}';
        final page = q['page']! as int, size = q['pageSize']! as int;
        return {
          'data': await tx.query('SELECT * FROM tenants WHERE $w ORDER BY name ASC LIMIT $size OFFSET ${(page - 1) * size}', p),
          'page': page,
          'pageSize': size,
          'total': await tx.scalar<int>('SELECT count(*)::int FROM tenants WHERE $w', p),
        };
      });
    });

    // Painel do Super Admin: só números por cliente — nenhum dado de pessoa ou de ponto dos clientes.
    r.get('/overview', permission: 'platform.tenants:manage', (ctx) {
      return app.db.asPlatform((tx) async {
        final rows = await tx.query('''
          SELECT t.id, t.name, t.slug, t.status, t.created_at,
            (SELECT count(*)::int FROM companies c WHERE c.tenant_id = t.id AND c.deleted_at IS NULL) AS companies,
            coalesce((SELECT array_agg(c.cnpj::text ORDER BY c.created_at) FROM companies c WHERE c.tenant_id = t.id AND c.deleted_at IS NULL AND c.cnpj IS NOT NULL), ARRAY[]::text[]) AS cnpjs,
            (SELECT count(*)::int FROM users u WHERE u.tenant_id = t.id AND u.deleted_at IS NULL AND NOT u.is_support) AS users,
            (SELECT count(*)::int FROM employment_relationships e WHERE e.tenant_id = t.id AND e.deleted_at IS NULL AND e.status = 'ACTIVE') AS employees,
            (SELECT count(*)::int FROM devices d WHERE d.tenant_id = t.id AND d.deleted_at IS NULL) AS devices
          FROM tenants t WHERE t.deleted_at IS NULL ORDER BY t.name ASC''');
        int sum(String k) => rows.fold(0, (a, x) => a + (x[k]! as int));
        return {
          'totals': {
            'tenants': rows.length,
            'active': rows.where((x) => x['status'] == 'ACTIVE' || x['status'] == 'TRIAL').length,
            'suspended': rows.where((x) => x['status'] == 'SUSPENDED' || x['status'] == 'CANCELLED').length,
            'companies': sum('companies'),
            'users': sum('users'),
            'employees': sum('employees'),
            'devices': sum('devices'),
          },
          'data': rows,
        };
      });
    });

    // Renomeia, suspende ou reativa um cliente. Suspenso/cancelado não entra e perde as sessões abertas.
    r.patch('/:id', permission: 'platform.tenants:manage', (ctx) {
      final id = ctx.uuidParam('id');
      final b = _updateTenant.parse(ctx.body);
      return app.db.asPlatform((tx) async {
        final before = await tx.one('SELECT * FROM tenants WHERE id = @id AND deleted_at IS NULL', {'id': id});
        if (before == null) throw notFound('Cliente não encontrado');
        final after = b.isEmpty ? before : await tx.update('tenants', id, b);
        if (b['status'] == 'SUSPENDED' || b['status'] == 'CANCELLED') {
          await tx.execute('UPDATE auth_refresh_tokens SET revoked = true WHERE user_id IN (SELECT id::text FROM users WHERE tenant_id = @t)', {'t': id});
        }
        await app.audit.record(tx, tenantId: id, actorUserId: ctx.user.id, action: 'UPDATE', entity: 'tenant', entityId: id, before: before, after: after, meta: ctx.meta);
        return after;
      });
    });

    // Nova senha inicial para o "admin" ou o "suporte" do cliente (mostrada uma única vez).
    r.post('/:id/reset-password', permission: 'platform.tenants:manage', (ctx) async {
      final id = ctx.uuidParam('id');
      final who = _reset.parse(ctx.body)['who']! as String;
      final password = initialPassword();
      final hash = await app.hasher.hash(password);
      final username = await app.db.asPlatform((tx) async {
        final tenant = await tx.one('SELECT id, slug FROM tenants WHERE id = @id AND deleted_at IS NULL', {'id': id});
        if (tenant == null) throw notFound('Cliente não encontrado');
        var u = who == 'support'
            ? await tx.one('SELECT id, username FROM users WHERE tenant_id = @t AND is_support AND deleted_at IS NULL LIMIT 1', {'t': id})
            : await tx.one("SELECT id, username FROM users WHERE tenant_id = @t AND username = 'admin' AND NOT is_support AND deleted_at IS NULL LIMIT 1", {'t': id});
        if (u == null && who == 'support') {
          final s = await support.ensureInTx(tx, id, tenant['slug']! as String, passwordHash: hash);
          u = await tx.one('SELECT id, username FROM users WHERE id = @id', {'id': s.id});
        }
        if (u == null) throw notFound('O cliente não tem usuário "admin"');
        await tx.execute('UPDATE users SET password_hash = @h, must_change_password = @m, is_active = true, updated_at = now() WHERE id = @id', {'h': hash, 'm': who == 'admin', 'id': u['id']});
        await tx.execute('UPDATE auth_refresh_tokens SET revoked = true WHERE user_id = @u', {'u': u['id']});
        await app.audit.record(tx, tenantId: id, actorUserId: ctx.user.id, action: 'UPDATE', entity: 'user', entityId: u['id'] as String?, after: {'passwordReset': who}, meta: ctx.meta);
        return (u['username'] as String?) ?? (who == 'support' ? 'suporte' : 'admin');
      });
      return {'username': username, 'password': password};
    });

    // Cria o cliente como na v1: empresa com o CNPJ, administrador (usuário "admin") e suporte (usuário
    // "suporte", oculto e não editável pelo cliente), com senhas iniciais mostradas uma única vez.
    r.post('', permission: 'platform.tenants:manage', (ctx) async {
      final b = _createTenant.parse(ctx.body);
      final admin = (b['admin'] as Map<String, Object?>?) ?? const {};
      final realEmail = admin['email'] == null ? null : normalizeEmail(admin['email']! as String);
      final adminEmail = realEmail ?? 'admin@${b['slug']}.superponto.local';
      final adminPassword = initialPassword(), supportPassword = initialPassword();
      final adminHash = await app.hasher.hash(adminPassword), supportHash = await app.hasher.hash(supportPassword);
      final result = await app.db.asPlatform((tx) async {
        if (await tx.one('SELECT 1 FROM tenants WHERE slug = @s', {'s': b['slug']}) != null) throw conflict('Identificador (slug) já em uso');
        if (await tx.one('SELECT 1 FROM users WHERE email = @e', {'e': adminEmail}) != null) throw conflict('E-mail do administrador já cadastrado');
        if (b['document'] != null && await tx.one('SELECT 1 FROM companies WHERE cnpj = @c AND deleted_at IS NULL', {'c': b['document']}) != null) {
          throw conflict('Este CNPJ já pertence a outro cliente');
        }
        final tenant = await tx.insert('tenants', {'name': b['name'], 'slug': b['slug'], if (b['document'] != null) 'document': b['document']});
        // A empresa com o CNPJ do cliente: é por ela que o login "usuário + CNPJ" encontra o cliente.
        final company = b['document'] == null ? null : await tx.insert('companies', {'tenantId': tenant['id'], 'legalName': b['name'], 'cnpj': b['document']});
        final roleId = await tx.scalar<String>("SELECT id FROM roles WHERE tenant_id IS NULL AND key = 'company_admin'");
        final user = await tx.insert('users', {
          'tenantId': tenant['id'],
          'email': adminEmail,
          'username': 'admin',
          'displayName': admin['displayName'] ?? 'Administrador',
          'passwordHash': adminHash,
          'mustChangePassword': true,
        });
        await tx.insert('user_roles', {'userId': user['id'], 'roleId': roleId, 'tenantId': tenant['id'], 'scope': 'TENANT'}, updatedAt: false);
        final s = await support.ensureInTx(tx, tenant['id']! as String, tenant['slug']! as String, passwordHash: supportHash);
        await app.audit.record(
          tx,
          tenantId: tenant['id'] as String?,
          actorUserId: ctx.user.id,
          action: 'CREATE',
          entity: 'tenant',
          entityId: tenant['id'] as String?,
          after: {'tenant': tenant, 'adminEmail': adminEmail, 'companyId': company?['id']},
          meta: ctx.meta,
        );
        return {'tenant': tenant, 'companyId': company?['id'], 'adminId': user['id'], 'supportEmail': s.email};
      });
      if (realEmail != null) app.passwordReset.request(realEmail);
      return {
        ...result,
        // Mostrado uma única vez: o banco guarda só o hash.
        'credentials': {
          'cnpj': b['document'],
          'admin': {'username': 'admin', 'password': adminPassword},
          'support': {'username': 'suporte', 'password': supportPassword},
        },
      };
    });
  });
}
