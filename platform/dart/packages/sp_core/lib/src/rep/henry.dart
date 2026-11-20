// Henry, protocolo de gerenciamento "8x" (Primme Acesso, Argos, Prisma 8.x), a partir da especificação
// do fabricante. Quadro: 0x02 | tamanho (word LE) | "II+CMD+VV[+dados]" | XOR | 0x03.
import 'dart:convert';
import 'dart:typed_data';
import '../engine/time.dart' show civil;
import 'afd.dart';

const henryErrors = <String, String>{
  '01': 'Não há dados', '10': 'Comando desconhecido', '11': 'Tamanho do pacote inválido', '12': 'Parâmetros inválidos', '13': 'Erro de checksum',
  '14': 'Tamanho dos parâmetros inválido', '15': 'Número da mensagem inválido', '16': 'Start byte inválido', '17': 'Erro ao receber pacote',
  '20': 'Não há empregador cadastrado', '21': 'Não há usuários cadastrados', '22': 'Usuário não cadastrado', '23': 'Usuário já cadastrado',
  '24': 'Limite de usuários atingido', '25': 'Equipamento sem biometria', '26': 'Índice biométrico não encontrado', '27': 'Limite de digitais atingido',
  '28': 'Equipamento não possui eventos', '29': 'Erro na manipulação de biometrias', '30': 'Documento do empregador inválido', '31': 'Tipo do documento do empregador inválido',
  '33': 'Tipo de operação do usuário inválido', '34': 'Identificador do empregado inválido', '43': 'Erro ao gravar dados', '44': 'Erro ao ler dados', '50': 'Erro desconhecido',
  '61': 'Matrícula já existe', '62': 'Identificador já existe', '64': 'Matrícula não existe', '65': 'Identificador não existe',
};

class HenryFrame {
  const HenryFrame(this.index, this.command, this.code, this.data);
  final String index, command, code, data;
}

int _xor(List<int> b) => b.fold(0, (a, x) => a ^ x);

Uint8List encodeHenry(int index, String command, {String data = '', String version = '00'}) {
  if (!RegExp(r'^[A-Z]{2,4}$').hasMatch(command)) throw ArgumentError('Comando Henry inválido: $command');
  if (RegExp(r'[\x00-\x1f]').hasMatch(data)) throw ArgumentError('Dados com caractere de controle');
  final body = latin1.encode('${(index % 100).toString().padLeft(2, '0')}+$command+$version${data.isNotEmpty ? '+$data' : ''}');
  if (body.length > 65535) throw ArgumentError('Pacote Henry acima de 65535 bytes');
  final size = [body.length & 0xff, body.length >> 8];
  final cs = _xor([...size, ...body]);
  return Uint8List.fromList([0x02, ...size, ...body, cs, 0x03]);
}

/// Lê quadros completos de um buffer (TCP entrega em pedaços). Devolve os quadros e o resto.
({List<HenryFrame> frames, Uint8List rest}) decodeHenry(Uint8List buf) {
  final frames = <HenryFrame>[];
  var i = 0;
  while (i < buf.length) {
    if (buf[i] != 0x02) {
      i++;
      continue;
    }
    if (buf.length - i < 3) break;
    final len = buf[i + 1] | (buf[i + 2] << 8);
    final end = i + 3 + len + 2;
    if (buf.length < end) break;
    final cs = buf[i + 3 + len];
    if (buf[end - 1] != 0x03) throw const FormatException('Quadro Henry sem byte final');
    if (_xor(buf.sublist(i + 1, i + 3 + len)) != cs) throw const FormatException('Checksum Henry inválido');
    final text = latin1.decode(buf.sublist(i + 3, i + 3 + len));
    final m = RegExp(r'^(\d{2})\+([A-Z]{2,4})\+(\d{2,3})(?:\+([\s\S]*))?$').firstMatch(text);
    if (m == null) throw FormatException('Quadro Henry malformado: ${text.length > 40 ? text.substring(0, 40) : text}');
    frames.add(HenryFrame(m[1]!, m[2]!, m[3]!, m[4] ?? ''));
    i = end;
  }
  return (frames: frames, rest: Uint8List.fromList(buf.sublist(i)));
}

