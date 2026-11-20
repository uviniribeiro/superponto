// Peças de tela reutilizadas por todos os módulos: cabeçalho, carregamento, vazio, tabela responsiva, formulários e diálogos.
import 'dart:async';
import 'dart:ui' as ui;

import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/glass.dart';
import '../core/tokens.dart';

bool isWide(BuildContext c) => MediaQuery.sizeOf(c).width >= 900;

/// Página padrão: título, descrição, ações e conteúdo rolável.
class PageScaffold extends StatelessWidget {
  const PageScaffold({super.key, required this.title, this.subtitle, this.actions = const [], required this.children, this.icon, this.scroll = true, this.maxWidth = 1280});
  final String title;
  final String? subtitle;
  final IconData? icon;
  final List<Widget> actions;
  final List<Widget> children;
  final bool scroll;
  final double maxWidth;

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final wide = isWide(context);
    final header = Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Wrap(
        spacing: 16,
        runSpacing: 12,
        alignment: WrapAlignment.spaceBetween,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          ConstrainedBox(
            constraints: BoxConstraints(maxWidth: wide ? 720 : 560),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (icon != null) ...[IconBubble(icon!, size: 44), const SizedBox(width: 14)],
                Flexible(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: TextStyle(fontSize: wide ? 26 : 22, fontWeight: FontWeight.w700, letterSpacing: -0.5, color: t.fg),
                      ),
                      if (subtitle != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(subtitle!, style: TextStyle(color: t.muted, fontSize: 14, height: 1.4)),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          if (actions.isNotEmpty) Wrap(spacing: 8, runSpacing: 8, crossAxisAlignment: WrapCrossAlignment.center, children: actions),
        ],
      ),
    );
    final content = Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [header, ...children]);
    final pad = EdgeInsets.fromLTRB(wide ? 28 : 16, wide ? 24 : 12, wide ? 28 : 16, 40);
    final body = scroll
        ? SingleChildScrollView(
            padding: pad,
            child: Center(
              child: ConstrainedBox(
                constraints: BoxConstraints(maxWidth: maxWidth),
                child: content,
              ),
            ),
          )
        : Padding(padding: pad, child: content);
    return SelectionArea(child: body);
  }
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.text, {super.key, this.trailing});
  final String text;
  final Widget? trailing;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: Row(
      children: [
        Expanded(
          child: Text(
            text,
            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: context.sp.fg),
          ),
        ),
        ?trailing,
      ],
    ),
  );
}

class Loading extends StatelessWidget {
  const Loading({super.key, this.height = 160});
  final double height;
  @override
  Widget build(BuildContext context) => SizedBox(
    height: height,
    child: const Center(child: CircularProgressIndicator(strokeWidth: 2.4)),
  );
}

class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.icon, required this.title, this.body, this.action});
  final IconData icon;
  final String title;
  final String? body;
  final Widget? action;
  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 36, horizontal: 16),
      child: Column(
        children: [
          IconBubble(icon, size: 56, color: t.muted),
          const SizedBox(height: 14),
          Text(
            title,
            textAlign: TextAlign.center,
            style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16, color: t.fg),
          ),
          if (body != null)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                body!,
                textAlign: TextAlign.center,
                style: TextStyle(color: t.muted),
              ),
            ),
          if (action != null) Padding(padding: const EdgeInsets.only(top: 16), child: action),
        ],
      ),
    );
  }
}

class ErrorView extends StatelessWidget {
  const ErrorView(this.error, {super.key, this.onRetry});
  final Object error;
  final VoidCallback? onRetry;
  @override
  Widget build(BuildContext context) => EmptyState(
    icon: Icons.cloud_off_rounded,
    title: error is ApiException && (error as ApiException).status == 403 ? 'Sem permissão para ver isto' : 'Não foi possível carregar',
    body: '$error',
    action: onRetry == null ? null : GlassButton(label: 'Tentar de novo', icon: Icons.refresh_rounded, kind: BtnKind.glass, onPressed: onRetry),
  );
}

