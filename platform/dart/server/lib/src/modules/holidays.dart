// Feriados: catálogo anual (nacionais, estaduais, municipais), feriados da empresa e decisões de folga/trabalho.
import 'dart:io';

import 'package:sp_core/sp_core.dart' as core;

import '../app.dart';
import '../db.dart';
import '../http.dart';
import '../validate.dart';

String _upper(String name) => name.replaceAllMapped(RegExp('[A-Z]'), (m) => '_${m[0]}').toUpperCase();
const _movables = {
  'CARNIVAL_MONDAY': core.Movable.carnivalMonday, 'CARNIVAL_TUESDAY': core.Movable.carnivalTuesday, 'ASH_WEDNESDAY': core.Movable.ashWednesday,
  'GOOD_FRIDAY': core.Movable.goodFriday, 'CORPUS_CHRISTI': core.Movable.corpusChristi, 'EASTER': core.Movable.easter,
};

String _day(Object? d) => d is DateTime ? isoMs(d).substring(0, 10) : d.toString().substring(0, 10);

final _rule = Obj({
  'name': const Str(trim: true, min: 2, max: 120),
  'kind': const Enum(['HOLIDAY', 'OPTIONAL']).def('HOLIDAY'),
  'month': const Num(int: true, min: 1, max: 12).optional,
  'day': const Num(int: true, min: 1, max: 31).optional,
  'movable': const Enum(['CARNIVAL_MONDAY', 'CARNIVAL_TUESDAY', 'ASH_WEDNESDAY', 'GOOD_FRIDAY', 'CORPUS_CHRISTI']).optional,
})
    .check((v) => v['movable'] != null ? v['month'] == null && v['day'] == null : v['month'] != null && v['day'] != null, 'Informe dia e mês, ou um feriado móvel')
    .check((v) => v['movable'] != null || DateTime.utc(2024, v['month']! as int, v['day']! as int).month == v['month'], 'Data inexistente');
final _override = Obj({'date': date, 'workday': const Bool(), 'note': const Str(trim: true, max: 200).optional});

class HolidaysService {
  HolidaysService(this.app);
  final App app;
  Db get db => app.db;

  /// Gera (de forma idempotente) o catálogo do ano.
  Future<int> generateYear(int year) async {
    if (year < 2000 || year > 2100) throw badRequest('Ano inválido');
    final items = [
      ...core.nationalHolidays(year),
      for (final uf in core.ufs) ...core.stateHolidays(year, uf),
      for (final ibge in core.municipalRules.keys) ...core.municipalHolidays(year, ibge),
    ];
    return db.asPlatform((tx) async {
      var created = 0;
      for (final h in items) {
        created += await tx.execute(
          'INSERT INTO public_holidays (id, date, year, name, scope, kind, uf, ibge, basis, review) '
          'VALUES (gen_random_uuid(), @d, @y, @n, @s, @k, @uf, @ibge, @b, @r) ON CONFLICT DO NOTHING',
          {'d': h.date, 'y': year, 'n': h.name, 's': _upper(h.scope.name), 'k': _upper(h.kind.name), 'uf': h.uf ?? '', 'ibge': h.ibge ?? '', 'b': h.basis, 'r': h.review},
        );
      }
      if (created > 0) stdout.writeln('Feriados $year: $created cadastrado(s)');
      return created;
    });
  }

  /// Garante o ano corrente e o próximo.
  Future<Map<String, int>> ensureUpcoming([DateTime? now]) async {
    final y = (now ?? DateTime.now()).toUtc().year;
    return {'$y': await generateYear(y), '${y + 1}': await generateYear(y + 1)};
  }

  Future<Row> _company(Tx tx, String id) async {
    final c = await tx.one('SELECT id, state, ibge_code, city FROM companies WHERE id = @id AND deleted_at IS NULL', {'id': id});
    if (c == null) throw notFound('Empresa não encontrada');
    return c;
  }

