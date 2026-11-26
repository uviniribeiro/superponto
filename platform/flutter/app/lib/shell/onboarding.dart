// "O que há de novo" (uma vez por versão, lembrado ao fechar) e tour guiado na primeira vez que cada
// menu é aberto. Fica guardado no aparelho (SharedPreferences).
import 'package:material_ui/material_ui.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/glass.dart';
import '../core/tokens.dart';

const appVersion = '2.1.0';

const _news = <(IconData, String, String)>[
  (Icons.auto_awesome_rounded, 'Visual novo em vidro', 'Telas mais modernas, leves e fluidas, inclusive em monitores de 120/144 Hz.'),
  (Icons.pin_rounded, 'Verificação em duas etapas animada', 'Digite o código em caixas animadas, com confirmação visual.'),
  (Icons.password_rounded, 'Senha mais prática e segura', '6+ caracteres com maiúscula, minúscula, número e símbolo, com medidor de força.'),
  (Icons.apartment_rounded, 'Empresa pelo CNPJ', 'Entre com usuário + CNPJ; com mais de um CNPJ, escolha a empresa no topo.'),
  (Icons.tour_rounded, 'Tour guiado', 'Na primeira vez em cada menu, um guia rápido mostra o que dá para fazer ali.'),
];

/// Dicas do tour por tela (as demais usam uma dica geral com o nome do menu).
const _tips = <String, List<String>>{
  '/': ['Este é o seu painel: resumo do dia e atalhos.', 'Use o menu à esquerda para navegar; no celular, toque em ☰.'],
  '/funcionarios': ['Cadastre e encontre funcionários por nome, CPF ou matrícula.', 'Toque num funcionário para ver o vínculo, a escala e o histórico.'],
  '/ponto/espelho': ['Escolha o funcionário e o mês para ver o espelho de ponto.', 'Ajustes, abonos e o fechamento ficam nos menus de Ponto.'],
  '/ponto/registrar': ['Registre o ponto com um toque.', 'A marcação entra no espelho na hora (REP-P).'],
  '/relatorios': ['Escolha um relatório, aplique filtros e exporte em CSV, Excel ou imprima.'],
  '/usuarios': ['Crie usuários, defina perfis e bloqueios de acesso.', 'O usuário de suporte fica oculto e protegido.'],
  '/empresas': ['Cadastre as empresas (CNPJ) do seu grupo.', 'Com mais de um CNPJ, o seletor no topo troca a empresa ativa.'],
  '/equipamentos': ['Cadastre os relógios (REP) e acompanhe a comunicação.', 'Envie funcionários e colete marcações pelo relógio.'],
  '/plataforma': ['Visão geral da plataforma: números por cliente.', 'Os dados de cada cliente ficam só com o cliente.'],
  '/plataforma/clientes': ['Crie clientes, gere novas senhas de admin/suporte e suspenda ou reative.'],
  '/minha-conta': ['Troque sua senha e ative a verificação em duas etapas.'],
};

Future<SharedPreferences?> _prefs() async {
  try {
    return await SharedPreferences.getInstance();
  } catch (_) {
    return null;
  }
}

/// Mostra "O que há de novo" se esta versão ainda não foi vista neste aparelho.
Future<void> maybeShowWhatsNew(BuildContext context) async {
  final p = await _prefs();
  if (p == null || p.getString('sp.seenVersion') == appVersion || !context.mounted) return;
  await showDialog<void>(
    context: context,
    barrierColor: Colors.black54,
    builder: (ctx) {
      final t = ctx.sp;
      return Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 480),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Material(
              type: MaterialType.transparency,
              child: Glass(
                strong: true,
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'O que há de novo',
                      style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: t.fg),
                    ),
                    Text('SuperPonto $appVersion', style: TextStyle(color: t.muted)),
                    const SizedBox(height: 16),
                    for (final (i, n) in _news.indexed)
                      TweenAnimationBuilder<double>(
                        tween: Tween(begin: 0, end: 1),
                        duration: Duration(milliseconds: 350 + i * 90),
                        curve: Curves.easeOutCubic,
                        builder: (_, v, child) => Opacity(
                          opacity: v,
                          child: Transform.translate(offset: Offset(0, 12 * (1 - v)), child: child),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              IconBubble(n.$1),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(n.$2, style: const TextStyle(fontWeight: FontWeight.w700)),
                                    Text(n.$3, style: TextStyle(color: t.muted, fontSize: 13)),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    const SizedBox(height: 8),
                    GlassButton(label: 'Entendi', expand: true, onPressed: () => Navigator.pop(ctx)),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
    },
  );
  await p.setString('sp.seenVersion', appVersion); // fechou: não mostra de novo nesta versão
}

/// Cartão do tour para a tela atual, na primeira visita. Devolve null se já foi visto.
class TourCard extends StatefulWidget {
  const TourCard({super.key, required this.path, required this.title});
  final String path, title;
  @override
  State<TourCard> createState() => _TourCardState();
}

class _TourCardState extends State<TourCard> {
  bool _show = false;
  int _step = 0;
  late List<String> _steps;

  @override
  void initState() {
    super.initState();
    _steps = _tips[widget.path] ?? ['Bem-vindo a ${widget.title}.', 'Use a busca e os filtros no topo da tela; toque num item para ver detalhes.'];
    _prefs().then((p) {
      if (p != null && p.getBool('sp.tour.off') != true && p.getBool('sp.tour.${widget.path}') != true && mounted) setState(() => _show = true);
    });
  }

  /// Concluir: não mostra mais nesta tela. Pular: desliga o tour em todas as telas (salvo no aparelho).
  Future<void> _close({bool all = false}) async {
    setState(() => _show = false);
    final p = await _prefs();
    await p?.setBool('sp.tour.${widget.path}', true);
    if (all) await p?.setBool('sp.tour.off', true);
  }

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    return AnimatedSlide(
      offset: _show ? Offset.zero : const Offset(0, 0.3),
      duration: const Duration(milliseconds: 320),
      curve: Curves.easeOutCubic,
      child: AnimatedOpacity(
        opacity: _show ? 1 : 0,
        duration: const Duration(milliseconds: 260),
        child: IgnorePointer(
          ignoring: !_show,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 360),
            child: Glass(
              strong: true,
              padding: const EdgeInsets.fromLTRB(18, 14, 10, 10),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.tour_rounded, size: 18, color: t.brand),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text('Tour: ${widget.title}', style: const TextStyle(fontWeight: FontWeight.w700)),
                      ),
                      Text('${_step + 1}/${_steps.length}', style: TextStyle(color: t.subtle, fontSize: 12)),
                    ],
                  ),
                  const SizedBox(height: 8),
                  AnimatedSwitcher(
                    duration: const Duration(milliseconds: 220),
                    child: Text(
                      _steps[_step],
                      key: ValueKey(_step),
                      style: TextStyle(color: t.muted),
                    ),
                  ),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      TextButton(onPressed: () => _close(all: true), child: const Text('Pular tour')),
                      TextButton(onPressed: () => _step < _steps.length - 1 ? setState(() => _step++) : _close(), child: Text(_step < _steps.length - 1 ? 'Próximo' : 'Concluir')),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
