// Leitura do AFD (Portarias 1.510/2009 e 671/2021, e REP-A da 373/2011) e geração do AFD do REP-P.
import 'dart:convert';
import 'package:crypto/crypto.dart';
import '../engine/time.dart';

enum AfdLayout { p1510, p671 }

String afdLayoutName(AfdLayout l) => l == AfdLayout.p1510 ? '1510' : '671';
AfdLayout afdLayoutFrom(String v) => v == '1510' ? AfdLayout.p1510 : AfdLayout.p671;

class AfdHeader {
  AfdHeader({required this.layout, required this.employerIdType, required this.employerId, required this.secondaryId, required this.employerName,
      required this.repId, required this.periodStart, required this.periodEnd, this.layoutVersion, this.manufacturerId, this.model});
  final AfdLayout layout;
  final String employerIdType, employerId, secondaryId, employerName, repId, periodStart, periodEnd;
  final String? layoutVersion, manufacturerId, model;
  Map<String, Object?> toJson() => {
        'layout': afdLayoutName(layout), 'employerIdType': employerIdType, 'employerId': employerId, 'secondaryId': secondaryId, 'employerName': employerName,
        'repId': repId, 'periodStart': periodStart, 'periodEnd': periodEnd, 'layoutVersion': ?layoutVersion, 'manufacturerId': ?manufacturerId, 'model': ?model,
      };
}

/// Registro do AFD: marcação, empregado, ajuste de relógio, empregador ou evento sensível.
class AfdRecord {
  AfdRecord({required this.kind, required this.nsr, required this.line, this.occurredAt, this.workerId, this.workerIdType, this.recordType, this.collector,
      this.connectionFlag, this.hash, this.operation, this.name, this.before, this.after, this.employerIdType, this.employerId, this.employerName, this.location, this.code});
  /// punch, employee, clock, employer, event
  final String kind;
  final int nsr, line;
  final DateTime? occurredAt, before, after;
  final String? workerId, workerIdType, recordType, collector, connectionFlag, hash, operation, name, employerIdType, employerId, employerName, location, code;

  Map<String, Object?> toJson() => {
        'kind': kind, 'nsr': nsr, 'line': line, 'occurredAt': ?occurredAt?.toUtc().toIso8601String(), 'workerId': ?workerId, 'workerIdType': ?workerIdType,
        'recordType': ?recordType, 'collector': ?collector, 'connectionFlag': ?connectionFlag, 'hash': ?hash, 'operation': ?operation, 'name': ?name,
        'before': ?before?.toUtc().toIso8601String(), 'after': ?after?.toUtc().toIso8601String(), 'employerIdType': ?employerIdType, 'employerId': ?employerId,
        'employerName': ?employerName, 'location': ?location, 'code': ?code,
      };
}

class AfdResult {
  AfdResult(this.layout, this.header, this.records, this.trailer, this.warnings);
  final AfdLayout layout;
  final AfdHeader? header;
  final List<AfdRecord> records;
  final Map<String, int>? trailer;
  final List<String> warnings;
  List<AfdRecord> get punches => records.where((r) => r.kind == 'punch').toList();
}

String _trimId(String v) => v.trim().replaceFirst(RegExp(r'^0+(?=\d)'), '');
String _text(String v) => v.replaceFirst(RegExp(r'\s+$'), '');
String _sl(String s, int a, int b) => s.length <= a ? '' : s.substring(a, s.length < b ? s.length : b);

DateTime _date1510(String ddmmaaaa, String hhmm, String tz) {
  final d = int.tryParse(_sl(ddmmaaaa, 0, 2)), m = int.tryParse(_sl(ddmmaaaa, 2, 4)), y = int.tryParse(_sl(ddmmaaaa, 4, 8));
  final h = int.tryParse(_sl(hhmm, 0, 2)), mi = int.tryParse(_sl(hhmm, 2, 4));
  if (d == null || m == null || y == null || h == null || mi == null || m < 1 || m > 12 || d < 1 || d > 31 || h > 23 || mi > 59) {
    throw FormatException('data inválida "$ddmmaaaa $hhmm"');
  }
  return zonedToUtc(y, m, d, h, mi, 0, tz);
}

