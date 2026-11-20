// Limites do plano (chave da plan_features). Sem assinatura = sem limite (clientes antigos e instalação própria).
import 'db.dart';
import 'http.dart';

const limitLabels = {'limit.employments': 'funcionários ativos', 'limit.devices': 'equipamentos', 'limit.users': 'usuários'};

/// Uso atual de cada limite no cliente (dentro da transação do cliente).
Future<Map<String, int>> usage(Tx tx, String tenantId) async {
  final r = await tx.one(
    "SELECT (SELECT count(*)::int FROM employment_relationships WHERE deleted_at IS NULL AND status <> 'TERMINATED') AS e, "
    '(SELECT count(*)::int FROM devices WHERE deleted_at IS NULL) AS d, '
    '(SELECT count(*)::int FROM users WHERE tenant_id = @t AND deleted_at IS NULL AND is_active AND NOT is_support) AS u',
    {'t': tenantId},
  );
  return {'limit.employments': r!['e']! as int, 'limit.devices': r['d']! as int, 'limit.users': r['u']! as int};
}

/// Assinatura vigente com os limites efetivos (plano + ajustes do contrato).
Future<({Row subscription, Row plan, List<Row> features, Map<String, int> limits})?> currentPlan(Tx tx) async {
  final sub = await tx.one("SELECT * FROM subscriptions WHERE status IN ('TRIALING', 'ACTIVE', 'PAST_DUE') ORDER BY created_at DESC LIMIT 1");
  if (sub == null) return null;
  final plan = (await tx.one('SELECT * FROM plans WHERE id = @p', {'p': sub['planId']}))!;
  final features = await tx.query('SELECT * FROM plan_features WHERE plan_id = @p', {'p': sub['planId']});
  final limits = <String, int>{};
  for (final f in features) {
    final v = f['value'];
    if (limitLabels.containsKey(f['key']) && v is num) limits[f['key']! as String] = v.toInt();
  }
  final overrides = sub['overrides'];
  if (overrides is Map) {
    for (final e in overrides.entries) {
      if (limitLabels.containsKey(e.key) && e.value is num) limits[e.key as String] = (e.value as num).toInt();
    }
  }
  return (subscription: sub, plan: plan, features: features, limits: limits);
}

/// Recusa a criação quando o plano não comporta mais um item.
Future<void> assertLimit(Tx tx, String tenantId, String key, [int adding = 1]) async {
  final plan = await currentPlan(tx);
  final max = plan?.limits[key];
  if (max == null) return;
  final used = (await usage(tx, tenantId))[key]!;
  if (used + adding > max) {
    throw forbidden('Limite do plano ${plan!.plan['name']} atingido: $max ${limitLabels[key]} (em uso: $used). Fale com a equipe SuperPonto para ampliar.');
  }
}
