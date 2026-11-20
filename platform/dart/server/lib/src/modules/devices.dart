// Equipamentos: cadastro, comandos (fila para o agente local), digitais cifradas, importação de AFD,
// monitor de comunicação com alertas por e-mail e protocolo do agente local (cabeçalho X-Device-Key).
import 'dart:convert';
import 'dart:io';

import 'package:sp_core/sp_core.dart' as core;

import '../app.dart';
import '../auth/auth_user.dart';
import '../crypto/openssl.dart' show randomBytes;
import '../crypto/tokens.dart' show FieldCipher, b64url, sha256Hex;
import '../db.dart';
import '../http.dart';
import '../limits.dart';
import '../mail.dart';
import '../validate.dart';
import 'schedules.dart' show isoDay;
import 'timesheet_core.dart' show brMidnight, localBr;

const _actions = ['SET_DATETIME', 'SET_EMPLOYER', 'SYNC_EMPLOYEES', 'RECEIVE_EMPLOYEES', 'RECEIVE_FINGERPRINTS', 'RECEIVE_EMPLOYER', 'COLLECT_RECORDS'];
const _formats = ['ISO_19794_2', 'ANSI_378', 'CONTROLID', 'HENRY', 'OTHER'];
final _b64 = RegExp(r'^[A-Za-z0-9+/]+={0,2}$');

final deviceSchema = Obj({
  'companyId': uuid,
  'unitId': uuid.nullish,
  'name': const Str(trim: true, min: 2, max: 80),
  'ordinance': const Enum(['P1510_2009', 'P373_2011', 'P671_2021']),
  'serialNumber': const Str(trim: true, max: 40).nullish,
  'repNumber': Str(trim: true, pattern: RegExp(r'^\d{17}$'), patternMessage: 'Número do REP com 17 dígitos').nullish,
  'manufacturer': const Str(trim: true, max: 60).nullish,
  'modelName': const Str(trim: true, max: 60).nullish,
  'host': const Str(trim: true, max: 120).nullish,
  'port': const Num(int: true, min: 1, max: 65535).nullish,
  'groupName': const Str(trim: true, max: 60).nullish,
  'collectIntervalMinutes': const Num(int: true, min: 5, max: 1440).nullish,
  'alertEmails': const Arr(email, max: 10).def(<String>[]),
  'timezone': const Str(trim: true, max: 60).def('America/Sao_Paulo'),
  'active': const Bool().def(true),
});
final _fingerprint = Obj({
  'finger': const Num(int: true, min: 0, max: 9),
  'format': const Enum(_formats),
  'template': Str(pattern: _b64, patternMessage: 'Template deve estar em base64', max: 22000),
  'quality': const Num(int: true, min: 0, max: 100).optional,
  'capturedDeviceId': uuid.optional,
});
final _afdUpload = Obj({'content': const Str(min: 10, max: 20000000)});
final _result = Obj({
  'status': const Enum(['SUCCEEDED', 'FAILED']),
  'error': const Str(max: 1000).optional,
  'data': Obj({
    'employees': Arr(Obj({
      'workerId': Str(pattern: RegExp(r'^\d{11,12}$')), 'name': const Str(max: 120).optional, 'registration': const Str(max: 40).optional,
      'fingerprints': const Num(int: true, min: 0, max: 10).optional,
    }), max: 20000).optional,
    'fingerprints': Arr(Obj({
      'workerId': Str(pattern: RegExp(r'^\d{11,12}$')), 'finger': const Num(int: true, min: 0, max: 9), 'format': const Enum(_formats),
      'template': Str(pattern: _b64, max: 22000),
    }), max: 20000).optional,
    'employer': Obj({'cnpj': const Str(max: 20), 'name': const Str(max: 150).optional}).optional,
    'afd': const Str(max: 20000000).optional,
  }).optional,
});
final _heartbeat = Obj({'firmware': const Str(max: 60).optional, 'adapterVersion': const Str(max: 60).optional, 'message': const Str(max: 300).optional});

/// Portaria do equipamento → leiaute do AFD.
core.AfdLayout layoutOf(String? ordinance) {
  if (ordinance == null) throw badRequest('Defina a portaria do equipamento (1.510/2009, 373/2011 ou 671/2021) antes de usá-lo');
  return ordinance == 'P671_2021' ? core.AfdLayout.p671 : core.AfdLayout.p1510;
}

/// "Online" = falou com a API dentro de 3 intervalos de coleta (mínimo 15 min).
int offlineAfterMinutes(Row d) {
  final m = 3 * ((d['collectIntervalMinutes'] as int?) ?? 5);
  return m < 15 ? 15 : m;
}

const _publicCols = 'd.id, d.company_id, d.unit_id, d.name, d.ordinance::text AS ordinance, d.serial_number, d.rep_number, d.manufacturer, d.model_name, d.host, d.port, '
    'd.group_name, d.collect_interval_minutes, d.alert_emails, d.timezone, d.status::text AS status, d.last_seen_at, d.last_sync_at, d.firmware, d.adapter_version, '
    'd.agent_key_hash, d.created_at, c.legal_name AS c_legal_name, c.trade_name AS c_trade_name, u.name AS u_name';
const _publicFrom = 'FROM devices d JOIN companies c ON c.id = d.company_id LEFT JOIN company_units u ON u.id = d.unit_id';

Map<String, Object?> _shape(Row d) => {
      for (final e in d.entries) if (e.key != 'agentKeyHash' && !RegExp('^[cu][A-Z]').hasMatch(e.key)) e.key: e.value,
      'company': {'legalName': d['cLegalName'], 'tradeName': d['cTradeName']},
      'unit': d['unitId'] == null ? null : {'name': d['uName']},
      'hasAgentKey': d['agentKeyHash'] != null,
    };

class DevicesModule {
  DevicesModule(this.app) : _cipher = app.config.biometricEncryptionKey == null ? null : FieldCipher(app.config.biometricEncryptionKey!);
  final App app;
  final FieldCipher? _cipher;
  Db get db => app.db;

  FieldCipher _requireCipher() => _cipher ?? (throw unavailable('Cadastro de digitais desativado: configure BIOMETRIC_ENCRYPTION_KEY na API'));

  Future<Row> _device(Tx tx, String id) async {
    final d = await tx.one('SELECT $_publicCols, c.cnpj AS c_cnpj $_publicFrom WHERE d.id = @id AND d.deleted_at IS NULL', {'id': id});
    if (d == null) throw notFound('Equipamento não encontrado');
    return d;
  }

  Future<List<Row>> _repTargets(Tx tx, String companyId) => tx.query(
      "SELECT id FROM devices WHERE company_id = @c AND deleted_at IS NULL AND status <> 'DISABLED' AND ordinance IS NOT NULL AND 'TIME' = ANY(usage::text[])", {'c': companyId});

