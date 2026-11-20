import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/glass.dart';
import 'auth_layout.dart';

class ForgotPasswordPage extends StatefulWidget {
  const ForgotPasswordPage({super.key});
  @override
  State<ForgotPasswordPage> createState() => _ForgotPasswordPageState();
}

class _ForgotPasswordPageState extends State<ForgotPasswordPage> {
  final _email = TextEditingController();
  bool _busy = false, _sent = false;
  String? _error;

  Future<void> _submit() async {
    final e = _email.text.trim();
    if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(e)) {
      setState(() => _error = 'E-mail inválido');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await api.post('/auth/password/forgot', {'email': e});
      setState(() => _sent = true);
    } on ApiException catch (x) {
      setState(() => _error = x.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => AuthLayout(
    title: 'Esqueci minha senha',
    subtitle: 'Enviaremos um link para criar uma nova senha. O link vale por 1 hora.',
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (_error != null) FormMessage(_error!),
        if (_sent)
          const FormMessage('Se o e-mail estiver cadastrado, você vai receber o link em instantes. Confira também a caixa de spam.', error: false)
        else ...[
          TextField(
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            onSubmitted: (_) => _submit(),
            decoration: const InputDecoration(labelText: 'E-mail', prefixIcon: Icon(Icons.alternate_email_rounded, size: 20)),
          ),
          const SizedBox(height: 20),
          GlassButton(label: 'Enviar link', icon: Icons.send_rounded, loading: _busy, expand: true, onPressed: _submit),
        ],
        const SizedBox(height: 12),
        Center(
          child: TextButton(onPressed: () => context.go('/login'), child: const Text('Voltar ao login')),
        ),
      ],
    ),
  );
}