DateTime _date671(String v) {
  final m = RegExp(r'^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?([+-])(\d{2}):?(\d{2})$').firstMatch(v.trim());
  if (m == null) throw FormatException('data inválida "${v.trim()}"');
  final offset = (int.parse(m[8]!) * 60 + int.parse(m[9]!)) * (m[7] == '-' ? -1 : 1);
  return DateTime.utc(int.parse(m[1]!), int.parse(m[2]!), int.parse(m[3]!), int.parse(m[4]!), int.parse(m[5]!), int.parse(m[6] ?? '0')).subtract(Duration(minutes: offset));
}

AfdLayout _detect(List<String> lines) {
  for (final l in lines) {
    if (_sl(l, 9, 10) == '1') return RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(_sl(l, 206, 216)) ? AfdLayout.p671 : AfdLayout.p1510;
  }
  return lines.any((l) => RegExp(r'^\d{9}\d\d{4}-\d{2}-\d{2}T').hasMatch(l)) ? AfdLayout.p671 : AfdLayout.p1510;
}

/// Lê o AFD; linhas com problema viram avisos com o número da linha.
AfdResult parseAfd(String content, {String timeZone = 'America/Sao_Paulo'}) {
  final lines = content.replaceFirst('﻿', '').split(RegExp(r'\r?\n'));
  final layout = _detect(lines);
  final warnings = <String>[];
  final records = <AfdRecord>[];
  AfdHeader? header;
  Map<String, int>? trailer;
  var lastNsr = 0;
  for (var i = 0; i < lines.length; i++) {
    final raw = lines[i];
    final line = i + 1;
    if (raw.trim().isEmpty) continue;
    final type = _sl(raw, 9, 10);
    try {
      if (raw.startsWith('999999999')) {
        int n(int a) => int.tryParse(_sl(raw, a, a + 9)) ?? 0;
        trailer = layout == AfdLayout.p1510 ? {'2': n(9), '3': n(18), '4': n(27), '5': n(36)} : {'2': n(9), '3': n(18), '4': n(27), '5': n(36), '6': n(45), '7': n(54)};
        continue;
      }
      final nsr = int.tryParse(_sl(raw, 0, 9)) ?? 0;
      if (type != '1') {
        if (nsr <= 0) throw const FormatException('NSR inválido');
        if (nsr <= lastNsr) {
          warnings.add('linha $line: NSR $nsr fora de ordem (anterior $lastNsr)');
        } else if (lastNsr > 0 && nsr != lastNsr + 1) {
          warnings.add('linha $line: lacuna de NSR entre $lastNsr e $nsr');
        }
        if (nsr > lastNsr) lastNsr = nsr;
      }
      if (layout == AfdLayout.p1510) {
        switch (type) {
          case '1':
            header = AfdHeader(layout: layout, employerIdType: _sl(raw, 10, 11) == '2' ? 'CPF' : 'CNPJ', employerId: _sl(raw, 11, 25).trim(), secondaryId: _sl(raw, 25, 37).trim(),
                employerName: _text(_sl(raw, 37, 187)), repId: _sl(raw, 187, 204).trim(), periodStart: _sl(raw, 204, 212), periodEnd: _sl(raw, 212, 220));
          case '2':
            records.add(AfdRecord(kind: 'employer', nsr: nsr, line: line, occurredAt: _date1510(_sl(raw, 10, 18), _sl(raw, 18, 22), timeZone), employerIdType: _sl(raw, 22, 23) == '2' ? 'CPF' : 'CNPJ',
                employerId: _sl(raw, 23, 37).trim(), employerName: _text(_sl(raw, 49, 199)), location: _text(_sl(raw, 199, 299))));
          case '3':
            final wid = _trimId(_sl(raw, 22, 34));
            if (!RegExp(r'^\d{11}$').hasMatch(wid.padLeft(11, '0'))) throw const FormatException('PIS inválido');
            records.add(AfdRecord(kind: 'punch', nsr: nsr, line: line, occurredAt: _date1510(_sl(raw, 10, 18), _sl(raw, 18, 22), timeZone), workerId: wid, workerIdType: 'PIS', recordType: '3'));
          case '4':
            records.add(AfdRecord(kind: 'clock', nsr: nsr, line: line, before: _date1510(_sl(raw, 10, 18), _sl(raw, 18, 22), timeZone), after: _date1510(_sl(raw, 22, 30), _sl(raw, 30, 34), timeZone)));
          case '5':
            records.add(AfdRecord(kind: 'employee', nsr: nsr, line: line, occurredAt: _date1510(_sl(raw, 10, 18), _sl(raw, 18, 22), timeZone), operation: _sl(raw, 22, 23),
                workerId: _trimId(_sl(raw, 23, 35)), workerIdType: 'PIS', name: _text(_sl(raw, 35, 87))));
          default:
            warnings.add('linha $line: tipo de registro "$type" desconhecido no leiaute 1510');
        }
      } else {
        switch (type) {
          case '1':
            header = AfdHeader(layout: layout, employerIdType: _sl(raw, 10, 11) == '2' ? 'CPF' : 'CNPJ', employerId: _sl(raw, 11, 25).trim(), secondaryId: _sl(raw, 25, 39).trim(),
                employerName: _text(_sl(raw, 39, 189)), repId: _sl(raw, 189, 206).trim(), periodStart: _sl(raw, 206, 216), periodEnd: _sl(raw, 216, 226),
                layoutVersion: _sl(raw, 250, 253), manufacturerId: _sl(raw, 254, 268).trim(), model: _text(_sl(raw, 268, 298)));
          case '2':
            records.add(AfdRecord(kind: 'employer', nsr: nsr, line: line, occurredAt: _date671(_sl(raw, 10, 34)), employerIdType: _sl(raw, 48, 49) == '2' ? 'CPF' : 'CNPJ',
                employerId: _sl(raw, 49, 63).trim(), employerName: _text(_sl(raw, 77, 227)), location: _text(_sl(raw, 227, 327))));
          case '3':
            records.add(AfdRecord(kind: 'punch', nsr: nsr, line: line, occurredAt: _date671(_sl(raw, 10, 34)), workerId: _trimId(_sl(raw, 34, 46)), workerIdType: 'CPF', recordType: '3'));
          case '4':
            records.add(AfdRecord(kind: 'clock', nsr: nsr, line: line, before: _date671(_sl(raw, 10, 34)), after: _date671(_sl(raw, 34, 58))));
          case '5':
            records.add(AfdRecord(kind: 'employee', nsr: nsr, line: line, occurredAt: _date671(_sl(raw, 10, 34)), operation: _sl(raw, 34, 35), workerId: _trimId(_sl(raw, 35, 47)),
                workerIdType: 'CPF', name: _text(_sl(raw, 47, 99))));
          case '6':
            records.add(AfdRecord(kind: 'event', nsr: nsr, line: line, occurredAt: _date671(_sl(raw, 10, 34)), code: _sl(raw, 34, 36)));
          case '7':
            final h = _sl(raw, 73, 137).trim();
            records.add(AfdRecord(kind: 'punch', nsr: nsr, line: line, occurredAt: _date671(_sl(raw, 10, 34)), workerId: _trimId(_sl(raw, 34, 46)), workerIdType: 'CPF', recordType: '7',
                collector: _sl(raw, 70, 72), connectionFlag: _sl(raw, 72, 73), hash: h.isEmpty ? null : h));
          default:
            warnings.add('linha $line: tipo de registro "$type" desconhecido no leiaute 671');
        }
      }
    } on FormatException catch (e) {
      warnings.add('linha $line: ${e.message}');
    }
  }
  if (trailer != null) {
    final count3 = records.where((r) => r.kind == 'punch' && r.recordType == '3').length;
    if (trailer['3'] != count3) warnings.add('trailer informa ${trailer['3']} marcações tipo 3, arquivo tem $count3');
  }
  return AfdResult(layout, header, records, trailer, warnings);
}

