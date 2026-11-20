// Login pelo diretório do cliente (LDAP/AD): configuração por cliente, teste de conexão e verificação de senha.
// A conta de serviço busca o usuário pelo filtro e a senha é conferida com um bind do próprio usuário.
import 'dart:convert';
import 'dart:io';

import '../app.dart';
import '../auth/auth_service.dart';
import '../crypto/tokens.dart' show FieldCipher;
import '../db.dart';
import '../http.dart';
import '../ldap.dart';
import '../validate.dart';

final _config = Obj({
  'enabled': const Bool(),
  'url': Str(trim: true, max: 300, pattern: RegExp(r'^ldaps?://', caseSensitive: false), patternMessage: 'Use ldap:// ou ldaps://'),
  'startTls': const Bool().def(false),
  'allowInsecureTls': const Bool().def(false),
  'bindDn': const Str(trim: true, max: 500).nullish,
  'bindPassword': const Str(max: 500).nullish,
  'baseDn': const Str(trim: true, min: 3, max: 500),
  'userFilter': const Str(trim: true, max: 500)
      .refine((v) => (v as String).contains('{email}') || v.contains('{login}'), 'O filtro precisa conter {email} ou {login}')
      .refine((v) => (v as String).startsWith('(') && v.endsWith(')'), 'O filtro deve estar entre parênteses, ex.: (mail={email})')
      .def('(mail={email})'),
  'timeoutMs': const Num(int: true, min: 1000, max: 30000).def(5000),
});
final _test = Obj({'email': email, 'password': const Str(max: 500).optional});

const _messages = {
  'not_found': 'Conexão funcionou, mas nenhum usuário com este e-mail foi encontrado no diretório (confira a base e o filtro).',
  'ambiguous': 'Mais de um usuário corresponde ao filtro: ajuste-o para encontrar uma única conta.',
  'invalid_credentials': 'Conta de serviço ou senha do usuário recusada pelo diretório.',
  'unreachable': 'Não foi possível conectar ao servidor LDAP.',
  'config': 'O diretório recusou a configuração (DN, base ou filtro inválidos).',
};

