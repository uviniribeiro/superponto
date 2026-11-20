// Consulta pública de CEP e CNPJ (BrasilAPI, ViaCEP) com reserva entre provedores e cache de 24 h.
import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:sp_core/sp_core.dart' show isValidCnpj, normalizeCnpj, onlyDigits;

import '../app.dart';
import '../http.dart';

typedef Fetcher = Future<({int status, Object? body})> Function(String url);

String _titleCase(String v) => v
    .toLowerCase()
    .replaceAllMapped(RegExp(r'(^|[\s/-])([a-zà-ú])'), (m) => '${m[1]}${m[2]!.toUpperCase()}')
    .replaceAllMapped(RegExp(r'\b(De|Da|Do|Das|Dos|E)\b'), (m) => m[0]!.toLowerCase());

class LookupService {
  LookupService({Fetcher? fetch}) : _fetch = fetch ?? _httpFetch;
  Fetcher _fetch;
  final _cache = <String, (DateTime, Object?)>{};
  static const _ttl = Duration(hours: 24);

  /// Somente testes: troca o acesso externo por um servidor local que responde no lugar dos provedores.
  void useStub(String base) {
    _cache.clear();
    _fetch = (url) => _httpFetch('$base?url=${Uri.encodeQueryComponent(url)}');
  }

  static Future<({int status, Object? body})> _httpFetch(String url) async {
    final client = HttpClient()..connectionTimeout = const Duration(seconds: 8);
    try {
      final req = await client.getUrl(Uri.parse(url)).timeout(const Duration(seconds: 8));
      req.headers.set('accept', 'application/json');
      req.headers.set('user-agent', 'SuperPonto/2');
      final res = await req.close().timeout(const Duration(seconds: 8));
      final text = await res.transform(utf8.decoder).join().timeout(const Duration(seconds: 8));
      Object? body;
      try {
        body = text.isEmpty ? null : jsonDecode(text);
      } catch (_) {
        body = null;
      }
      return (status: res.statusCode, body: body);
    } finally {
      client.close(force: true);
    }
  }

  Future<T> _cached<T>(String key, Future<T> Function() load) async {
    final hit = _cache[key];
    if (hit != null && DateTime.now().difference(hit.$1) < _ttl) return hit.$2 as T;
    final value = await load();
    if (_cache.length > 5000) _cache.remove(_cache.keys.first);
    _cache[key] = (DateTime.now(), value);
    return value;
  }

  Future<Map<String, Object?>> cep(String input) {
    final cep = onlyDigits(input);
    if (cep.length != 8) throw badRequest('CEP deve ter 8 dígitos');
    return _cached('cep:$cep', () async {
      var notFoundCount = 0;
      try {
        final r = await _fetch('https://brasilapi.com.br/api/cep/v2/$cep');
        final b = r.body;
        if (r.status == 200 && b is Map && b['city'] != null) {
          return {
            'cep': cep, 'street': b['street'] ?? '', 'district': b['neighborhood'] ?? '', 'city': b['city'], 'uf': b['state'],
            'ibge': (b['ibge'] as Map?)?['city'], if (b['timezoneName'] != null) 'timezone': b['timezoneName'],
          };
        }
        if (r.status == 404) notFoundCount++;
      } catch (_) {/* tenta o próximo */}
      try {
        final r = await _fetch('https://viacep.com.br/ws/$cep/json/');
        final b = r.body;
        if (r.status == 200 && b is Map && b['erro'] == null && b['localidade'] != null) {
          return {'cep': cep, 'street': b['logradouro'] ?? '', 'district': b['bairro'] ?? '', 'city': b['localidade'], 'uf': b['uf'], 'ibge': b['ibge']};
        }
        if (r.status == 200 && b is Map && b['erro'] != null && b['erro'] != false) notFoundCount++;
      } catch (_) {/* sem resposta */}
      if (notFoundCount > 0) throw notFound('CEP não encontrado');
      throw HttpError(502, 'Serviço de CEP indisponível no momento; preencha o endereço manualmente');
    });
  }

