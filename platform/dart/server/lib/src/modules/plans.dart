// Planos e assinaturas (equipe SuperPonto) e a visão do próprio plano pelo cliente. A cobrança fica com o meio de pagamento.
import '../app.dart';
import '../db.dart';
import '../http.dart';
import '../limits.dart';
import '../validate.dart';

final _limits = Obj({
  'limit.employments': const Num(int: true, min: 1, max: 1000000).nullable,
  'limit.devices': const Num(int: true, min: 0, max: 100000).nullable,
  'limit.users': const Num(int: true, min: 1, max: 1000000).nullable,
}).partial;
final _plan = Obj({
  'key': Str(trim: true, lower: true, pattern: RegExp(r'^[a-z0-9-]{2,40}$')),
  'name': const Str(trim: true, min: 2, max: 80),
  'priceCents': const Num(int: true, min: 0, max: 100000000),
  'interval': const Enum(['month', 'year']).def('month'),
  'isPublic': const Bool().def(true),
  'limits': _limits.def(<String, Object?>{}),
});
final _subscription = Obj({
  'planId': uuid,
  'status': const Enum(['TRIALING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED']),
  'currentPeriodEnd': date,
  'trialEndsAt': date.nullish,
  'overrides': _limits.def(<String, Object?>{}),
});

Future<Map<String, Object?>> _shapePlan(Tx tx, Row p) async {
  final features = await tx.query('SELECT key, value FROM plan_features WHERE plan_id = @p', {'p': p['id']});
  return {
    'id': p['id'],
    'key': p['key'],
    'name': p['name'],
    'priceCents': p['priceCents'],
    'currency': p['currency'],
    'interval': p['interval'],
    'isPublic': p['isPublic'],
    'limits': {
      for (final f in features)
        if (limitLabels.containsKey(f['key'])) f['key']! as String: f['value'],
    },
  };
}