  Future<void> _queue(Tx tx, String tenantId, String deviceId, String action, Map<String, Object?> payload, String? userId) => tx.execute(
        'INSERT INTO device_sync_jobs (id, tenant_id, device_id, action, payload, created_by_id) VALUES (gen_random_uuid(), @t, @d, @a, @p, @u)',
        {'t': tenantId, 'd': deviceId, 'a': action, 'p': jsonb(payload), 'u': userId},
      );

  // ------------------------------------------------------------------ AFD
  /// Importa um AFD: grava cada evento bruto e cria as marcações dos trabalhadores identificados. Reimportar não duplica.
  Future<Map<String, Object?>> importAfd(String tenantId, String? userId, String deviceId, String content, Map<String, Object?> meta) => db.forTenant(tenantId, (tx) async {
        final device = await _device(tx, deviceId);
        final expected = layoutOf(device['ordinance'] as String?);
        final tzName = device['timezone']! as String;
        final afd = core.parseAfd(content, timeZone: tzName);
        final layoutName = core.afdLayoutName(afd.layout);
        final warnings = [...afd.warnings];
        if (afd.layout != expected && device['ordinance'] != 'P373_2011') {
          warnings.add('Arquivo no leiaute da Portaria ${layoutName == '671' ? '671/2021' : '1.510/2009'}, mas o equipamento está cadastrado como ${device['ordinance']}');
        }
        final companyCnpj = device['cCnpj'] == null ? null : core.normalizeCnpj(device['cCnpj']! as String);
        if (afd.header?.employerIdType == 'CNPJ' && companyCnpj != null && core.normalizeCnpj(afd.header!.employerId) != companyCnpj) {
          throw badRequest('O AFD é do CNPJ ${afd.header!.employerId}, diferente da empresa do equipamento ($companyCnpj)');
        }
        final punches = afd.punches;
        if (punches.isEmpty) return {'layout': layoutName, 'header': afd.header?.toJson(), 'punches': 0, 'imported': 0, 'duplicates': 0, 'unmatched': <Object?>[], 'warnings': warnings};
        final rawLines = content.split(RegExp(r'\r?\n'));
        var newEvents = 0;
        for (final p in punches) {
          newEvents += await tx.execute(
            "INSERT INTO device_events (id, tenant_id, device_id, kind, occurred_at, identifier, nsr, payload) VALUES (gen_random_uuid(), @t, @d, 'TIME_RECORD', @at, @w, @n, @p) ON CONFLICT DO NOTHING",
            {
              't': tenantId, 'd': deviceId, 'at': p.occurredAt, 'w': p.workerId, 'n': p.nsr,
              'p': jsonb({'layout': layoutName, 'recordType': p.recordType, 'workerIdType': p.workerIdType, 'line': p.line,
                'text': p.line - 1 < rawLines.length ? rawLines[p.line - 1].trimRight() : null, 'hash': p.hash}),
            },
          );
        }
        final field = afd.layout == core.AfdLayout.p1510 ? 'pis' : 'cpf';
        final ids = {for (final p in punches) p.workerId!.padLeft(11, '0')}.toList();
        final employments = await tx.query(
            'SELECT e.id, e.hired_at, e.terminated_at, p.cpf, p.pis FROM employment_relationships e JOIN people p ON p.id = e.person_id '
            'WHERE e.company_id = @c AND e.deleted_at IS NULL AND p.$field = ANY(@ids)',
            {'c': device['companyId'], 'ids': ids});
        final byWorker = <String, List<Row>>{};
        for (final e in employments) {
          byWorker.putIfAbsent(core.onlyDigits((e[field] as String?) ?? ''), () => []).add(e);
        }
        final keys = [for (final p in punches) 'afd:$deviceId:${p.nsr}'];
        final existing = {for (final x in await tx.query('SELECT idempotency_key FROM time_records WHERE idempotency_key = ANY(@k)', {'k': keys})) x['idempotencyKey']};
        final lastHash = <String, String?>{};
        final unmatched = <String, int>{};
        var imported = 0, duplicates = 0;
        final sorted = [...punches]..sort((a, b) => a.occurredAt!.compareTo(b.occurredAt!) != 0 ? a.occurredAt!.compareTo(b.occurredAt!) : a.nsr.compareTo(b.nsr));
        for (final p in sorted) {
          final key = 'afd:$deviceId:${p.nsr}';
          if (existing.contains(key)) {
            duplicates++;
            continue;
          }
          final l = core.localParts(p.occurredAt!, tzName);
          final day = core.civil(l.year, l.month, l.day);
          // Com mais de um vínculo na mesma empresa, vale o vigente na data da marcação.
          final emp = (byWorker[p.workerId!.padLeft(11, '0')] ?? const []).where((e) =>
              isoDay(e['hiredAt']).compareTo(day) <= 0 && (e['terminatedAt'] == null || isoDay(e['terminatedAt']).compareTo(day) >= 0)).firstOrNull;
          if (emp == null) {
            unmatched[p.workerId!] = (unmatched[p.workerId!] ?? 0) + 1;
            continue;
          }
          final eid = emp['id']! as String;
          if (!lastHash.containsKey(eid)) {
            lastHash[eid] = await tx.scalar<String>('SELECT hash FROM time_records WHERE employment_id = @e ORDER BY received_at DESC LIMIT 1', {'e': eid});
          }
          final previousHash = lastHash[eid];
          final hash = sha256Hex(utf8.encode([previousHash ?? '', eid, isoMs(p.occurredAt!), deviceId, p.nsr].join('|')));
          await tx.insert('time_records', {
            'tenantId': tenantId, 'employmentId': eid, 'recordedAt': p.occurredAt, 'timezone': tzName, 'source': 'DEVICE', 'deviceId': deviceId,
            'deviceNsr': p.nsr, 'hash': hash, 'previousHash': previousHash, 'idempotencyKey': key,
          });
          lastHash[eid] = hash;
          imported++;
        }
        await tx.execute('UPDATE devices SET last_sync_at = now(), updated_at = now() WHERE id = @id', {'id': deviceId});
        final summary = {
          'layout': layoutName, 'header': afd.header?.toJson(), 'punches': punches.length, 'newEvents': newEvents, 'imported': imported, 'duplicates': duplicates,
          'unmatched': [for (final e in unmatched.entries) {'workerId': e.key, 'count': e.value}], 'warnings': warnings,
        };
        await app.audit.record(tx, tenantId: tenantId, actorUserId: userId, action: 'CREATE', entity: 'afd_import', entityId: deviceId,
            after: {...summary, 'header': null, 'warnings': warnings.length}..remove('header'), meta: meta);
        return summary;
      });