  Future<Map<String, Object?>> listForCompany(String tenantId, String companyId, int year) async {
    if (year < 2000 || year > 2100) throw badRequest('Ano inválido');
    if ((await db.asPlatform((tx) => tx.scalar<int>('SELECT count(*)::int FROM public_holidays WHERE year = @y', {'y': year})) ?? 0) == 0) {
      await generateYear(year);
    }
    return db.forTenant(tenantId, (tx) async {
      final c = await _company(tx, companyId);
      final catalog = await tx.query(
        "SELECT date, name, scope::text AS scope, kind::text AS kind, basis, review FROM public_holidays WHERE year = @y AND (scope = 'NATIONAL' "
        "OR (scope = 'STATE' AND uf = @uf) OR (scope = 'MUNICIPAL' AND ibge = @ibge))",
        {'y': year, 'uf': c['state'], 'ibge': c['ibgeCode']},
      );
      final rules = await tx.query('SELECT * FROM company_holiday_rules WHERE company_id = @c AND deleted_at IS NULL', {'c': companyId});
      final overrides = await tx.query('SELECT * FROM company_holiday_overrides WHERE company_id = @c AND date BETWEEN @a AND @b',
          {'c': companyId, 'a': untyped('$year-01-01'), 'b': untyped('$year-12-31')});
      final items = <Map<String, Object?>>[
        for (final h in catalog)
          {'date': _day(h['date']), 'name': h['name'], 'scope': h['scope'], 'kind': h['kind'], 'basis': h['basis'], 'review': h['review'], 'workday': false, 'overridden': false},
        for (final r in rules)
          {
            'date': core.ruleDate(
                core.HolidayRule(name: r['name']! as String, kind: r['kind'] == 'OPTIONAL' ? core.HolidayKind.optional : core.HolidayKind.holiday,
                    month: r['month'] as int?, day: r['day'] as int?, movable: _movables[r['movable']]),
                year),
            'name': r['name'], 'scope': 'COMPANY', 'kind': r['kind'], 'basis': 'Cadastrado pela empresa', 'review': false, 'workday': false, 'overridden': false,
            'ruleId': r['id'],
          },
      ];
      // Um por data: o mais específico vence (empresa > municipal > estadual > nacional) e feriado vence facultativo.
      int rank(Map<String, Object?> h) => (h['kind'] == 'HOLIDAY' ? 10 : 0) + const {'COMPANY': 4, 'MUNICIPAL': 3, 'STATE': 2, 'NATIONAL': 1}[h['scope']]!;
      final byDate = <String, Map<String, Object?>>{};
      for (final h in items) {
        final cur = byDate[h['date']];
        if (cur == null || rank(h) > rank(cur)) byDate[h['date']! as String] = h;
      }
      // Ponto facultativo é dia de trabalho até a empresa decidir folgar; a decisão da empresa prevalece.
      for (final h in byDate.values) {
        h['workday'] = h['kind'] == 'OPTIONAL';
      }
      for (final o in overrides) {
        final d = _day(o['date']);
        final h = byDate[d];
        if (h != null) {
          h['workday'] = o['workday'];
          h['overridden'] = true;
          h['note'] = o['note'];
        } else if (o['workday'] != true) {
          final note = o['note'] as String?;
          byDate[d] = {
            'date': d, 'name': note == null || note.isEmpty ? 'Folga concedida pela empresa' : note, 'scope': 'COMPANY', 'kind': 'HOLIDAY',
            'basis': 'Decisão da empresa', 'review': false, 'workday': false, 'overridden': true, 'note': note,
          };
        }
      }
      final ibge = c['ibgeCode'] as String?;
      return {
        'year': year,
        'location': {'city': c['city'], 'state': c['state'], 'ibge': ibge, 'municipalBase': ibge != null && core.municipalRules.containsKey(ibge)},
        'holidays': byDate.values.toList()..sort((a, b) => (a['date']! as String).compareTo(b['date']! as String)),
      };
    });
  }

