// Componentes "liquid glass": vidro fosco com desfoque do fundo, borda luminosa e brilho especular.
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:material_ui/material_ui.dart';

import 'tokens.dart';

/// Fundo vivo: degradê escuro com manchas de luz que se movem devagar (o vidro desfoca isso).
class LiquidBackdrop extends StatefulWidget {
  const LiquidBackdrop({super.key, required this.child});
  final Widget child;

  @override
  State<LiquidBackdrop> createState() => _LiquidBackdropState();
}

class _LiquidBackdropState extends State<LiquidBackdrop> {
  // Fundo estático: antes as manchas se moviam a cada quadro e obrigavam todo vidro (desfoque) a ser
  // recalculado 60–144 vezes por segundo. Parado, o desfoque só é refeito quando algo muda na tela.
  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    return Stack(
      fit: StackFit.expand,
      children: [
        DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [t.bg, t.bgDeep]),
          ),
        ),
        RepaintBoundary(child: CustomPaint(painter: _BlobPainter(0.12, t))),
        BackdropGroup(child: widget.child),
      ],
    );
  }
}

class _BlobPainter extends CustomPainter {
  _BlobPainter(this.v, this.t);
  final double v;
  final SpTokens t;

  @override
  void paint(Canvas canvas, Size size) {
    final a = v * 2 * math.pi;
    void blob(Offset c, double r, Color color) {
      canvas.drawCircle(c, r, Paint()..shader = RadialGradient(colors: [color, color.withValues(alpha: 0)]).createShader(Rect.fromCircle(center: c, radius: r)));
    }

    final w = size.width, h = size.height, m = math.max(w, h);
    blob(Offset(w * (0.15 + 0.08 * math.sin(a)), h * (0.1 + 0.06 * math.cos(a))), m * 0.45, t.glowA);
    blob(Offset(w * (0.9 + 0.06 * math.cos(a * 1.3)), h * (0.35 + 0.1 * math.sin(a))), m * 0.4, t.glowB);
    blob(Offset(w * (0.55 + 0.12 * math.sin(a * 0.7)), h * (1.0 + 0.05 * math.cos(a))), m * 0.42, t.glowA.withValues(alpha: t.glowA.a * 0.6));
  }

  @override
  bool shouldRepaint(_BlobPainter old) => old.v != v || old.t != t;
}

/// Painel de vidro: desfoque do que está atrás, preenchimento translúcido, borda com luz no topo.
class Glass extends StatelessWidget {
  const Glass({super.key, required this.child, this.padding = const EdgeInsets.all(20), this.radius = SpTokens.radius, this.blur = 14, this.strong = false, this.tint, this.onTap, this.margin});
  final Widget child;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry? margin;
  final double radius, blur;
  final bool strong;
  final Color? tint;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final br = BorderRadius.circular(radius);
    Widget body = DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: br,
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color.alphaBlend((tint ?? t.highlight).withValues(alpha: t.dark ? 0.07 : 0.35), strong ? t.surfaceStrong : t.surface),
            strong ? t.surfaceStrong : t.surface,
          ],
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: t.dark ? 0.35 : 0.08),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: CustomPaint(
        foregroundPainter: _RimPainter(radius, t),
        child: Padding(padding: padding, child: child),
      ),
    );
    if (onTap != null) {
      body = Material(
        type: MaterialType.transparency,
        child: InkWell(borderRadius: br, onTap: onTap, child: body),
      );
    }
    return Padding(
      padding: margin ?? EdgeInsets.zero,
      child: RepaintBoundary(
        child: ClipRRect(
          borderRadius: br,
          child: BackdropFilter.grouped(
            filter: ui.ImageFilter.blur(sigmaX: blur, sigmaY: blur),
            child: body,
          ),
        ),
      ),
    );
  }
}

/// Borda luminosa: mais clara no alto (luz) e quase invisível embaixo, como a refração do vidro.
class _RimPainter extends CustomPainter {
  _RimPainter(this.radius, this.t);
  final double radius;
  final SpTokens t;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final rr = RRect.fromRectAndRadius(rect.deflate(0.5), Radius.circular(radius));
    canvas.drawRRect(
      rr,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            t.highlight,
            t.border,
            t.border.withValues(alpha: t.border.a * 0.5),
          ],
          stops: const [0, 0.4, 1],
        ).createShader(rect),
    );
    // brilho especular no topo
    canvas.save();
    canvas.clipRRect(rr);
    final shine = Rect.fromLTWH(0, 0, size.width, math.min(70, size.height * 0.5));
    canvas.drawRect(
      shine,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Colors.white.withValues(alpha: t.dark ? 0.05 : 0.25),
            Colors.white.withValues(alpha: 0),
          ],
        ).createShader(shine),
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(_RimPainter old) => old.radius != radius || old.t != t;
}