/// Carrega dados com estados de carregando/erro e permite recarregar (`key.currentState.reload()` ou `reloadToken`).
class Async<T> extends StatefulWidget {
  const Async({super.key, required this.load, required this.builder, this.reloadToken, this.loading});
  final Future<T> Function() load;
  final Widget Function(BuildContext, T data, VoidCallback reload) builder;
  final Object? reloadToken;
  final Widget? loading;
  @override
  State<Async<T>> createState() => AsyncState<T>();
}

class AsyncState<T> extends State<Async<T>> {
  late Future<T> _f = widget.load();
  T? _last;

  void reload() => setState(() => _f = widget.load());

  @override
  void didUpdateWidget(covariant Async<T> oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.reloadToken != widget.reloadToken) _f = widget.load();
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<T>(
    future: _f,
    builder: (context, s) {
      if (s.hasError) return ErrorView(s.error!, onRetry: reload);
      if (s.connectionState != ConnectionState.done) {
        // mantém o conteúdo anterior enquanto recarrega (sem piscar)
        if (_last != null) {
          return Stack(
            children: [
              widget.builder(context, _last as T, reload),
              const Positioned(top: 0, left: 0, right: 0, child: LinearProgressIndicator(minHeight: 2)),
            ],
          );
        }
        return widget.loading ?? const Loading();
      }
      _last = s.data;
      return widget.builder(context, s.data as T, reload);
    },
  );
}

void toast(BuildContext context, String message, {bool error = false}) {
  final t = context.sp;
  ScaffoldMessenger.maybeOf(context)
    ?..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        content: Row(
          children: [
            Icon(error ? Icons.error_outline_rounded : Icons.check_circle_outline_rounded, color: error ? t.danger : t.success, size: 20),
            const SizedBox(width: 10),
            Expanded(child: Text(message)),
          ],
        ),
        width: isWide(context) ? 440 : null,
      ),
    );
}

/// Executa uma ação com aviso de sucesso/erro. Devolve true se deu certo.
Future<bool> act(BuildContext context, Future<Object?> Function() action, {String? success}) async {
  try {
    await action();
    if (success != null && context.mounted) toast(context, success);
    return true;
  } catch (e) {
    if (context.mounted) toast(context, '$e', error: true);
    return false;
  }
}

/// Executa uma ação com aviso de sucesso/erro. Devolve o resultado (ou null se falhou).
Future<R?> run<R>(BuildContext context, Future<R> Function() action, {String? success}) async {
  try {
    final r = await action();
    if (success != null && context.mounted) toast(context, success);
    return r;
  } catch (e) {
    if (context.mounted) toast(context, '$e', error: true);
    return null;
  }
}

/// Diálogo de vidro centralizado (ou tela cheia no celular).
Future<T?> showGlassDialog<T>(BuildContext context, {required String title, required Widget Function(BuildContext) builder, double width = 560}) {
  return showGeneralDialog<T>(
    context: context,
    barrierDismissible: true,
    barrierLabel: 'Fechar',
    barrierColor: Colors.black.withValues(alpha: 0.45),
    transitionDuration: const Duration(milliseconds: 220),
    pageBuilder: (ctx, _, _) {
      final t = ctx.sp;
      final narrow = MediaQuery.sizeOf(ctx).width < 640;
      return SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: BoxConstraints(maxWidth: narrow ? double.infinity : width, maxHeight: MediaQuery.sizeOf(ctx).height * (narrow ? 1 : 0.9)),
            child: Padding(
              padding: EdgeInsets.all(narrow ? 8 : 24),
              child: Material(
                type: MaterialType.transparency,
                child: Glass(
                  strong: true,
                  padding: EdgeInsets.zero,
                  blur: 30,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(22, 16, 10, 8),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(
                                title,
                                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: t.fg),
                              ),
                            ),
                            IconButton(
                              tooltip: 'Fechar',
                              onPressed: () => Navigator.of(ctx).pop(),
                              icon: Icon(Icons.close_rounded, color: t.muted),
                            ),
                          ],
                        ),
                      ),
                      Flexible(
                        child: SingleChildScrollView(padding: const EdgeInsets.fromLTRB(22, 4, 22, 22), child: builder(ctx)),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      );
    },
    transitionBuilder: (ctx, a, _, child) {
      final c = CurvedAnimation(parent: a, curve: Curves.easeOutCubic);
      return BackdropFilter(
        filter: ui.ImageFilter.blur(sigmaX: 6 * a.value, sigmaY: 6 * a.value),
        child: FadeTransition(
          opacity: c,
          child: ScaleTransition(scale: Tween(begin: 0.96, end: 1.0).animate(c), child: child),
        ),
      );
    },
  );
}

