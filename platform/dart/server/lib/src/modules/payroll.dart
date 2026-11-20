// Exportação para a folha de pagamento (arquivo próprio, configurável; não fala com nenhum sistema)
// e importação de marcações por planilha (matrícula ou CPF; data; hora).
import 'dart:convert';

import 'package:sp_core/sp_core.dart' show onlyDigits;

import '../app.dart';
import '../auth/auth_user.dart';
import '../crypto/tokens.dart' show sha256Hex;
import '../db.dart';
import '../http.dart';
import '../validate.dart';
import 'reports.dart';
import 'schedules.dart' show isoDay;
import 'timesheet_core.dart';

const payrollItems = <String, ({String label, String unit})>{
  'normal': (label: 'Horas normais', unit: 'hours'),
  'ot50': (label: 'Extra 50%', unit: 'hours'),
  'ot60': (label: 'Extra 60%', unit: 'hours'),
  'ot70': (label: 'Extra 70%', unit: 'hours'),
  'ot75': (label: 'Extra 75%', unit: 'hours'),
  'ot80': (label: 'Extra 80%', unit: 'hours'),
  'ot100': (label: 'Extra 100%', unit: 'hours'),
  'night': (label: 'Adicional noturno (hora reduzida)', unit: 'hours'),
  'absence': (label: 'Faltas (horas)', unit: 'hours'),
  'late': (label: 'Atrasos e saídas antecipadas', unit: 'hours'),
  'allowances': (label: 'Dias abonados', unit: 'days'),
  'onCall': (label: 'Sobreaviso (1/3)', unit: 'hours'),
};
final _eventCode = Str(trim: true, pattern: RegExp(r'^[A-Za-z0-9._-]{1,20}$'), patternMessage: 'Código do evento: até 20 letras, números, ponto, hífen ou sublinhado');
final _layout = Obj({
  'companyId': uuid,
  'name': const Str(trim: true, min: 2, max: 80),
  'events': Rec(_eventCode)
      .refine((e) => (e as Map).keys.every((k) => RegExp(r'^(normal|ot\d{1,3}|night|absence|late|allowances|onCall)$').hasMatch(k as String)), 'Verba desconhecida')
      .refine((e) => (e as Map).isNotEmpty, 'Informe o código de ao menos uma verba'),
  'separator': const Enum([';', ',', '|', 'TAB']).def(';'),
  'quantityFormat': const Enum(['HHMM', 'DECIMAL', 'MINUTES']).def('HHMM'),
  'includeHeader': const Bool().def(true),
  'employeeKey': const Enum(['MATRICULA', 'CPF']).def('MATRICULA'),
});
final _export = Obj({'from': date, 'to': date, 'departmentId': uuid.optional, 'groupingId': uuid.optional, 'employmentIds': const Arr(uuid, max: 2000).optional});
final _markImport = Obj({
  'companyId': uuid,
  'content': const Str(min: 1, max: 2000000),
  'employeeKey': const Enum(['MATRICULA', 'CPF']).def('MATRICULA'),
  'dryRun': const Bool().def(true),
});

String formatQuantity(int minutes, String fmt, String unit) {
  if (unit == 'days' || fmt == 'MINUTES') return '$minutes';
  if (fmt == 'DECIMAL') return (minutes / 60).toStringAsFixed(2).replaceFirst('.', ',');
  return '${(minutes ~/ 60).toString().padLeft(2, '0')}:${(minutes % 60).toString().padLeft(2, '0')}';
}

String? _parseDate(String v) {
  final br = RegExp(r'^(\d{2})/(\d{2})/(\d{4})$').firstMatch(v);
  final d = br != null
      ? '${br[3]}-${br[2]}-${br[1]}'
      : RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(v)
      ? v
      : null;
  if (d == null) return null;
  final p = d.split('-').map(int.parse).toList();
  final t = DateTime.utc(p[0], p[1], p[2]);
  return t.year == p[0] && t.month == p[1] && t.day == p[2] ? d : null;
}

class PayrollModule {
  PayrollModule(this.app, this.reports);
  final App app;
  final ReportsModule reports;
  Db get db => app.db;

  Future<Row> _one(Tx tx, String id) async {
    final l = await tx.one('SELECT * FROM payroll_layouts WHERE id = @id AND deleted_at IS NULL', {'id': id});
    if (l == null) throw notFound('Layout não encontrado');
    return l;
  }

  Never _dup(DbError e) {
    if (e.uniqueViolation || (e.constraint ?? '').contains('payroll_layouts_company_name')) throw conflict('Já existe um layout com esse nome nesta empresa');
    throw e;
  }

