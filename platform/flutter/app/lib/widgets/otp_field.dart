// Código de 6 dígitos com animações (estilo "Glassy OTP"): cada dígito surge com mola, a caixa ativa
// brilha, erro faz a fileira tremer e o sucesso transforma as caixas em verde e num selo de "verificado".
// Só anima quando algo muda (nada roda em loop) — leve para a GPU, fluido em 120/144 Hz.
import 'dart:math' as math;

import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../core/tokens.dart';

enum OtpState { idle, error, success }

class OtpField extends StatefulWidget {
  const OtpField({super.key, required this.controller, this.length = 6, this.onCompleted, this.state = OtpState.idle, this.autofocus = true});
  final TextEditingController controller;
  final int length;
  final ValueChanged<String>? onCompleted;
  final OtpState state;
  final bool autofocus;
  @override
  State<OtpField> createState() => _OtpFieldState();
}

class _OtpFieldState extends State<OtpField> with TickerProviderStateMixin {
  final _focus = FocusNode();
  late final _shake = AnimationController(vsync: this, duration: const Duration(milliseconds: 420));
  late final _done = AnimationController(vsync: this, duration: const Duration(milliseconds: 650));

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_changed);
    _focus.addListener(() => setState(() {}));
  }

  @override
  void didUpdateWidget(OtpField old) {
    super.didUpdateWidget(old);
    if (old.state != widget.state) {
      if (widget.state == OtpState.error) {
        HapticFeedback.mediumImpact();
        _shake.forward(from: 0);
      }
      if (widget.state == OtpState.success) {
        _done.forward(from: 0);
      } else {
        _done.value = 0;
      }
    }
  }

  void _changed() {
    final v = widget.controller.text;
    setState(() {});
    if (v.length == widget.length) widget.onCompleted?.call(v);
  }

  @override
  void dispose() {
    widget.controller.removeListener(_changed);
    _focus.dispose();
    _shake.dispose();
    _done.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final v = widget.controller.text;
    final ok = widget.state == OtpState.success, bad = widget.state == OtpState.error;
    return RepaintBoundary(
      child: AnimatedBuilder(
        animation: Listenable.merge([_shake, _done]),
        builder: (context, _) {
          final dx = math.sin(_shake.value * math.pi * 6) * 10 * (1 - _shake.value);
          final d = Curves.easeInOutCubic.transform(_done.value);
          return Stack(
            alignment: Alignment.center,
            children: [
              // Campo real (invisível): teclado, colar, preenchimento automático do celular.
              Opacity(
                opacity: 0,
                child: SizedBox(
                  height: 1,
                  child: TextField(
                    controller: widget.controller,
                    focusNode: _focus,
                    autofocus: widget.autofocus,
                    keyboardType: TextInputType.number,
                    autofillHints: const [AutofillHints.oneTimeCode],
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(widget.length)],
                    enabled: !ok,
                  ),
                ),
              ),
              GestureDetector(
                onTap: () => _focus.requestFocus(),
                child: Transform.translate(
                  offset: Offset(dx, 0),
                  child: Opacity(
                    opacity: (1 - d * 1.6).clamp(0, 1),
                    child: Transform.scale(
                      scale: 1 - d * 0.25,
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          for (var i = 0; i < widget.length; i++)
                            Padding(
                              padding: EdgeInsets.only(left: i == 0 ? 0 : (i == widget.length ~/ 2 ? 14 : 8)),
                              child: _Box(
                                digit: i < v.length ? v[i] : null,
                                active: _focus.hasFocus && i == math.min(v.length, widget.length - 1) && !ok,
                                color: ok ? t.success : (bad ? t.danger : null),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
              if (d > 0)
                Transform.scale(
                  scale: Curves.elasticOut.transform(((_done.value - 0.35) / 0.65).clamp(0, 1)),
                  child: Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      color: t.success,
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [BoxShadow(color: t.success.withValues(alpha: 0.45), blurRadius: 24)],
                    ),
                    child: const Icon(Icons.check_rounded, color: Colors.white, size: 38),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

class _Box extends StatelessWidget {
  const _Box({required this.digit, required this.active, this.color});
  final String? digit;
  final bool active;
  final Color? color;
  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final c = color ?? (active ? t.brand : t.border);
    return AnimatedContainer(
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeOutCubic,
      width: 44,
      height: 54,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: (color ?? t.fg).withValues(alpha: color != null ? 0.16 : 0.05),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: c, width: active || color != null ? 1.6 : 1),
        boxShadow: active ? [BoxShadow(color: t.brand.withValues(alpha: 0.35), blurRadius: 14)] : null,
      ),
      child: AnimatedSwitcher(
        duration: const Duration(milliseconds: 260),
        switchInCurve: Curves.easeOutBack,
        transitionBuilder: (w, a) => ScaleTransition(
          scale: a,
          child: FadeTransition(opacity: a, child: w),
        ),
        child: digit == null
            ? (active ? _Caret(color: t.brand) : const SizedBox.shrink())
            : Text(
                digit!,
                key: ValueKey(digit),
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: color ?? t.fg),
              ),
      ),
    );
  }
}

/// Cursor piscando só enquanto a caixa está ativa.
class _Caret extends StatefulWidget {
  const _Caret({required this.color});
  final Color color;
  @override
  State<_Caret> createState() => _CaretState();
}

class _CaretState extends State<_Caret> with SingleTickerProviderStateMixin {
  late final _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1000))..repeat(reverse: true);
  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => FadeTransition(
    opacity: _c,
    child: Container(width: 2, height: 22, color: widget.color),
  );
}
