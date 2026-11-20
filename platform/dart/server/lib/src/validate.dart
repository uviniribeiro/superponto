// Validação de entrada (equivalente aos esquemas Zod da API em Node). Erros viram 400 com a lista de mensagens.
import 'package:sp_core/sp_core.dart' show normalizeCnpj, isValidCnpj, isValidCpf, isValidPis;

import 'http.dart';

class Issues {
  final list = <String>[];
  void add(List<Object> path, String message) => list.add(path.isEmpty ? message : '${path.join('.')}: $message');
}

/// Marca "campo ausente" (diferente de null explícito).
const absent = _Absent();

class _Absent {
  const _Absent();
}

abstract class S {
  const S();

  /// Valor convertido; em erro registra em [issues] e devolve qualquer coisa.
  Object? run(Object? value, List<Object> path, Issues issues);

  S get optional => _Optional(this);
  S get nullable => _Nullable(this);
  S get nullish => _Optional(_Nullable(this));
  S def(Object? value) => _Default(this, value);
  S refine(bool Function(Object? v) test, String message) => _Refine(this, test, message);
  S map(Object? Function(Object? v) fn) => _Map(this, fn);

  /// Valida e devolve o valor, ou lança 400.
  Object? parse(Object? value) {
    final issues = Issues();
    final out = run(value ?? absent, const [], issues);
    if (issues.list.isNotEmpty) throw badRequest(issues.list);
    return out;
  }
}

class _Optional extends S {
  const _Optional(this.inner);
  final S inner;
  @override
  Object? run(Object? v, List<Object> path, Issues issues) => identical(v, absent) ? absent : inner.run(v, path, issues);
}

class _Nullable extends S {
  const _Nullable(this.inner);
  final S inner;
  @override
  Object? run(Object? v, List<Object> path, Issues issues) => v == null ? null : inner.run(v, path, issues);
}

class _Default extends S {
  const _Default(this.inner, this.value);
  final S inner;
  final Object? value;
  @override
  Object? run(Object? v, List<Object> path, Issues issues) => identical(v, absent) ? value : inner.run(v, path, issues);
}

class _Refine extends S {
  const _Refine(this.inner, this.test, this.message);
  final S inner;
  final bool Function(Object? v) test;
  final String message;
  @override
  Object? run(Object? v, List<Object> path, Issues issues) {
    final before = issues.list.length;
    final out = inner.run(v, path, issues);
    if (issues.list.length == before && !identical(out, absent) && out != null && !test(out)) issues.add(path, message);
    return out;
  }
}

class _Map extends S {
  const _Map(this.inner, this.fn);
  final S inner;
  final Object? Function(Object? v) fn;
  @override
  Object? run(Object? v, List<Object> path, Issues issues) {
    final before = issues.list.length;
    final out = inner.run(v, path, issues);
    return issues.list.length == before && !identical(out, absent) && out != null ? fn(out) : out;
  }
}

bool _missing(Object? v, List<Object> path, Issues issues) {
  if (identical(v, absent) || v == null) {
    issues.add(path, identical(v, absent) ? 'Invalid input: expected value, received undefined' : 'Invalid input: received null');
    return true;
  }
  return false;
}

final _emailRe = RegExp(r"^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$");

class Str extends S {
  const Str({
    this.min,
    this.max,
    this.trim = false,
    this.lower = false,
    this.upper = false,
    this.pattern,
    this.patternMessage,
    this.email = false,
    this.uuid = false,
    this.length,
    this.digitsOnly = false,
    this.message,
  });
  final int? min, max, length;
  final bool trim, lower, upper, email, uuid;

  /// remove tudo que não é dígito antes de validar (CEP, telefone...)
  final bool digitsOnly;
  final RegExp? pattern;
  final String? patternMessage, message;

  @override
  Object? run(Object? v, List<Object> path, Issues issues) {
    if (_missing(v, path, issues)) return v;
    if (v is! String) {
      issues.add(path, 'Invalid input: expected string, received ${_typeName(v)}');
      return v;
    }
    var s = v;
    if (trim) s = s.trim();
    if (lower) s = s.toLowerCase();
    if (upper) s = s.toUpperCase();
    if (digitsOnly) s = s.replaceAll(RegExp(r'\D'), '');
    if (min != null && s.length < min!) issues.add(path, message ?? 'Too small: expected string to have >=$min characters');
    if (max != null && s.length > max!) issues.add(path, message ?? 'Too big: expected string to have <=$max characters');
    if (length != null && s.length != length) issues.add(path, message ?? 'Expected string to have $length characters');
    if (email && !_emailRe.hasMatch(s)) issues.add(path, message ?? 'Invalid email address');
    if (uuid && !isUuid(s)) issues.add(path, message ?? 'Invalid UUID');
    if (pattern != null && !pattern!.hasMatch(s)) issues.add(path, patternMessage ?? message ?? 'Invalid string: must match pattern');
    return s;
  }
}