// ------------------------------------------------------------------ geração (REP-P, Portaria 671)

/// CRC-16/KERMIT em 4 dígitos hexadecimais.
String crc16(String text) {
  var crc = 0;
  for (final b in latin1.encode(text)) {
    crc ^= b;
    for (var i = 0; i < 8; i++) {
      crc = (crc & 1) != 0 ? (crc >> 1) ^ 0x8408 : crc >> 1;
    }
  }
  return crc.toRadixString(16).toUpperCase().padLeft(4, '0');
}

String _l(Object v, int n) {
  final s = v.toString().padLeft(n, '0');
  return s.substring(s.length - n);
}

String _r(String v, int n) {
  final clean = removeAccents(v).replaceAll(RegExp(r'[^\x20-\x7e]'), ' ');
  final p = clean.padRight(n);
  return p.substring(0, n);
}

String removeAccents(String s) {
  const from = 'ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖòóôõöÙÚÛÜùúûüÇçÑñÝýÿ';
  const to = 'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNnYyy';
  final b = StringBuffer();
  for (final ch in s.split('')) {
    final i = from.indexOf(ch);
    b.write(i >= 0 ? to[i] : ch);
  }
  return b.toString();
}

/// AAAA-MM-DDThh:mm:00-0300 (com segundos quando pedido).
String afdDateTime(DateTime at, {String timeZone = 'America/Sao_Paulo', bool withSeconds = false}) {
  final p = localParts(at, timeZone);
  final off = p.offsetMinutes;
  final a = off.abs();
  return '${_l(p.year, 4)}-${_l(p.month, 2)}-${_l(p.day, 2)}T${_l(p.hour, 2)}:${_l(p.minute, 2)}:${withSeconds ? _l(p.second, 2) : '00'}${off < 0 ? '-' : '+'}${_l(a ~/ 60, 2)}${_l(a % 60, 2)}';
}

