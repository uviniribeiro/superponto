/// CNPJ (numérico e alfanumérico, IN RFB 2.229/2024), CPF e PIS/PASEP/NIS.
library;

final _body = RegExp(r'^[0-9A-Z]{12}$');
final _full = RegExp(r'^[0-9A-Z]{12}[0-9]{2}$');

/// Remove máscara e espaços e passa letras para maiúsculas.
String normalizeCnpj(String value) => value.replaceAll(RegExp(r'[\s./-]'), '').toUpperCase();

int _checkDigit(String chars) {
  var sum = 0, weight = 2;
  for (var i = chars.length - 1; i >= 0; i--) {
    sum += (chars.codeUnitAt(i) - 48) * weight;
    weight = weight == 9 ? 2 : weight + 1;
  }
  final rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

/// Os dois dígitos verificadores para os 12 primeiros caracteres.
String cnpjCheckDigits(String body) {
  final b = normalizeCnpj(body);
  if (!_body.hasMatch(b)) throw ArgumentError('A base do CNPJ tem 12 caracteres (letras A-Z ou números)');
  final d1 = _checkDigit(b);
  final d2 = _checkDigit('$b$d1');
  return '$d1$d2';
}

bool isValidCnpj(String value) {
  final v = normalizeCnpj(value);
  if (!_full.hasMatch(v)) return false;
  if (RegExp(r'^(.)\1{13}$').hasMatch(v)) return false;
  return v.substring(12) == cnpjCheckDigits(v.substring(0, 12));
}

String formatCnpj(String value) {
  final v = normalizeCnpj(value);
  if (v.length != 14) return value;
  return '${v.substring(0, 2)}.${v.substring(2, 5)}.${v.substring(5, 8)}/${v.substring(8, 12)}-${v.substring(12)}';
}

/// Máscara progressiva para digitação (letras só nas 12 primeiras posições).
String maskCnpjInput(String value) {
  final raw = normalizeCnpj(value).replaceAll(RegExp(r'[^0-9A-Z]'), '');
  final body = raw.length > 12 ? raw.substring(0, 12) : raw;
  var dv = raw.length > 12 ? raw.substring(12).replaceAll(RegExp(r'\D'), '') : '';
  if (dv.length > 2) dv = dv.substring(0, 2);
  final v = body + (body.length == 12 ? dv : '');
  String cut(int a, int b) => v.length <= a ? '' : v.substring(a, v.length < b ? v.length : b);
  var out = cut(0, 2);
  if (v.length > 2) out += '.${cut(2, 5)}';
  if (v.length > 5) out += '.${cut(5, 8)}';
  if (v.length > 8) out += '/${cut(8, 12)}';
  if (v.length > 12) out += '-${cut(12, 14)}';
  return out;
}

String onlyDigits(String v) => v.replaceAll(RegExp(r'\D'), '');

bool isValidCpf(String value) {
  final v = onlyDigits(value);
  if (v.length != 11 || RegExp(r'^(\d)\1{10}$').hasMatch(v)) return false;
  int dv(int len) {
    var sum = 0;
    for (var i = 0; i < len; i++) {
      sum += int.parse(v[i]) * (len + 1 - i);
    }
    final r = (sum * 10) % 11;
    return r == 10 ? 0 : r;
  }
  return dv(9) == int.parse(v[9]) && dv(10) == int.parse(v[10]);
}

bool isValidPis(String value) {
  final v = onlyDigits(value);
  if (v.length != 11 || RegExp(r'^(\d)\1{10}$').hasMatch(v)) return false;
  const weights = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  var sum = 0;
  for (var i = 0; i < 10; i++) {
    sum += weights[i] * int.parse(v[i]);
  }
  final r = 11 - (sum % 11);
  return (r >= 10 ? 0 : r) == int.parse(v[10]);
}

String formatCpf(String value) {
  final v = onlyDigits(value);
  return v.length == 11 ? '${v.substring(0, 3)}.${v.substring(3, 6)}.${v.substring(6, 9)}-${v.substring(9)}' : value;
}
