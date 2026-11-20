// /v1/dashboard/summary: resumo do painel; cada bloco só aparece com a permissão de leitura correspondente.
import 'package:sp_core/sp_core.dart' show localParts, civil;

import '../app.dart';
import '../auth/auth_user.dart';
import '../validate.dart';
import 'holidays.dart';

String todayBr([DateTime? now]) {
  final l = localParts(now ?? DateTime.now(), 'America/Sao_Paulo');
  return civil(l.year, l.month, l.day);
}

void dashboardRoutes(App app, HolidaysService holidays) {
  app.router.get('/v1/dashboard/summary', (ctx) async {
    final q = Obj({'companyId': uuid.optional}).parse(ctx.query);
    final user = ctx.user, tenantId = ctx.tenant;
    final companyId = q['companyId'] as String?;
    final today = todayBr();
    final y = int.parse(today.substring(0, 4)), m = int.parse(today.substring(5, 7));
    final months = [
      for (var i = 0; i < 6; i++)
        () {
          final d = DateTime.utc(y, m - (5 - i), 1);
          return '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}';
        }(),
    ];
    final from = DateTime.parse('${months.first}-01T00:00:00Z');
    final co = companyId == null ? '' : ' AND company_id = @co';
    final p = {'co': companyId, 'from': from};

    final data = await app.db.forTenant(tenantId, (tx) async {
      final out = <String, Object?>{};
      if (can(user, 'people.employments:read')) {
        final counts = (await tx.one(
          "SELECT count(*) FILTER (WHERE status = 'ACTIVE')::int AS active, count(*)::int AS total, "
          "count(*) FILTER (WHERE status = 'ACTIVE' AND department_id IS NOT NULL AND position_id IS NOT NULL)::int AS complete "
          'FROM employment_relationships WHERE deleted_at IS NULL$co',
          p,
        ))!;
        final hired = await tx.query('SELECT hired_at FROM employment_relationships WHERE deleted_at IS NULL$co AND hired_at >= @from', p);
        final ended = await tx.query('SELECT terminated_at FROM employment_relationships WHERE deleted_at IS NULL$co AND terminated_at >= @from', p);
        List<int> bucket(List<Object?> dates) => [for (final mo in months) dates.where((d) => d is DateTime && d.toUtc().toIso8601String().substring(0, 7) == mo).length];
        out['employees'] = {
          ...counts,
          'months': months,
          'hires': bucket([for (final h in hired) h['hiredAt']]),
          'terminations': bucket([for (final t in ended) t['terminatedAt']]),
        };
      }
      if (can(user, 'org.companies:read')) {
        out['structure'] = {
          'companies': await tx.scalar<int>('SELECT count(*)::int FROM companies WHERE deleted_at IS NULL'),
          'departments': can(user, 'org.departments:read') ? await tx.scalar<int>('SELECT count(*)::int FROM departments WHERE deleted_at IS NULL$co', p) : null,
          'positions': can(user, 'org.positions:read') ? await tx.scalar<int>('SELECT count(*)::int FROM job_positions WHERE deleted_at IS NULL$co', p) : null,
          'groupings': can(user, 'org.groupings:read') ? await tx.scalar<int>('SELECT count(*)::int FROM groupings WHERE deleted_at IS NULL') : null,
        };
      }
      if (can(user, 'admin.users:read')) {
        final hideSupport = !user.isPlatformAdmin && !user.isSupport;
        out['access'] = {
          'users': await tx.scalar<int>('SELECT count(*)::int FROM users WHERE deleted_at IS NULL AND is_active AND tenant_id = @t${hideSupport ? ' AND NOT is_support' : ''}', {'t': tenantId}),
          'activeBlocks': await tx.scalar<int>('SELECT count(*)::int FROM user_access_blocks WHERE revoked_at IS NULL AND starts_at <= now() AND (ends_at IS NULL OR ends_at >= now())'),
        };
      }
      final first = companyId ?? await tx.scalar<String>('SELECT id FROM companies WHERE deleted_at IS NULL ORDER BY created_at ASC LIMIT 1');
      return (out: out, holidayCompany: first);
    });

    List<Map<String, Object?>>? upcoming;
    if (data.holidayCompany != null && can(user, 'org.holidays:read')) {
      final list = [
        ...((await holidays.listForCompany(tenantId, data.holidayCompany!, y))['holidays']! as List).cast<Map<String, Object?>>(),
        if (m >= 11) ...((await holidays.listForCompany(tenantId, data.holidayCompany!, y + 1))['holidays']! as List).cast<Map<String, Object?>>(),
      ];
      upcoming = [
        for (final h in list.where((h) => (h['date']! as String).compareTo(today) >= 0 && h['workday'] != true).take(3)) {'date': h['date'], 'name': h['name'], 'scope': h['scope']},
      ];
    }
    return {'today': today, ...data.out, 'holidays': ?upcoming};
  });
}