String _p2(int n) => n.toString().padLeft(2, '0');
String henrySafe(String s, int max) {
  final t = removeAccents(s.replaceAll(RegExp(r'[+\][{}]'), ' '));
  return (t.length > max ? t.substring(0, max) : t).trim();
}

String henryDateTime(int year, int month, int day, int hour, int minute, int second) =>
    '${_p2(day)}/${_p2(month)}/${_p2(year % 100)} ${_p2(hour)}:${_p2(minute)}:${_p2(second)}]00/00/00]00/00/00';

String henryEmployer(String id, String name, String location) {
  final doc = id.replaceAll(RegExp(r'\W'), '');
  return ']${doc.length > 32 ? doc.substring(0, 32) : doc}]]${henrySafe(name, 150)}]${henrySafe(location, 100)}';
}

String henryUser(String op, String id, {String name = '', List<String> cards = const []}) =>
    op == 'E' ? '1+E[$id[[[0[' : '1+$op[$id[${henrySafe(name, 100)}[[${cards.length}[${cards.join('}')}';

List<String> henryUserResult(String data) {
  final parts = data.split('+');
  final results = parts.length > 1 ? parts[1] : '';
  return results.split(RegExp(r'[\][]')).where((s) => s.isNotEmpty).toList();
}

String henryFingerprint(String id, int finger, String template) => 'D]$id}1}$finger{$template';
String henryDeleteFingerprints(String id) => 'E]$id';

class HenryEvent {
  const HenryEvent(this.id, this.code, this.user, this.year, this.month, this.day, this.hour, this.minute, this.second, this.direction, this.reader);
  final int id, year, month, day, hour, minute, second;
  final String code, user, direction, reader;
}

List<HenryEvent> parseHenryEvents(String data) {
  final plus = data.indexOf('+');
  if (plus < 0) return const [];
  final out = <HenryEvent>[];
  for (final rec in data.substring(plus + 1).split(']')) {
    final f = rec.split('[');
    if (f.length < 4) continue;
    final m = RegExp(r'^(\d{2})/(\d{2})/(\d{4}) (\d{2}):(\d{2}):(\d{2})$').firstMatch(f[3].trim());
    final id = int.tryParse(f[0]);
    if (m == null || id == null || id <= 0) continue;
    out.add(HenryEvent(id, f[1].trim(), f[2].trim(), int.parse(m[3]!), int.parse(m[2]!), int.parse(m[1]!), int.parse(m[4]!), int.parse(m[5]!), int.parse(m[6]!),
        f.length > 4 ? f[4].trim() : '', f.length > 6 ? f[6].trim() : ''));
  }
  return out;
}

List<({String id, String name, List<String> cards})> parseHenryUsers(String data) {
  final plus = data.indexOf('+');
  if (plus < 0) return const [];
  return [
    for (final r in data.substring(plus + 1).split(']'))
      if (r.split('[').length >= 2 && r.split('[')[0].isNotEmpty)
        (id: r.split('[')[0].trim(), name: r.split('[')[1].trim(), cards: (r.split('[').length > 4 ? r.split('[')[4] : '').split('}').where((s) => s.isNotEmpty).toList()),
  ];
}

/// Eventos -> linhas tipo 3 do AFD (NSR = id do evento). Equipamento de acesso não é REP certificado.
String henryEventsToAfd(List<HenryEvent> events, AfdLayout layout, {String offset = '-0300'}) => events
    .where((e) => RegExp(r'^\d{1,12}$').hasMatch(e.user) && int.parse(e.user) > 0)
    .map((e) {
      final nsr = e.id.toString().padLeft(9, '0');
      final w = e.user.padLeft(12, '0');
      return layout == AfdLayout.p671
          ? '${nsr}3${civil(e.year, e.month, e.day)}T${_p2(e.hour)}:${_p2(e.minute)}:${_p2(e.second)}$offset${w}0000'
          : '${nsr}3${_p2(e.day)}${_p2(e.month)}${e.year}${_p2(e.hour)}${_p2(e.minute)}$w';
    })
    .join('\r\n');