  /// Agenda o envio ao REP do empregador, dos funcionários ativos e das digitais.
  Future<Map<String, Object?>> syncRoster(String tenantId, AuthUser user, String deviceId, Map<String, Object?> meta) => db.forTenant(tenantId, (tx) async {
        final device = await _device(tx, deviceId);
        final layout = layoutOf(device['ordinance'] as String?);
        final cnpj = device['cCnpj'] as String?;
        if (cnpj == null) throw badRequest('A empresa do equipamento não tem CNPJ cadastrado');
        try {
          final employer = core.validateEmployer(core.RepEmployer(idType: 'CNPJ', id: cnpj, name: device['cLegalName']! as String,
              location: (device['uName'] ?? device['cTradeName'] ?? device['cLegalName'])! as String));
          core.assertEmployerFitsLayout(layout, employer);
        } on core.RepCommandError catch (e) {
          throw badRequest(e.message);
        }
        final employments = await tx.query(
          'SELECT e.id, e.registration, p.full_name, p.cpf, p.pis, (SELECT array_agg(b.id::text) FROM biometric_templates b WHERE b.employment_id = e.id AND b.revoked_at IS NULL) AS bios '
          "FROM employment_relationships e JOIN people p ON p.id = e.person_id WHERE e.company_id = @c AND e.deleted_at IS NULL AND e.status = 'ACTIVE' ORDER BY e.registration ASC",
          {'c': device['companyId']},
        );
        final jobs = <(String, Map<String, Object?>)>[('SET_EMPLOYER', {'companyId': device['companyId']})];
        final skipped = <Map<String, Object?>>[];
        for (final e in employments) {
          try {
            core.workerIdFor(layout, core.RepEmployee(employmentId: e['id']! as String, name: e['fullName']! as String, cpf: e['cpf'] as String?, pis: e['pis'] as String?));
          } on core.RepCommandError catch (err) {
            skipped.add({'employmentId': e['id'], 'name': e['fullName'], 'reason': err.message});
            continue;
          }
          jobs.add(('UPSERT_EMPLOYEE', {'employmentId': e['id']}));
          for (final b in (e['bios'] as List?) ?? const []) {
            jobs.add(('UPSERT_FINGERPRINT', {'employmentId': e['id'], 'biometricId': b}));
          }
        }
        for (final j in jobs) {
          await _queue(tx, tenantId, deviceId, j.$1, j.$2, user.id);
        }
        final result = {
          'layout': core.afdLayoutName(layout), 'queued': jobs.length, 'employees': employments.length - skipped.length,
          'fingerprints': jobs.where((j) => j.$1 == 'UPSERT_FINGERPRINT').length, 'skipped': skipped,
        };
        await app.audit.record(tx, tenantId: tenantId, actorUserId: user.id, action: 'CREATE', entity: 'device_sync', entityId: deviceId,
            after: {...result, 'skipped': skipped.length}, meta: meta);
        return result;
      });

  // ------------------------------------------------------------------ digitais
  static const _bioCols = 'id, employment_id, finger, format::text AS format, quality, captured_device_id, created_at';

  Future<Row> _employment(Tx tx, String id) async {
    final e = await tx.one('SELECT id, company_id, status::text AS status FROM employment_relationships WHERE id = @id AND deleted_at IS NULL', {'id': id});
    if (e == null) throw notFound('Vínculo não encontrado');
    return e;
  }

  /// Grava a digital cifrada, revoga a anterior do mesmo dedo e agenda o envio aos REPs da empresa.
  Future<Map<String, Object?>> enroll(String tenantId, String? userId, String employmentId, Map<String, Object?> input, Map<String, Object?> meta) async {
    final cipher = _requireCipher();
    final raw = base64.decode(input['template']! as String);
    if (raw.length < 64) throw badRequest('Template de digital muito pequeno: confira a captura');
    return db.forTenant(tenantId, (tx) async {
      final emp = await _employment(tx, employmentId);
      if (emp['status'] != 'ACTIVE') throw badRequest('Só é possível cadastrar digital de vínculo ativo');
      final hash = sha256Hex(raw);
      final previous = await tx.query('SELECT id, template_sha256 FROM biometric_templates WHERE employment_id = @e AND finger = @f AND format = @fmt AND revoked_at IS NULL',
          {'e': employmentId, 'f': input['finger'], 'fmt': input['format']});
      if (previous.any((p) => p['templateSha256'] == hash)) throw badRequest('Esta digital já está cadastrada');
      if (previous.isNotEmpty) {
        await tx.execute('UPDATE biometric_templates SET revoked_at = now() WHERE id::text = ANY(@ids)', {'ids': [for (final p in previous) p['id']! as String]});
      }
      final saved = (await tx.one(
        'INSERT INTO biometric_templates (id, tenant_id, employment_id, finger, format, template_enc, template_sha256, quality, captured_device_id, captured_by_id) '
        'VALUES (gen_random_uuid(), @t, @e, @f, @fmt, @enc, @h, @q, @cd, @u) RETURNING $_bioCols',
        {'t': tenantId, 'e': employmentId, 'f': input['finger'], 'fmt': input['format'], 'enc': cipher.encrypt(raw), 'h': hash, 'q': input['quality'],
          'cd': input['capturedDeviceId'], 'u': userId},
      ))!;
      final targets = await _repTargets(tx, emp['companyId']! as String);
      for (final d in targets) {
        // A fila guarda só a referência: o template é decifrado no momento do envio, nunca copiado.
        await _queue(tx, tenantId, d['id']! as String, 'UPSERT_FINGERPRINT', {'employmentId': employmentId, 'biometricId': saved['id']}, userId);
      }
      await app.audit.record(tx, tenantId: tenantId, actorUserId: userId, action: 'CREATE', entity: 'biometric_template', entityId: saved['id'] as String?,
          after: {...saved, 'replaced': [for (final p in previous) p['id']], 'queuedDevices': targets.length}, meta: meta);
      return {...saved, 'queuedDevices': targets.length};
    });
  }

