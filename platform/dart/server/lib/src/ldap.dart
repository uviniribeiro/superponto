// Cliente LDAP v3 mínimo (RFC 4511): bind simples, busca com filtro (RFC 4515), STARTTLS e ldaps://.
// Usado só para conferir login no diretório do próprio cliente; nunca grava nada no diretório.
import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

class LdapError implements Exception {
  LdapError(this.code, this.message);

  /// código de resultado LDAP (49 = credenciais inválidas, 32 = objeto inexistente...) ou -1 (rede/protocolo)
  final int code;
  final String message;
  @override
  String toString() => 'LdapError($code): $message';
}

class FilterError implements Exception {
  FilterError(this.message);
  final String message;
}

// ------------------------------------------------------------------ BER
List<int> _len(int n) {
  if (n < 0x80) return [n];
  final bytes = <int>[];
  for (var v = n; v > 0; v >>= 8) {
    bytes.insert(0, v & 0xff);
  }
  return [0x80 | bytes.length, ...bytes];
}

List<int> _tlv(int tag, List<int> value) => [tag, ..._len(value.length), ...value];
List<int> _int(int tag, int v) {
  final bytes = <int>[];
  var x = v;
  do {
    bytes.insert(0, x & 0xff);
    x >>= 8;
  } while (x > 0);
  if (bytes.first & 0x80 != 0) bytes.insert(0, 0);
  return _tlv(tag, bytes);
}

List<int> _str(int tag, String s) => _tlv(tag, utf8.encode(s));
List<int> _seq(int tag, List<List<int>> items) => _tlv(tag, [for (final i in items) ...i]);

class _Ber {
  _Ber(this.tag, this.value);
  final int tag;
  final Uint8List value;
  List<_Ber> get children {
    final out = <_Ber>[];
    var i = 0;
    while (i < value.length) {
      final r = _readTlv(value, i);
      if (r == null) throw LdapError(-1, 'Resposta LDAP malformada');
      out.add(r.$1);
      i = r.$2;
    }
    return out;
  }

  int get asInt {
    var v = 0;
    for (final b in value) {
      v = (v << 8) | b;
    }
    return v;
  }

  String get asString => utf8.decode(value, allowMalformed: true);
}

/// Lê um TLV a partir de `i`; devolve (elemento, próxima posição) ou null se ainda faltam bytes.
(_Ber, int)? _readTlv(Uint8List b, int i) {
  if (i + 2 > b.length) return null;
  final tag = b[i];
  var p = i + 1;
  var len = b[p++];
  if (len & 0x80 != 0) {
    final n = len & 0x7f;
    if (n == 0 || n > 4 || p + n > b.length) return n > 4 ? throw LdapError(-1, 'Resposta LDAP grande demais') : null;
    len = 0;
    for (var k = 0; k < n; k++) {
      len = (len << 8) | b[p++];
    }
  }
  if (p + len > b.length) return null;
  return (_Ber(tag, Uint8List.sublistView(b, p, p + len)), p + len);
}

// ------------------------------------------------------------------ filtro (RFC 4515)
String _unescape(String v) {
  final out = <int>[];
  for (var i = 0; i < v.length; i++) {
    if (v[i] == r'\') {
      if (i + 2 >= v.length) throw FilterError('Escape incompleto no filtro');
      final hex = v.substring(i + 1, i + 3);
      final b = int.tryParse(hex, radix: 16);
      if (b == null) throw FilterError('Escape inválido no filtro');
      out.add(b);
      i += 2;
    } else {
      out.addAll(utf8.encode(v[i]));
    }
  }
  return utf8.decode(out, allowMalformed: true);
}

List<int> encodeFilter(String f) {
  var pos = 0;
  List<int> parse() {
    if (pos >= f.length || f[pos] != '(') throw FilterError('Filtro deve começar com "("');
    pos++;
    final c = f[pos];
    List<int> out;
    if (c == '&' || c == '|') {
      pos++;
      final items = <List<int>>[];
      while (pos < f.length && f[pos] == '(') {
        items.add(parse());
      }
      out = _seq(c == '&' ? 0xa0 : 0xa1, items);
    } else if (c == '!') {
      pos++;
      out = _tlv(0xa2, parse());
    } else {
      final end = f.indexOf(')', pos);
      if (end < 0) throw FilterError('Filtro sem ")"');
      final item = f.substring(pos, end);
      pos = end;
      final m = RegExp(r'^([A-Za-z0-9;.\-]+)(~=|>=|<=|=)(.*)$').firstMatch(item);
      if (m == null) throw FilterError('Item de filtro inválido: $item');
      final attr = m[1]!, op = m[2]!, val = m[3]!;
      if (op == '=' && val == '*') {
        out = _str(0x87, attr);
      } else if (op == '=' && val.contains('*')) {
        final parts = val.split('*');
        final subs = <List<int>>[];
        for (var i = 0; i < parts.length; i++) {
          if (parts[i].isEmpty) continue;
          final tag = i == 0
              ? 0x80
              : i == parts.length - 1
              ? 0x82
              : 0x81;
          subs.add(_str(tag, _unescape(parts[i])));
        }
        out = _seq(0xa4, [_str(0x04, attr), _seq(0x30, subs)]);
      } else {
        final tag = switch (op) {
          '~=' => 0xa8,
          '>=' => 0xa5,
          '<=' => 0xa6,
          _ => 0xa3,
        };
        out = _seq(tag, [_str(0x04, attr), _str(0x04, _unescape(val))]);
      }
    }
    if (pos >= f.length || f[pos] != ')') throw FilterError('Filtro sem ")"');
    pos++;
    return out;
  }

  final r = parse();
  if (pos != f.length) throw FilterError('Texto sobrando no filtro');
  return r;
}

