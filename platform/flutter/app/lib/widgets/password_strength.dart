// Política de senha (igual à da API) e medidor de força: fraca, média ou forte.
import 'package:material_ui/material_ui.dart';

import '../core/tokens.dart';

const passwordRule = 'A senha precisa de 6 ou mais caracteres, com letra maiúscula, minúscula, número e símbolo';

bool passwordOk(String s) => s.length >= 6 && RegExp(r'[A-Z]').hasMatch(s) && RegExp(r'[a-z]').hasMatch(s) && RegExp(r'\d').hasMatch(s) && RegExp(r'[^A-Za-z0-9]').hasMatch(s);

/// 0 = vazia, 1 = fraca, 2 = média, 3 = forte.
int passwordScore(String s) {
  if (s.isEmpty) return 0;
  if (!passwordOk(s)) return 1;
  return s.length >= 10 ? 3 : 2;
}

class PasswordStrength extends StatelessWidget {
  const PasswordStrength({super.key, required this.controller});
  final TextEditingController controller;
  @override
  Widget build(BuildContext context) => ValueListenableBuilder<TextEditingValue>(
    valueListenable: controller,
    builder: (context, v, _) {
      final t = context.sp;
      final s = v.text, score = passwordScore(s);
      final color = [t.border, t.danger, t.warning, t.success][score];
      final checks = {
        '6+ caracteres': s.length >= 6,
        'Maiúscula': RegExp(r'[A-Z]').hasMatch(s),
        'Minúscula': RegExp(r'[a-z]').hasMatch(s),
        'Número': RegExp(r'\d').hasMatch(s),
        'Símbolo': RegExp(r'[^A-Za-z0-9]').hasMatch(s),
      };
      return Padding(
        padding: const EdgeInsets.only(top: 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                for (var i = 1; i <= 3; i++) ...[
                  Expanded(
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 220),
                      height: 5,
                      decoration: BoxDecoration(color: i <= score ? color : t.border, borderRadius: BorderRadius.circular(9)),
                    ),
                  ),
                  if (i < 3) const SizedBox(width: 6),
                ],
                const SizedBox(width: 10),
                Text(
                  ['', 'Fraca', 'Média', 'Forte'][score],
                  style: TextStyle(color: color, fontWeight: FontWeight.w600, fontSize: 12.5),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Wrap(
              spacing: 10,
              runSpacing: 4,
              children: [
                for (final e in checks.entries)
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(e.value ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded, size: 14, color: e.value ? t.success : t.subtle),
                      const SizedBox(width: 4),
                      Text(e.key, style: TextStyle(fontSize: 12, color: e.value ? t.fg : t.subtle)),
                    ],
                  ),
              ],
            ),
          ],
        ),
      );
    },
  );
}