  void routes() {
    final r = app.router;
    r.group('/v1/payroll-layouts', tag: 'folha', () {
      r.get(
        '/items',
        permission: 'reports.payroll:export',
        (ctx) => [
          for (final e in payrollItems.entries) {'key': e.key, 'label': e.value.label, 'unit': e.value.unit},
        ],
      );
      r.get('', permission: 'reports.payroll:export', (ctx) {
        final q = Obj({'companyId': uuid.optional}).parse(ctx.query);
        return db.forTenant(
          ctx.tenant,
          (tx) => tx.query('SELECT * FROM payroll_layouts WHERE deleted_at IS NULL${q['companyId'] != null ? ' AND company_id = @c' : ''} ORDER BY name ASC', {'c': q['companyId']}),
        );
      });
      r.post('', permission: 'reports.payroll:export', (ctx) async {
        final input = _layout.parse(ctx.body);
        final tenantId = ctx.tenant;
        try {
          return await db.forTenant(tenantId, (tx) async {
            if (await tx.one('SELECT 1 FROM companies WHERE id = @c AND deleted_at IS NULL', {'c': input['companyId']}) == null) throw notFound('Empresa não encontrada');
            final l = await tx.insert('payroll_layouts', {'tenantId': tenantId, ...input, 'events': jsonb(input['events'])});
            await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'CREATE', entity: 'payroll_layout', entityId: l['id'] as String?, after: l, meta: ctx.meta);
            return l;
          });
        } on DbError catch (e) {
          _dup(e);
        }
      });
      r.put('/:id', permission: 'reports.payroll:export', (ctx) async {
        final id = ctx.uuidParam('id');
        final input = _layout.omit(['companyId']).parse(ctx.body);
        final tenantId = ctx.tenant;
        try {
          return await db.forTenant(tenantId, (tx) async {
            final before = await _one(tx, id);
            final l = await tx.update('payroll_layouts', id, {...input, 'events': jsonb(input['events'])});
            await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'UPDATE', entity: 'payroll_layout', entityId: id, before: before, after: l, meta: ctx.meta);
            return l;
          });
        } on DbError catch (e) {
          _dup(e);
        }
      });
      r.delete('/:id', permission: 'reports.payroll:export', status: 204, (ctx) {
        final id = ctx.uuidParam('id');
        final tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          final before = await _one(tx, id);
          await tx.update('payroll_layouts', id, {'deletedAt': DateTime.now()});
          await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'DELETE', entity: 'payroll_layout', entityId: id, before: before, meta: ctx.meta);
          return null;
        });
      });

      // Gera o arquivo: uma linha por funcionário e verba (quantidade zero não entra).
      r.post('/:id/export', permission: 'reports.payroll:export', status: 200, (ctx) async {
        final id = ctx.uuidParam('id');
        final q = _export.parse(ctx.body);
        final user = ctx.user, tenantId = ctx.tenant;
        final layout = await db.forTenant(tenantId, (tx) => _one(tx, id));
        final byCpf = layout['employeeKey'] == 'CPF';
        if (byCpf && !can(user, 'people.sensitive:read')) throw forbidden('Layout por CPF exige a permissão de ver dados sensíveis');
        final res = await reports.run(tenantId, user, 'folha-conferencia', {
          'companyId': layout['companyId'],
          'from': q['from'],
          'to': q['to'],
          'departmentId': q['departmentId'],
          'groupingId': q['groupingId'],
          'employmentIds': q['employmentIds'],
          'includeSubdepartments': true,
          'status': 'ACTIVE',
        });
        final rows = (res['rows']! as List).cast<Map<String, Object?>>();
        final events = (layout['events']! as Map).cast<String, Object?>();
        var cpfs = <String, String>{};
        if (byCpf) {
          final emps = await db.forTenant(
            tenantId,
            (tx) => tx.query(
              'SELECT e.registration, p.cpf FROM employment_relationships e JOIN people p ON p.id = e.person_id WHERE e.company_id = @c AND e.deleted_at IS NULL AND e.registration = ANY(@r)',
              {
                'c': layout['companyId'],
                'r': [for (final x in rows) x['registration'].toString()],
              },
            ),
          );
          cpfs = {for (final e in emps) e['registration']! as String: (e['cpf'] as String?) ?? ''};
        }
        final sep = layout['separator'] == 'TAB' ? '\t' : layout['separator']! as String;
        final from = q['from']! as String, to = q['to']! as String;
        final lines = <String>[
          if (layout['includeHeader'] == true) [byCpf ? 'CPF' : 'Matricula', 'Evento', 'Quantidade', 'Inicio', 'Fim'].join(sep),
        ];
        final missing = <String>[];
        var n = 0;
        for (final row in rows) {
          final key = byCpf ? (cpfs[row['registration'].toString()] ?? '') : row['registration'].toString();
          if (key.isEmpty) {
            missing.add(row['name'].toString());
            continue;
          }
          for (final e in events.entries) {
            final qty = ((row[e.key] as num?) ?? 0).toInt();
            if (qty == 0) continue;
            lines.add(
              [
                key,
                e.value,
                formatQuantity(qty, layout['quantityFormat']! as String, payrollItems[e.key]?.unit ?? 'hours'),
                from.split('-').reversed.join('/'),
                to.split('-').reversed.join('/'),
              ].join(sep),
            );
            n++;
          }
        }
        await db.forTenant(
          tenantId,
          (tx) => app.audit.record(
            tx,
            tenantId: tenantId,
            actorUserId: user.id,
            action: 'EXPORT',
            entity: 'payroll_export',
            entityId: id,
            after: {'layout': layout['name'], 'from': from, 'to': to, 'employees': rows.length, 'lines': n},
            meta: ctx.meta,
          ),
        );
        final slug = (layout['name']! as String).toLowerCase().replaceAll(RegExp('[^a-z0-9]+'), '-').replaceAll(RegExp(r'^-|-$'), '');
        return {
          'filename': 'folha_${slug}_${from}_$to.txt',
          'mime': 'text/plain;charset=utf-8',
          'base64': base64.encode(utf8.encode('${lines.join('\r\n')}\r\n')),
          'lines': n,
          'employees': rows.length,
          'missingKey': missing,
          'unmappedItems': [
            for (final c in (res['columns']! as List).cast<Map<String, Object?>>())
              if (payrollItems.containsKey(c['key']) && !events.containsKey(c['key']) && rows.any((x) => ((x[c['key']] as num?) ?? 0) > 0)) c['key'],
          ],
        };
      });
    });

    // Importa marcações de planilha (matrícula ou CPF; data; hora). Com dryRun só confere; repetir o arquivo não duplica.
    r.post('/v1/time-records/import-csv', permission: 'time.records:import', status: 200, throttle: 20, (ctx) {
      final input = _markImport.parse(ctx.body);
      final user = ctx.user, tenantId = ctx.tenant;
      final raw = (input['content']! as String).replaceFirst('﻿', '').split(RegExp(r'\r?\n'));
      if (raw.length > 20001) throw badRequest('Até 20.000 linhas por arquivo');
      final byCpf = input['employeeKey'] == 'CPF';
      return db.forTenant(tenantId, (tx) async {
        if (await tx.one('SELECT 1 FROM companies WHERE id = @c AND deleted_at IS NULL', {'c': input['companyId']}) == null) throw notFound('Empresa não encontrada');
        final emps = await tx.query(
          'SELECT e.id, e.registration, e.hired_at, e.terminated_at, p.cpf, p.full_name FROM employment_relationships e JOIN people p ON p.id = e.person_id WHERE e.company_id = @c AND e.deleted_at IS NULL',
          {'c': input['companyId']},
        );
        final byKey = {for (final e in emps) byCpf ? onlyDigits((e['cpf'] as String?) ?? '') : e['registration']! as String: e};
        final closings = await tx.query("SELECT period_start, period_end FROM time_closings WHERE company_id = @c AND status = 'CLOSED'", {'c': input['companyId']});
        final now = DateTime.now();
        final errors = <Map<String, Object?>>[];
        final valid = <({int line, String employmentId, String name, DateTime at, String date, String time, String key})>[];
        final seen = <String>{};
        for (var i = 0; i < raw.length; i++) {
          final line = i + 1;
          final t = raw[i].trim();
          if (t.isEmpty) continue;
          final parts = [for (final x in t.split(RegExp(r'[;,\t|]'))) x.trim().replaceAll(RegExp(r'^"|"$'), '')];
          if (i == 0 && !RegExp(r'\d').hasMatch(parts.length > 1 ? parts[1] : '')) continue; // cabeçalho
          if (parts.length < 3) {
            errors.add({'line': line, 'message': 'Use: matrícula (ou CPF); data; hora'});
            continue;
          }
          final key = byCpf ? onlyDigits(parts[0]) : parts[0];
          final e = byKey[key];
          if (e == null) {
            errors.add({'line': line, 'message': 'Funcionário não encontrado: ${parts[0]}'});
            continue;
          }
          final d = _parseDate(parts[1]);
          if (d == null) {
            errors.add({'line': line, 'message': 'Data inválida: ${parts[1]}'});
            continue;
          }
          final hm = RegExp(r'^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$').firstMatch(parts[2]);
          if (hm == null) {
            errors.add({'line': line, 'message': 'Hora inválida: ${parts[2]}'});
            continue;
          }
          final at = DateTime.parse('${d}T${hm[1]}:${hm[2]}:00-03:00').toUtc();
          if (at.isAfter(now)) {
            errors.add({'line': line, 'message': 'Marcação no futuro'});
            continue;
          }
          if (d.compareTo(isoDay(e['hiredAt'])) < 0 || (e['terminatedAt'] != null && d.compareTo(isoDay(e['terminatedAt'])) > 0)) {
            errors.add({'line': line, 'message': 'Fora do período do vínculo'});
            continue;
          }
          if (closings.any((c) => isoDay(c['periodStart']).compareTo(d) <= 0 && isoDay(c['periodEnd']).compareTo(d) >= 0)) {
            errors.add({'line': line, 'message': 'Período fechado'});
            continue;
          }
          final k = 'import:${e['id']}:${isoMs(at).substring(0, 16)}';
          if (seen.contains(k)) {
            errors.add({'line': line, 'message': 'Repetida no arquivo'});
            continue;
          }
          seen.add(k);
          valid.add((line: line, employmentId: e['id']! as String, name: e['fullName']! as String, at: at, date: d, time: '${hm[1]}:${hm[2]}', key: k));
        }
        // Já existentes: mesma marcação (mesmo minuto) vinda de qualquer origem.
        var have = <String>{};
        if (valid.isNotEmpty) {
          final minAt = valid.map((v) => v.at).reduce((a, b) => a.isBefore(b) ? a : b);
          final maxAt = valid.map((v) => v.at).reduce((a, b) => a.isAfter(b) ? a : b).add(const Duration(milliseconds: 59999));
          final existing = await tx.query('SELECT employment_id, recorded_at FROM time_records WHERE employment_id::text = ANY(@ids) AND recorded_at BETWEEN @a AND @b', {
            'ids': {for (final v in valid) v.employmentId}.toList(),
            'a': minAt,
            'b': maxAt,
          });
          have = {for (final x in existing) 'import:${x['employmentId']}:${isoMs(x['recordedAt']! as DateTime).substring(0, 16)}'};
        }
        final fresh = [
          for (final v in valid)
            if (!have.contains(v.key)) v,
        ];
        final result = <String, Object?>{
          'total': valid.length + errors.length,
          'valid': valid.length,
          'duplicates': valid.length - fresh.length,
          'toImport': fresh.length,
          'imported': 0,
          'errors': errors.take(500).toList(),
          'preview': [
            for (final v in fresh.take(50)) {'line': v.line, 'name': v.name, 'date': v.date, 'time': v.time},
          ],
        };
        if (input['dryRun'] == true || fresh.isEmpty) return result;
        fresh.sort((a, b) => a.employmentId.compareTo(b.employmentId) != 0 ? a.employmentId.compareTo(b.employmentId) : a.at.compareTo(b.at));
        final last = <String, String?>{};
        for (final v in fresh) {
          if (!last.containsKey(v.employmentId)) {
            last[v.employmentId] = await tx.scalar<String>('SELECT hash FROM time_records WHERE employment_id = @e ORDER BY received_at DESC LIMIT 1', {'e': v.employmentId});
          }
          final prev = last[v.employmentId];
          final hash = sha256Hex(utf8.encode([prev ?? '', v.employmentId, isoMs(v.at), 'IMPORT', v.key].join('|')));
          await tx.insert('time_records', {'tenantId': tenantId, 'employmentId': v.employmentId, 'recordedAt': v.at, 'source': 'IMPORT', 'hash': hash, 'previousHash': prev, 'idempotencyKey': v.key});
          last[v.employmentId] = hash;
        }
        final l = localBr(now);
        await app.audit.record(
          tx,
          tenantId: tenantId,
          actorUserId: user.id,
          action: 'CREATE',
          entity: 'time_record_import',
          after: {
            'companyId': input['companyId'],
            'imported': fresh.length,
            'duplicates': result['duplicates'],
            'errors': errors.length,
            'at': {'date': l.date, 'time': l.time},
          },
          meta: ctx.meta,
        );
        return {...result, 'imported': fresh.length};
      });
    });
  }
}

/// Usado por outros módulos que precisam do usuário do contexto.
bool canExportPayroll(AuthUser u) => can(u, 'reports.payroll:export');
