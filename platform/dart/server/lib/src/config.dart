// Configuração por variáveis de ambiente (as mesmas da API em Node).
import 'dart:convert';

class ConfigError implements Exception {
  ConfigError(this.message);
  final String message;
  @override
  String toString() => 'Configuração inválida: $message';
}

class AppConfig {
  AppConfig._(this._env);
  final Map<String, String> _env;

  late final String nodeEnv = _enum('NODE_ENV', ['development', 'test', 'production'], 'development');
  late final int port = _int('PORT', 3000);
  late final String databaseUrl = _required('DATABASE_URL');
  late final String appUrl = _url('APP_URL', 'http://localhost:3001');
  late final String apiUrl = _url('API_URL', 'http://localhost:3000');
  late final String jwtSecret = _min('JWT_SECRET', 32);
  late final String mfaEncryptionKey = _min('MFA_ENCRYPTION_KEY', 40);
  late final String? biometricEncryptionKey = _optMin('BIOMETRIC_ENCRYPTION_KEY', 40);
  late final String? secretsEncryptionKey = _optMin('SECRETS_ENCRYPTION_KEY', 40);
  late final bool ldapAllowPrivateHosts = _enum('LDAP_ALLOW_PRIVATE_HOSTS', ['true', 'false'], 'false') == 'true';
  late final String supportEmail = _env['SUPPORT_EMAIL'] ?? 'suporte@superponto.local';
  late final String mailTransport = _enum('MAIL_TRANSPORT', ['smtp', 'memory'], 'memory');
  late final String? smtpHost = _env['SMTP_HOST'];
  late final int smtpPort = _int('SMTP_PORT', 587);
  late final String? smtpUser = _env['SMTP_USER'];
  late final String? smtpPass = _env['SMTP_PASS'];
  late final String mailFrom = _env['MAIL_FROM'] ?? 'SuperPonto <nao-responda@superponto.local>';
  late final List<String> corsOrigins = [appUrl, ...(_env['CORS_ORIGINS'] ?? '').split(',').map((o) => o.trim()).where((o) => o.isNotEmpty)];

  /// Segredo compartilhado com o servidor de comunicação de equipamentos (repositório separado).
  /// Definido: /v1/agent/* só aceita o cabeçalho X-Comm-Token igual a ele. Vazio: modo direto.
  late final String? commServerToken = _optMin('COMM_SERVER_TOKEN', 32);

  /// Compara em tempo constante; sem token configurado, aceita (modo direto).
  bool commTokenOk(String? token) {
    final expected = commServerToken;
    if (expected == null) return true;
    final a = utf8.encode(token ?? ''), b = utf8.encode(expected);
    if (a.length != b.length) return false;
    var diff = 0;
    for (var i = 0; i < a.length; i++) {
      diff |= a[i] ^ b[i];
    }
    return diff == 0;
  }

  /// Somente testes: grava cada e-mail (memória) neste arquivo JSONL, para os testes de contrato lerem.
  late final String? mailOutboxFile = _env['MAIL_OUTBOX_FILE'];

  /// Limite de requisições por IP (desligável apenas em teste, pois a suíte inteira vem do mesmo IP).
  late final bool rateLimit = !(nodeEnv == 'test' && _env['RATE_LIMIT'] == 'off');

  /// Ponte para testes (`/__test/...`): só existe com NODE_ENV=test.
  bool get testHooks => nodeEnv == 'test';

  static AppConfig load(Map<String, String> env) {
    final c = AppConfig._(env);
    // Lê tudo já na partida: configuração errada derruba o servidor antes de aceitar conexões.
    final _ = [
      c.nodeEnv,
      c.port,
      c.databaseUrl,
      c.appUrl,
      c.apiUrl,
      c.jwtSecret,
      c.mfaEncryptionKey,
      c.biometricEncryptionKey,
      c.secretsEncryptionKey,
      c.ldapAllowPrivateHosts,
      c.mailTransport,
      c.smtpPort,
      c.corsOrigins,
      c.commServerToken,
    ];
    for (final key in [c.biometricEncryptionKey, c.secretsEncryptionKey]) {
      if (key != null && _b64Length(key) != 32) throw ConfigError('chaves de cifra precisam ter 32 bytes em base64');
    }
    if (c.nodeEnv == 'production' && c.mailTransport == 'memory') {
      throw ConfigError('MAIL_TRANSPORT=memory não é permitido em produção');
    }
    return c;
  }

  static int _b64Length(String s) {
    try {
      return base64.decode(s).length;
    } catch (_) {
      return -1;
    }
  }

  String _required(String k) {
    final v = _env[k];
    if (v == null || v.isEmpty) throw ConfigError('$k é obrigatório');
    return v;
  }

  String _min(String k, int n) {
    final v = _required(k);
    if (v.length < n) throw ConfigError('$k precisa de ao menos $n caracteres');
    return v;
  }

  String? _optMin(String k, int n) => _env[k] == null || _env[k]!.isEmpty ? null : _min(k, n);

  String _enum(String k, List<String> values, String def) {
    final v = _env[k] ?? def;
    if (!values.contains(v)) throw ConfigError('$k deve ser ${values.join(' | ')}');
    return v;
  }

  int _int(String k, int def) {
    final v = _env[k];
    if (v == null || v.isEmpty) return def;
    return int.tryParse(v) ?? (throw ConfigError('$k deve ser um número inteiro'));
  }

  String _url(String k, String def) {
    final v = _env[k] ?? def;
    final u = Uri.tryParse(v);
    if (u == null || !u.hasScheme || u.host.isEmpty) throw ConfigError('$k deve ser uma URL');
    return v;
  }
}