Future<bool> confirm(BuildContext context, {required String title, required String body, String confirmLabel = 'Confirmar', bool danger = true}) async {
  final r = await showGlassDialog<bool>(
    context,
    title: title,
    width: 440,
    builder: (ctx) => Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(body, style: TextStyle(color: ctx.sp.muted, height: 1.45)),
        const SizedBox(height: 20),
        Wrap(
          alignment: WrapAlignment.end,
          spacing: 8,
          children: [
            GlassButton(label: 'Cancelar', kind: BtnKind.ghost, onPressed: () => Navigator.pop(ctx, false)),
            GlassButton(label: confirmLabel, kind: danger ? BtnKind.danger : BtnKind.primary, onPressed: () => Navigator.pop(ctx, true)),
          ],
        ),
      ],
    ),
  );
  return r ?? false;
}

Future<String?> promptText(BuildContext context, {required String title, required String label, String? initial, String confirmLabel = 'Salvar', int maxLines = 1, bool required = true}) async {
  final c = TextEditingController(text: initial);
  final r = await showGlassDialog<String>(
    context,
    title: title,
    width: 480,
    builder: (ctx) => Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: c,
          autofocus: true,
          maxLines: maxLines,
          decoration: InputDecoration(labelText: label),
        ),
        const SizedBox(height: 18),
        Align(
          alignment: Alignment.centerRight,
          child: GlassButton(
            label: confirmLabel,
            onPressed: () {
              if (required && c.text.trim().isEmpty) return;
              Navigator.pop(ctx, c.text.trim());
            },
          ),
        ),
      ],
    ),
  );
  return r;
}

/// Coluna da tabela.
class Col<T> {
  const Col(this.label, this.cell, {this.flex = 2, this.numeric = false, this.primary = false});
  final String label;
  final Widget Function(T row) cell;
  final int flex;
  final bool numeric;

  /// mostrado como título do cartão no celular
  final bool primary;
}

Widget txt(Object? v, {bool mono = false, bool muted = false, bool bold = false}) => Builder(
  builder: (c) => Text(
    v == null || '$v'.isEmpty ? '—' : '$v',
    overflow: TextOverflow.ellipsis,
    maxLines: 2,
    style: TextStyle(color: muted ? c.sp.muted : c.sp.fg, fontFeatures: mono ? const [ui.FontFeature.tabularFigures()] : null, fontWeight: bold ? FontWeight.w600 : null),
  ),
);