/// Escape de valores em filtros LDAP (RFC 4515): impede injeção como "*)(uid=*".
String escapeFilterValue(String v) => v.replaceAllMapped(RegExp(r'[\\*()\x00]'), (m) => '\\${m[0]!.codeUnitAt(0).toRadixString(16).padLeft(2, '0')}');

/// Monta o filtro trocando {email} e {login} (parte antes do @), sempre com escape.
String buildFilter(String template, String email) {
  final login = email.split('@').first;
  return template.replaceAll('{email}', escapeFilterValue(email)).replaceAll('{login}', escapeFilterValue(login));
}

// ------------------------------------------------------------------ cliente
class LdapClient {
  LdapClient._(this._socket, this._timeout) {
    _listen();
  }
  Socket _socket;
  final Duration _timeout;
  final _buf = BytesBuilder(copy: false);
  var _id = 0;
  final _waiting = <int, (Completer<List<_Ber>>, List<_Ber>, Set<int>)>{};
  StreamSubscription<Uint8List>? _sub;
  Object? _closedWith;

  static Future<LdapClient> connect(Uri url, {required Duration timeout, bool allowInsecureTls = false}) async {
    final secure = url.scheme == 'ldaps';
    final host = url.host;
    final port = url.hasPort ? url.port : (secure ? 636 : 389);
    try {
      final Socket s = secure
          ? await SecureSocket.connect(host, port, timeout: timeout, onBadCertificate: (_) => allowInsecureTls, supportedProtocols: null)
          : await Socket.connect(host, port, timeout: timeout);
      return LdapClient._(s, timeout);
    } on Object catch (e) {
      throw LdapError(-1, 'Sem conexão com $host:$port ($e)');
    }
  }

  void _listen() {
    _sub = _socket.listen(
      (data) {
        _buf.add(data);
        var bytes = _buf.takeBytes();
        var i = 0;
        while (true) {
          final r = _readTlv(bytes, i);
          if (r == null) break;
          i = r.$2;
          final msg = r.$1.children;
          if (msg.length < 2) continue;
          final id = msg[0].asInt, op = msg[1];
          final w = _waiting[id];
          if (w == null) continue;
          w.$2.add(op);
          if (w.$3.contains(op.tag)) {
            _waiting.remove(id);
            w.$1.complete(w.$2);
          }
        }
        if (i < bytes.length) _buf.add(Uint8List.sublistView(bytes, i));
        bytes = Uint8List(0);
      },
      onError: (Object e) => _fail(e),
      onDone: () => _fail(LdapError(-1, 'Conexão encerrada pelo servidor')),
      cancelOnError: true,
    );
  }

  void _fail(Object e) {
    _closedWith = e;
    for (final w in _waiting.values) {
      if (!w.$1.isCompleted) w.$1.completeError(e is LdapError ? e : LdapError(-1, e.toString()));
    }
    _waiting.clear();
  }

  Future<List<_Ber>> _send(List<int> op, Set<int> doneTags) {
    if (_closedWith != null) return Future.error(LdapError(-1, 'Conexão encerrada'));
    final id = ++_id;
    final c = Completer<List<_Ber>>();
    _waiting[id] = (c, <_Ber>[], doneTags);
    _socket.add(_seq(0x30, [_int(0x02, id), op]));
    return c.future.timeout(
      _timeout,
      onTimeout: () {
        _waiting.remove(id);
        throw LdapError(-1, 'Tempo esgotado esperando o servidor LDAP');
      },
    );
  }

  static void _check(_Ber result) {
    final f = result.children;
    final code = f[0].asInt;
    if (code != 0 && code != 4) throw LdapError(code, f.length > 2 ? f[2].asString : 'Erro LDAP $code');
  }

  /// STARTTLS (OID 1.3.6.1.4.1.1466.20037) e troca o socket por um TLS.
  Future<void> startTls({required String host, bool allowInsecureTls = false}) async {
    final res = await _send(_seq(0x77, [_str(0x80, '1.3.6.1.4.1.1466.20037')]), {0x78});
    _check(res.last);
    await _sub?.cancel();
    _socket = await SecureSocket.secure(_socket, host: host, onBadCertificate: (_) => allowInsecureTls).timeout(_timeout);
    _listen();
  }

  Future<void> bind(String dn, String password) async {
    final res = await _send(_seq(0x60, [_int(0x02, 3), _str(0x04, dn), _str(0x80, password)]), {0x61});
    _check(res.last);
  }

  /// Busca na subárvore; devolve os DNs encontrados (até `sizeLimit`).
  Future<List<String>> search(String base, String filter, {int sizeLimit = 2, List<String> attributes = const ['dn']}) async {
    final f = encodeFilter(filter);
    final req = _seq(0x63, [
      _str(0x04, base),
      _int(0x0a, 2),
      _int(0x0a, 0),
      _int(0x02, sizeLimit),
      _int(0x02, _timeout.inSeconds.clamp(1, 3600)),
      _tlv(0x01, [0]),
      f,
      _seq(0x30, [for (final a in attributes) _str(0x04, a)]),
    ]);
    final res = await _send(req, {0x65});
    _check(res.last);
    return [
      for (final r in res)
        if (r.tag == 0x64) r.children.first.asString,
    ];
  }

  Future<void> close() async {
    try {
      if (_closedWith == null) {
        _socket.add(
          _seq(0x30, [
            _int(0x02, ++_id),
            [0x42, 0x00],
          ]),
        );
        await _socket.flush().timeout(const Duration(seconds: 1));
      }
    } catch (_) {
      /* já fechado */
    }
    await _sub?.cancel();
    _socket.destroy();
  }
}
