// /v1/platform/tenants: administração global (equipe SuperPonto) e usuário de suporte de cada cliente.
import '../app.dart';
import '../auth/users.dart';
import '../db.dart';
import '../http.dart';
import '../validate.dart';

final _createTenant = Obj({
  'name': const Str(trim: true, min: 2, max: 200),
  'slug': Str(trim: true, lower: true, pattern: RegExp(r'^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$'), patternMessage: 'Use letras minúsculas, números e hífen'),
  'document': cnpj.optional,
  'admin': Obj({'email': email, 'displayName': const Str(trim: true, min: 2, max: 200)}),
});

/// Endereço do suporte de um cliente: `suporte+slug@dominio`.
String supportEmailFor(String base, String slug) {
  final parts = base.toLowerCase().split('@');
  return '${parts[0]}+$slug@${parts[1]}';
}

class SupportProvisioning {
  SupportProvisioning(this.app);
  final App app;

  /// Garante o usuário de suporte do cliente dentro de uma transação já aberta. Idempotente.
  Future<({String id, String email, bool created})> ensureInTx(Tx tx, String tenantId, String slug) async {
    final existing = await tx.one('SELECT id, email FROM users WHERE tenant_id = @t AND is_support AND deleted_at IS NULL LIMIT 1', {'t': tenantId});
    if (existing != null) return (id: existing['id']! as String, email: existing['email']! as String, created: false);
    final email = supportEmailFor(app.config.supportEmail, slug);
    final roleId = await tx.scalar<String>("SELECT id FROM roles WHERE tenant_id IS NULL AND key = 'company_admin'");
    final user = await tx.insert('users', {'tenantId': tenantId, 'email': email, 'displayName': 'Suporte SuperPonto', 'isSupport': true});
    await tx.insert('user_roles', {'userId': user['id'], 'roleId': roleId, 'tenantId': tenantId, 'scope': 'TENANT'}, updatedAt: false);
    return (id: user['id']! as String, email: email, created: true);
  }

  void sendAccess(String email) {
    if (!email.endsWith('.local')) app.passwordReset.request(email);
  }

  /// Clientes antigos sem usuário de suporte recebem um na subida do servidor.
  Future<int> backfill() async {
    final tenants = await app.db.asPlatform((tx) => tx.query(
        'SELECT id, slug FROM tenants t WHERE deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.tenant_id = t.id AND u.is_support AND u.deleted_at IS NULL)'));
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
          'page': page, 'pageSize': size,
          'total': await tx.scalar<int>('SELECT count(*)::int FROM tenants WHERE $w', p),
        };
      });
    });

    // Cria o cliente e seu primeiro administrador, que recebe um e-mail para definir a senha.
    r.post('', permission: 'platform.tenants:manage', (ctx) async {
      final b = _createTenant.parse(ctx.body);
      final admin = b['admin']! as Map<String, Object?>;
      final adminEmail = normalizeEmail(admin['email']! as String);
      final result = await app.db.asPlatform((tx) async {
        if (await tx.one('SELECT 1 FROM tenants WHERE slug = @s', {'s': b['slug']}) != null) throw conflict('Identificador (slug) já em uso');
        if (await tx.one('SELECT 1 FROM users WHERE email = @e', {'e': adminEmail}) != null) throw conflict('E-mail do administrador já cadastrado');
        final tenant = await tx.insert('tenants', {'name': b['name'], 'slug': b['slug'], if (b['document'] != null) 'document': b['document']});
        final roleId = await tx.scalar<String>("SELECT id FROM roles WHERE tenant_id IS NULL AND key = 'company_admin'");
        final user = await tx.insert('users', {'tenantId': tenant['id'], 'email': adminEmail, 'displayName': admin['displayName']});
        await tx.insert('user_roles', {'userId': user['id'], 'roleId': roleId, 'tenantId': tenant['id'], 'scope': 'TENANT'}, updatedAt: false);
        final s = await support.ensureInTx(tx, tenant['id']! as String, tenant['slug']! as String);
        await app.audit.record(tx, tenantId: tenant['id'] as String?, actorUserId: ctx.user.id, action: 'CREATE', entity: 'tenant',
            entityId: tenant['id'] as String?, after: {'tenant': tenant, 'adminEmail': adminEmail}, meta: ctx.meta);
        return {'tenant': tenant, 'adminId': user['id'], 'supportEmail': s.email};
      });
      app.passwordReset.request(adminEmail);
      support.sendAccess(result['supportEmail']! as String);
      return result;
    });
  });
}