/// Tabela de vidro: linhas no computador, cartões no celular.
class GlassTable<T> extends StatelessWidget {
  const GlassTable({super.key, required this.rows, required this.columns, this.onTap, this.actions, this.empty});
  final List<T> rows;
  final List<Col<T>> columns;
  final void Function(T)? onTap;
  final List<Widget> Function(T)? actions;
  final Widget? empty;

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    if (rows.isEmpty) {
      return Glass(
        child: empty ?? const EmptyState(icon: Icons.inbox_rounded, title: 'Nada por aqui ainda'),
      );
    }
    if (!isWide(context)) {
      final primary = columns.firstWhere((c) => c.primary, orElse: () => columns.first);
      return Column(
        children: [
          for (final r in rows)
            Glass(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(16),
              radius: 20,
              onTap: onTap == null ? null : () => onTap!(r),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: DefaultTextStyle.merge(
                          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                          child: primary.cell(r),
                        ),
                      ),
                      if (actions != null) ...actions!(r),
                    ],
                  ),
                  const SizedBox(height: 8),
                  for (final c in columns)
                    if (c != primary)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            SizedBox(
                              width: 120,
                              child: Text(c.label, style: TextStyle(color: t.subtle, fontSize: 12.5)),
                            ),
                            Expanded(
                              child: DefaultTextStyle.merge(style: const TextStyle(fontSize: 13.5), child: c.cell(r)),
                            ),
                          ],
                        ),
                      ),
                ],
              ),
            ),
        ],
      );
    }
    return Glass(
      padding: EdgeInsets.zero,
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            decoration: BoxDecoration(
              border: Border(bottom: BorderSide(color: t.border)),
            ),
            child: Row(
              children: [
                for (final c in columns)
                  Expanded(
                    flex: c.flex,
                    child: Text(
                      c.label.toUpperCase(),
                      textAlign: c.numeric ? TextAlign.right : TextAlign.left,
                      style: TextStyle(color: t.subtle, fontSize: 11.5, fontWeight: FontWeight.w600, letterSpacing: 0.6),
                    ),
                  ),
                if (actions != null) const SizedBox(width: 96),
              ],
            ),
          ),
          for (var i = 0; i < rows.length; i++)
            _Row(
              last: i == rows.length - 1,
              onTap: onTap == null ? null : () => onTap!(rows[i]),
              child: Row(
                children: [
                  for (final c in columns)
                    Expanded(
                      flex: c.flex,
                      child: Padding(
                        padding: const EdgeInsets.only(right: 12),
                        child: Align(alignment: c.numeric ? Alignment.centerRight : Alignment.centerLeft, child: c.cell(rows[i])),
                      ),
                    ),
                  if (actions != null)
                    SizedBox(
                      width: 96,
                      child: Row(mainAxisAlignment: MainAxisAlignment.end, children: actions!(rows[i])),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _Row extends StatefulWidget {
  const _Row({required this.child, this.onTap, required this.last});
  final Widget child;
  final VoidCallback? onTap;
  final bool last;
  @override
  State<_Row> createState() => _RowState();
}

class _RowState extends State<_Row> {
  bool _h = false;
  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    return MouseRegion(
      onEnter: (_) => setState(() => _h = true),
      onExit: (_) => setState(() => _h = false),
      cursor: widget.onTap != null ? SystemMouseCursors.click : MouseCursor.defer,
      child: GestureDetector(
        onTap: widget.onTap,
        behavior: HitTestBehavior.opaque,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 120),
          constraints: const BoxConstraints(minHeight: 52),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
          decoration: BoxDecoration(
            color: _h ? t.hover : Colors.transparent,
            border: widget.last ? null : Border(bottom: BorderSide(color: t.border)),
          ),
          child: widget.child,
        ),
      ),
    );
  }
}

class RowAction extends StatelessWidget {
  const RowAction(this.icon, this.tooltip, this.onPressed, {super.key, this.danger = false});
  final IconData icon;
  final String tooltip;
  final VoidCallback? onPressed;
  final bool danger;
  @override
  Widget build(BuildContext context) => IconButton(
    tooltip: tooltip,
    visualDensity: VisualDensity.compact,
    onPressed: onPressed,
    icon: Icon(icon, size: 19, color: danger ? context.sp.danger : context.sp.muted),
  );
}

/// Indicador numérico (cartão de métrica).
class StatTile extends StatelessWidget {
  const StatTile({super.key, required this.label, required this.value, this.icon, this.color, this.hint, this.onTap});
  final String label, value;
  final String? hint;
  final IconData? icon;
  final Color? color;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    return Glass(
      padding: const EdgeInsets.all(18),
      onTap: onTap,
      child: Row(
        children: [
          if (icon != null) ...[IconBubble(icon!, color: color ?? t.brand), const SizedBox(width: 14)],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(color: t.muted, fontSize: 13),
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 4),
                TweenAnimationBuilder<double>(
                  tween: Tween(begin: 0.6, end: 1),
                  duration: const Duration(milliseconds: 500),
                  curve: Curves.easeOutBack,
                  builder: (_, v, child) => Opacity(opacity: v.clamp(0, 1), child: child),
                  child: Text(
                    value,
                    style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: t.fg, letterSpacing: -0.5, fontFeatures: const [ui.FontFeature.tabularFigures()]),
                  ),
                ),
                if (hint != null)
                  Text(
                    hint!,
                    style: TextStyle(color: t.subtle, fontSize: 12),
                    overflow: TextOverflow.ellipsis,
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Grade responsiva de cartões.
class ResponsiveGrid extends StatelessWidget {
  const ResponsiveGrid({super.key, required this.children, this.minItemWidth = 240, this.spacing = 14});
  final List<Widget> children;
  final double minItemWidth, spacing;
  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, c) {
      final cols = (c.maxWidth / minItemWidth).floor().clamp(1, 6);
      final w = (c.maxWidth - spacing * (cols - 1)) / cols;
      return Wrap(
        spacing: spacing,
        runSpacing: spacing,
        children: [for (final ch in children) SizedBox(width: w, child: ch)],
      );
    },
  );
}

// ───────────── Campos de formulário ─────────────

class FieldLabel extends StatelessWidget {
  const FieldLabel(this.text, {super.key});
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 6),
    child: Text(
      text,
      style: TextStyle(fontSize: 13, color: context.sp.muted, fontWeight: FontWeight.w500),
    ),
  );
}