const email = Str(email: true);
const uuid = Str(uuid: true);

/// "YYYY-MM-DD"
final date = Str(pattern: RegExp(r'^\d{4}-\d{2}-\d{2}$'), patternMessage: 'Data inválida (AAAA-MM-DD)').refine((v) {
  final p = (v as String).split('-').map(int.parse).toList();
  final d = DateTime.utc(p[0], p[1], p[2]);
  return d.year == p[0] && d.month == p[1] && d.day == p[2];
}, 'Data inválida');

/// "HH:mm"
final hm = Str(pattern: RegExp(r'^([01]\d|2[0-3]):[0-5]\d$'), patternMessage: 'Horário inválido (HH:mm)');

/// CNPJ numérico ou alfanumérico, com ou sem máscara; sai normalizado.
final cnpj = const Str(trim: true)
    .map((v) => normalizeCnpj(v as String))
    .refine((v) => isValidCnpj(v as String), 'CNPJ inválido: confira os 12 caracteres (letras ou números) e os 2 dígitos verificadores');
final cpf = const Str(trim: true, digitsOnly: true).refine((v) => isValidCpf(v as String), 'CPF inválido');
final pis = const Str(trim: true, digitsOnly: true).refine((v) => isValidPis(v as String), 'PIS inválido');

/// Instante ISO 8601 (com fuso) → DateTime.
class DateTimeS extends S {
  const DateTimeS();
  @override
  Object? run(Object? v, List<Object> path, Issues issues) {
    if (_missing(v, path, issues)) return v;
    if (v is String && RegExp(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$').hasMatch(v)) {
      final d = DateTime.tryParse(v);
      if (d != null) return d.toUtc();
    }
    issues.add(path, 'Invalid ISO datetime');
    return v;
  }
}

class Num extends S {
  const Num({this.min, this.max, this.int = false, this.coerce = false, this.positive = false, this.message});
  final num? min, max;
  final bool int, coerce, positive;
  final String? message;

  @override
  Object? run(Object? v, List<Object> path, Issues issues) {
    if (_missing(v, path, issues)) return v;
    num? n;
    if (v is num) {
      n = v;
    } else if (coerce && v is String && v.trim().isNotEmpty) {
      n = num.tryParse(v.trim());
    } else if (coerce && v is bool) {
      n = v ? 1 : 0;
    }
    if (n == null || n.isNaN || n.isInfinite) {
      issues.add(path, 'Invalid input: expected number, received ${_typeName(v)}');
      return v;
    }
    if (int && n != n.truncate()) {
      issues.add(path, message ?? 'Invalid input: expected int, received number');
      return v;
    }
    if (min != null && n < min!) issues.add(path, message ?? 'Too small: expected number to be >=$min');
    if (max != null && n > max!) issues.add(path, message ?? 'Too big: expected number to be <=$max');
    if (positive && n <= 0) issues.add(path, message ?? 'Too small: expected number to be >0');
    return int ? n.toInt() : n;
  }
}

const integer = Num(int: true);

class Bool extends S {
  const Bool({this.coerce = false});
  final bool coerce;
  @override
  Object? run(Object? v, List<Object> path, Issues issues) {
    if (_missing(v, path, issues)) return v;
    if (v is bool) return v;
    if (coerce && v is String && (v == 'true' || v == 'false')) return v == 'true';
    issues.add(path, 'Invalid input: expected boolean, received ${_typeName(v)}');
    return v;
  }
}

class Enum extends S {
  const Enum(this.values);
  final List<String> values;
  @override
  Object? run(Object? v, List<Object> path, Issues issues) {
    if (_missing(v, path, issues)) return v;
    if (v is! String || !values.contains(v)) issues.add(path, 'Invalid option: expected one of ${values.map((e) => '"$e"').join('|')}');
    return v;
  }
}

class Literal extends S {
  const Literal(this.value);
  final Object value;
  @override
  Object? run(Object? v, List<Object> path, Issues issues) {
    if (v != value) issues.add(path, 'Invalid input: expected $value');
    return v;
  }
}

class AnyS extends S {
  const AnyS();
  @override
  Object? run(Object? v, List<Object> path, Issues issues) => identical(v, absent) ? absent : v;
}

class Arr extends S {
  const Arr(this.item, {this.min, this.max, this.message});
  final S item;
  final int? min, max;
  final String? message;
  @override
  Object? run(Object? v, List<Object> path, Issues issues) {
    if (_missing(v, path, issues)) return v;
    if (v is! List) {
      issues.add(path, 'Invalid input: expected array, received ${_typeName(v)}');
      return v;
    }
    if (min != null && v.length < min!) issues.add(path, message ?? 'Too small: expected array to have >=$min items');
    if (max != null && v.length > max!) issues.add(path, message ?? 'Too big: expected array to have <=$max items');
    return [
      for (var i = 0; i < v.length; i++) item.run(v[i], [...path, i], issues),
    ];
  }
}

/// Mapa com chaves livres e valores de um tipo.
class Rec extends S {
  const Rec(this.value);
  final S value;
  @override
  Object? run(Object? v, List<Object> path, Issues issues) {
    if (_missing(v, path, issues)) return v;
    if (v is! Map) {
      issues.add(path, 'Invalid input: expected record, received ${_typeName(v)}');
      return v;
    }
    return {
      for (final e in v.entries) e.key.toString(): value.run(e.value, [...path, e.key.toString()], issues),
    };
  }
}

/// Objeto: campos desconhecidos são descartados (como o Zod). Campos ausentes opcionais não aparecem no resultado.
class Obj extends S {
  const Obj(this.fields, {this.checks = const [], this.supers = const []});
  final Map<String, S> fields;
  final List<(bool Function(Map<String, Object?>), String, List<Object>)> checks;

