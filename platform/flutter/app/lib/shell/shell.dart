// Casco do app logado: barra lateral de vidro (computador) ou gaveta (celular), topo com organização, tema e conta.
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/glass.dart';
import '../core/logo.dart';
import '../core/tokens.dart';
import '../main.dart' show saveThemeMode, themeMode;
import 'nav.dart';

class AppShell extends StatefulWidget {
  const AppShell({super.key, required this.location, required this.child});
  final String location;
  final Widget child;
  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  bool _collapsed = false;

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final me = api.me!;
    final sections = buildNav(me);
    final wide = MediaQuery.sizeOf(context).width >= 1024;
    final content = KeyedSubtree(key: ValueKey('${api.activeTenant}'), child: widget.child);
    final page = AnimatedSwitcher(
      duration: const Duration(milliseconds: 260),
      switchInCurve: Curves.easeOutCubic,
      transitionBuilder: (c, a) => FadeTransition(
        opacity: a,
        child: SlideTransition(
          position: Tween(begin: const Offset(0, 0.012), end: Offset.zero).animate(a),
          child: c,
        ),
      ),
      child: KeyedSubtree(key: ValueKey(widget.location.split('?').first), child: content),
    );
    return Scaffold(
      backgroundColor: Colors.transparent,
      drawer: wide
          ? null
          : Drawer(
              backgroundColor: Colors.transparent,
              width: 300,
              child: _Sidebar(sections: sections, location: widget.location, collapsed: false, onNavigate: () => Navigator.of(context).pop()),
            ),
      body: LiquidBackdrop(
        child: SafeArea(
          child: Row(
            children: [
              if (wide)
                AnimatedContainer(
                  duration: const Duration(milliseconds: 260),
                  curve: Curves.easeOutCubic,
                  width: _collapsed ? 84 : 276,
                  child: _Sidebar(sections: sections, location: widget.location, collapsed: _collapsed, onToggle: () => setState(() => _collapsed = !_collapsed)),
                ),
              Expanded(
                child: Column(
                  children: [
                    _TopBar(wide: wide, t: t),
                    Expanded(child: page),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar({required this.wide, required this.t});
  final bool wide;
  final SpTokens t;
  @override
  Widget build(BuildContext context) {
    final me = api.me!;
    return Padding(
      padding: EdgeInsets.fromLTRB(wide ? 20 : 8, 12, wide ? 24 : 12, 4),
      child: Row(
        children: [
          if (!wide) ...[
            Builder(
              builder: (c) => IconButton(tooltip: 'Menu', onPressed: () => Scaffold.of(c).openDrawer(), icon: const Icon(Icons.menu_rounded)),
            ),
            const LogoMark(size: 30),
          ],
          const Spacer(),
          if (me.isPlatformAdmin) Pill('Super Admin', color: t.brand),
          const SizedBox(width: 8),
          ValueListenableBuilder(
            valueListenable: themeMode,
            builder: (_, m, _) => IconButton(
              tooltip: m == ThemeMode.light ? 'Tema escuro' : 'Tema claro',
              onPressed: () => setTheme(m == ThemeMode.light ? ThemeMode.dark : ThemeMode.light),
              icon: Icon(m == ThemeMode.light ? Icons.dark_mode_rounded : Icons.light_mode_rounded, color: t.muted),
            ),
          ),
          PopupMenuButton<String>(
            tooltip: 'Conta',
            offset: const Offset(0, 48),
            onSelected: (v) async {
              if (v == 'account') context.go('/minha-conta');
              if (v == 'out') await api.signOut();
            },
            itemBuilder: (_) => [
              PopupMenuItem(
                enabled: false,
                child: Text(me.email, style: TextStyle(color: t.muted, fontSize: 13)),
              ),
              const PopupMenuItem(
                value: 'account',
                child: ListTile(dense: true, leading: Icon(Icons.person_rounded), title: Text('Minha conta')),
              ),
              const PopupMenuItem(
                value: 'out',
                child: ListTile(dense: true, leading: Icon(Icons.logout_rounded), title: Text('Sair')),
              ),
            ],
            child: Glass(
              radius: 999,
              padding: const EdgeInsets.fromLTRB(4, 4, 12, 4),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  CircleAvatar(
                    radius: 15,
                    backgroundColor: t.brand,
                    child: Text(
                      me.displayName.isEmpty ? '?' : me.displayName.characters.first.toUpperCase(),
                      style: TextStyle(color: t.onBrand, fontWeight: FontWeight.w700, fontSize: 13),
                    ),
                  ),
                  if (wide) ...[
                    const SizedBox(width: 8),
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 160),
                      child: Text(
                        me.displayName,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.w500),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Sidebar extends StatelessWidget {
  const _Sidebar({required this.sections, required this.location, required this.collapsed, this.onToggle, this.onNavigate});
  final List<NavSection> sections;
  final String location;
  final bool collapsed;
  final VoidCallback? onToggle, onNavigate;

  bool _active(String path) {
    final loc = location.split('?').first;
    return path == '/' ? loc == '/' : loc == path || loc.startsWith('$path/') && !sections.any((s) => s.items.any((i) => i.path != path && i.path.startsWith('$path/') && loc.startsWith(i.path)));
  }

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    return Glass(
      margin: const EdgeInsets.all(12),
      padding: EdgeInsets.zero,
      strong: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: EdgeInsets.fromLTRB(collapsed ? 0 : 18, 18, collapsed ? 0 : 8, 10),
            child: collapsed
                ? Column(
                    children: [
                      const LogoMark(size: 34),
                      if (onToggle != null)
                        IconButton(
                          tooltip: 'Expandir',
                          onPressed: onToggle,
                          icon: Icon(Icons.keyboard_double_arrow_right_rounded, color: t.muted, size: 20),
                        ),
                    ],
                  )
                : Row(
                    children: [
                      const Expanded(child: Logo(size: 34)),
                      if (onToggle != null)
                        IconButton(
                          tooltip: 'Recolher',
                          onPressed: onToggle,
                          icon: Icon(Icons.keyboard_double_arrow_left_rounded, color: t.muted, size: 20),
                        ),
                    ],
                  ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(10, 0, 10, 16),
              children: [
                for (final s in sections) ...[
                  if (!collapsed)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(12, 16, 12, 6),
                      child: Text(
                        s.label.toUpperCase(),
                        style: TextStyle(fontSize: 11, letterSpacing: 0.8, fontWeight: FontWeight.w600, color: t.subtle),
                      ),
                    )
                  else
                    Divider(height: 18, indent: 18, endIndent: 18, color: t.border),
                  for (final i in s.items) _NavTile(item: i, active: _active(i.path), collapsed: collapsed, onNavigate: onNavigate),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _NavTile extends StatefulWidget {
  const _NavTile({required this.item, required this.active, required this.collapsed, this.onNavigate});
  final NavItem item;
  final bool active, collapsed;
  final VoidCallback? onNavigate;
  @override
  State<_NavTile> createState() => _NavTileState();
}

class _NavTileState extends State<_NavTile> {
  bool _h = false;
  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final a = widget.active;
    final tile = MouseRegion(
      cursor: SystemMouseCursors.click,
      onEnter: (_) => setState(() => _h = true),
      onExit: (_) => setState(() => _h = false),
      child: GestureDetector(
        onTap: () {
          context.go(widget.item.path);
          widget.onNavigate?.call();
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          margin: const EdgeInsets.symmetric(vertical: 1.5),
          padding: EdgeInsets.symmetric(horizontal: widget.collapsed ? 0 : 12, vertical: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            gradient: a ? LinearGradient(colors: [t.brand.withValues(alpha: 0.2), t.brand.withValues(alpha: 0.06)]) : null,
            color: a ? null : (_h ? t.hover : Colors.transparent),
            border: Border.all(color: a ? t.brand.withValues(alpha: 0.3) : Colors.transparent),
          ),
          child: Row(
            mainAxisAlignment: widget.collapsed ? MainAxisAlignment.center : MainAxisAlignment.start,
            children: [
              if (widget.item.dot != null && !widget.collapsed)
                Container(
                  width: 7,
                  height: 7,
                  margin: const EdgeInsets.only(right: 12, left: 6),
                  decoration: BoxDecoration(color: widget.item.dot, shape: BoxShape.circle),
                )
              else
                Icon(widget.item.icon, size: 20, color: a ? t.brand : t.muted),
              if (!widget.collapsed) ...[
                if (widget.item.dot == null) const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    widget.item.label,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(color: a ? t.fg : t.muted, fontWeight: a ? FontWeight.w600 : FontWeight.w500, fontSize: 14),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
    return widget.collapsed ? Tooltip(message: widget.item.label, waitDuration: const Duration(milliseconds: 300), child: tile) : tile;
  }
}

void setTheme(ThemeMode m) {
  themeMode.value = m;
  saveThemeMode(m);
}