class Select<T> extends StatelessWidget {
  const Select({super.key, required this.value, required this.items, required this.onChanged, this.label, this.hint, this.width});
  final T? value;
  final List<(T, String)> items;
  final ValueChanged<T?>? onChanged;
  final String? label, hint;
  final double? width;
  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final has = items.any((e) => e.$1 == value);
    final field = DropdownButtonFormField<T>(
      initialValue: has ? value : null,
      key: ValueKey('$label|$value|${items.length}'),
      isExpanded: true,
      dropdownColor: t.surfaceStrong,
      borderRadius: BorderRadius.circular(16),
      decoration: InputDecoration(labelText: label, hintText: hint),
      items: [
        for (final (v, l) in items)
          DropdownMenuItem<T>(
            value: v,
            child: Text(l, overflow: TextOverflow.ellipsis),
          ),
      ],
      onChanged: onChanged,
    );
    return width == null ? field : SizedBox(width: width, child: field);
  }
}

/// Campo de data (abre o calendário).
class DateField extends StatelessWidget {
  const DateField({super.key, required this.label, required this.value, required this.onChanged, this.width, this.clearable = false});
  final String label;
  final String? value;
  final ValueChanged<String?> onChanged;
  final double? width;
  final bool clearable;
  @override
  Widget build(BuildContext context) {
    final f = InkWell(
      borderRadius: BorderRadius.circular(SpTokens.radiusSm),
      onTap: () async {
        final init = DateTime.tryParse(value ?? '') ?? todayBr();
        final d = await showDatePicker(context: context, initialDate: init, firstDate: DateTime(2000), lastDate: DateTime(2100), locale: const Locale('pt', 'BR'));
        if (d != null) onChanged(isoDate(d));
      },
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: label,
          suffixIcon: clearable && value != null ? IconButton(icon: const Icon(Icons.close_rounded, size: 18), onPressed: () => onChanged(null)) : const Icon(Icons.event_rounded, size: 18),
        ),
        child: Text(value == null || value!.isEmpty ? 'Escolher' : brDate(value), style: TextStyle(color: context.sp.fg)),
      ),
    );
    return width == null ? f : SizedBox(width: width, child: f);
  }
}