  Future<Map<String, Object?>> cnpj(String input) async {
    final cnpj = normalizeCnpj(input);
    if (!isValidCnpj(cnpj)) throw badRequest('CNPJ inválido: confira os dígitos verificadores');
    if (RegExp('[A-Z]').hasMatch(cnpj)) throw notFound('A consulta pública ainda não cobre CNPJ alfanumérico; preencha os dados manualmente');
    final info = await _cached('cnpj:$cnpj', () async {
      ({int status, Object? body}) r;
      try {
        r = await _fetch('https://brasilapi.com.br/api/cnpj/v1/$cnpj');
      } catch (_) {
        r = (status: 0, body: null);
      }
      final b = r.body;
      if (r.status == 404) throw notFound('CNPJ não encontrado na Receita Federal');
      if (r.status != 200 || b is! Map || b['razao_social'] == null) throw HttpError(502, 'Consulta de CNPJ indisponível no momento; preencha manualmente');
      final ibge = b['codigo_municipio_ibge']?.toString();
      final street = [b['descricao_tipo_de_logradouro'], b['logradouro']].where((x) => x != null && x.toString().isNotEmpty).join(' ').trim();
      final phone = onlyDigits((b['ddd_telefone_1'] ?? '').toString());
      return <String, Object?>{
        'cnpj': cnpj,
        'legalName': b['razao_social'].toString().trim(),
        'tradeName': b['nome_fantasia'] != null && b['nome_fantasia'].toString().isNotEmpty ? b['nome_fantasia'].toString().trim() : null,
        'status': b['descricao_situacao_cadastral'],
        'activity': b['cnae_fiscal_descricao'],
        'openedAt': b['data_inicio_atividade'],
        'phone': phone.length >= 10 ? phone : null,
        'email': b['email'] != null && b['email'].toString().isNotEmpty ? b['email'].toString().toLowerCase() : null,
        'address': b['cep'] == null
            ? null
            : {
                'cep': onlyDigits(b['cep'].toString()).padLeft(8, '0'),
                'street': street.isEmpty ? '' : _titleCase(street),
                if (b['numero'] != null && b['numero'].toString().isNotEmpty) 'number': b['numero'].toString(),
                if (b['complemento'] != null && b['complemento'].toString().isNotEmpty) 'complement': b['complemento'].toString(),
                'district': b['bairro'] != null ? _titleCase(b['bairro'].toString()) : '',
                'city': b['municipio'] != null ? _titleCase(b['municipio'].toString()) : '',
                'uf': b['uf'] ?? '',
                'ibge': ibge != null && RegExp(r'^\d{7}$').hasMatch(ibge) ? ibge : null,
              },
        'source': 'Receita Federal (via BrasilAPI)',
      };
    });
    // A Receita grava o endereço em maiúsculas e sem acentos: completa com a base de CEP.
    final address = info['address'] as Map<String, Object?>?;
    if (address == null || address['cep'] == null) return info;
    Map<String, Object?>? byCep;
    try {
      byCep = await cep(address['cep']! as String);
    } catch (_) {
      byCep = null;
    }
    if (byCep == null) return info;
    String pick(Object? a, Object? b) => a is String && a.isNotEmpty ? a : (b as String? ?? '');
    return {
      ...info,
      'address': {
        ...address,
        'street': pick(byCep['street'], address['street']), 'district': pick(byCep['district'], address['district']),
        'city': byCep['city'], 'uf': byCep['uf'], 'ibge': byCep['ibge'] ?? address['ibge'], 'timezone': byCep['timezone'],
      },
    };
  }

  void routes(App app) {
    final r = app.router;
    r.group('/v1/lookup', tag: 'consultas', () {
      r.get('/cep/:cep', throttle: 60, (ctx) => cep(ctx.param('cep')));
      r.get('/cnpj/:cnpj', throttle: 20, (ctx) => cnpj(ctx.param('cnpj')));
    });
  }
}
