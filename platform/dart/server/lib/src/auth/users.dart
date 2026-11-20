// Usuários para autenticação. Opera em modo plataforma (o login acontece antes de saber o cliente)
// e devolve só AuthUser: o hash de senha nunca sai daqui, exceto em findCredentials.
import 'package:sp_core/sp_core.dart' show localParts;

import '../crypto/tokens.dart' show nfc;
import '../db.dart';
import 'auth_user.dart';

String normalizeEmail(String email) => nfc(email.trim()).toLowerCase();

class Credentials {
  Credentials(this.user, this.passwordHash, this.denial, this.authSource);
  final AuthUser user;
  final String? passwordHash;
  final String? denial;
  final String authSource;
}

class UsersRepository {
  UsersRepository(this.db);
  final Db db;

  Future<AuthUser?> findById(String id) => db.asPlatform((tx) async {
    final u = await tx.one('SELECT * FROM users WHERE id = @id::uuid AND is_active AND deleted_at IS NULL', {'id': id});
    if (u == null) return null;
    // Bloqueio ou dia sem acesso derrubam também sessões e tokens já emitidos.
    if (await accessDenial(tx, u) != null) return null;
    return toAuthUser(tx, u);
  });

  Future<String?> findHashById(String id) => db.asPlatform((tx) => tx.scalar<String>('SELECT password_hash FROM users WHERE id = @id::uuid AND deleted_at IS NULL', {'id': id}));

  Future<String?> findAuthSource(String id) => db.asPlatform((tx) => tx.scalar<String>('SELECT auth_source::text FROM users WHERE id = @id::uuid AND deleted_at IS NULL', {'id': id}));

  Future<Credentials?> findCredentials(String email) => db.asPlatform((tx) async {
    final u = await tx.one('SELECT * FROM users WHERE email = @e AND is_active AND deleted_at IS NULL', {'e': normalizeEmail(email)});
    if (u == null) return null;
    if (u['tenantId'] != null) {
      final t = await tx.one('SELECT status::text AS status, deleted_at FROM tenants WHERE id = @id::uuid', {'id': u['tenantId']});
      if (t == null || t['status'] == 'SUSPENDED' || t['status'] == 'CANCELLED' || t['deletedAt'] != null) return null;
    }
    return Credentials(await toAuthUser(tx, u), u['passwordHash'] as String?, await accessDenial(tx, u), u['authSource'] as String? ?? 'LOCAL');
  });

  Future<Row?> findLdapConfig(String tenantId) => db.asPlatform((tx) => tx.one('SELECT * FROM tenant_ldap_configs WHERE tenant_id = @t::uuid AND enabled LIMIT 1', {'t': tenantId}));

  Future<void> updatePasswordHash(String id, String hash) =>
      db.asPlatform((tx) => tx.execute('UPDATE users SET password_hash = @h, must_change_password = false, failed_logins = 0, updated_at = now() WHERE id = @id::uuid', {'h': hash, 'id': id}));

  Future<void> recordLogin(String id) => db.asPlatform((tx) => tx.execute('UPDATE users SET last_login_at = now(), failed_logins = 0, updated_at = now() WHERE id = @id::uuid', {'id': id}));

  /// Trilha de acesso (login, falha, troca/redefinição de senha) na auditoria do cliente.
  Future<void> logAccess(String userId, String action, String entity, Map<String, Object?> after, [Map<String, Object?>? meta]) => db.asPlatform((tx) async {
    final u = await tx.one('SELECT tenant_id FROM users WHERE id = @id::uuid', {'id': userId});
    if (u == null) return;
    final ua = meta?['userAgent'] as String?;
    await tx.execute(
      'INSERT INTO audit_logs (id, tenant_id, actor_user_id, action, entity, entity_id, after, ip, user_agent) '
      'VALUES (gen_random_uuid(), @t::uuid, @u::uuid, @a::audit_action, @e, @id, @after, @ip, @ua)',
      {'t': u['tenantId'], 'u': userId, 'a': action, 'e': entity, 'id': userId, 'after': jsonb(after), 'ip': meta?['ip'], 'ua': ua == null ? null : (ua.length > 300 ? ua.substring(0, 300) : ua)},
    );
  });

  Future<AuthUser> toAuthUser(Tx tx, Row u) async {
    final rows = await tx.query(
      'SELECT p.key, ur.scope::text AS scope, ur.company_id, ur.unit_id, ur.department_id '
      'FROM user_roles ur JOIN roles r ON r.id = ur.role_id AND r.deleted_at IS NULL '
      'JOIN role_permissions rp ON rp.role_id = r.id JOIN permissions p ON p.id = rp.permission_id '
      'WHERE ur.user_id = @id::uuid',
      {'id': u['id']},
    );
    return AuthUser(
      id: u['id']! as String,
      email: u['email']! as String,
      displayName: u['displayName']! as String,
      tenantId: u['tenantId'] as String?,
      personId: u['personId'] as String?,
      isPlatformAdmin: u['isPlatformAdmin'] == true,
      isSupport: u['isSupport'] == true,
      mustChangePassword: u['mustChangePassword'] == true,
      grants: [
        for (final r in rows)
          Grant(permission: r['key']! as String, scope: r['scope']! as String, companyId: r['companyId'] as String?, unitId: r['unitId'] as String?, departmentId: r['departmentId'] as String?),
      ],
    );
  }
}

const _weekdays = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

/// "20/11/2026, 14:30" (pt-BR curto, horário de Brasília).
String brDateTime(DateTime d) {
  final l = localParts(d, 'America/Sao_Paulo');
  String p(int n) => n.toString().padLeft(2, '0');
  return '${p(l.day)}/${p(l.month)}/${l.year}, ${p(l.hour)}:${p(l.minute)}';
}

/// Motivo pelo qual o usuário não pode entrar agora, ou null: bloqueio ativo ou dia da semana não permitido.
Future<String?> accessDenial(Tx tx, Row user, [DateTime? now]) async {
  final at = now ?? DateTime.now();
  final block = await tx.one(
    'SELECT reason, ends_at FROM user_access_blocks WHERE user_id = @u::uuid AND revoked_at IS NULL AND starts_at <= @now '
    'AND (ends_at IS NULL OR ends_at > @now) ORDER BY starts_at DESC LIMIT 1',
    {'u': user['id'], 'now': at},
  );
  if (block != null) {
    final ends = block['endsAt'] as DateTime?;
    return 'Acesso bloqueado${ends == null ? '' : ' até ${brDateTime(ends)}'}. Motivo: ${block['reason']}';
  }
  final days = (user['accessWeekdays'] as List?)?.cast<int>() ?? const [];
  if (days.isNotEmpty) {
    final l = localParts(at, 'America/Sao_Paulo');
    final wd = DateTime.utc(l.year, l.month, l.day).weekday % 7;
    if (!days.contains(wd)) return 'Seu acesso não é permitido em ${_weekdays[wd]}';
  }
  return null;
}
