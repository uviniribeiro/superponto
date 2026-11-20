// Leitura de CSV (separador ; ou , detectado, aspas, UTF-8 ou Windows-1252 do Excel) e montagem das linhas da importação.
import 'dart:convert';
import 'dart:typed_data';

String decodeCsvBytes(Uint8List bytes) {
  final utf = utf8.decode(bytes, allowMalformed: true);
  final text = utf.contains('�') ? latin1.decode(bytes) : utf;
  return text.startsWith('﻿') ? text.substring(1) : text;
}

List<List<String>> parseCsv(String text) {
  final first = text.split(RegExp(r'\r?\n')).first;
  final sep = ';'.allMatches(first).length >= ','.allMatches(first).length ? ';' : ',';
  final rows = <List<String>>[];
  var row = <String>[];
  final cell = StringBuffer();
  var quoted = false;
  for (var i = 0; i < text.length; i++) {
    final c = text[i];
    if (quoted) {
      if (c == '"' && i + 1 < text.length && text[i + 1] == '"') {
        cell.write('"');
        i++;
      } else if (c == '"') {
        quoted = false;
      } else {
        cell.write(c);
      }
    } else if (c == '"') {
      quoted = true;
    } else if (c == sep) {
      row.add(cell.toString());
      cell.clear();
    } else if (c == '\n' || c == '\r') {
      if (c == '\r' && i + 1 < text.length && text[i + 1] == '\n') i++;
      row.add(cell.toString());
      cell.clear();
      if (row.any((v) => v.trim().isNotEmpty)) rows.add(row);
      row = <String>[];
    } else {
      cell.write(c);
    }
  }
  row.add(cell.toString());
  if (row.any((v) => v.trim().isNotEmpty)) rows.add(row);
  return rows;
}

const _aliases = {
  'nome': 'nome', 'nome_completo': 'nome', 'funcionario': 'nome', 'colaborador': 'nome', 'nome_social': 'nome_social', //
  'cpf': 'cpf', 'pis': 'pis', 'pis_pasep': 'pis', 'pispasep': 'pis', 'nis': 'pis', 'pasep': 'pis',
  'matricula': 'matricula', 'registro': 'matricula', 'admissao': 'admissao', 'data_admissao': 'admissao', 'data_de_admissao': 'admissao',
  'nascimento': 'nascimento', 'data_nascimento': 'nascimento', 'data_de_nascimento': 'nascimento', 'email': 'email', 'e_mail': 'email',
  'telefone': 'telefone', 'celular': 'telefone', 'carga_semanal': 'carga_semanal', 'carga_horaria': 'carga_semanal', 'carga_horaria_semanal': 'carga_semanal',
  'contrato': 'contrato', 'tipo_contrato': 'contrato', 'tipo_de_contrato': 'contrato', 'regime': 'contrato',
  'departamento': 'departamento', 'setor': 'departamento', 'lotacao': 'departamento', 'secao': 'secao', 'cargo': 'cargo', 'funcao': 'funcao',
  'centro_custo': 'centro_custo', 'centro_de_custo': 'centro_custo', 'tipo': 'tipo', 'tipo_funcionario': 'tipo', 'tipo_de_funcionario': 'tipo',
  'sindicato': 'sindicato', 'cep': 'cep', 'numero': 'numero', 'complemento': 'complemento',
};

const _accents = {
  'á': 'a',
  'à': 'a',
  'â': 'a',
  'ã': 'a',
  'ä': 'a',
  'é': 'e',
  'ê': 'e',
  'è': 'e',
  'ë': 'e',
  'í': 'i',
  'î': 'i',
  'ì': 'i',
  'ï': 'i',
  'ó': 'o',
  'ô': 'o',
  'õ': 'o',
  'ò': 'o',
  'ö': 'o',
  'ú': 'u',
  'û': 'u',
  'ù': 'u',
  'ü': 'u',
  'ç': 'c',
  'ñ': 'n',
};

String stripAccents(String s) => s.split('').map((c) => _accents[c] ?? c).join();

String normHeader(String h) => stripAccents(h.toLowerCase().trim()).replaceAll(RegExp(r'[^a-z0-9]+'), '_').replaceAll(RegExp(r'^_|_$'), '');

({List<Map<String, String>> rows, List<String> ignored, List<String> recognized}) toImportRows(List<List<String>> table) {
  if (table.isEmpty) return (rows: const [], ignored: const [], recognized: const []);
  final header = table.first;
  final keys = [for (final h in header) _aliases[normHeader(h)]];
  final ignored = [
    for (var i = 0; i < header.length; i++)
      if (keys[i] == null) header[i],
  ];
  final rows = [
    for (final cells in table.skip(1))
      {
        for (var i = 0; i < keys.length; i++)
          if (keys[i] != null && i < cells.length && cells[i].trim().isNotEmpty) keys[i]!: cells[i].trim(),
      },
  ];
  return (rows: rows, ignored: ignored, recognized: {...keys.whereType<String>()}.toList());
}

String templateCsv() {
  const header = [
    'Nome',
    'CPF',
    'PIS',
    'Matrícula',
    'Data de admissão',
    'Nascimento',
    'E-mail',
    'Telefone',
    'Contrato',
    'Carga semanal',
    'Departamento',
    'Seção',
    'Cargo',
    'Função',
    'Centro de custo',
    'Tipo de funcionário',
    'Sindicato',
    'CEP',
    'Número',
  ];
  const example = [
    'Maria da Silva',
    '529.982.247-25',
    '',
    '1001',
    '01/03/2024',
    '10/05/1990',
    'maria@exemplo.com.br',
    '(31) 99999-0000',
    'CLT',
    '40',
    'UBS Centro',
    'Vacinação',
    'Enfermeiro',
    'Sala de vacina',
    'Atenção Básica',
    'Efetivo',
    'SINDSAUDE',
    '30130-010',
    '100',
  ];
  return '﻿${header.join(';')}\r\n${example.join(';')}\r\n';
}