/// Seletor de mês (‹ Janeiro/2027 ›).
class MonthPicker extends StatelessWidget {
  const MonthPicker({super.key, required this.month, required this.onChanged});
  final DateTime month;
  final ValueChanged<DateTime> onChanged;
  @override
  Widget build(BuildContext context) => Glass(
    padding: const EdgeInsets.symmetric(horizontal: 4),
    radius: 999,
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        IconButton(tooltip: 'Mês anterior', icon: const Icon(Icons.chevron_left_rounded), onPressed: () => onChanged(DateTime(month.year, month.month - 1))),
        SizedBox(
          width: 130,
          child: Text(
            monthLabel(month),
            textAlign: TextAlign.center,
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
        ),
        IconButton(tooltip: 'Próximo mês', icon: const Icon(Icons.chevron_right_rounded), onPressed: () => onChanged(DateTime(month.year, month.month + 1))),
      ],
    ),
  );
}

/// Campo de busca com atraso (debounce).
class SearchField extends StatefulWidget {
  const SearchField({super.key, required this.onChanged, this.hint = 'Buscar…', this.width = 280});
  final ValueChanged<String> onChanged;
  final String hint;
  final double width;
  @override
  State<SearchField> createState() => _SearchFieldState();
}

class _SearchFieldState extends State<SearchField> {
  Timer? _t;
  @override
  void dispose() {
    _t?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => SizedBox(
    width: isWide(context) ? widget.width : double.infinity,
    child: TextField(
      decoration: InputDecoration(hintText: widget.hint, prefixIcon: const Icon(Icons.search_rounded, size: 20)),
      onChanged: (v) {
        _t?.cancel();
        _t = Timer(const Duration(milliseconds: 300), () => widget.onChanged(v.trim()));
      },
    ),
  );
}

/// Formulário em colunas (2 no computador, 1 no celular).
class FormGrid extends StatelessWidget {
  const FormGrid({super.key, required this.children, this.columns = 2});
  final List<Widget> children;
  final int columns;
  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, c) {
      final cols = c.maxWidth < 480 ? 1 : columns;
      final w = (c.maxWidth - 12 * (cols - 1)) / cols;
      return Wrap(
        spacing: 12,
        runSpacing: 14,
        children: [for (final ch in children) SizedBox(width: ch is FullWidth ? c.maxWidth : w, child: ch)],
      );
    },
  );
}

class FullWidth extends StatelessWidget {
  const FullWidth(this.child, {super.key});
  final Widget child;
  @override
  Widget build(BuildContext context) => child;
}

List<TextInputFormatter> digitsOnly([int? max]) => [FilteringTextInputFormatter.digitsOnly, if (max != null) LengthLimitingTextInputFormatter(max)];

/// Barra de abas em pílula de vidro.
class GlassTabs extends StatelessWidget {
  const GlassTabs({super.key, required this.tabs, required this.index, required this.onChanged});
  final List<String> tabs;
  final int index;
  final ValueChanged<int> onChanged;
  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Glass(
        radius: 999,
        padding: const EdgeInsets.all(4),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (var i = 0; i < tabs.length; i++)
              GestureDetector(
                onTap: () => onChanged(i),
                child: MouseRegion(
                  cursor: SystemMouseCursors.click,
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(999),
                      color: i == index ? t.brand.withValues(alpha: 0.16) : Colors.transparent,
                      border: Border.all(color: i == index ? t.brand.withValues(alpha: 0.35) : Colors.transparent),
                    ),
                    child: Text(
                      tabs[i],
                      style: TextStyle(color: i == index ? t.brand : t.muted, fontWeight: FontWeight.w600, fontSize: 13.5),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

Map<String, dynamic> asMap(Object? v) => v is Map ? v.cast<String, dynamic>() : <String, dynamic>{};
List<Map<String, dynamic>> asList(Object? v) => v is List ? [for (final e in v) asMap(e)] : (v is Map && v['data'] is List ? asList(v['data']) : const []);
