// Tokens semânticos do tema (os mesmos da web: globals.css). Compartilhados pelo login e pelo app logado.
import 'package:material_ui/material_ui.dart';

@immutable
class SpTokens extends ThemeExtension<SpTokens> {
  const SpTokens({
    required this.bg,
    required this.bgDeep,
    required this.brand,
    required this.brandStrong,
    required this.brandDeep,
    required this.onBrand,
    required this.fg,
    required this.muted,
    required this.subtle,
    required this.surface,
    required this.surfaceStrong,
    required this.border,
    required this.highlight,
    required this.hover,
    required this.success,
    required this.info,
    required this.danger,
    required this.warning,
    required this.glowA,
    required this.glowB,
    required this.dark,
  });

  final Color bg, bgDeep, brand, brandStrong, brandDeep, onBrand, fg, muted, subtle, surface, surfaceStrong, border, highlight, hover;
  final Color success, info, danger, warning, glowA, glowB;
  final bool dark;

  static const radius = 24.0;
  static const radiusSm = 14.0;

  static const darkTokens = SpTokens(
    bg: Color(0xFF07080A),
    bgDeep: Color(0xFF030405),
    brand: Color(0xFFFCC419),
    brandStrong: Color(0xFFFFD43B),
    brandDeep: Color(0xFFE8A100),
    onBrand: Color(0xFF121212),
    fg: Color(0xFFF4F4F5),
    muted: Color(0xFFA1A1AA),
    subtle: Color(0xFF71717A),
    surface: Color(0x801E2126),
    surfaceStrong: Color(0xCC1A1C20),
    border: Color(0x14FFFFFF),
    highlight: Color(0x2EFFFFFF),
    hover: Color(0x0FFFFFFF),
    success: Color(0xFF34D399),
    info: Color(0xFF60A5FA),
    danger: Color(0xFFF87171),
    warning: Color(0xFFFB923C),
    glowA: Color(0x33FCC419),
    glowB: Color(0x2660A5FA),
    dark: true,
  );

  static const lightTokens = SpTokens(
    bg: Color(0xFFEEF0F3),
    bgDeep: Color(0xFFE2E5EA),
    brand: Color(0xFFF0B400),
    brandStrong: Color(0xFFFCC419),
    brandDeep: Color(0xFFC98F00),
    onBrand: Color(0xFF121212),
    fg: Color(0xFF18181B),
    muted: Color(0xFF52525B),
    subtle: Color(0xFF71717A),
    surface: Color(0xA6FFFFFF),
    surfaceStrong: Color(0xE6FFFFFF),
    border: Color(0x1A0F172A),
    highlight: Color(0xCCFFFFFF),
    hover: Color(0x0A0F172A),
    success: Color(0xFF059669),
    info: Color(0xFF2563EB),
    danger: Color(0xFFDC2626),
    warning: Color(0xFFEA580C),
    glowA: Color(0x40FCC419),
    glowB: Color(0x2660A5FA),
    dark: false,
  );

  @override
  SpTokens copyWith() => this;

  @override
  SpTokens lerp(ThemeExtension<SpTokens>? other, double t) => t < 0.5 || other is! SpTokens ? this : other;
}

extension SpTheme on BuildContext {
  SpTokens get sp => Theme.of(this).extension<SpTokens>() ?? SpTokens.darkTokens;
}

ThemeData buildTheme(SpTokens t) {
  final scheme = ColorScheme.fromSeed(
    seedColor: t.brand,
    brightness: t.dark ? Brightness.dark : Brightness.light,
    primary: t.brand,
    onPrimary: t.onBrand,
    surface: t.bg,
    onSurface: t.fg,
    error: t.danger,
  );
  final base = ThemeData(useMaterial3: true, colorScheme: scheme, brightness: scheme.brightness, fontFamily: 'Jakarta', extensions: [t]);
  OutlineInputBorder outline(Color c, [double w = 1]) => OutlineInputBorder(
    borderRadius: BorderRadius.circular(SpTokens.radiusSm),
    borderSide: BorderSide(color: c, width: w),
  );
  return base.copyWith(
    scaffoldBackgroundColor: t.bg,
    canvasColor: t.bg,
    textTheme: base.textTheme.apply(bodyColor: t.fg, displayColor: t.fg),
    dividerColor: t.border,
    splashFactory: InkSparkle.splashFactory,
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: t.hover,
      isDense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      labelStyle: TextStyle(color: t.muted),
      hintStyle: TextStyle(color: t.subtle),
      border: outline(t.border),
      enabledBorder: outline(t.border),
      focusedBorder: outline(t.brand, 1.4),
      errorBorder: outline(t.danger),
      focusedErrorBorder: outline(t.danger, 1.4),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: t.surfaceStrong,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(SpTokens.radius)),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: t.surfaceStrong,
      contentTextStyle: TextStyle(color: t.fg),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
    ),
    popupMenuTheme: PopupMenuThemeData(
      color: t.surfaceStrong,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
    ),
    tooltipTheme: TooltipThemeData(
      decoration: BoxDecoration(color: t.surfaceStrong, borderRadius: BorderRadius.circular(8)),
      textStyle: TextStyle(color: t.fg, fontSize: 12),
    ),
    progressIndicatorTheme: ProgressIndicatorThemeData(color: t.brand),
    checkboxTheme: CheckboxThemeData(fillColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? t.brand : null), checkColor: WidgetStatePropertyAll(t.onBrand)),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? t.onBrand : t.muted),
      trackColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? t.brand : t.hover),
    ),
  );
}
