import 'package:flutter_test/flutter_test.dart';
import 'package:superponto_app/core/format.dart';

void main() {
  test('formata horas e documentos', () {
    expect(hm(125), '2:05');
    expect(hm(-30), '-0:30');
    expect(hm(90, sign: true), '+1:30');
    expect(fmtCnpj('11222333000181'), '11.222.333/0001-81');
    expect(validCnpj('11.222.333/0001-81'), isTrue);
    expect(validCnpj('11.222.333/0001-82'), isFalse);
    expect(validCpf('529.982.247-25'), isTrue);
    expect(brDate('2027-01-31'), '31/01/2027');
    expect(money(123456), r'R$ 1.234,56');
  });
}
