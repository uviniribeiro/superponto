// SuperPonto — app Flutter (web, Android, iOS e desktop) com visual liquid glass.
import 'package:flutter/foundation.dart';
import 'package:flutter_localizations/flutter_localizations.dart' show GlobalWidgetsLocalizations;
import 'package:flutter_web_plugins/url_strategy.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'auth/forgot_page.dart';
import 'auth/login_page.dart';
import 'auth/reset_page.dart';
import 'core/api.dart';
import 'core/tokens.dart';
import 'pages/registry.dart';
import 'shell/shell.dart';

final themeMode = ValueNotifier<ThemeMode>(ThemeMode.dark);

Future<void> saveThemeMode(ThemeMode m) async {
  try {
    (await SharedPreferences.getInstance()).setString('sp.theme', m.name);
  } catch (_) {}
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Erros de tela também no modo release (aparecem no console do navegador e no log do aparelho).
  FlutterError.onError = (d) {
    FlutterError.presentError(d);
    debugPrint('Erro de tela: ${d.exceptionAsString()}\n${d.stack?.toString().split('\n').take(6).join('\n') ?? ''}');
  };
  if (kIsWeb) usePathUrlStrategy();
  try {
    final saved = (await SharedPreferences.getInstance()).getString('sp.theme');
    if (saved == 'light') themeMode.value = ThemeMode.light;
  } catch (_) {}
  api.init();
  runApp(const SuperPontoApp());
}

const _public = ['/login', '/forgot-password', '/reset-password'];

/// Telas que o Super Admin usa: as da plataforma, a própria conta e a ajuda.
bool platformAllowed(String loc) =>
    loc.startsWith('/plataforma') || loc.startsWith('/minha-conta') || loc.startsWith('/manual') || loc.startsWith('/conformidade');

final router = GoRouter(
  refreshListenable: api,
  initialLocation: '/',
  redirect: (context, state) {
    final loc = state.matchedLocation;
    if (!api.ready || api.waitingNetwork) return loc == '/splash' ? null : '/splash?next=${Uri.encodeComponent(state.uri.toString())}';
    final isPublic = _public.contains(loc);
    if (loc == '/splash') {
      final next = state.uri.queryParameters['next'];
      final target = next != null && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/splash') ? next : '/';
      if (_public.contains(Uri.parse(target).path)) return target;
      return api.signedIn ? target : '/login${target == '/' ? '' : '?next=${Uri.encodeComponent(target)}'}';
    }
    if (!api.signedIn && !isPublic) return '/login${loc == '/' ? '' : '?next=${Uri.encodeComponent(state.uri.toString())}'}';
    if (api.signedIn && loc == '/login') return '/';
    if (api.signedIn && api.me!.mustChangePassword && loc != '/minha-conta') return '/minha-conta';
    // Super Admin: só o painel da plataforma (não abre telas nem dados de clientes).
    if (api.signedIn && api.me!.isPlatformAdmin && !platformAllowed(loc)) return '/plataforma';
    return null;
  },
  routes: [
    GoRoute(path: '/splash', builder: (_, _) => const _Splash()),
    GoRoute(
      path: '/login',
      builder: (_, s) => LoginPage(next: s.uri.queryParameters['next']),
    ),
    GoRoute(path: '/forgot-password', builder: (_, _) => const ForgotPasswordPage()),
    GoRoute(
      path: '/reset-password',
      builder: (_, s) => ResetPasswordPage(token: s.uri.queryParameters['token'] ?? ''),
    ),
    ShellRoute(
      builder: (context, state, child) => AppShell(location: state.uri.toString(), child: child),
      routes: [
        for (final e in pageRoutes.entries)
          GoRoute(
            path: e.key,
            pageBuilder: (c, s) => NoTransitionPage(child: e.value(c, s)),
          ),
      ],
    ),
  ],
  errorBuilder: (context, state) => const _NotFound(),
);

class SuperPontoApp extends StatelessWidget {
  const SuperPontoApp({super.key});

  @override
  Widget build(BuildContext context) => ValueListenableBuilder(
    valueListenable: themeMode,
    builder: (_, mode, _) => MaterialApp.router(
      title: 'SuperPonto',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(SpTokens.lightTokens),
      darkTheme: buildTheme(SpTokens.darkTokens),
      themeMode: mode,
      locale: const Locale('pt', 'BR'),
      supportedLocales: const [Locale('pt', 'BR')],
      localizationsDelegates: const [GlobalMaterialLocalizations.delegate, GlobalWidgetsLocalizations.delegate],
      routerConfig: router,
    ),
  );
}

class _Splash extends StatelessWidget {
  const _Splash();
  @override
  Widget build(BuildContext context) => Scaffold(
    body: ListenableBuilder(
      listenable: api,
      builder: (context, _) => Center(
        child: !api.waitingNetwork
            ? CircularProgressIndicator(color: context.sp.brand)
            : Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.cloud_off_rounded, size: 48, color: context.sp.muted),
                    const SizedBox(height: 12),
                    const Text('Sem conexão com o servidor', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 6),
                    Text('Seu login continua salvo. Confira a internet e tente de novo.', textAlign: TextAlign.center, style: TextStyle(color: context.sp.muted)),
                    const SizedBox(height: 16),
                    FilledButton.icon(onPressed: api.reconnect, icon: const Icon(Icons.refresh_rounded), label: const Text('Tentar de novo')),
                  ],
                ),
              ),
      ),
    ),
  );
}

class _NotFound extends StatelessWidget {
  const _NotFound();
  @override
  Widget build(BuildContext context) => Scaffold(
    body: Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text('Página não encontrada', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
          const SizedBox(height: 12),
          TextButton(onPressed: () => context.go('/'), child: const Text('Ir para o início')),
        ],
      ),
    ),
  );
}
