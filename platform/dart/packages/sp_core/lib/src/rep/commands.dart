// Comandos para o REP independentes de fabricante e adaptador Control iD (API local *.fcgi).
import '../br_docs.dart';
import 'afd.dart';

class RepCommandError implements Exception {
  RepCommandError(this.message);
  final String message;
  @override
  String toString() => message;
}

class RepEmployer {
  const RepEmployer({required this.idType, required this.id, this.secondaryId, required this.name, required this.location});
  final String idType; // CNPJ ou CPF
  final String id, name, location;
  final String? secondaryId;
  Map<String, Object?> toJson() => {'idType': idType, 'id': id, 'secondaryId': ?secondaryId, 'name': name, 'location': location};
}

class RepEmployee {
  const RepEmployee({this.employmentId = '', required this.name, this.cpf, this.pis, this.registration, this.card});
  final String employmentId, name;
  final String? cpf, pis, registration, card;
}

/// Identificador do trabalhador exigido pelo leiaute (PIS na 1.510, CPF na 671).
({String type, String value}) workerIdFor(AfdLayout layout, RepEmployee e) {
  if (layout == AfdLayout.p1510) {
    final pis = onlyDigits(e.pis ?? '');
    if (!isValidPis(pis)) throw RepCommandError('${e.name}: equipamento da Portaria 1.510 exige PIS válido');
    return (type: 'PIS', value: pis);
  }
  final cpf = onlyDigits(e.cpf ?? '');
  if (!isValidCpf(cpf)) throw RepCommandError('${e.name}: equipamento da Portaria 671 exige CPF válido');
  return (type: 'CPF', value: cpf);
}

RepEmployer validateEmployer(RepEmployer e) {
  final id = e.idType == 'CNPJ' ? normalizeCnpj(e.id) : onlyDigits(e.id);
  final ok = e.idType == 'CNPJ' ? isValidCnpj(id) : isValidCpf(id);
  if (!ok) throw RepCommandError('${e.idType} do empregador inválido');
  if (e.name.trim().isEmpty) throw RepCommandError('Razão social do empregador obrigatória');
  if (e.location.trim().isEmpty) throw RepCommandError('Local de prestação de serviço obrigatório');
  return RepEmployer(idType: e.idType, id: id, secondaryId: e.secondaryId, name: e.name.trim(), location: e.location.trim());
}

void assertEmployerFitsLayout(AfdLayout layout, RepEmployer e) {
  if (layout == AfdLayout.p1510 && e.idType == 'CNPJ' && RegExp('[A-Z]').hasMatch(e.id)) {
    throw RepCommandError('Este equipamento (Portaria 1.510) não aceita CNPJ alfanumérico; atualize o firmware ou use um REP da Portaria 671');
  }
}

/// Nome no limite do campo do REP, sem acentos.
String repName(String name, [int max = 52]) {
  final s = removeAccents(name).replaceAll(RegExp(r'[^\x20-\x7E]'), '').trim();
  return s.length > max ? s.substring(0, max) : s;
}

/// Requisição HTTP ao equipamento (método, caminho, corpo).
class DeviceRequest {
  const DeviceRequest(this.method, this.path, [this.body, this.homologationPending = false]);
  final String method, path;
  final Object? body;
  final bool homologationPending;
}
