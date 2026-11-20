import 'dart:convert';

import 'package:archive/archive.dart';
import 'package:sp_server/src/http.dart';
import 'package:sp_server/src/ldap.dart';
import 'package:sp_server/src/modules/ldap_config.dart';
import 'package:sp_server/src/validate.dart';
import 'package:sp_server/src/xlsx.dart';
import 'package:test/test.dart';

void main() {
  test('filtro LDAP com escape: o e-mail não altera a busca (injeção)', () {
    expect(buildFilter('(mail={email})', 'a*)(uid=*@x.test'), r'(mail=a\2a\29\28uid=\2a@x.test)');
    expect(buildFilter('(sAMAccountName={login})', 'joao.silva@empresa.com.br'), '(sAMAccountName=joao.silva)');
  });

  test('filtro LDAP vira BER (igualdade, presença, subcadeia, e/ou/não)', () {
    expect(encodeFilter('(mail=a@b.c)').first, 0xa3);
    expect(encodeFilter('(objectClass=*)').first, 0x87);
    expect(encodeFilter('(cn=jo*ão)').first, 0xa4);
    expect(encodeFilter('(&(objectClass=person)(|(uid=x)(!(mail=y))))').first, 0xa0);
    expect(() => encodeFilter('mail=x'), throwsA(isA<FilterError>()));
    expect(() => encodeFilter('(mail=x'), throwsA(isA<FilterError>()));
  });

  test('no SaaS, recusa servidor LDAP interno e URL fora do padrão', () async {
    final svc = LdapService(allowPrivateHosts: false);
    for (final url in ['ldap://127.0.0.1:389', 'ldap://10.1.2.3', 'ldaps://192.168.0.10:636', 'ldap://169.254.169.254', 'ldap://[::1]:389']) {
      await expectLater(svc.assertSafeUrl(url), throwsA(isA<HttpError>().having((e) => e.body['message'].toString(), 'msg', contains('endereço público'))), reason: url);
    }
    await expectLater(svc.assertSafeUrl('http://ad.empresa.com.br'), throwsA(isA<HttpError>().having((e) => e.body['message'].toString(), 'msg', contains('ldap://'))));
    await expectLater(svc.assertSafeUrl('ldap://user:senha@8.8.8.8'), throwsA(isA<HttpError>().having((e) => e.body['message'].toString(), 'msg', contains('só protocolo'))));
  });

  test('validação: campos obrigatórios, padrões, transformação e mensagens no formato do Nest', () {
    final s = Obj({'name': const Str(trim: true, min: 2), 'n': const Num(int: true, coerce: true).def(1), 'e': email.optional});
    expect(s.parse({'name': '  Ana ', 'n': '3'}), {'name': 'Ana', 'n': 3});
    try {
      s.parse({'name': 'A', 'e': 'x'});
      fail('deveria recusar');
    } on HttpError catch (e) {
      expect(e.status, 400);
      expect((e.body['message']! as List).length, 2);
      expect(e.body['error'], 'Bad Request');
    }
  });

  test('XLSX gerado é um pacote Office válido com a planilha e os estilos', () {
    final bytes = buildXlsx(sheetName: 'Horas', rows: [
      [const XlsxCell('Título', size: 14)],
      [const XlsxCell('Matrícula', fill: true), const XlsxCell('Horas', fill: true)],
      [const XlsxCell('001'), const XlsxCell(12.5)],
    ], widths: [12, 10], frozenRows: 2);
    final zip = ZipDecoder().decodeBytes(bytes);
    final names = zip.files.map((f) => f.name).toSet();
    expect(names, containsAll(['[Content_Types].xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml', 'xl/styles.xml']));
    final sheet = utf8.decode(zip.findFile('xl/worksheets/sheet1.xml')!.content as List<int>);
    expect(sheet, contains('<v>12.5</v>'));
    expect(sheet, contains('state="frozen"'));
  });
}