bool isPrivateAddress(InternetAddress a) {
  if (a.type == InternetAddressType.IPv6) {
    final v = a.address.toLowerCase();
    if (v == '::1' || v == '::') return true;
    if (v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80')) return true;
    final mapped = RegExp(r'^::ffff:(\d+\.\d+\.\d+\.\d+)$').firstMatch(v);
    return mapped != null && isPrivateAddress(InternetAddress(mapped[1]!));
  }
  final p = a.address.split('.').map(int.parse).toList();
  return p[0] == 10 || p[0] == 127 || p[0] == 0 || (p[0] == 169 && p[1] == 254) || (p[0] == 172 && p[1] >= 16 && p[1] <= 31) || (p[0] == 192 && p[1] == 168) ||
      (p[0] == 100 && p[1] >= 64 && p[1] <= 127);
}

class LdapService implements LdapAuthenticator {
  LdapService({required this.allowPrivateHosts, String? secretsKey}) : _cipher = secretsKey == null ? null : FieldCipher(secretsKey);
  final bool allowPrivateHosts;
  final FieldCipher? _cipher;

  FieldCipher get _requireCipher => _cipher ?? (throw unavailable('Login por LDAP desativado: configure SECRETS_ENCRYPTION_KEY na API'));
  String encrypt(String secret) => _requireCipher.encrypt(utf8.encode(secret));
  String? _decrypt(String? enc) => enc == null ? null : utf8.decode(_requireCipher.decrypt(enc));

  /// Só ldap:// ou ldaps://; endereço interno só com LDAP_ALLOW_PRIVATE_HOSTS (instalação própria).
  Future<void> assertSafeUrl(String raw) async {
    final u = Uri.tryParse(raw);
    if (u == null || u.host.isEmpty && !raw.contains('://')) throw badRequest('Endereço do servidor LDAP inválido');
    if (u.scheme != 'ldap' && u.scheme != 'ldaps') throw badRequest('Use ldap:// ou ldaps://');
    if (u.userInfo.isNotEmpty || (u.path.isNotEmpty && u.path != '/') || u.hasQuery) {
      throw badRequest('Informe só protocolo, servidor e porta (ex.: ldaps://ad.empresa.com.br:636)');
    }
    if (allowPrivateHosts) return;
    final host = u.host.replaceAll(RegExp(r'^\[|\]$'), '');
    List<InternetAddress> addresses;
    try {
      final ip = InternetAddress.tryParse(host);
      addresses = ip != null ? [ip] : await InternetAddress.lookup(host);
    } catch (_) {
      throw badRequest('Servidor LDAP não encontrado (DNS)');
    }
    if (addresses.isEmpty || addresses.any(isPrivateAddress)) {
      throw badRequest('O servidor LDAP precisa ter endereço público (com TLS). Endereços internos só em instalação própria do SuperPonto.');
    }
  }

  Future<LdapClient> _client(Row s) async {
    final url = Uri.parse(s['url']! as String);
    final c = await LdapClient.connect(url, timeout: Duration(milliseconds: s['timeoutMs'] as int? ?? 5000), allowInsecureTls: s['allowInsecureTls'] == true);
    if (s['startTls'] == true) await c.startTls(host: url.host, allowInsecureTls: s['allowInsecureTls'] == true);
    return c;
  }

  Map<String, Object?> _failure(Object e) {
    if (e is LdapError && e.code == 49) return {'ok': false, 'reason': 'invalid_credentials'};
    if ((e is LdapError && (e.code == 32 || e.code == 34)) || e is FilterError) return {'ok': false, 'reason': 'config', 'detail': e.toString()};
    stderr.writeln('Falha ao falar com o servidor LDAP: $e');
    return {'ok': false, 'reason': 'unreachable', 'detail': e.toString()};
  }

  /// Busca o DN do usuário com a conta de serviço (ou anônima, se não houver conta).
  Future<Map<String, Object?>> findUser(Row s, String email) async {
    await assertSafeUrl(s['url']! as String);
    LdapClient? c;
    try {
      c = await _client(s);
      final pass = _decrypt(s['bindPasswordEnc'] as String?);
      if (s['bindDn'] != null) {
        if (pass == null || pass.isEmpty) return {'ok': false, 'reason': 'config', 'detail': 'Conta de serviço sem senha'};
        await c.bind(s['bindDn']! as String, pass);
      }
      final dns = await c.search(s['baseDn']! as String, buildFilter(s['userFilter']! as String, email));
      if (dns.isEmpty) return {'ok': false, 'reason': 'not_found'};
      if (dns.length > 1) return {'ok': false, 'reason': 'ambiguous'};
      return {'ok': true, 'dn': dns.first};
    } on HttpError {
      rethrow;
    } catch (e) {
      return _failure(e);
    } finally {
      await c?.close();
    }
  }

  /// Confere e-mail + senha no diretório. Senha vazia nunca é enviada (evita "bind anônimo").
  Future<Map<String, Object?>> check(Row s, String email, String password) async {
    if (password.isEmpty) return {'ok': false, 'reason': 'invalid_credentials'};
    final found = await findUser(s, email);
    if (found['ok'] != true) return found;
    LdapClient? c;
    try {
      c = await _client(s);
      await c.bind(found['dn']! as String, password);
      return found;
    } catch (e) {
      return _failure(e);
    } finally {
      await c?.close();
    }
  }

  @override
  Future<String> authenticate(Row config, String email, String password) async {
    try {
      final r = await check(config, email, password);
      return r['ok'] == true ? 'ok' : r['reason']! as String;
    } on HttpError {
      return 'config';
    }
  }
}

/// Visão pública: a senha da conta de serviço nunca sai da API (só "tem senha").
Map<String, Object?> _view(Row? c) {
  if (c == null) return {'configured': false};
  return {
    'configured': true,
    for (final k in ['enabled', 'url', 'startTls', 'allowInsecureTls', 'bindDn', 'baseDn', 'userFilter', 'timeoutMs', 'updatedAt']) k: c[k],
    'hasBindPassword': c['bindPasswordEnc'] != null,
  };
}

void ldapConfigRoutes(App app, LdapService ldap) {
  final r = app.router;
  final db = app.db;
  r.group('/v1/ldap-config', tag: 'usuários', () {
    r.get('', permission: 'admin.ldap:manage', (ctx) {
      final tenantId = ctx.tenant;
      return db.forTenant(tenantId, (tx) async => _view(await tx.one('SELECT * FROM tenant_ldap_configs WHERE tenant_id = @t', {'t': tenantId})));
    });

    r.put('', permission: 'admin.ldap:manage', (ctx) async {
      final input = _config.parse(ctx.body);
      final tenantId = ctx.tenant;
      await ldap.assertSafeUrl(input['url']! as String);
      if (input['allowInsecureTls'] == true && !(input['url']! as String).toLowerCase().startsWith('ldaps://') && input['startTls'] != true) {
        throw badRequest('"Aceitar certificado próprio" só faz sentido com ldaps:// ou STARTTLS');
      }
      final hasPass = input.containsKey('bindPassword');
      final pass = input['bindPassword'] as String?;
      final enc = hasPass && pass != null && pass.isNotEmpty ? ldap.encrypt(pass) : null;
      return db.forTenant(tenantId, (tx) async {
        final before = await tx.one('SELECT * FROM tenant_ldap_configs WHERE tenant_id = @t', {'t': tenantId});
        final bindDn = (input['bindDn'] as String?)?.isEmpty ?? true ? null : input['bindDn'] as String?;
        // omitida = mantém; null = remove; texto = troca
        final finalEnc = enc ?? (hasPass && pass == null ? null : before?['bindPasswordEnc'] as String?);
        if (bindDn != null && finalEnc == null) throw badRequest('Informe a senha da conta de serviço');
        final data = {
          'enabled': input['enabled'], 'url': input['url'], 'startTls': input['startTls'], 'allowInsecureTls': input['allowInsecureTls'], 'bindDn': bindDn,
          'bindPasswordEnc': bindDn != null ? finalEnc : null, 'baseDn': input['baseDn'], 'userFilter': input['userFilter'], 'timeoutMs': input['timeoutMs'],
        };
        final saved = before == null
            ? await tx.insert('tenant_ldap_configs', {'tenantId': tenantId, ...data})
            : (await tx.update('tenant_ldap_configs', before['id']! as String, data))!;
        await app.audit.record(tx, tenantId: tenantId, actorUserId: ctx.user.id, action: before == null ? 'CREATE' : 'UPDATE', entity: 'ldap_config', entityId: saved['id'] as String?,
            before: before == null ? null : _view(before), after: _view(saved), meta: ctx.meta);
        return _view(saved);
      });
    });

    // Testa a configuração salva: encontra o usuário pelo e-mail e, se a senha vier, confere o login.
    r.post('/test', permission: 'admin.ldap:manage', status: 200, (ctx) async {
      final b = _test.parse(ctx.body);
      final tenantId = ctx.tenant;
      final cfg = await db.forTenant(tenantId, (tx) => tx.one('SELECT * FROM tenant_ldap_configs WHERE tenant_id = @t', {'t': tenantId}));
      if (cfg == null) throw badRequest('Salve a configuração antes de testar');
      final password = b['password'] as String?;
      final res = password != null ? await ldap.check(cfg, b['email']! as String, password) : await ldap.findUser(cfg, b['email']! as String);
      return res['ok'] == true
          ? {'ok': true, 'dn': res['dn'], 'message': password != null ? 'Login conferido no diretório.' : 'Usuário encontrado no diretório.'}
          : {'ok': false, 'reason': res['reason'], 'message': _messages[res['reason']] ?? 'Falha no teste'};
    });
  });
}
