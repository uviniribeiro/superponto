// Meus aparelhos: liberar o celular/tablet que marca o ponto pelo app (código por e-mail).
import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/glass.dart';
import '../core/tokens.dart';
import '../widgets/ui.dart';

class MyDevicesPage extends StatefulWidget {
  const MyDevicesPage({super.key});
  @override
  State<MyDevicesPage> createState() => _MyDevicesPageState();
}

class _MyDevicesPageState extends State<MyDevicesPage> {
  final _name = TextEditingController(), _code = TextEditingController();
  Map<String, dynamic>? _pending;
  String? _token;
  bool _busy = false;
  int _reload = 0;

  Future<void> _request() async {
    final n = _name.text.trim();
    if (n.length < 2) return toast(context, 'Dê um nome ao aparelho', error: true);
    setState(() => _busy = true);
    final r = await run(context, () => api.post('/app-devices/request', {'name': n}), success: 'Enviamos um código para o seu e-mail');
    if (!mounted) return;
    setState(() {
      _busy = false;
      if (r != null) {
        _pending = asMap(r);
        _code.clear();
        _token = null;
        _reload++;
      }
    });
  }

  Future<void> _confirm() async {
    setState(() => _busy = true);
    final r = await run(context, () => api.post('/app-devices/${_pending!['id']}/confirm', {'code': _code.text.trim()}));
    if (!mounted) return;
    setState(() {
      _busy = false;
      if (r != null) {
        _token = asMap(r)['token'] as String?;
        _pending = null;
        _name.clear();
        _reload++;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final left = Glass(
      child: _token != null
          ? Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Icon(Icons.check_circle_rounded, color: t.success),
                    const SizedBox(width: 8),
                    const Text('Aparelho liberado', style: TextStyle(fontWeight: FontWeight.w700)),
                  ],
                ),
                const SizedBox(height: 8),
                Text('Cole este token no app do aparelho. Ele aparece só agora; se perder, libere de novo.', style: TextStyle(color: t.muted)),
                const SizedBox(height: 10),
                Glass(
                  radius: 12,
                  padding: const EdgeInsets.all(12),
                  child: SelectableText(_token!, style: const TextStyle(fontFamily: 'monospace')),
                ),
                const SizedBox(height: 10),
                Align(
                  alignment: Alignment.centerLeft,
                  child: GlassButton(
                    label: 'Copiar',
                    icon: Icons.copy_rounded,
                    kind: BtnKind.glass,
                    small: true,
                    onPressed: () async {
                      await Clipboard.setData(ClipboardData(text: _token!));
                      if (context.mounted) toast(context, 'Copiado');
                    },
                  ),
                ),
              ],
            )
          : _pending != null
          ? Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('Digite o código de 6 dígitos enviado ao seu e-mail para liberar ${_pending!['name']}. Vale por 10 minutos.', style: TextStyle(color: t.muted)),
                const SizedBox(height: 12),
                TextField(
                  controller: _code,
                  keyboardType: TextInputType.number,
                  inputFormatters: digitsOnly(6),
                  decoration: const InputDecoration(labelText: 'Código'),
                ),
                const SizedBox(height: 14),
                Wrap(
                  spacing: 8,
                  children: [
                    GlassButton(label: 'Confirmar', loading: _busy, onPressed: _confirm),
                    GlassButton(label: 'Cancelar', kind: BtnKind.ghost, onPressed: () => setState(() => _pending = null)),
                  ],
                ),
              ],
            )
          : Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextField(
                  controller: _name,
                  maxLength: 60,
                  decoration: const InputDecoration(labelText: 'Nome do aparelho', hintText: 'Ex.: Meu celular', counterText: ''),
                ),
                const SizedBox(height: 14),
                Align(
                  alignment: Alignment.centerLeft,
                  child: GlassButton(label: 'Enviar código por e-mail', icon: Icons.smartphone_rounded, loading: _busy, onPressed: _request),
                ),
              ],
            ),
    );
    final right = Glass(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SectionTitle('Aparelhos liberados'),
          Async<List<Map<String, dynamic>>>(
            reloadToken: _reload,
            load: () => api.getList('/app-devices/mine'),
            builder: (context, list, reload) {
              final approved = list.where((d) => d['approvedAt'] != null).toList();
              if (approved.isEmpty) return const EmptyState(icon: Icons.smartphone_rounded, title: 'Nenhum aparelho', body: 'Libere o aparelho ao lado.');
              return Column(
                children: [
                  for (final d in approved)
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const IconBubble(Icons.smartphone_rounded, size: 36),
                      title: Row(
                        children: [
                          Flexible(child: Text('${d['name']}')),
                          if (d['revokedAt'] != null) ...[const SizedBox(width: 6), Pill('revogado', color: t.danger)],
                        ],
                      ),
                      subtitle: Text('Liberado em ${brDateTime(d['approvedAt'])}${d['lastUsedAt'] != null ? ' · usado em ${brDateTime(d['lastUsedAt'])}' : ''}'),
                      trailing: d['revokedAt'] != null
                          ? null
                          : RowAction(Icons.delete_outline_rounded, 'Revogar', () async {
                              if (!await confirm(context, title: 'Revogar aparelho?', body: '${d['name']} não poderá mais marcar o ponto pelo app.', confirmLabel: 'Revogar') || !context.mounted) {
                                return;
                              }
                              if (await act(context, () => api.post('/app-devices/mine/${d['id']}/revoke'), success: 'Aparelho revogado')) reload();
                            }, danger: true),
                    ),
                ],
              );
            },
          ),
        ],
      ),
    );
    return PageScaffold(
      title: 'Meus aparelhos',
      subtitle: 'Libere o celular ou tablet que você usa para marcar o ponto pelo app. A liberação é confirmada por um código enviado ao seu e-mail.',
      icon: Icons.smartphone_rounded,
      children: [
        isWide(context)
            ? Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: left),
                  const SizedBox(width: 14),
                  Expanded(child: right),
                ],
              )
            : Column(children: [left, const SizedBox(height: 14), right]),
      ],
    );
  }
}
