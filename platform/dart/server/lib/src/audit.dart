// Trilha de auditoria: gravada na MESMA transação da alteração (ou ambas acontecem, ou nenhuma).
import 'db.dart';

class Audit {
  const Audit();

  Future<void> record(Tx tx, {required String? tenantId, required String? actorUserId, required String action, required String entity,
      String? entityId, Object? before, Object? after, Map<String, Object?>? meta}) async {
    final ua = meta?['userAgent'] as String?;
    await tx.execute(
      'INSERT INTO audit_logs (id, tenant_id, actor_user_id, action, entity, entity_id, before, after, ip, user_agent) '
      'VALUES (gen_random_uuid(), @t, @u, @a::audit_action, @e, @id, @b, @af, @ip, @ua)',
      {
        't': tenantId, 'u': actorUserId, 'a': action, 'e': entity, 'id': entityId,
        'b': before == null ? null : jsonb(toJsonValue(before)), 'af': after == null ? null : jsonb(toJsonValue(after)),
        'ip': meta?['ip'], 'ua': ua,
      },
    );
  }
}