  // ------------------------------------------------------------------ monitor
  Future<void> _notify(List<String> emails, String subject, String text) async {
    for (final to in emails) {
      try {
        await app.mail.send(OutgoingMail(to: to, subject: subject, text: text, html: '<p>${text.replaceAllMapped(RegExp('[&<>]'), (m) => '&#${m[0]!.codeUnitAt(0)};')}</p>'));
      } catch (e) {
        stderr.writeln('Falha ao enviar alerta: $e');
      }
    }
  }

  Future<void> seen(String tenantId, String deviceId, Map<String, Object?> info) async {
    final back = await db.forTenant(tenantId, (tx) async {
      final d = (await tx.one('SELECT status::text AS status, name, alert_emails FROM devices WHERE id = @id', {'id': deviceId}))!;
      await tx.execute(
          "UPDATE devices SET last_seen_at = now(), status = 'ONLINE', firmware = coalesce(@f, firmware), adapter_version = coalesce(@a, adapter_version), updated_at = now() WHERE id = @id",
          {'f': info['firmware'], 'a': info['adapterVersion'], 'id': deviceId});
      await tx.insert('device_logs', {'tenantId': tenantId, 'deviceId': deviceId, 'level': 'info', 'message': info['message'] != null ? 'Contato: ${info['message']}' : 'Contato do agente'});
      return d['status'] == 'OFFLINE' ? d : null;
    });
    if (back != null) {
      await db.forTenant(tenantId, (tx) => tx.insert('device_logs', {'tenantId': tenantId, 'deviceId': deviceId, 'level': 'warn', 'message': 'Comunicação restabelecida'}));
      final now = localBr(DateTime.now());
      final when = '${now.date.split('-').reversed.join('/')}, ${now.time}:${DateTime.now().second.toString().padLeft(2, '0')}';
      await _notify((back['alertEmails']! as List).cast<String>(), 'SuperPonto: ${back['name']} voltou a se comunicar', 'O equipamento ${back['name']} voltou a se comunicar em $when.');
    }
  }

  /// Equipamentos sem contato além do limite viram OFFLINE e disparam o alerta (uma vez por queda).
  Future<int> checkOffline([DateTime? now]) async {
    final at = now ?? DateTime.now();
    final candidates = await db.asPlatform((tx) => tx.query(
        "SELECT id, tenant_id, name, last_seen_at, collect_interval_minutes, alert_emails FROM devices WHERE deleted_at IS NULL AND status = 'ONLINE' AND last_seen_at IS NOT NULL"));
    var n = 0;
    for (final d in candidates) {
      final last = d['lastSeenAt']! as DateTime;
      if (at.difference(last).inMilliseconds < offlineAfterMinutes(d) * 60000) continue;
      final l = localBr(last);
      final since = '${l.date.split('-').reversed.join('/')}, ${l.time}:${core.localParts(last, 'America/Sao_Paulo').second.toString().padLeft(2, '0')}';
      await db.asPlatform((tx) async {
        await tx.execute("UPDATE devices SET status = 'OFFLINE', updated_at = now() WHERE id = @id", {'id': d['id']});
        await tx.insert('device_logs', {'tenantId': d['tenantId'], 'deviceId': d['id'], 'level': 'error', 'message': 'Sem comunicação desde $since'});
      });
      await _notify((d['alertEmails']! as List).cast<String>(), 'SuperPonto: ${d['name']} sem comunicação',
          'O equipamento ${d['name']} não se comunica desde $since. Verifique energia, rede e o agente local.');
      n++;
    }
    return n;
  }

  // ------------------------------------------------------------------ agente local
  Future<Row> _agentAuth(Ctx ctx) async {
    final key = ctx.header('x-device-key');
    if (key == null || !key.startsWith('spd_') || key.length > 100) throw unauthorized('Chave do equipamento ausente ou inválida');
    final d = await db.asPlatform((tx) => tx.one('SELECT id, tenant_id, status::text AS status FROM devices WHERE agent_key_hash = @h AND deleted_at IS NULL', {'h': sha256Hex(utf8.encode(key))}));
    if (d == null) throw unauthorized('Chave do equipamento ausente ou inválida');
    if (d['status'] == 'DISABLED') throw unauthorized('Equipamento desativado');
    return d;
  }

  Future<Map<String, Object?>> _applyData(String tenantId, String deviceId, String action, Map<String, Object?> data, String? actorId) async {
    if (action == 'RECEIVE_EMPLOYEES') {
      final list = ((data['employees'] as List?) ?? const []).cast<Map<String, Object?>>();
      await db.forTenant(tenantId, (tx) async {
        await tx.execute('DELETE FROM device_roster WHERE device_id = @d', {'d': deviceId});
        for (final e in list) {
          await tx.execute(
            'INSERT INTO device_roster (id, tenant_id, device_id, worker_id, name, registration, fingerprints) VALUES (gen_random_uuid(), @t, @d, @w, @n, @r, @f) ON CONFLICT DO NOTHING',
            {'t': tenantId, 'd': deviceId, 'w': e['workerId'], 'n': e['name'], 'r': e['registration'], 'f': e['fingerprints'] ?? 0},
          );
        }
      });
      return {'received': list.length};
    }
    if (action == 'RECEIVE_FINGERPRINTS') {
      // Digitais lidas do relógio entram cifradas para os funcionários da empresa (sem duplicar).
      final list = ((data['fingerprints'] as List?) ?? const []).cast<Map<String, Object?>>();
      final dev = (await db.forTenant(tenantId, (tx) => tx.one('SELECT company_id, ordinance::text AS ordinance FROM devices WHERE id = @id', {'id': deviceId})))!;
      final field = layoutOf(dev['ordinance'] as String?) == core.AfdLayout.p1510 ? 'pis' : 'cpf';
      var imported = 0, duplicates = 0, unmatched = 0;
      for (final f in list) {
        final emp = await db.forTenant(tenantId, (tx) => tx.scalar<String>(
            "SELECT e.id FROM employment_relationships e JOIN people p ON p.id = e.person_id WHERE e.company_id = @c AND e.deleted_at IS NULL AND e.status = 'ACTIVE' AND p.$field = @w LIMIT 1",
            {'c': dev['companyId'], 'w': (f['workerId']! as String).padLeft(11, '0')}));
        if (emp == null) {
          unmatched++;
          continue;
        }
        try {
          await enroll(tenantId, actorId, emp, {'finger': f['finger'], 'format': f['format'], 'template': f['template'], 'capturedDeviceId': deviceId}, {'ip': null, 'userAgent': 'agente-local'});
          imported++;
        } on HttpError catch (e) {
          if (e.body['message'].toString().contains('já está cadastrada')) {
            duplicates++;
          } else {
            rethrow;
          }
        }
      }
      return {'imported': imported, 'duplicates': duplicates, 'unmatched': unmatched};
    }
    if (action == 'RECEIVE_EMPLOYER') {
      final cnpj = await db.forTenant(tenantId, (tx) => tx.scalar<String>('SELECT c.cnpj FROM devices d JOIN companies c ON c.id = d.company_id WHERE d.id = @id', {'id': deviceId}));
      final employer = data['employer'] as Map<String, Object?>?;
      final matches = employer != null && cnpj != null && core.normalizeCnpj(employer['cnpj']! as String) == core.normalizeCnpj(cnpj);
      return {'employer': employer, 'matchesCompany': matches};
    }
    if (action == 'COLLECT_RECORDS') {
      if (data['afd'] == null) return {'imported': 0};
      final r = await importAfd(tenantId, actorId, deviceId, data['afd']! as String, {'ip': null, 'userAgent': 'agente-local'});
      return {'imported': r['imported'], 'duplicates': r['duplicates'], 'unmatched': (r['unmatched']! as List).length};
    }
    return {};
  }

  void routes() {
    final r = app.router;

    r.group('/v1', tag: 'equipamentos', () {
      r.post('/devices/:id/afd', permission: 'devices.commands:execute', (ctx) {
        final id = ctx.uuidParam('id');
        return importAfd(ctx.tenant, ctx.user.id, id, _afdUpload.parse(ctx.body)['content']! as String, ctx.meta);
      });
      r.post('/devices/:id/sync', permission: 'devices.commands:execute', (ctx) => syncRoster(ctx.tenant, ctx.user, ctx.uuidParam('id'), ctx.meta));
      r.get('/devices/:id/jobs', permission: 'devices.devices:read', (ctx) {
        final id = ctx.uuidParam('id');
        return db.forTenant(ctx.tenant, (tx) async {
          await _device(tx, id);
          return tx.query('SELECT id, action, payload, status::text AS status, attempts, last_error, scheduled_at, finished_at FROM device_sync_jobs WHERE device_id = @d ORDER BY scheduled_at DESC LIMIT 200', {'d': id});
        });
      });
      r.get('/employments/:id/fingerprints', permission: 'people.biometrics:manage', (ctx) {
        final id = ctx.uuidParam('id');
        return db.forTenant(ctx.tenant, (tx) async {
          await _employment(tx, id);
          return tx.query('SELECT $_bioCols FROM biometric_templates WHERE employment_id = @e AND revoked_at IS NULL ORDER BY finger ASC', {'e': id});
        });
      });
      r.post('/employments/:id/fingerprints', permission: 'people.biometrics:manage', (ctx) => enroll(ctx.tenant, ctx.user.id, ctx.uuidParam('id'), _fingerprint.parse(ctx.body), ctx.meta));
      r.delete('/employments/:id/fingerprints/:fid', permission: 'people.biometrics:manage', status: 204, (ctx) {
        final id = ctx.uuidParam('id'), fid = ctx.uuidParam('fid');
        final tenantId = ctx.tenant, userId = ctx.user.id;
        return db.forTenant(tenantId, (tx) async {
          final emp = await _employment(tx, id);
          final row = await tx.one('SELECT $_bioCols FROM biometric_templates WHERE id = @f AND employment_id = @e AND revoked_at IS NULL', {'f': fid, 'e': id});
          if (row == null) throw notFound('Digital não encontrada');
          await tx.execute('UPDATE biometric_templates SET revoked_at = now() WHERE id = @f', {'f': fid});
          for (final d in await _repTargets(tx, emp['companyId']! as String)) {
            await _queue(tx, tenantId, d['id']! as String, 'DELETE_FINGERPRINTS', {'employmentId': id, 'biometricId': fid}, userId);
          }
          await app.audit.record(tx, tenantId: tenantId, actorUserId: userId, action: 'DELETE', entity: 'biometric_template', entityId: fid, before: row, meta: ctx.meta);
          return null;
        });
      });
    });

    r.group('/v1/devices', tag: 'equipamentos', () {
      r.get('', permission: 'devices.devices:read', (ctx) {
        final q = Obj({'companyId': uuid.optional, 'groupName': const Str(max: 60).optional}).parse(ctx.query);
        return db.forTenant(ctx.tenant, (tx) async {
          final rows = await tx.query(
              'SELECT $_publicCols $_publicFrom WHERE d.deleted_at IS NULL${q['companyId'] != null ? ' AND d.company_id = @c' : ''}${q['groupName'] != null ? ' AND d.group_name = @g' : ''} '
              'ORDER BY d.group_name ASC NULLS LAST, d.name ASC',
              {'c': q['companyId'], 'g': q['groupName']});
          final counts = await tx.query(
              "SELECT device_id, count(*) FILTER (WHERE status IN ('QUEUED', 'RUNNING'))::int AS pending, count(*) FILTER (WHERE status = 'FAILED')::int AS failed "
              'FROM device_sync_jobs WHERE device_id::text = ANY(@ids) GROUP BY device_id',
              {'ids': [for (final x in rows) x['id']! as String]});
          return [
            for (final x in rows)
              {
                ..._shape(x),
                'pendingJobs': counts.where((c) => c['deviceId'] == x['id']).firstOrNull?['pending'] ?? 0,
                'failedJobs': counts.where((c) => c['deviceId'] == x['id']).firstOrNull?['failed'] ?? 0,
              },
          ];
        });
      });

      Future<Map<String, Object?>> command(String tenantId, AuthUser user, String id, String action, Map<String, Object?> meta) async {
        if (action == 'SYNC_EMPLOYEES') return syncRoster(tenantId, user, id, meta);
        return db.forTenant(tenantId, (tx) async {
          final d = await _device(tx, id);
          if (d['status'] == 'DISABLED') throw badRequest('Equipamento desativado');
          layoutOf(d['ordinance'] as String?);
          final job = (await tx.one("INSERT INTO device_sync_jobs (id, tenant_id, device_id, action, payload, created_by_id) VALUES (gen_random_uuid(), @t, @d, @a, '{}', @u) RETURNING id",
              {'t': tenantId, 'd': id, 'a': action, 'u': user.id}))!;
          await app.audit.record(tx, tenantId: tenantId, actorUserId: user.id, action: 'CREATE', entity: 'device_command', entityId: id, after: {'action': action, 'jobId': job['id']}, meta: meta);
          return {'queued': 1, 'jobId': job['id']};
        });
      }

      r.post('/group-command', permission: 'devices.commands:execute', (ctx) async {
        final b = Obj({'companyId': uuid, 'groupName': const Str(trim: true, min: 1, max: 60), 'action': const Enum(_actions)}).parse(ctx.body);
        final tenantId = ctx.tenant;
        final devices = await db.forTenant(tenantId, (tx) => tx.query(
            "SELECT id, name FROM devices WHERE company_id = @c AND group_name = @g AND deleted_at IS NULL AND status <> 'DISABLED'", {'c': b['companyId'], 'g': b['groupName']}));
        if (devices.isEmpty) throw notFound('Nenhum equipamento ativo neste grupo');
        final results = <Map<String, Object?>>[];
        for (final d in devices) {
          try {
            results.add({'deviceId': d['id'], 'name': d['name'], 'ok': true, 'result': await command(tenantId, ctx.user, d['id']! as String, b['action']! as String, ctx.meta)});
          } on HttpError catch (e) {
            results.add({'deviceId': d['id'], 'name': d['name'], 'ok': false, 'error': e.body['message'].toString()});
          }
        }
        return {'devices': results.length, 'results': results};
      });

      r.get('/:id', permission: 'devices.devices:read', (ctx) {
        final id = ctx.uuidParam('id');
        return db.forTenant(ctx.tenant, (tx) async => _shape(await _device(tx, id)));
      });

      r.post('', permission: 'devices.devices:manage', (ctx) async {
        final input = deviceSchema.parse(ctx.body);
        final tenantId = ctx.tenant;
        try {
          return await db.forTenant(tenantId, (tx) async {
            await _requireCompany(tx, input['companyId']);
            await _checkUnit(tx, input['unitId'], input['companyId']! as String);
            await assertLimit(tx, tenantId, 'limit.devices');
            final active = input.remove('active') == true;
            final created = await tx.insert('devices', {
              'tenantId': tenantId, ...input, 'alertEmails': (input['alertEmails']! as List).cast<String>(), 'status': active ? 'PENDING' : 'DISABLED',
            });
            final d = await _device(tx, created['id']! as String);
            await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'CREATE', entity: 'device', entityId: d['id'] as String?, after: _shape(d), meta: ctx.meta);
            return _shape(d);
          });
        } on DbError catch (e) {
          if (e.uniqueViolation) throw conflict('Já existe um equipamento com este número de série');
          rethrow;
        }
      });

      r.patch('/:id', permission: 'devices.devices:manage', (ctx) async {
        final id = ctx.uuidParam('id');
        final input = deviceSchema.partial.parse(ctx.body);
        final tenantId = ctx.tenant;
        try {
          return await db.forTenant(tenantId, (tx) async {
            final before = await _device(tx, id);
            await _checkUnit(tx, input['unitId'], before['companyId']! as String);
            final active = input.remove('active');
            input.remove('companyId');
            final status = active == false ? 'DISABLED' : active == true && before['status'] == 'DISABLED' ? 'PENDING' : null;
            await tx.update('devices', id, {
              ...input, if (input['alertEmails'] != null) 'alertEmails': (input['alertEmails']! as List).cast<String>(), 'status': ?status,
            });
            final d = await _device(tx, id);
            await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'UPDATE', entity: 'device', entityId: id, before: _shape(before), after: _shape(d), meta: ctx.meta);
            return _shape(d);
          });
        } on DbError catch (e) {
          if (e.uniqueViolation) throw conflict('Já existe um equipamento com este número de série');
          rethrow;
        }
      });

      r.delete('/:id', permission: 'devices.devices:manage', status: 204, (ctx) {
        final id = ctx.uuidParam('id');
        final tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          final before = await _device(tx, id);
          await tx.execute("UPDATE devices SET deleted_at = now(), agent_key_hash = NULL, status = 'DISABLED', updated_at = now() WHERE id = @id", {'id': id});
          await tx.execute("UPDATE device_sync_jobs SET status = 'CANCELLED' WHERE device_id = @id AND status = 'QUEUED'", {'id': id});
          await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'DELETE', entity: 'device', entityId: id, before: _shape(before), meta: ctx.meta);
          return null;
        });
      });