  /// validações com várias mensagens (como o superRefine do Zod)
  final List<void Function(Map<String, Object?> v, void Function(String message, [List<Object> path]) add)> supers;

  Obj superRefine(void Function(Map<String, Object?> v, void Function(String message, [List<Object> path]) add) fn) => Obj(fields, checks: checks, supers: [...supers, fn]);

  Obj get partial => Obj({for (final e in fields.entries) e.key: _stripDefault(e.value).optional});
  Obj extend(Map<String, S> more) => Obj({...fields, ...more}, checks: checks, supers: supers);
  Obj omit(List<String> keys) => Obj({
    for (final e in fields.entries)
      if (!keys.contains(e.key)) e.key: e.value,
  });
  Obj pick(List<String> keys) => Obj({
    for (final e in fields.entries)
      if (keys.contains(e.key)) e.key: e.value,
  });
  Obj check(bool Function(Map<String, Object?> v) test, String message, {List<Object> path = const []}) => Obj(fields, checks: [...checks, (test, message, path)], supers: supers);

  static S _stripDefault(S s) => s is _Default ? s.inner : s;

  @override
  Map<String, Object?> parse(Object? value) => super.parse(value)! as Map<String, Object?>;

  @override
  Object? run(Object? v, List<Object> path, Issues issues) {
    if (_missing(v, path, issues)) return v;
    if (v is! Map) {
      issues.add(path, 'Invalid input: expected object, received ${_typeName(v)}');
      return v;
    }
    final out = <String, Object?>{};
    final before = issues.list.length;
    for (final e in fields.entries) {
      final raw = v.containsKey(e.key) ? v[e.key] : absent;
      final r = e.value.run(raw, [...path, e.key], issues);
      if (!identical(r, absent)) out[e.key] = r;
    }
    if (issues.list.length == before) {
      for (final c in checks) {
        if (!c.$1(out)) {
          issues.add([...path, ...c.$3], c.$2);
          break;
        }
      }
      for (final f in supers) {
        f(out, (m, [p = const []]) => issues.add([...path, ...p], m));
      }
    }
    return out;
  }
}

String _typeName(Object? v) => switch (v) {
  null => 'null',
  _Absent() => 'undefined',
  String() => 'string',
  num() => 'number',
  bool() => 'boolean',
  List() => 'array',
  Map() => 'object',
  _ => 'unknown',
};

/// Paginação padrão (?page&pageSize&search).
final pageSchema = Obj({
  'page': const Num(int: true, min: 1, coerce: true).def(1),
  'pageSize': const Num(int: true, min: 1, max: 200, coerce: true).def(50),
  'search': const Str(trim: true, max: 200).optional,
});
