// Acesso ao PostgreSQL com RLS. A API conecta com o papel `superponto_app` (sujeito à RLS):
//  - forTenant(): transação com `app.tenant_id`; o banco só expõe dados desse cliente.
//  - asPlatform(): transação com a RLS liberada; reservada a login, SuperAdmin e ingestão.
import 'dart:convert';
import 'dart:typed_data';

import 'package:postgres/postgres.dart';

typedef Row = Map<String, Object?>;

/// Erro do banco já classificado (violação de unicidade, de chave estrangeira, de regra).
class DbError implements Exception {
  DbError(this.code, this.message, {this.constraint});
  final String code;
  final String message;
  final String? constraint;
  bool get uniqueViolation => code == '23505';
  bool get foreignKeyViolation => code == '23503';
  bool get checkViolation => code == '23514';
  @override
  String toString() => 'DbError($code): $message';
}

String _camel(String snake) {
  if (!snake.contains('_')) return snake;
  final parts = snake.split('_');
  return parts.first + parts.skip(1).map((p) => p.isEmpty ? '' : p[0].toUpperCase() + p.substring(1)).join();
}

/// Decimal como o Prisma serializa: sem zeros à direita ("-23.5505200" → "-23.55052").
String decimalText(String v) {
  if (!v.contains('.') || v.contains('e') || v.contains('E')) return v;
  var s = v.replaceFirst(RegExp(r'0+$'), '');
  if (s.endsWith('.')) s = s.substring(0, s.length - 1);
  return s == '-0' ? '0' : s;
}

/// camelCase → snake_case (nome da coluna).
String snake(String camel) => camel.replaceAllMapped(RegExp('[A-Z]'), (m) => '_${m[0]!.toLowerCase()}');

Object? _value(Object? v) {
  if (v is UndecodedBytes) return v.asString;
  if (v is List && v.isNotEmpty && v.first is UndecodedBytes) return [for (final e in v) (e as UndecodedBytes).asString];
  if (v is DateTime) return v.toUtc();
  return v;
}

/// Converte uma linha (colunas snake_case) em mapa camelCase, como os modelos do Prisma.
Row rowOf(ResultRow r) {
  final out = <String, Object?>{};
  final cols = r.schema.columns;
  for (var i = 0; i < cols.length; i++) {
    final v = _value(r[i]);
    out[_camel(cols[i].columnName ?? 'c$i')] = v is String && cols[i].type == Type.numeric ? decimalText(v) : v;
  }
  return out;
}

class Tx {
  Tx(this._s);
  final Session _s;

  Future<List<Row>> query(String sql, [Map<String, Object?> params = const {}]) async {
    try {
      final res = await _s.execute(Sql.named(sql), parameters: _params(sql, params));
      return [for (final r in res) rowOf(r)];
    } on ServerException catch (e) {
      throw DbError(e.code ?? '', e.message, constraint: e.constraintName);
    }
  }

  Future<Row?> one(String sql, [Map<String, Object?> params = const {}]) async {
    final rows = await query(sql, params);
    return rows.isEmpty ? null : rows.first;
  }

  Future<T?> scalar<T>(String sql, [Map<String, Object?> params = const {}]) async {
    final row = await one(sql, params);
    return row == null || row.isEmpty ? null : row.values.first as T?;
  }

  Future<int> execute(String sql, [Map<String, Object?> params = const {}]) async {
    try {
      final res = await _s.execute(Sql.named(sql), parameters: _params(sql, params));
      return res.affectedRows;
    } on ServerException catch (e) {
      throw DbError(e.code ?? '', e.message, constraint: e.constraintName);
    }
  }

  /// INSERT a partir de um mapa camelCase; devolve a linha criada. `id` e `updated_at` são preenchidos.
  /// Colunas `updated_at` existentes, por tabela (lidas uma vez do catálogo do banco).
  static final _updatedAt = <String, bool>{};
  Future<bool> _hasUpdatedAt(String table) async => _updatedAt[table] ??=
      (await scalar<int>("SELECT count(*)::int FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = @t AND column_name = 'updated_at'", {'t': table})) == 1;

  Future<Row> insert(String table, Map<String, Object?> data, {bool id = true, bool? updatedAt}) async {
    updatedAt ??= await _hasUpdatedAt(table);
    final cols = <String>[], vals = <String>[], params = <String, Object?>{};
    if (id && !data.containsKey('id')) {
      cols.add('id');
      vals.add('gen_random_uuid()');
    }
    var i = 0;
    for (final e in data.entries) {
      cols.add(snake(e.key));
      vals.add('@p$i');
      params['p${i++}'] = e.value;
    }
    if (updatedAt && !data.containsKey('updatedAt')) {
      cols.add('updated_at');
      vals.add('now()');
    }
    return (await one('INSERT INTO $table (${cols.join(', ')}) VALUES (${vals.join(', ')}) RETURNING *', params))!;
  }

