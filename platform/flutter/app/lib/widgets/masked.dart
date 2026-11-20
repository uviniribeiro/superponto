// Formatadores de máscara para campos de texto (CPF, CNPJ, CEP, telefone, hora).
import 'package:flutter/services.dart';

class MaskFormatter extends TextInputFormatter {
  MaskFormatter(this.mask);
  final String Function(String) mask;
  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) {
    final m = mask(newValue.text);
    return TextEditingValue(
      text: m,
      selection: TextSelection.collapsed(offset: m.length),
    );
  }
}

String maskCnpjInput(String v) {
  // CNPJ alfanumérico (2026): 12 posições letras/números + 2 dígitos verificadores
  final d = v.toUpperCase().replaceAll(RegExp(r'[^0-9A-Z]'), '');
  final s = d.length > 14 ? d.substring(0, 14) : d;
  final b = StringBuffer();
  for (var i = 0; i < s.length; i++) {
    if (i == 2 || i == 5) b.write('.');
    if (i == 8) b.write('/');
    if (i == 12) b.write('-');
    b.write(s[i]);
  }
  return b.toString();
}

String maskCpfInput(String v) {
  final d = v.replaceAll(RegExp(r'\D'), '');
  final s = d.length > 11 ? d.substring(0, 11) : d;
  final b = StringBuffer();
  for (var i = 0; i < s.length; i++) {
    if (i == 3 || i == 6) b.write('.');
    if (i == 9) b.write('-');
    b.write(s[i]);
  }
  return b.toString();
}

String maskTime(String v) {
  final d = v.replaceAll(RegExp(r'\D'), '');
  final s = d.length > 4 ? d.substring(0, 4) : d;
  return s.length > 2 ? '${s.substring(0, 2)}:${s.substring(2)}' : s;
}
