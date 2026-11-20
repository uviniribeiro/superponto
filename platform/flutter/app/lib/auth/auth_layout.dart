// Layout das telas públicas (login, esqueci a senha, redefinir): mesmo logo e tokens do app logado.
import 'package:material_ui/material_ui.dart';

import '../core/glass.dart';
import '../core/logo.dart';
import '../core/tokens.dart';

class AuthLayout extends StatelessWidget {
  const AuthLayout({super.key, required this.title, this.subtitle, required this.child});
  final String title;
  final String? subtitle;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: LiquidBackdrop(
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: TweenAnimationBuilder<double>(
                  tween: Tween(begin: 0, end: 1),
                  duration: const Duration(milliseconds: 600),
                  curve: Curves.easeOutCubic,
                  builder: (_, v, c) => Opacity(
                    opacity: v,
                    child: Transform.translate(offset: Offset(0, 16 * (1 - v)), child: c),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Center(child: Logo(size: 44, subtitle: 'Gestão de ponto')),
                      const SizedBox(height: 28),
                      Glass(
                        padding: const EdgeInsets.all(28),
                        blur: 28,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text(
                              title,
                              style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: t.fg, letterSpacing: -0.4),
                            ),
                            if (subtitle != null)
                              Padding(
                                padding: const EdgeInsets.only(top: 6),
                                child: Text(subtitle!, style: TextStyle(color: t.muted, height: 1.4)),
                              ),
                            const SizedBox(height: 22),
                            child,
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class FormMessage extends StatelessWidget {
  const FormMessage(this.text, {super.key, this.error = true});
  final String text;
  final bool error;
  @override
  Widget build(BuildContext context) {
    final c = error ? context.sp.danger : context.sp.success;
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: c.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: c.withValues(alpha: 0.3)),
      ),
      child: Text(text, style: TextStyle(color: c, fontSize: 13.5)),
    );
  }
}
