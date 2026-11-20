// Minha conta: troca de senha (atende a troca obrigatória no próximo acesso) e verificação em duas etapas.
import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../core/api.dart';
import '../core/glass.dart';
import '../core/tokens.dart';
import '../widgets/ui.dart';

class AccountPage extends StatefulWidget {
  const AccountPage({super.key});
  @override
  State<AccountPage> createState() => _AccountPageState();
}

class _AccountPageState extends State<AccountPage> {
  final _cur = TextEditingController(), _next = TextEditingController(), _conf = TextEditingController();
  String? _error;
  bool _busy = false;

  Future<void> _change() async {
    setState(() => _error = null);
    if (_next.text.length < 12) return setState(() => _error = 'A nova senha precisa de 12 caracteres ou mais');
    if (_next.text != _conf.text) return setState(() => _error = 'As senhas novas não conferem');
    setState(() => _busy = true);
    try {
      await api.post('/auth/password/change', {'currentPassword': _cur.text, 'newPassword': _next.text});
      _cur.clear();
      _next.clear();
      _conf.clear();
      await api.loadMe();
      if (mounted) toast(context, 'Senha alterada');
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final me = api.me!;
    final pw = Glass(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SectionTitle('Trocar senha'),
          TextField(
            controller: _cur,
            obscureText: true,
            autofillHints: const [AutofillHints.password],
            decoration: const InputDecoration(labelText: 'Senha atual'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _next,
            obscureText: true,
            autofillHints: const [AutofillHints.newPassword],
            decoration: const InputDecoration(labelText: 'Nova senha', helperText: '12 caracteres ou mais'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _conf,
            obscureText: true,
            onSubmitted: (_) => _change(),
            decoration: const InputDecoration(labelText: 'Repita a nova senha'),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Text(_error!, style: TextStyle(color: t.danger)),
            ),
          const SizedBox(height: 16),
          Align(
            alignment: Alignment.centerLeft,
            child: GlassButton(label: 'Salvar nova senha', icon: Icons.key_rounded, loading: _busy, onPressed: _change),
          ),
        ],
      ),
    );
    return PageScaffold(
      title: 'Minha conta',
      subtitle: '${me.displayName} · ${me.email}',
      icon: Icons.person_rounded,
      maxWidth: 1100,
      children: [
        if (me.mustChangePassword)
          Glass(
            margin: const EdgeInsets.only(bottom: 14),
            tint: t.warning,
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Icon(Icons.gpp_maybe_rounded, color: t.warning),
                const SizedBox(width: 10),
                const Expanded(child: Text('O administrador pediu que você troque sua senha antes de continuar.')),
              ],
            ),
          ),
        isWide(context)
            ? Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: pw),
                  const SizedBox(width: 14),
                  const Expanded(child: MfaCard()),
                ],
              )
            : Column(children: [pw, const SizedBox(height: 14), const MfaCard()]),
      ],
    );
  }
}

/// Verificação em duas etapas (aplicativo autenticador).
class MfaCard extends StatefulWidget {
  const MfaCard({super.key});
  @override
  State<MfaCard> createState() => _MfaCardState();
}

class _MfaCardState extends State<MfaCard> {
  int _token = 0;
  Map<String, dynamic>? _enroll;
  List<String>? _codes;
  bool _disabling = false, _busy = false;
  final _code = TextEditingController();