  void routes() {
    final r = app.router;
    r.group('/v1', tag: 'feriados', () {
      r.get('/companies/:id/holidays', permission: 'org.holidays:read', (ctx) {
        final id = ctx.uuidParam('id');
        final q = Obj({'year': Num(int: true, coerce: true, min: 2000, max: 2100).def(DateTime.now().year)}).parse(ctx.query);
        return listForCompany(ctx.tenant, id, q['year']! as int);
      });

      r.post('/companies/:id/holiday-rules', permission: 'org.holidays:manage', (ctx) {
        final id = ctx.uuidParam('id');
        final input = _rule.parse(ctx.body);
        final tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          await _company(tx, id);
          final rule = await tx.insert('company_holiday_rules', {
            'tenantId': tenantId, 'companyId': id, 'name': input['name'], 'kind': input['kind'],
            'month': input['month'], 'day': input['day'], 'movable': input['movable'],
          });
          await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'CREATE', entity: 'company_holiday_rule', entityId: rule['id'] as String?, after: rule, meta: ctx.meta);
          return rule;
        });
      });

      r.delete('/companies/:id/holiday-rules/:ruleId', permission: 'org.holidays:manage', status: 204, (ctx) {
        final id = ctx.uuidParam('id'), ruleId = ctx.uuidParam('ruleId');
        final tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          final rule = await tx.one('SELECT * FROM company_holiday_rules WHERE id = @r AND company_id = @c AND deleted_at IS NULL', {'r': ruleId, 'c': id});
          if (rule == null) throw notFound('Feriado não encontrado');
          await tx.update('company_holiday_rules', ruleId, {'deletedAt': DateTime.now()});
          await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'DELETE', entity: 'company_holiday_rule', entityId: ruleId, before: rule, meta: ctx.meta);
          return null;
        });
      });

      r.put('/companies/:id/holiday-overrides', permission: 'org.holidays:manage', (ctx) {
        final id = ctx.uuidParam('id');
        final input = _override.parse(ctx.body);
        final tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          await _company(tx, id);
          final before = await tx.one('SELECT * FROM company_holiday_overrides WHERE company_id = @c AND date = @d', {'c': id, 'd': input['date']});
          final Row saved;
          if (before == null) {
            saved = await tx.insert('company_holiday_overrides',
                {'tenantId': tenantId, 'companyId': id, 'date': input['date'], 'workday': input['workday'], 'note': input['note']});
          } else {
            saved = (await tx.update('company_holiday_overrides', before['id']! as String, {'workday': input['workday'], 'note': input['note']}))!;
          }
          await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: before == null ? 'CREATE' : 'UPDATE',
              entity: 'company_holiday_override', entityId: saved['id'] as String?, before: before, after: saved, meta: ctx.meta);
          return saved;
        });
      });

      r.delete('/companies/:id/holiday-overrides/:date', permission: 'org.holidays:manage', status: 204, (ctx) {
        final id = ctx.uuidParam('id');
        final d = ctx.param('date');
        date.parse(d);
        final tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          final row = await tx.one('SELECT * FROM company_holiday_overrides WHERE company_id = @c AND date = @d', {'c': id, 'd': d});
          if (row == null) throw notFound('Nenhuma decisão para esta data');
          await tx.execute('DELETE FROM company_holiday_overrides WHERE id = @id', {'id': row['id']});
          await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'DELETE', entity: 'company_holiday_override', entityId: row['id'] as String?, before: row, meta: ctx.meta);
          return null;
        });
      });

      // SuperAdmin: gera manualmente o catálogo de um ano (normalmente automático).
      r.post('/platform/holidays/generate', permission: 'platform.tenants:manage', (ctx) async {
        final b = Obj({'year': const Num(int: true, min: 2000, max: 2100)}).parse(ctx.body);
        return {'year': b['year'], 'created': await generateYear(b['year']! as int)};
      });
    });

    // Cadastro automático: na subida e a cada 6 horas garante o ano corrente e o seguinte.
    if (!app.config.testHooks) {
      ensureUpcoming().then((_) {}, onError: (Object e) => stderr.writeln('Falha ao gerar feriados: $e'));
      app.every(const Duration(hours: 6), () => ensureUpcoming());
    }
  }
}
