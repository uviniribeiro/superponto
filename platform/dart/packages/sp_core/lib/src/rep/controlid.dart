// Adaptador Control iD: comandos -> chamadas da API local (*.fcgi). Quem executa é o agente local.
import '../engine/time.dart';
import 'afd.dart';
import 'commands.dart';

int _deviceUserId(AfdLayout layout, RepEmployee e) {
  final v = workerIdFor(layout, e).value;
  return int.parse(v.length > 9 ? v.substring(v.length - 9) : v);
}

List<DeviceRequest> controlIdSetClock(DateTime at, String timeZone) {
  final d = localParts(at, timeZone);
  return [DeviceRequest('POST', '/set_system_time.fcgi', {'day': d.day, 'month': d.month, 'year': d.year, 'hour': d.hour, 'minute': d.minute, 'second': d.second})];
}

List<DeviceRequest> controlIdFetchAfd(AfdLayout layout, {int? fromNsr}) =>
    [DeviceRequest('GET', '/get_afd.fcgi?mode=${afdLayoutName(layout)}${fromNsr != null ? '&initial_nsr=$fromNsr' : ''}')];

List<DeviceRequest> controlIdSetEmployer(RepEmployer employer, AfdLayout layout, {required bool rep}) {
  final e = validateEmployer(employer);
  assertEmployerFitsLayout(layout, e);
  if (!rep) return const [];
  final name = e.name.length > 150 ? e.name.substring(0, 150) : e.name;
  final addr = e.location.length > 100 ? e.location.substring(0, 100) : e.location;
  return [DeviceRequest('POST', '/set_employer.fcgi', {'employer': {'document_type': e.idType == 'CNPJ' ? 1 : 2, 'document': e.id, 'cei': e.secondaryId ?? '', 'name': name, 'address': addr}}, true)];
}

List<DeviceRequest> controlIdUpsertEmployee(RepEmployee emp, AfdLayout layout, {required bool rep}) {
  final wid = workerIdFor(layout, emp);
  final name = repName(emp.name);
  if (rep) {
    return [DeviceRequest('POST', '/add_users.fcgi', {'users': [{'name': name, (wid.type == 'PIS' ? 'pis' : 'cpf'): int.parse(wid.value), 'registration': emp.registration ?? '', 'rfid': emp.card != null ? int.parse(emp.card!) : 0}]}, true)];
  }
  final id = _deviceUserId(layout, emp);
  return [
    DeviceRequest('POST', '/destroy_objects.fcgi', {'object': 'users', 'where': {'users': {'id': id}}}),
    DeviceRequest('POST', '/create_objects.fcgi', {'object': 'users', 'values': [{'id': id, 'name': name, 'registration': emp.registration ?? '$id'}]}),
  ];
}

List<DeviceRequest> controlIdDeleteEmployee(RepEmployee emp, AfdLayout layout, {required bool rep}) {
  final wid = workerIdFor(layout, emp);
  if (rep) return [DeviceRequest('POST', '/remove_users.fcgi', {'users': [int.parse(wid.value)]}, true)];
  return [DeviceRequest('POST', '/destroy_objects.fcgi', {'object': 'users', 'where': {'users': {'id': _deviceUserId(layout, emp)}}})];
}

List<DeviceRequest> controlIdUpsertFingerprint(RepEmployee emp, AfdLayout layout, {required int finger, required String format, required String template, required bool rep}) {
  if (format != 'CONTROLID' && format != 'ISO_19794_2') throw RepCommandError('Formato de digital $format não é aceito por equipamentos Control iD');
  return [DeviceRequest('POST', '/create_objects.fcgi', {'object': 'templates', 'values': [{'user_id': _deviceUserId(layout, emp), 'finger_type': finger, 'template': template}]}, rep)];
}

List<DeviceRequest> controlIdDeleteFingerprints(RepEmployee emp, AfdLayout layout, {required bool rep}) =>
    [DeviceRequest('POST', '/destroy_objects.fcgi', {'object': 'templates', 'where': {'templates': {'user_id': _deviceUserId(layout, emp)}}}, rep)];