void plansRoutes(App app) {
  final r = app.router;
  final db = app.db;

  Future<void> writeFeatures(Tx tx, String planId, Map<String, Object?> limits) async {
    for (final e in limits.entries) {
      if (e.value == null) {
        await tx.execute('DELETE FROM plan_features WHERE plan_id = @p AND key = @k', {'p': planId, 'k': e.key});
      } else {
        await tx.execute('INSERT INTO plan_features (id, plan_id, key, value) VALUES (gen_random_uuid(), @p, @k, @v) ON CONFLICT (plan_id, key) DO UPDATE SET value = EXCLUDED.value', {
          'p': planId,
          'k': e.key,
          'v': jsonb(e.value),
        });
      }
    }
  }

  r.group('/v1/platform', tag: 'plataforma', () {
    r.get(
      '/plans',
      permission: 'platform.plans:manage',
      (ctx) => db.asPlatform((tx) async => [for (final p in await tx.query('SELECT * FROM plans ORDER BY price_cents ASC')) await _shapePlan(tx, p)]),
    );

    r.post('/plans', permission: 'platform.plans:manage', (ctx) {
      final b = _plan.parse(ctx.body);
      return db.asPlatform((tx) async {
        if (await tx.one('SELECT 1 FROM plans WHERE key = @k', {'k': b['key']}) != null) throw conflict('Já existe um plano com esse identificador');
        final limits = (b.remove('limits')! as Map).cast<String, Object?>();
        final p = await tx.insert('plans', b);
        await writeFeatures(tx, p['id']! as String, limits);
        await app.audit.record(tx, tenantId: null, actorUserId: ctx.user.id, action: 'CREATE', entity: 'plan', entityId: p['id'] as String?, after: {...b, 'limits': limits}, meta: ctx.meta);
        return _shapePlan(tx, p);
      });
    });

    r.put('/plans/:id', permission: 'platform.plans:manage', (ctx) {
      final id = ctx.uuidParam('id');
      final b = _plan.omit(['key']).parse(ctx.body);
      return db.asPlatform((tx) async {
        final before = await tx.one('SELECT * FROM plans WHERE id = @id', {'id': id});
        if (before == null) throw notFound('Plano não encontrado');
        final beforeShape = await _shapePlan(tx, before);
        final limits = (b.remove('limits')! as Map).cast<String, Object?>();
        final p = (await tx.update('plans', id, b))!;
        await writeFeatures(tx, id, limits);
        await app.audit.record(tx, tenantId: null, actorUserId: ctx.user.id, action: 'UPDATE', entity: 'plan', entityId: id, before: beforeShape, after: {...b, 'limits': limits}, meta: ctx.meta);
        return _shapePlan(tx, p);
      });
    });

    // Situação do cliente: assinatura, limites e uso.
    r.get('/tenants/:id/subscription', permission: 'platform.tenants:manage', (ctx) {
      final tid = ctx.uuidParam('id');
      return db.forTenant(tid, (tx) async {
        final plan = await currentPlan(tx);
        final last = plan?.subscription ?? await tx.one('SELECT * FROM subscriptions ORDER BY created_at DESC LIMIT 1');
        final planName = plan?.plan['name'] ?? (last == null ? null : await tx.scalar<String>('SELECT name FROM plans WHERE id = @p', {'p': last['planId']}));
        return {
          'subscription': last == null
              ? null
              : {
                  'id': last['id'],
                  'status': last['status'],
                  'planId': last['planId'],
                  'planName': planName,
                  'currentPeriodEnd': last['currentPeriodEnd'],
                  'trialEndsAt': last['trialEndsAt'],
                  'overrides': last['overrides'],
                },
          'limits': plan?.limits ?? const <String, int>{},
          'usage': await usage(tx, tid),
        };
      });
    });

    // Define o plano do cliente. SUSPENDED/CANCELLED também suspendem o cliente; ACTIVE/TRIALING reativam.
    r.put('/tenants/:id/subscription', permission: 'platform.tenants:manage', (ctx) {
      final tid = ctx.uuidParam('id');
      final b = _subscription.parse(ctx.body);
      return db.asPlatform((tx) async {
        final tenant = await tx.one('SELECT id, status::text AS status FROM tenants WHERE id = @id AND deleted_at IS NULL', {'id': tid});
        if (tenant == null) throw notFound('Cliente não encontrado');
        if (await tx.one('SELECT 1 FROM plans WHERE id = @p', {'p': b['planId']}) == null) throw notFound('Plano não encontrado');
        final overrides = {
          for (final e in (b['overrides']! as Map).entries)
            if (e.value != null) e.key: e.value,
        };
        final current = await tx.one("SELECT * FROM subscriptions WHERE tenant_id = @t AND status <> 'CANCELLED' ORDER BY created_at DESC LIMIT 1", {'t': tid});
        final data = {
          'planId': b['planId'],
          'status': b['status'],
          'currentPeriodEnd': DateTime.parse('${b['currentPeriodEnd']}T23:59:59-03:00'),
          'trialEndsAt': b['trialEndsAt'] == null ? null : DateTime.parse('${b['trialEndsAt']}T23:59:59-03:00'),
          'overrides': jsonb(overrides),
        };
        final sub = current != null
            ? (await tx.update('subscriptions', current['id']! as String, data))!
            : await tx.insert('subscriptions', {'tenantId': tid, 'currentPeriodStart': DateTime.now(), ...data});
        final status = b['status'] == 'SUSPENDED' || b['status'] == 'CANCELLED'
            ? 'SUSPENDED'
            : b['status'] == 'TRIALING'
            ? 'TRIAL'
            : 'ACTIVE';
        if (tenant['status'] != status) await tx.execute('UPDATE tenants SET status = @s, updated_at = now() WHERE id = @id', {'s': status, 'id': tid});
        await app.audit.record(
          tx,
          tenantId: tid,
          actorUserId: ctx.user.id,
          action: 'UPDATE',
          entity: 'subscription',
          entityId: sub['id'] as String?,
          before: current,
          after: {...b, 'tenantStatus': status},
          meta: ctx.meta,
        );
        return sub;
      });
    });
  });

  // O cliente vê o próprio plano, limites e uso.
  r.get('/v1/subscription', permission: 'admin.users:read', (ctx) {
    final tenantId = ctx.tenant;
    return db.forTenant(tenantId, (tx) async {
      final plan = await currentPlan(tx);
      return {
        'plan': plan == null
            ? null
            : {'name': plan.plan['name'], 'status': plan.subscription['status'], 'currentPeriodEnd': plan.subscription['currentPeriodEnd'], 'trialEndsAt': plan.subscription['trialEndsAt']},
        'limits': plan?.limits ?? const <String, int>{},
        'usage': await usage(tx, tenantId),
        'labels': limitLabels,
      };
    });
  });
}
