// Rótulos e contas do espelho de ponto (os mesmos da web).
String hhmm(Object? m, {bool signed = false}) {
  final v = m is num ? m.round() : 0;
  final a = v.abs();
  final s = '${a ~/ 60}h${(a % 60).toString().padLeft(2, '0')}';
  if (signed) return v > 0 ? '+$s' : (v < 0 ? '−$s' : s);
  return v < 0 ? '−$s' : s;
}

const flagLabel = {
  'ABSENCE': 'Falta',
  'INCOMPLETE': 'Marcação ímpar',
  'LATE': 'Atraso',
  'EARLY_LEAVE': 'Saída antecipada',
  'EARLY_ENTRY': 'Entrada antecipada',
  'INSUFFICIENT_BREAK': 'Intervalo curto',
  'AUTO_BREAK_DEDUCTED': 'Intervalo descontado',
  'OVERTIME_LIMIT_EXCEEDED': 'Extra acima do limite',
  'WITHIN_TOLERANCE': 'Na tolerância',
  'WORK_ON_REST_DAY': 'Trabalho na folga',
  'WORK_ON_HOLIDAY': 'Trabalho no feriado',
  'LEAVE_FULL': 'Abonado',
  'LEAVE_PARTIAL': 'Abono parcial',
  'MOBILE_ENTRY': 'Entrada móvel',
  'BREAK_OUT_OF_WINDOW': 'Intervalo fora da janela',
  'BREAK_EXCEEDED': 'Intervalo excedido',
  'IN_ITINERE': 'In itinere',
  'SCHEDULED_DAY': 'Escala agendada',
  'JUSTIFIED': 'Justificado',
  'OVERTIME_UNAUTHORIZED': 'Extra sem autorização',
};
const badFlags = {'ABSENCE', 'INCOMPLETE', 'LATE', 'EARLY_LEAVE', 'INSUFFICIENT_BREAK', 'OVERTIME_LIMIT_EXCEEDED', 'BREAK_OUT_OF_WINDOW', 'BREAK_EXCEEDED', 'OVERTIME_UNAUTHORIZED'};
const leaveTypes = [
  ('MEDICAL', 'Atestado médico'),
  ('VACATION', 'Férias'),
  ('MATERNITY', 'Licença-maternidade'),
  ('PATERNITY', 'Licença-paternidade'),
  ('WORK_ACCIDENT', 'Acidente de trabalho'),
  ('UNPAID', 'Licença não remunerada'),
  ('SUSPENSION', 'Suspensão'),
  ('OTHER', 'Outro afastamento'),
];
const sourceLabel = {'WEB': 'Navegador', 'MOBILE': 'App', 'KIOSK': 'Terminal', 'DEVICE': 'Relógio', 'COMMUNICATION_SERVER': 'Relógio', 'IMPORT': 'Importação', 'MANUAL_ADJUSTMENT': 'Incluída'};
const punchStatusLabel = {'INCLUDED': 'incluída', 'DISREGARDED': 'desconsiderada', 'PENDING_INCLUDE': 'inclusão pendente', 'PENDING_DISREGARD': 'desconsiderar pendente'};
const wdShort = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

({String from, String to}) monthRange(DateTime m) {
  final last = DateTime.utc(m.year, m.month + 1, 0).day;
  final mm = m.month.toString().padLeft(2, '0');
  return (from: '${m.year}-$mm-01', to: '${m.year}-$mm-${last.toString().padLeft(2, '0')}');
}
