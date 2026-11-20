// Marca SuperPonto (mesmo desenho do logo.tsx da web): relógio estilizado no amarelo da identidade.
import 'package:material_ui/material_ui.dart';

import 'tokens.dart';

class LogoMark extends StatelessWidget {
  const LogoMark({super.key, this.size = 36});
  final double size;

  @override
  Widget build(BuildContext context) => SizedBox.square(
    dimension: size,
    child: CustomPaint(painter: _LogoPainter()),
  );
}

class _LogoPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 40;
    canvas.scale(s);
    final rect = RRect.fromRectAndRadius(const Rect.fromLTWH(0, 0, 40, 40), const Radius.circular(12));
    canvas.drawRRect(
      rect,
      Paint()..shader = const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFFFFE066), Color(0xFFF0A800)]).createShader(const Rect.fromLTWH(0, 0, 40, 40)),
    );
    final ink = Paint()
      ..color = const Color(0xFF121212)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.6
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    canvas.drawCircle(const Offset(20, 21), 11, ink);
    canvas.drawPath(
      Path()
        ..moveTo(20, 14.5)
        ..lineTo(20, 21)
        ..lineTo(24.5, 24),
      ink,
    );
    canvas.drawLine(const Offset(16, 7.5), const Offset(24, 7.5), ink);
    canvas.drawCircle(const Offset(29.5, 12), 2.2, Paint()..color = const Color(0xFF121212));
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class Logo extends StatelessWidget {
  const Logo({super.key, this.subtitle, this.size = 36});
  final String? subtitle;
  final double size;

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        LogoMark(size: size),
        const SizedBox(width: 12),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text.rich(
              TextSpan(
                children: [
                  TextSpan(
                    text: 'Super',
                    style: TextStyle(color: t.fg),
                  ),
                  TextSpan(
                    text: 'Ponto',
                    style: TextStyle(color: t.brand),
                  ),
                ],
              ),
              style: TextStyle(fontFamily: 'Syne', fontSize: size * 0.47, fontWeight: FontWeight.w800, letterSpacing: -0.3, height: 1.1),
            ),
            if (subtitle != null) Text(subtitle!, style: TextStyle(fontSize: 12, color: t.subtle)),
          ],
        ),
      ],
    );
  }
}
