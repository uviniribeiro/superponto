import 'package:flutter/foundation.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/glass.dart';
import '../core/tokens.dart';
import '../widgets/masked.dart';
import '../widgets/ui.dart';
import 'auth_layout.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key, this.next});
  final String? next;
  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _email = TextEditingController(), _password = TextEditingController(), _code = TextEditingController(), _server = TextEditingController(text: api.baseUrl);
  final _username = TextEditingController(), _cnpj = TextEditingController(text: maskCnpjInput(api.lastLoginCnpj));
  bool _busy = false, _mfa = false, _recovery = false, _show = false, _showServer = false;

  /// Como na v1: usuário + CNPJ da empresa + senha (padrão), ou e-mail + senha.
  bool _byCompany = api.lastLoginMode != 'email';
  String? _error;

  Future<void> _submit() async {
    if (_byCompany ? (_username.text.trim().isEmpty || _cnpj.text.trim().isEmpty || _password.text.isEmpty) : (_email.text.trim().isEmpty || _password.text.isEmpty)) {
      setState(() => _error = _byCompany ? 'Informe usuário, CNPJ e senha' : 'Informe e-mail e senha');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      if (!kIsWeb && _server.text.trim() != api.baseUrl) await api.setServer(_server.text);
      await api.signIn(
        _email.text,
        _password.text,
        username: _byCompany ? _username.text : null,
        cnpj: _byCompany ? _cnpj.text : null,
        code: _mfa && !_recovery ? _code.text.trim() : null,
        recoveryCode: _mfa && _recovery ? _code.text.trim() : null,
      );
      final next = widget.next != null && widget.next!.startsWith('/') && !widget.next!.startsWith('//') ? widget.next! : null;
      // Super Admin abre no painel da plataforma (clientes); os demais, no painel do próprio cliente.
      if (mounted) context.go(next ?? (api.me?.isPlatformAdmin == true ? '/plataforma' : '/'));
    } on ApiException catch (e) {
      setState(() {
        if (e.mfaRequired) _mfa = true;
        _error = e.mfaRequired && !_mfa ? null : e.message;
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    return AuthLayout(
      title: _mfa ? 'Verificação em duas etapas' : 'Entrar',
      subtitle: _mfa
          ? (_recovery ? 'Digite um dos códigos de recuperação.' : 'Digite o código de 6 dígitos do aplicativo autenticador.')
          : (_byCompany ? 'Acesse com seu usuário, o CNPJ da empresa e a senha.' : 'Acesse com seu e-mail e senha.'),
      child: AutofillGroup(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_error != null) FormMessage(_error!),
            if (!_mfa) ...[
              Center(
                child: GlassTabs(
                  tabs: const ['Empresa', 'E-mail'],
                  index: _byCompany ? 0 : 1,
                  onChanged: (i) => setState(() {
                    _byCompany = i == 0;
                    _error = null;
                  }),
                ),
              ),
              const SizedBox(height: 16),
              if (_byCompany) ...[
                TextField(
                  controller: _username,
                  autofillHints: const [AutofillHints.username],
                  textInputAction: TextInputAction.next,
                  autocorrect: false,
                  decoration: const InputDecoration(labelText: 'Usuário', prefixIcon: Icon(Icons.person_outline_rounded, size: 20)),
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: _cnpj,
                  textInputAction: TextInputAction.next,
                  inputFormatters: [MaskFormatter(maskCnpjInput)],
                  decoration: const InputDecoration(labelText: 'CNPJ da empresa', hintText: '00.000.000/0000-00', prefixIcon: Icon(Icons.business_rounded, size: 20)),
                ),
              ] else
                TextField(
                  controller: _email,
                  keyboardType: TextInputType.emailAddress,
                  autofillHints: const [AutofillHints.username, AutofillHints.email],
                  textInputAction: TextInputAction.next,
                  decoration: const InputDecoration(labelText: 'E-mail', prefixIcon: Icon(Icons.alternate_email_rounded, size: 20)),
                ),
              const SizedBox(height: 14),
              TextField(
                controller: _password,
                obscureText: !_show,
                autofillHints: const [AutofillHints.password],
                onSubmitted: (_) => _submit(),
                decoration: InputDecoration(
                  labelText: 'Senha',
                  prefixIcon: const Icon(Icons.lock_outline_rounded, size: 20),
                  suffixIcon: IconButton(
                    tooltip: _show ? 'Ocultar senha' : 'Mostrar senha',
                    icon: Icon(_show ? Icons.visibility_off_rounded : Icons.visibility_rounded, size: 20),
                    onPressed: () => setState(() => _show = !_show),
                  ),
                ),
              ),
            ] else
              TextField(
                controller: _code,
                autofocus: true,
                keyboardType: _recovery ? TextInputType.text : TextInputType.number,
                autofillHints: const [AutofillHints.oneTimeCode],
                onSubmitted: (_) => _submit(),
                decoration: InputDecoration(labelText: _recovery ? 'Código de recuperação' : 'Código', prefixIcon: const Icon(Icons.pin_rounded, size: 20)),
              ),
            if (!kIsWeb && !_mfa) ...[
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(onPressed: () => setState(() => _showServer = !_showServer), icon: const Icon(Icons.dns_rounded, size: 16), label: const Text('Servidor')),
              ),
              if (_showServer)
                TextField(
                  controller: _server,
                  keyboardType: TextInputType.url,
                  decoration: const InputDecoration(labelText: 'Endereço do servidor', hintText: 'https://ponto.suaempresa.com.br'),
                ),
            ],
            const SizedBox(height: 20),
            GlassButton(label: _mfa ? 'Verificar' : 'Entrar', icon: Icons.arrow_forward_rounded, loading: _busy, expand: true, onPressed: _submit),
            const SizedBox(height: 12),
            if (_mfa)
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  TextButton(onPressed: () => setState(() => _recovery = !_recovery), child: Text(_recovery ? 'Usar o aplicativo' : 'Usar código de recuperação')),
                  TextButton(
                    onPressed: () => setState(() {
                      _mfa = _recovery = false;
                      _code.clear();
                      _error = null;
                    }),
                    child: const Text('Voltar'),
                  ),
                ],
              )
            else
              Center(
                child: TextButton(
                  onPressed: () => context.go('/forgot-password'),
                  child: Text('Esqueci minha senha', style: TextStyle(color: t.muted)),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