      // Gera (ou troca) a chave do agente local; ela só aparece agora.
      r.post('/:id/agent-key', permission: 'devices.devices:manage', status: 200, (ctx) {
        final id = ctx.uuidParam('id');
        final tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          await _device(tx, id);
          final key = 'spd_${b64url(randomBytes(24))}';
          await tx.execute('UPDATE devices SET agent_key_hash = @h, updated_at = now() WHERE id = @id', {'h': sha256Hex(utf8.encode(key)), 'id': id});
          await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'UPDATE', entity: 'device_agent_key', entityId: id, after: {'rotated': true}, meta: ctx.meta);
          return {'key': key};
        });
      });

      r.post('/:id/commands', permission: 'devices.commands:execute', (ctx) {
        final id = ctx.uuidParam('id');
        final b = Obj({'action': const Enum(_actions)}).parse(ctx.body);
        return command(ctx.tenant, ctx.user, id, b['action']! as String, ctx.meta);
      });

      r.post('/:id/jobs/retry', permission: 'devices.commands:execute', status: 200, (ctx) {
        final id = ctx.uuidParam('id');
        final tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          await _device(tx, id);
          final n = await tx.execute("UPDATE device_sync_jobs SET status = 'QUEUED', last_error = NULL, scheduled_at = now() WHERE device_id = @d AND status = 'FAILED'", {'d': id});
          await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'UPDATE', entity: 'device_command', entityId: id, after: {'retried': n}, meta: ctx.meta);
          return {'retried': n};
        });
      });

      r.delete('/:id/jobs/:jobId', permission: 'devices.commands:execute', status: 204, (ctx) {
        final id = ctx.uuidParam('id'), jobId = ctx.uuidParam('jobId');
        final tenantId = ctx.tenant;
        return db.forTenant(tenantId, (tx) async {
          await _device(tx, id);
          final job = await tx.one('SELECT status::text AS status FROM device_sync_jobs WHERE id = @j AND device_id = @d', {'j': jobId, 'd': id});
          if (job == null) throw notFound('Comando não encontrado');
          if (job['status'] != 'QUEUED' && job['status'] != 'FAILED') throw conflict('Só comandos na fila ou com falha podem ser cancelados');
          await tx.execute("UPDATE device_sync_jobs SET status = 'CANCELLED', finished_at = now() WHERE id = @j", {'j': jobId});
          await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: 'UPDATE', entity: 'device_command', entityId: jobId, after: {'status': 'CANCELLED'}, meta: ctx.meta);
          return null;
        });
      });

      // Funcionários no cadastro × lidos do relógio × último envio.
      r.get('/:id/roster', permission: 'devices.devices:read', (ctx) {
        final id = ctx.uuidParam('id');
        return db.forTenant(ctx.tenant, (tx) async {
          final d = await _device(tx, id);
          final layout = layoutOf(d['ordinance'] as String?);
          final emps = await tx.query(
            'SELECT e.id, e.registration, p.full_name, p.cpf, p.pis, (SELECT count(*)::int FROM biometric_templates b WHERE b.employment_id = e.id AND b.revoked_at IS NULL) AS bios '
            "FROM employment_relationships e JOIN people p ON p.id = e.person_id WHERE e.company_id = @c AND e.deleted_at IS NULL AND e.status = 'ACTIVE' ORDER BY p.full_name ASC",
            {'c': d['companyId']},
          );
          final roster = await tx.query('SELECT * FROM device_roster WHERE device_id = @d', {'d': id});
          final jobs = await tx.query(
              "SELECT status::text AS status, scheduled_at, finished_at, last_error, payload FROM device_sync_jobs WHERE device_id = @d AND action = 'UPSERT_EMPLOYEE' ORDER BY scheduled_at DESC",
              {'d': id});
          final byWorker = {for (final x in roster) (x['workerId']! as String).padLeft(11, '0'): x};
          final seenIds = <String>{};
          final rows = [
            for (final e in emps)
              () {
                String? workerId, problem;
                try {
                  workerId = core.workerIdFor(layout, core.RepEmployee(employmentId: e['id']! as String, name: e['fullName']! as String, cpf: e['cpf'] as String?, pis: e['pis'] as String?))
                      .value.padLeft(11, '0');
                } on core.RepCommandError catch (err) {
                  problem = err.message;
                }
                final inDevice = workerId == null ? null : byWorker[workerId];
                if (workerId != null) seenIds.add(workerId);
                final job = jobs.where((j) => (j['payload'] as Map?)?['employmentId'] == e['id']).firstOrNull;
                return <String, Object?>{
                  'employmentId': e['id'], 'name': e['fullName'], 'registration': e['registration'], 'workerId': workerId, 'problem': problem, 'fingerprints': e['bios'],
                  'inDevice': inDevice != null, 'deviceFingerprints': inDevice?['fingerprints'],
                  'lastSend': job == null ? null : {'status': job['status'], 'at': job['finishedAt'] ?? job['scheduledAt'], 'error': job['lastError']},
                };
              }(),
          ];
          final extra = [
            for (final x in roster)
              if (!seenIds.contains((x['workerId']! as String).padLeft(11, '0'))) {'workerId': x['workerId'], 'name': x['name'], 'registration': x['registration']},
          ];
          DateTime? receivedAt;
          for (final x in roster) {
            final at = x['receivedAt'] as DateTime?;
            if (at != null && (receivedAt == null || at.isAfter(receivedAt))) receivedAt = at;
          }
          return {
            'layout': core.afdLayoutName(layout), 'receivedAt': receivedAt, 'rows': rows, 'extra': extra,
            'totals': {
              'registry': rows.length, 'inDevice': rows.where((x) => x['inDevice'] == true).length,
              'missing': rows.where((x) => x['workerId'] != null && x['inDevice'] != true).length, 'extra': extra.length,
              'problems': rows.where((x) => x['problem'] != null).length,
            },
          };
        });
      });

      // Registros e comunicação por dia (gráfico).
      r.get('/:id/stats', permission: 'devices.devices:read', (ctx) {
        final id = ctx.uuidParam('id');
        final q = Obj({'days': const Num(int: true, coerce: true, min: 1, max: 60).def(14)}).parse(ctx.query);
        final days = q['days']! as int;
        return db.forTenant(ctx.tenant, (tx) async {
          final d = await _device(tx, id);
          final since = DateTime.now().subtract(Duration(days: days));
          final records = await tx.query(
              "SELECT to_char(recorded_at AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS day, count(*)::int AS n FROM time_records WHERE device_id = @d AND recorded_at >= @s GROUP BY 1",
              {'d': id, 's': since});
          final logs = await tx.query(
              "SELECT to_char(created_at AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS day, level, count(*)::int AS n FROM device_logs WHERE device_id = @d AND created_at >= @s GROUP BY 1, 2",
              {'d': id, 's': since});
          final out = [
            for (var i = days - 1; i >= 0; i--)
              () {
                final day = localBr(DateTime.now().subtract(Duration(days: i))).date;
                return {
                  'day': day,
                  'records': records.where((x) => x['day'] == day).firstOrNull?['n'] ?? 0,
                  'contacts': logs.where((l) => l['day'] == day && l['level'] == 'info').fold<int>(0, (s, l) => s + (l['n']! as int)),
                  'alerts': logs.where((l) => l['day'] == day && l['level'] != 'info').fold<int>(0, (s, l) => s + (l['n']! as int)),
                };
              }(),
          ];
          final recent = await tx.query('SELECT level, message, created_at FROM device_logs WHERE device_id = @d ORDER BY created_at DESC LIMIT 20', {'d': id});
          return {'lastSeenAt': d['lastSeenAt'], 'status': d['status'], 'offlineAfterMinutes': offlineAfterMinutes(d), 'days': out, 'recent': recent};
        });
      });

      // Registros originais coletados do equipamento (linhas do AFD), por período.
      r.get('/:id/afd-export', permission: 'reports.reports:export', (ctx) {
        final id = ctx.uuidParam('id');
        final q = Obj({'from': date, 'to': date}).parse(ctx.query);
        return db.forTenant(ctx.tenant, (tx) async {
          final d = await _device(tx, id);
          final events = await tx.query(
              "SELECT payload FROM device_events WHERE device_id = @d AND kind = 'TIME_RECORD' AND occurred_at >= @f AND occurred_at < @t ORDER BY nsr ASC",
              {'d': id, 'f': brMidnight(q['from']! as String), 't': brMidnight(q['to']! as String).add(const Duration(days: 1))});
          final lines = [for (final e in events) if ((e['payload'] as Map?)?['text'] is String && ((e['payload']! as Map)['text'] as String).isNotEmpty) (e['payload']! as Map)['text'] as String];
          final label = ((d['repNumber'] ?? d['serialNumber'] ?? d['name'])! as String).replaceAll(RegExp(r'[^\w-]'), '_');
          return {'filename': 'registros-$label-${q['from']}-${q['to']}.txt', 'lines': lines.length, 'content': lines.join('\r\n') + (lines.isEmpty ? '' : '\r\n')};
        });
      });
    });

    // ------------------------------------------------------------------ agente local
    r.group('/v1/agent', tag: 'agente local', () {
      r.post('/heartbeat', access: Access.public, status: 200, throttle: 60, (ctx) async {
        final input = _heartbeat.parse(ctx.body ?? <String, Object?>{});
        final d = await _agentAuth(ctx);
        final tenantId = d['tenantId']! as String;
        await seen(tenantId, d['id']! as String, input);
        final cfg = (await db.forTenant(tenantId, (tx) => tx.one(
            'SELECT name, manufacturer, model_name, host, port, ordinance::text AS ordinance, timezone, collect_interval_minutes FROM devices WHERE id = @id', {'id': d['id']})))!;
        return {
          'ok': true, 'serverTime': isoMs(DateTime.now()),
          'device': {
            'name': cfg['name'], 'manufacturer': cfg['manufacturer'], 'modelName': cfg['modelName'], 'host': cfg['host'], 'port': cfg['port'],
            'layout': core.afdLayoutName(layoutOf(cfg['ordinance'] as String?)), 'timezone': cfg['timezone'], 'collectIntervalMinutes': cfg['collectIntervalMinutes'] ?? 10,
          },
        };
      });

      // Entrega até 50 comandos da fila (marcados como em execução), já com os dados que o relógio precisa.
      r.get('/jobs', access: Access.public, throttle: 60, (ctx) async {
        final dev = await _agentAuth(ctx);
        final tenantId = dev['tenantId']! as String;
        await seen(tenantId, dev['id']! as String, const {});
        return db.forTenant(tenantId, (tx) async {
          final d = await _device(tx, dev['id']! as String);
          final layout = layoutOf(d['ordinance'] as String?);
          await tx.execute("UPDATE device_sync_jobs SET status = 'QUEUED' WHERE device_id = @d AND status = 'RUNNING' AND scheduled_at < @t",
              {'d': d['id'], 't': DateTime.now().subtract(const Duration(minutes: 15))});
          final jobs = await tx.query("SELECT * FROM device_sync_jobs WHERE device_id = @d AND status = 'QUEUED' AND scheduled_at <= now() ORDER BY scheduled_at ASC LIMIT 50", {'d': d['id']});
          final out = <Map<String, Object?>>[];
          for (final j in jobs) {
            final p = (j['payload'] as Map?)?.cast<String, Object?>() ?? const {};
            Map<String, Object?> data = {};
            try {
              final action = j['action']! as String;
              if (action == 'SET_EMPLOYER') {
                data = {
                  'employer': core.validateEmployer(core.RepEmployer(idType: 'CNPJ', id: d['cCnpj'] as String? ?? '', name: d['cLegalName']! as String,
                      location: (d['uName'] ?? d['cTradeName'] ?? d['cLegalName'])! as String)).toJson(),
                };
              } else if (action == 'SET_DATETIME') {
                data = {'now': isoMs(DateTime.now()), 'timezone': d['timezone']};
              } else if (action == 'UPSERT_EMPLOYEE' || action == 'UPSERT_FINGERPRINT' || action == 'DELETE_FINGERPRINTS') {
                final e = await tx.one('SELECT e.id, e.registration, p.full_name, p.cpf, p.pis FROM employment_relationships e JOIN people p ON p.id = e.person_id WHERE e.id = @id',
                    {'id': p['employmentId']});
                if (e == null) throw StateError('Vínculo não encontrado');
                final worker = core.workerIdFor(layout, core.RepEmployee(employmentId: e['id']! as String, name: e['fullName']! as String, cpf: e['cpf'] as String?, pis: e['pis'] as String?));
                data = {'worker': {'type': worker.type, 'value': worker.value}, 'name': core.repName(e['fullName']! as String), 'registration': e['registration']};
                if (action == 'UPSERT_FINGERPRINT' && p['biometricId'] != null) {
                  final b = await tx.one('SELECT finger, format::text AS format, template_enc FROM biometric_templates WHERE id = @id AND revoked_at IS NULL', {'id': p['biometricId']});
                  if (b == null) throw StateError('Digital não encontrada');
                  data = {...data, 'finger': b['finger'], 'format': b['format'], 'template': base64.encode(_requireCipher().decrypt(b['templateEnc']! as String))};
                }
              } else if (action == 'COLLECT_RECORDS') {
                final last = await tx.scalar<int>("SELECT max(nsr) FROM device_events WHERE device_id = @d AND kind = 'TIME_RECORD'", {'d': d['id']});
                data = {'sinceNsr': last ?? 0};
              }
            } catch (e) {
              final msg = e is core.RepCommandError ? e.message : e is HttpError ? e.body['message'].toString() : e is StateError ? e.message : e.toString();
              await tx.execute("UPDATE device_sync_jobs SET status = 'FAILED', attempts = attempts + 1, last_error = @m, finished_at = now() WHERE id = @id", {'m': msg, 'id': j['id']});
              continue;
            }
            await tx.execute("UPDATE device_sync_jobs SET status = 'RUNNING', attempts = attempts + 1, scheduled_at = now() WHERE id = @id", {'id': j['id']});
            out.add({'id': j['id'], 'action': j['action'], 'layout': core.afdLayoutName(layout), 'data': data});
          }
          return {'jobs': out};
        });
      });

      r.post('/jobs/:id/result', access: Access.public, status: 200, throttle: 600, (ctx) async {
        final jobId = ctx.uuidParam('id');
        var input = _result.parse(ctx.body);
        final dev = await _agentAuth(ctx);
        final tenantId = dev['tenantId']! as String, deviceId = dev['id']! as String;
        final job = await db.forTenant(tenantId, (tx) => tx.one('SELECT action, status::text AS status, created_by_id FROM device_sync_jobs WHERE id = @j AND device_id = @d', {'j': jobId, 'd': deviceId}));
        if (job == null) throw notFound('Comando não encontrado');
        if (job['status'] != 'RUNNING') throw conflict('Este comando não está em execução');
        var summary = <String, Object?>{};
        if (input['status'] == 'SUCCEEDED') {
          try {
            summary = await _applyData(tenantId, deviceId, job['action']! as String, (input['data'] as Map?)?.cast<String, Object?>() ?? const {}, job['createdById'] as String?);
          } catch (e) {
            input = {'status': 'FAILED', 'error': e is HttpError ? e.body['message'].toString() : e.toString()};
          }
        }
        final ok = input['status'] == 'SUCCEEDED';
        await db.forTenant(tenantId, (tx) async {
          await tx.execute('UPDATE device_sync_jobs SET status = @s, last_error = @e, finished_at = now() WHERE id = @j', {'s': input['status'], 'e': input['error'], 'j': jobId});
          if (ok) await tx.execute('UPDATE devices SET last_sync_at = now(), updated_at = now() WHERE id = @d', {'d': deviceId});
          await tx.insert('device_logs', {
            'tenantId': tenantId, 'deviceId': deviceId, 'level': ok ? 'info' : 'error',
            'message': '${job['action']}: ${ok ? 'concluído' : 'falhou — ${input['error'] ?? 'sem detalhe'}'}', 'details': jsonb(summary),
          });
        });
        return {'ok': ok, ...summary};
      });

      // Coleta enviada por conta própria do agente (sem comando), ex.: na coleta agendada.
      r.post('/afd', access: Access.public, status: 200, throttle: 30, (ctx) async {
        final b = _afdUpload.parse(ctx.body);
        final dev = await _agentAuth(ctx);
        final tenantId = dev['tenantId']! as String, deviceId = dev['id']! as String;
        await seen(tenantId, deviceId, const {});
        final res = await importAfd(tenantId, null, deviceId, b['content']! as String, {'ip': null, 'userAgent': 'agente-local'});
        await db.forTenant(tenantId, (tx) => tx.execute('UPDATE devices SET last_sync_at = now(), updated_at = now() WHERE id = @d', {'d': deviceId}));
        return {'imported': res['imported'], 'duplicates': res['duplicates'], 'unmatched': (res['unmatched']! as List).length, 'warnings': res['warnings']};
      });
    });

    if (!app.config.testHooks) app.every(const Duration(minutes: 1), () => checkOffline());
  }

  Future<void> _requireCompany(Tx tx, Object? id) async {
    if (await tx.one('SELECT 1 FROM companies WHERE id = @id AND deleted_at IS NULL', {'id': id}) == null) throw notFound('Empresa não encontrada');
  }

  Future<void> _checkUnit(Tx tx, Object? unitId, String companyId) async {
    if (unitId == null) return;
    final u = await tx.one('SELECT company_id FROM company_units WHERE id = @id AND deleted_at IS NULL', {'id': unitId});
    if (u == null || u['companyId'] != companyId) throw badRequest('Unidade não pertence a esta empresa');
  }
}
