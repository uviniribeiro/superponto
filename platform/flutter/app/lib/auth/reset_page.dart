import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/glass.dart';
import 'auth_layout.dart';

/// Recebe ?token=… do e-mail. Só o servidor decide se o token vale (uso único, 1 hora); a tela não autoriza nada sozinha.
class ResetPasswordPage extends StatefulWidget {
  const ResetPasswordPage({super.key, required this.token});
  final String token;
  @override
  State<ResetPasswordPage> createState() => _ResetPasswordPageState();
}

class _ResetPasswordPageState extends State<ResetPasswordPage> {
  final _p1 = TextEditingController(), _p2 = TextEditingController();
  bool _busy = false, _done = false;
  String? _error;

  Future<void> _submit() async {
    if (_p1.text.length < 12) return setState(() => _error = 'A senha precisa de 12 caracteres ou mais');
    if (_p1.text != _p2.text) return setState(() => _error = 'As senhas não conferem');
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await api.post('/auth/password/reset', {'token': widget.token, 'password': _p1.text});
      setState(() => _done = true);
    } on ApiException catch (x) {
      setState(() => _error = x.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.token.isEmpty) {
      return AuthLayout(
        title: 'Link inválido',
        subtitle: 'Abra o link exatamente como chegou no e-mail ou peça um novo.',
        child: GlassButton(label: 'Pedir novo link', expand: true, onPressed: () => context.go('/forgot-password')),
      );
    }
    return AuthLayout(
      title: 'Nova senha',
      subtitle: 'Use 12 caracteres ou mais. Seu e-mail de acesso não muda.',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_error != null) FormMessage(_error!),
          if (_done) ...[
            const FormMessage('Senha alterada. Entre com a nova senha.', error: false),
            GlassButton(label: 'Ir para o login', expand: true, onPressed: () => context.go('/login')),
          ] else ...[
            TextField(
              controller: _p1,
              obscureText: true,
              autofillHints: const [AutofillHints.newPassword],
              decoration: const InputDecoration(labelText: 'Nova senha'),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _p2,
              obscureText: true,
              onSubmitted: (_) => _submit(),
              decoration: const InputDecoration(labelText: 'Repita a senha'),
            ),
            const SizedBox(height: 20),
            GlassButton(label: 'Salvar senha', loading: _busy, expand: true, onPressed: _submit),
          ],
        ],
      ),
    );
  }
}