  /// UPDATE por id a partir de um mapa camelCase; devolve a linha (ou null se não existe).
  Future<Row?> update(String table, String id, Map<String, Object?> data, {bool? updatedAt}) async {
    updatedAt ??= await _hasUpdatedAt(table);
    final sets = <String>[], params = <String, Object?>{'__id': id};
    var i = 0;
    for (final e in data.entries) {
      sets.add('${snake(e.key)} = @p$i');
      params['p${i++}'] = e.value;
    }
    if (updatedAt) sets.add('updated_at = now()');
    if (sets.isEmpty) return one('SELECT * FROM $table WHERE id = @__id', params);
    return one('UPDATE $table SET ${sets.join(', ')} WHERE id = @__id RETURNING *', params);
  }

  /// Só os parâmetros usados no SQL (o driver recusa sobras; assim filtros opcionais reaproveitam o mesmo mapa).
  static Map<String, Object?> _params(String sql, Map<String, Object?> p) => {
    for (final e in p.entries)
      if (RegExp('@${RegExp.escape(e.key)}(?![A-Za-z0-9_])').hasMatch(sql)) e.key: _param(e.value),
  };

  static Object? _param(Object? v) {
    if (v is TypedValue) return v;
    if (v == null) return null;
    if (v is DateTime) return TypedValue(Type.timestampTz, v.toUtc());
    if (v is Uint8List) return TypedValue(Type.byteArray, v);
    if (v is Map || (v is List && v.any((e) => e is Map))) return TypedValue(Type.jsonb, v);
    if (v is List<String>) return TypedValue(Type.textArray, v);
    if (v is List<int>) return TypedValue(Type.integerArray, v);
    if (v is String) return TypedValue(Type.unspecified, v);
    return v;
  }
}

/// Valor JSON para colunas jsonb (inclusive listas e textos JSON).
TypedValue jsonb(Object? v) => TypedValue(Type.jsonb, v);

/// Texto sem tipo: o banco deduz (uuid, enum, date...).
TypedValue untyped(String? v) => TypedValue(Type.unspecified, v);

class Db {
  Db(String url) : _pool = _open(url);
  final Pool<void> _pool;

  static Pool<void> _open(String url) {
    final u = Uri.parse(url);
    final schema = u.queryParameters['schema'] ?? 'superponto';
    if (!RegExp(r'^[a-z_][a-z0-9_]*$').hasMatch(schema)) throw ArgumentError('schema inválido');
    final ssl = switch (u.queryParameters['sslmode']) {
      'require' || 'verify-full' || 'verify-ca' => SslMode.require,
      _ => SslMode.disable,
    };
    final userInfo = u.userInfo.split(':');
    return Pool.withEndpoints(
      [
        Endpoint(
          host: u.host,
          port: u.hasPort ? u.port : 5432,
          database: u.pathSegments.isEmpty ? 'postgres' : u.pathSegments.first,
          username: Uri.decodeComponent(userInfo.first),
          password: userInfo.length > 1 ? Uri.decodeComponent(userInfo.sublist(1).join(':')) : null,
        ),
      ],
      settings: PoolSettings(
        maxConnectionCount: int.tryParse(u.queryParameters['connection_limit'] ?? '') ?? 10,
        sslMode: ssl,
        onOpen: (c) async {
          await c.execute('SET search_path TO $schema, public');
        },
      ),
    );
  }

  Future<T> forTenant<T>(String tenantId, Future<T> Function(Tx tx) fn) => _pool.runTx((s) async {
    await s.execute(Sql.named("SELECT set_config('app.tenant_id', @t, true)"), parameters: {'t': tenantId});
    return fn(Tx(s));
  });

  Future<T> asPlatform<T>(Future<T> Function(Tx tx) fn) => _pool.runTx((s) async {
    await s.execute("SELECT set_config('app.bypass_rls', 'on', true)");
    return fn(Tx(s));
  });

  /// Consulta sem contexto (ex.: health check). Com RLS, só vê o que é público.
  Future<T> plain<T>(Future<T> Function(Tx tx) fn) => _pool.run((s) => fn(Tx(s)));

  Future<void> close() => _pool.close();
}

/// Serialização JSON igual à do Nest/Prisma (datas ISO com milissegundos, decimais como texto).
Object? toJsonValue(Object? v) {
  if (v == null || v is String || v is bool || v is int) return v;
  if (v is double) return v.isFinite ? v : null;
  if (v is DateTime) return isoMs(v);
  if (v is Map) return {for (final e in v.entries) e.key.toString(): toJsonValue(e.value)};
  if (v is Iterable) return [for (final e in v) toJsonValue(e)];
  if (v is Uint8List) return base64.encode(v);
  if (v is UndecodedBytes) return v.asString;
  try {
    return toJsonValue((v as dynamic).toJson());
  } catch (_) {
    return v.toString();
  }
}

String isoMs(DateTime d) {
  final u = d.toUtc();
  String p(int n, [int w = 2]) => n.toString().padLeft(w, '0');
  return '${p(u.year, 4)}-${p(u.month)}-${p(u.day)}T${p(u.hour)}:${p(u.minute)}:${p(u.second)}.${p(u.millisecond, 3)}Z';
}