enum BtnKind { primary, glass, danger, ghost }

/// Botão em pílula: o principal é o amarelo da marca com brilho; os demais são vidro.
class GlassButton extends StatefulWidget {
  const GlassButton({super.key, required this.label, this.onPressed, this.icon, this.kind = BtnKind.primary, this.loading = false, this.expand = false, this.small = false});
  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final BtnKind kind;
  final bool loading, expand, small;

  @override
  State<GlassButton> createState() => _GlassButtonState();
}

class _GlassButtonState extends State<GlassButton> {
  bool _hover = false, _down = false;

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final enabled = widget.onPressed != null && !widget.loading;
    final primary = widget.kind == BtnKind.primary;
    final fg = switch (widget.kind) {
      BtnKind.primary => t.onBrand,
      BtnKind.danger => t.danger,
      _ => t.fg,
    };
    final h = widget.small ? 34.0 : 44.0;
    final decoration = BoxDecoration(
      borderRadius: BorderRadius.circular(h / 2),
      gradient: primary ? LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [t.brandStrong, t.brand, t.brandDeep], stops: const [0, 0.55, 1]) : null,
      color: primary
          ? null
          : widget.kind == BtnKind.ghost
          ? (_hover ? t.hover : Colors.transparent)
          : widget.kind == BtnKind.danger
          ? t.danger.withValues(alpha: _hover ? 0.18 : 0.1)
          : (_hover ? t.highlight.withValues(alpha: t.dark ? 0.12 : 0.6) : t.hover),
      border: widget.kind == BtnKind.ghost ? null : Border.all(color: primary ? Colors.white.withValues(alpha: 0.35) : t.border),
      boxShadow: primary && enabled
          ? [
              BoxShadow(
                color: t.brand.withValues(alpha: _hover ? 0.45 : 0.25),
                blurRadius: _hover ? 24 : 16,
                offset: const Offset(0, 6),
              ),
            ]
          : null,
    );
    final content = Row(
      mainAxisSize: widget.expand ? MainAxisSize.max : MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (widget.loading)
          SizedBox.square(dimension: 16, child: CircularProgressIndicator(strokeWidth: 2, color: fg))
        else if (widget.icon != null)
          Icon(widget.icon, size: widget.small ? 16 : 18, color: fg),
        if ((widget.loading || widget.icon != null) && widget.label.isNotEmpty) const SizedBox(width: 8),
        if (widget.label.isNotEmpty)
          Flexible(
            child: Text(
              widget.label,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: fg, fontWeight: FontWeight.w600, fontSize: widget.small ? 13 : 14),
            ),
          ),
      ],
    );
    return Semantics(
      button: true,
      enabled: enabled,
      label: widget.label,
      child: MouseRegion(
        cursor: enabled ? SystemMouseCursors.click : SystemMouseCursors.forbidden,
        onEnter: (_) => setState(() => _hover = true),
        onExit: (_) => setState(() => _hover = _down = false),
        child: GestureDetector(
          onTapDown: enabled ? (_) => setState(() => _down = true) : null,
          onTapCancel: () => setState(() => _down = false),
          onTapUp: enabled ? (_) => setState(() => _down = false) : null,
          onTap: enabled ? widget.onPressed : null,
          child: AnimatedScale(
            scale: _down ? 0.97 : 1,
            duration: const Duration(milliseconds: 120),
            child: AnimatedOpacity(
              opacity: enabled || widget.loading ? 1 : 0.45,
              duration: const Duration(milliseconds: 150),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                height: h,
                padding: EdgeInsets.symmetric(horizontal: widget.label.isEmpty ? 0 : (widget.small ? 14 : 20)),
                width: widget.label.isEmpty ? h : null,
                decoration: decoration,
                child: content,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Etiqueta colorida (status).
class Pill extends StatelessWidget {
  const Pill(this.text, {super.key, this.color});
  final String text;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final c = color ?? context.sp.muted;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(
        color: c.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: c.withValues(alpha: 0.28)),
      ),
      child: Text(
        text,
        style: TextStyle(color: c, fontSize: 12, fontWeight: FontWeight.w600),
      ),
    );
  }
}

/// Ícone dentro de uma "gota" de vidro colorida.
class IconBubble extends StatelessWidget {
  const IconBubble(this.icon, {super.key, this.color, this.size = 40});
  final IconData icon;
  final Color? color;
  final double size;

  @override
  Widget build(BuildContext context) {
    final c = color ?? context.sp.brand;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(size * 0.34),
        gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [c.withValues(alpha: 0.28), c.withValues(alpha: 0.1)]),
        border: Border.all(color: c.withValues(alpha: 0.3)),
      ),
      child: Icon(icon, color: c, size: size * 0.5),
    );
  }
}