String afdHeader671({required String employerIdType, required String employerId, String secondaryId = '', required String employerName, required String repId,
    required String periodStart, required String periodEnd, required DateTime generatedAt, required String developerId, required String model, String timeZone = 'America/Sao_Paulo'}) {
  final dev = developerId.replaceAll(RegExp(r'\W'), '');
  final line = '${_l(0, 9)}1${employerIdType == 'CPF' ? '2' : '1'}${_r(employerId.replaceAll(RegExp(r'\W'), ''), 14)}${_r(secondaryId, 14)}${_r(employerName, 150)}'
      '${_l(repId.isEmpty ? '0' : repId, 17)}$periodStart$periodEnd${afdDateTime(generatedAt, timeZone: timeZone)}003${developerId.replaceAll(RegExp(r'\D'), '').length == 11 ? '2' : '1'}'
      '${_r(dev, 14)}${_r(model, 30)}';
  return line + crc16(line);
}

/// Registro tipo 7 (REP-P): hash = SHA-256(campos + hash anterior).
({String line, String hash}) afdRecord7({required int nsr, required DateTime at, required String cpf, required DateTime recordedAt, required String collector,
    required bool offline, String? previousHash, String timeZone = 'America/Sao_Paulo'}) {
  final body = '${_l(nsr, 9)}7${afdDateTime(at, timeZone: timeZone)}${_l(cpf.replaceAll(RegExp(r'\D'), ''), 12)}${afdDateTime(recordedAt, timeZone: timeZone, withSeconds: true)}$collector${offline ? '1' : '0'}';
  final hash = sha256.convert(utf8.encode(body + (previousHash ?? ''))).toString();
  return (line: body + hash, hash: hash);
}

String afdTrailer671(Map<String, int> counts) => '999999999${['2', '3', '4', '5', '6', '7'].map((k) => _l(counts[k] ?? 0, 9)).join()}9';