  Future<void> _do(Future<void> Function() f) async {
    setState(() => _busy = true);
    try {
      await f();
    } catch (e) {
      if (mounted) toast(context, '$e', error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    return Glass(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SectionTitle('Verificação em duas etapas'),
          if (_codes != null) ...[
            Text('Guarde estes códigos de recuperação num lugar seguro. Cada um entra uma vez se você perder o celular. Eles não aparecem de novo.', style: TextStyle(color: t.muted)),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final c in _codes!)
                  Glass(
                    radius: 10,
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    child: SelectableText(c, style: const TextStyle(fontFamily: 'monospace')),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              children: [
                GlassButton(
                  label: 'Copiar',
                  icon: Icons.copy_rounded,
                  kind: BtnKind.glass,
                  small: true,
                  onPressed: () async {
                    await Clipboard.setData(ClipboardData(text: _codes!.join('\n')));
                    if (context.mounted) toast(context, 'Copiado');
                  },
                ),
                GlassButton(label: 'Já guardei', small: true, onPressed: () => setState(() => _codes = null)),
              ],
            ),
          ] else if (_enroll != null) ...[
            Text('1. No aplicativo autenticador, leia o QR code (ou digite a chave).', style: TextStyle(color: t.muted)),
            const SizedBox(height: 10),
            Center(
              child: Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
                child: QrImageView(data: '${_enroll!['uri']}', size: 180, backgroundColor: Colors.white),
              ),
            ),
            const SizedBox(height: 8),
            Center(
              child: SelectableText(
                '${_enroll!['secret']}',
                style: TextStyle(fontFamily: 'monospace', color: t.muted),
              ),
            ),
            const SizedBox(height: 12),
            Text('2. Digite o código de 6 dígitos que aparece no aplicativo.', style: TextStyle(color: t.muted)),
            const SizedBox(height: 8),
            TextField(
              controller: _code,
              keyboardType: TextInputType.number,
              inputFormatters: digitsOnly(6),
              decoration: const InputDecoration(labelText: 'Código'),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              children: [
                GlassButton(
                  label: 'Ativar',
                  loading: _busy,
                  onPressed: () => _do(() async {
                    final r = asMap(await api.post('/auth/mfa/confirm', {'code': _code.text}));
                    setState(() {
                      _codes = [for (final c in r['recoveryCodes'] as List) '$c'];
                      _enroll = null;
                      _code.clear();
                      _token++;
                    });
                  }),
                ),
                GlassButton(label: 'Cancelar', kind: BtnKind.ghost, onPressed: () => setState(() => _enroll = null)),
              ],
            ),
          ] else
            Async<Map<String, dynamic>>(
              reloadToken: _token,
              load: () => api.getMap('/auth/mfa'),
              builder: (context, st, _) => st['enrolled'] == true
                  ? Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(
                          children: [
                            Icon(Icons.verified_user_rounded, color: t.success),
                            const SizedBox(width: 8),
                            const Expanded(child: Text('Ativada. O login pede o código do aplicativo depois da senha.')),
                          ],
                        ),
                        Padding(
                          padding: const EdgeInsets.only(top: 6),
                          child: Text('Códigos de recuperação restantes: ${st['recoveryCodesLeft']}', style: TextStyle(color: t.muted)),
                        ),
                        const SizedBox(height: 12),
                        if (_disabling) ...[
                          TextField(
                            controller: _code,
                            keyboardType: TextInputType.number,
                            inputFormatters: digitsOnly(6),
                            decoration: const InputDecoration(labelText: 'Código atual do aplicativo'),
                          ),
                          const SizedBox(height: 10),
                          Wrap(
                            spacing: 8,
                            children: [
                              GlassButton(
                                label: 'Desativar',
                                kind: BtnKind.danger,
                                loading: _busy,
                                onPressed: () => _do(() async {
                                  await api.post('/auth/mfa/disable', {'code': _code.text});
                                  if (!mounted) return;
                                  toast(this.context, 'Verificação em duas etapas desativada');
                                  setState(() {
                                    _disabling = false;
                                    _code.clear();
                                    _token++;
                                  });
                                }),
                              ),
                              GlassButton(label: 'Cancelar', kind: BtnKind.ghost, onPressed: () => setState(() => _disabling = false)),
                            ],
                          ),
                        ] else
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              GlassButton(
                                label: 'Novos códigos de recuperação',
                                kind: BtnKind.glass,
                                small: true,
                                loading: _busy,
                                onPressed: () => _do(() async {
                                  final r = asMap(await api.post('/auth/mfa/recovery-codes'));
                                  setState(() => _codes = [for (final c in r['recoveryCodes'] as List) '$c']);
                                }),
                              ),
                              GlassButton(label: 'Desativar', kind: BtnKind.ghost, small: true, onPressed: () => setState(() => _disabling = true)),
                            ],
                          ),
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text('Para desativar ou gerar novos códigos, é preciso ter entrado com o código nesta sessão.', style: TextStyle(color: t.subtle, fontSize: 12)),
                        ),
                      ],
                    )
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          'Proteja sua conta: além da senha, o login pede um código que muda a cada 30 segundos no seu celular. Recomendado para administradores.',
                          style: TextStyle(color: t.muted),
                        ),
                        const SizedBox(height: 12),
                        Align(
                          alignment: Alignment.centerLeft,
                          child: GlassButton(
                            label: 'Ativar',
                            icon: Icons.smartphone_rounded,
                            loading: _busy,
                            onPressed: () => _do(() async {
                              final r = asMap(await api.post('/auth/mfa/enroll'));
                              setState(() {
                                _enroll = r;
                                _code.clear();
                              });
                            }),
                          ),
                        ),
                      ],
                    ),
            ),
        ],
      ),
    );
  }
}
