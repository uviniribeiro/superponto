// Empresas e filiais (CNPJs): o CNPJ busca os dados na Receita e o CEP completa o endereço (município para os feriados).
import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../core/api.dart';
import '../core/format.dart';
import '../core/glass.dart';
import '../core/options.dart';
import '../core/tokens.dart';
import '../widgets/company_scope.dart';
import '../widgets/masked.dart';
import '../widgets/pick.dart';
import '../widgets/ui.dart';

class CompaniesPage extends StatefulWidget {
  const CompaniesPage({super.key});
  @override
  State<CompaniesPage> createState() => _CompaniesPageState();
}

class _CompaniesPageState extends State<CompaniesPage> {
  String _q = '';
  int _token = 0;

  @override
  Widget build(BuildContext context) {
    final canCreate = api.can('org.companies:create'), canUpdate = api.can('org.companies:update'), canDelete = api.can('org.companies:delete');
    final t = context.sp;
    return PageScaffold(
      title: 'Empresas',
      subtitle: 'Empresas e filiais (CNPJs) da organização.',
      icon: Icons.business_rounded,
      actions: [if (canCreate) GlassButton(label: 'Nova empresa', icon: Icons.add_rounded, onPressed: () => _edit(null))],
      children: [
        SearchField(hint: 'Buscar por nome ou CNPJ…', onChanged: (v) => setState(() => _q = v)),
        const SizedBox(height: 14),
        Async<List<Map<String, dynamic>>>(
          reloadToken: '$_q|$_token',
          load: () => api.getList('/companies', {'pageSize': 100, 'search': _q}),
          builder: (context, rows, _) => GlassTable<Map<String, dynamic>>(
            rows: rows,
            empty: EmptyState(
              icon: Icons.business_rounded,
              title: _q.isEmpty ? 'Nenhuma empresa ainda' : 'Nada encontrado',
              body: _q.isEmpty ? 'Cadastre a primeira empresa para começar.' : 'Tente outro termo de busca.',
            ),
            onTap: canUpdate ? _edit : null,
            columns: [
              Col(
                'Empresa',
                (c) => Row(
                  children: [
                    CompanyLogo(company: c),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            companyName(c),
                            style: const TextStyle(fontWeight: FontWeight.w600),
                            overflow: TextOverflow.ellipsis,
                          ),
                          if (c['tradeName'] != null)
                            Text(
                              '${c['legalName']}',
                              style: TextStyle(color: t.subtle, fontSize: 12.5),
                              overflow: TextOverflow.ellipsis,
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
                flex: 4,
                primary: true,
              ),
              Col('CNPJ', (c) => txt(c['cnpj'] == null ? 'Sem CNPJ' : fmtCnpj(c['cnpj']), mono: true, muted: true), flex: 2),
              Col('Cidade', (c) => txt(c['city'] == null ? null : '${c['city']}/${c['state']}', muted: true), flex: 2),
              Col('Segmento', (c) => Pill(segments[c['segment']] ?? '${c['segment']}', color: t.info), flex: 2),
            ],
            actions: (c) => [if (canDelete) RowAction(Icons.delete_outline_rounded, 'Remover', () => _remove(c), danger: true)],
          ),
        ),
      ],
    );
  }

  Future<void> _edit(Map<String, dynamic>? c) async {
    final ok = await showGlassDialog<bool>(
      context,
      title: c == null ? 'Nova empresa' : 'Editar empresa',
      width: 720,
      builder: (_) => CompanyForm(initial: c),
    );
    if (ok == true && mounted) {
      invalidateCompanies();
      setState(() => _token++);
    }
  }

  Future<void> _remove(Map<String, dynamic> c) async {
    if (!await confirm(context, title: 'Remover empresa?', body: '"${c['legalName']}" deixa de aparecer nas listas. O histórico fica guardado na auditoria.', confirmLabel: 'Remover') || !mounted) {
      return;
    }
    if (await act(context, () => api.delete('/companies/${c['id']}'), success: 'Empresa removida') && mounted) {
      invalidateCompanies();
      setState(() => _token++);
    }
  }
}

/// Logo da empresa (ou a inicial).
class CompanyLogo extends StatelessWidget {
  const CompanyLogo({super.key, required this.company, this.size = 40});
  final Map<String, dynamic> company;
  final double size;
  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final initial = Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        gradient: LinearGradient(colors: [t.brand.withValues(alpha: 0.3), t.brand.withValues(alpha: 0.1)]),
      ),
      child: Text(
        companyName(company).characters.firstOrNull?.toUpperCase() ?? '?',
        style: TextStyle(color: t.brand, fontWeight: FontWeight.w800),
      ),
    );
    if (company['logoUpdatedAt'] == null) return initial;
    return FutureBuilder<Map<String, dynamic>>(
      future: _logoCache.putIfAbsent('${company['id']}|${company['logoUpdatedAt']}', () => api.getMap('/companies/${company['id']}/logo')),
      builder: (_, s) {
        final url = s.data?['dataUrl'] as String?;
        if (url == null || !url.contains(',')) return initial;
        return Container(
          width: size,
          height: size,
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)),
          child: Image.memory(base64Decode(url.split(',').last), fit: BoxFit.contain, gaplessPlayback: true),
        );
      },
    );
  }
}

final _logoCache = <String, Future<Map<String, dynamic>>>{};

class CompanyForm extends StatefulWidget {
  const CompanyForm({super.key, this.initial});
  final Map<String, dynamic>? initial;
  @override
  State<CompanyForm> createState() => _CompanyFormState();
}

class _CompanyFormState extends State<CompanyForm> {
  late final Map<String, TextEditingController> _c = {
    for (final k in ['cnpj', 'legalName', 'tradeName', 'zipCode', 'street', 'number', 'complement', 'district', 'city', 'phone', 'email', 'stateRegistration', 'cno', 'externalCode'])
      k: TextEditingController(text: _initial(k)),
  };
  late String _segment = widget.initial?['segment'] as String? ?? 'GENERAL';
  late String _timezone = widget.initial?['timezone'] as String? ?? 'America/Sao_Paulo';
  late String _state = widget.initial?['state'] as String? ?? '';
  late String _ibge = widget.initial?['ibgeCode'] as String? ?? '';
  late String _lastCnpj = widget.initial?['cnpj'] as String? ?? '';
  late String _lastCep = widget.initial?['zipCode'] as String? ?? '';
  String? _cnpjStatus, _cepStatus;
  bool _cnpjWarn = false, _cepWarn = false, _busy = false;
  final _errors = <String, String>{};
  late String? _logoUpdated = widget.initial?['logoUpdatedAt'] as String?;

  String _initial(String k) {
    final v = widget.initial?[k];
    if (v == null) return '';
    if (k == 'cnpj') return maskCnpjInput('$v');
    if (k == 'zipCode') return maskCep('$v');
    if (k == 'phone') return maskPhone('$v');
    return '$v';
  }

  Future<void> _lookupCnpj(String v) async {
    final n = normCnpj(v);
    if (n.length < 14) return setState(() => _cnpjStatus = null);
    if (!validCnpj(n)) {
      return setState(() {
        _cnpjStatus = 'CNPJ inválido: confira os dígitos finais';
        _cnpjWarn = true;
      });
    }
    if (n == _lastCnpj) return;
    _lastCnpj = n;
    setState(() {
      _cnpjStatus = 'Consultando a Receita Federal…';
      _cnpjWarn = false;
    });
    try {
      final d = await api.getMap('/lookup/cnpj/$n');
      _c['legalName']!.text = '${d['legalName'] ?? ''}';
      if (d['tradeName'] != null) _c['tradeName']!.text = '${d['tradeName']}';
      if (d['phone'] != null) _c['phone']!.text = maskPhone('${d['phone']}');
      if (d['email'] != null) _c['email']!.text = '${d['email']}';
      if (d['address'] != null) {
        _applyAddress(asMap(d['address']));
        _lastCep = '${asMap(d['address'])['cep']}';
      }
      final st = d['status'] as String?;
      setState(() {
        _cnpjWarn = st != null && st.toUpperCase() != 'ATIVA';
        _cnpjStatus = _cnpjWarn ? 'Atenção: situação cadastral $st' : 'Situação ${st ?? 'não informada'} · dados preenchidos pela Receita';
      });
    } on ApiException catch (e) {
      setState(() {
        _cnpjStatus = e.message;
        _cnpjWarn = true;
      });
    }
  }

  void _applyAddress(Map<String, dynamic> a) {
    _c['zipCode']!.text = maskCep('${a['cep'] ?? ''}');
    if (a['street'] != null) _c['street']!.text = '${a['street']}';
    _c['number']!.text = '${a['number'] ?? ''}';
    _c['complement']!.text = '${a['complement'] ?? ''}';
    if (a['district'] != null) _c['district']!.text = '${a['district']}';
    _c['city']!.text = '${a['city'] ?? ''}';
    _state = '${a['uf'] ?? ''}';
    _ibge = '${a['ibge'] ?? ''}';
    if (a['timezone'] != null) _timezone = '${a['timezone']}';
  }

  Future<void> _lookupCep(String v) async {
    final n = digits(v);
    if (n.length < 8 || n == _lastCep) return;
    _lastCep = n;
    setState(() {
      _cepStatus = 'Buscando endereço…';
      _cepWarn = false;
    });
    try {
      final a = await api.getMap('/lookup/cep/$n');
      _applyAddress(a);
      setState(() => _cepStatus = '${a['city']}/${a['uf']}${a['ibge'] != null ? ' · feriados municipais desta cidade aplicados' : ''}');
    } on ApiException catch (e) {
      setState(() {
        _cepStatus = e.message;
        _cepWarn = true;
      });
    }
  }

  Future<void> _save() async {
    _errors.clear();
    String v(String k) => _c[k]!.text.trim();
    final cnpj = normCnpj(v('cnpj'));
    if (v('legalName').length < 2) _errors['legalName'] = 'Informe a razão social';
    if (cnpj.isNotEmpty && !validCnpj(cnpj)) _errors['cnpj'] = 'CNPJ inválido';
    if (v('zipCode').isNotEmpty && digits(v('zipCode')).length != 8) _errors['zipCode'] = 'CEP deve ter 8 dígitos';
    if (v('phone').isNotEmpty && ![10, 11].contains(digits(v('phone')).length)) _errors['phone'] = 'Telefone com DDD: 10 ou 11 dígitos';
    if (v('email').isNotEmpty && !RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(v('email'))) _errors['email'] = 'E-mail inválido';
    if (v('cno').isNotEmpty && !RegExp(r'^\d{12,14}$').hasMatch(digits(v('cno')))) _errors['cno'] = 'CEI/CNO: de 12 a 14 dígitos';
    setState(() {});
    if (_errors.isNotEmpty) return;
    String? opt(String s) => s.trim().isEmpty ? null : s.trim();
    final body = <String, Object?>{
      'legalName': v('legalName'),
      'tradeName': opt(v('tradeName')),
      'cnpj': cnpj.isEmpty ? null : cnpj,
      'segment': _segment,
      'timezone': _timezone,
      'zipCode': opt(digits(v('zipCode'))),
      'street': opt(v('street')),
      'number': opt(v('number')),
      'complement': opt(v('complement')),
      'district': opt(v('district')),
      'city': opt(v('city')),
      'state': opt(_state),
      'ibgeCode': opt(_ibge),
      'phone': opt(digits(v('phone'))),
      'email': opt(v('email')),
      'stateRegistration': opt(v('stateRegistration')),
      'cno': opt(digits(v('cno'))),
      'externalCode': opt(v('externalCode')),
    }..removeWhere((k, val) => val == null);
    setState(() => _busy = true);
    final ok = await act(
      context,
      () => widget.initial == null ? api.post('/companies', body) : api.patch('/companies/${widget.initial!['id']}', body),
      success: widget.initial == null ? 'Empresa cadastrada' : 'Empresa atualizada',
    );
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) Navigator.pop(context, true);
  }

  Future<void> _pickLogo() async {
    final f = await pickFile(['png', 'jpg', 'jpeg', 'webp']);
    if (f == null || !mounted) return;
    final (bytes, name) = f;
    if (bytes.length > 512 * 1024) return toast(context, 'O logo deve ter até 512 KB', error: true);
    final ext = name.split('.').last.toLowerCase();
    final mime = ext == 'jpg' || ext == 'jpeg' ? 'image/jpeg' : (ext == 'webp' ? 'image/webp' : 'image/png');
    final res = await run(context, () => api.put('/companies/${widget.initial!['id']}/logo', {'dataUrl': 'data:$mime;base64,${base64Encode(bytes)}'}), success: 'Logo atualizado');
    if (res != null && mounted) setState(() => _logoUpdated = asMap(res)['logoUpdatedAt'] as String? ?? DateTime.now().toIso8601String());
  }

  Widget _status(String? text, bool warn) {
    if (text == null) return const SizedBox.shrink();
    final t = context.sp;
    return Padding(
      padding: const EdgeInsets.only(top: 6),
      child: Row(
        children: [
          Icon(warn ? Icons.warning_amber_rounded : Icons.check_circle_outline_rounded, size: 16, color: warn ? t.warning : t.success),
          const SizedBox(width: 6),
          Expanded(
            child: Text(text, style: TextStyle(fontSize: 12.5, color: warn ? t.warning : t.success)),
          ),
        ],
      ),
    );
  }

  TextField _f(String k, String label, {String? hint, List<TextInputFormatter>? fmt, TextInputType? kb, ValueChanged<String>? onChanged, int? max}) => TextField(
    controller: _c[k],
    inputFormatters: fmt,
    keyboardType: kb,
    maxLength: max,
    onChanged: (v) {
      if (_errors.remove(k) != null) setState(() {});
      onChanged?.call(v);
    },
    decoration: InputDecoration(labelText: label, helperText: hint, errorText: _errors[k], counterText: ''),
  );

  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final initial = widget.initial;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (initial != null) ...[
          const SectionTitle('Logo'),
          Row(
            children: [
              CompanyLogo(key: ValueKey(_logoUpdated), company: {...initial, 'logoUpdatedAt': _logoUpdated}, size: 56),
              const SizedBox(width: 14),
              GlassButton(label: 'Enviar logo', icon: Icons.upload_rounded, kind: BtnKind.glass, small: true, onPressed: _pickLogo),
              const SizedBox(width: 8),
              if (_logoUpdated != null)
                GlassButton(
                  label: 'Remover',
                  kind: BtnKind.ghost,
                  small: true,
                  onPressed: () async {
                    if (await act(context, () => api.delete('/companies/${initial['id']}/logo'), success: 'Logo removido') && mounted) setState(() => _logoUpdated = null);
                  },
                ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.only(top: 6, bottom: 18),
            child: Text('PNG, JPEG ou WebP até 512 KB.', style: TextStyle(color: t.subtle, fontSize: 12)),
          ),
        ],
        const SectionTitle('Identificação'),
        FormGrid(
          children: [
            FullWidth(
              Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _f('cnpj', 'CNPJ', hint: 'Ao completar, os dados vêm da Receita', fmt: [MaskFormatter(maskCnpjInput)], onChanged: _lookupCnpj),
                  _status(_cnpjStatus, _cnpjWarn),
                ],
              ),
            ),
            FullWidth(_f('legalName', 'Razão social *')),
            FullWidth(_f('tradeName', 'Nome fantasia')),
            _f('phone', 'Telefone', fmt: [MaskFormatter(maskPhone)], kb: TextInputType.phone),
            _f('email', 'E-mail', kb: TextInputType.emailAddress),
            _f('stateRegistration', 'Inscrição estadual', hint: 'Número ou ISENTO'),
            _f('cno', 'CEI / CNO', hint: 'Obra ou atividade (vai no AFD)', fmt: digitsOnly(14)),
            FullWidth(_f('externalCode', 'Código externo', hint: 'Código desta empresa no sistema de folha', max: 30)),
          ],
        ),
        const SizedBox(height: 22),
        const SectionTitle('Endereço'),
        FormGrid(
          children: [
            FullWidth(
              Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _f('zipCode', 'CEP', fmt: [MaskFormatter(maskCep)], kb: TextInputType.number, onChanged: _lookupCep),
                  _status(_cepStatus, _cepWarn),
                ],
              ),
            ),
            FullWidth(_f('street', 'Logradouro')),
            _f('number', 'Número'),
            _f('complement', 'Complemento'),
            FullWidth(_f('district', 'Bairro')),
            _f('city', 'Cidade', onChanged: (_) => _ibge = ''),
            Select<String>(
              label: 'UF',
              value: _state,
              items: [('', '—'), for (final u in ufs) (u, u)],
              onChanged: (v) => setState(() {
                _state = v ?? '';
                _ibge = '';
              }),
            ),
          ],
        ),
        if (_c['city']!.text.isNotEmpty && _ibge.isEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: Text('Preencha o CEP para o sistema identificar o município e aplicar os feriados municipais automaticamente.', style: TextStyle(color: t.warning, fontSize: 12.5)),
          ),
        const SizedBox(height: 22),
        const SectionTitle('Configuração'),
        FormGrid(
          children: [
            Select<String>(label: 'Segmento', value: _segment, items: [for (final e in segments.entries) (e.key, e.value)], onChanged: (v) => setState(() => _segment = v ?? 'GENERAL')),
            Select<String>(
              label: 'Fuso horário',
              value: _timezone,
              items: [...brTimezones, if (!brTimezones.any((e) => e.$1 == _timezone)) (_timezone, _timezone)],
              onChanged: (v) => setState(() => _timezone = v ?? _timezone),
            ),
          ],
        ),
        if (initial != null) ...[
          const SizedBox(height: 22),
          RepPSettings(companyId: initial['id'] as String, canEdit: api.can('org.companies:update')),
          const SizedBox(height: 22),
          CertificateSettings(companyId: initial['id'] as String, canEdit: api.can('admin.settings:manage')),
        ],
        const SizedBox(height: 24),
        Align(
          alignment: Alignment.centerRight,
          child: GlassButton(label: initial != null ? 'Salvar alterações' : 'Cadastrar empresa', icon: Icons.check_rounded, loading: _busy, onPressed: _save),
        ),
      ],
    );
  }
}

/// Número do REP-P no INPI (vai no AFD e no AEJ) e último NSR das marcações pelo navegador/app.
class RepPSettings extends StatefulWidget {
  const RepPSettings({super.key, required this.companyId, required this.canEdit});
  final String companyId;
  final bool canEdit;
  @override
  State<RepPSettings> createState() => _RepPSettingsState();
}

class _RepPSettingsState extends State<RepPSettings> {
  final _inpi = TextEditingController();
  Map<String, dynamic>? _data;

  @override
  void initState() {
    super.initState();
    api.getMap('/timesheet/rep-p', {'companyId': widget.companyId}).then((d) {
      if (!mounted) return;
      setState(() {
        _data = d;
        _inpi.text = '${d['inpiNumber'] ?? ''}';
      });
    }, onError: (_) {});
  }

  @override
  Widget build(BuildContext context) {
    if (_data == null) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SectionTitle('REP-P (marcação pelo navegador e app)'),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _inpi,
                enabled: widget.canEdit,
                inputFormatters: digitsOnly(17),
                decoration: InputDecoration(labelText: 'Número no INPI', hintText: '17 dígitos', helperText: 'Último NSR das marcações pelo navegador/app: ${_data!['lastNsr']}'),
              ),
            ),
            if (widget.canEdit) ...[
              const SizedBox(width: 10),
              GlassButton(
                label: 'Salvar',
                kind: BtnKind.glass,
                small: true,
                onPressed: () {
                  final v = _inpi.text.trim();
                  if (v.isNotEmpty && v.length != 17) return toast(context, 'O número do INPI tem 17 dígitos', error: true);
                  act(context, () => api.put('/timesheet/rep-p', {'companyId': widget.companyId, 'inpiNumber': v.isEmpty ? null : v}), success: 'Número do REP-P salvo');
                },
              ),
            ],
          ],
        ),
      ],
    );
  }
}

/// Certificado digital ICP-Brasil A1 (PFX) da empresa: assina o AFD do REP-P e o AEJ (CAdES, .p7s).
class CertificateSettings extends StatefulWidget {
  const CertificateSettings({super.key, required this.companyId, required this.canEdit});
  final String companyId;
  final bool canEdit;
  @override
  State<CertificateSettings> createState() => _CertificateSettingsState();
}

class _CertificateSettingsState extends State<CertificateSettings> {
  Map<String, dynamic>? _cert;
  bool _loaded = false, _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load() => api
      .getMap('/companies/${widget.companyId}/certificate')
      .then(
        (d) {
          if (mounted) setState(() => (_cert = d['certificate'] == null ? null : asMap(d['certificate']), _loaded = true));
        },
        onError: (_) {
          if (mounted) setState(() => _loaded = true);
        },
      );

  Future<void> _upload() async {
    final f = await pickFile(['pfx', 'p12']);
    if (f == null || !mounted) return;
    if (f.$1.length > 64 * 1024) return toast(context, 'O arquivo do certificado deve ter até 64 KB', error: true);
    final pass = await promptText(
      context,
      title: 'Senha do certificado',
      label: 'Senha do arquivo ${f.$2}',
      confirmLabel: 'Enviar',
      obscure: true,
      help: 'O arquivo e a senha ficam cifrados no servidor e só são usados para assinar o AFD e o AEJ.',
    );
    if (pass == null || !mounted) return;
    setState(() => _busy = true);
    final r = await run(context, () => api.put('/companies/${widget.companyId}/certificate', {'pfxBase64': base64Encode(f.$1), 'password': pass}), success: 'Certificado digital salvo');
    if (!mounted) return;
    setState(() {
      _busy = false;
      if (r != null) _cert = asMap(asMap(r)['certificate']);
    });
  }

  @override
  Widget build(BuildContext context) {
    if (!_loaded) return const SizedBox.shrink();
    final t = context.sp;
    final c = _cert;
    final expired = c?['expired'] == true;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SectionTitle('Certificado digital (assinatura do AFD e do AEJ)'),
        if (c == null)
          Text('Nenhum certificado enviado. Sem ele, o AFD do REP-P e o AEJ saem sem a assinatura eletrônica (.p7s) exigida pela Portaria 671.', style: TextStyle(color: t.warning, fontSize: 12.5))
        else ...[
          Text('${c['subject']}', style: const TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          Text('Emitido por ${c['issuer']}', style: TextStyle(color: t.muted, fontSize: 12.5)),
          Text(
            'Válido de ${brDate(c['notBefore'])} até ${brDate(c['notAfter'])}${expired ? ' — VENCIDO' : ''} · série ${c['serialNumber']}',
            style: TextStyle(color: expired ? t.danger : t.muted, fontSize: 12.5),
          ),
        ],
        if (widget.canEdit) ...[
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              GlassButton(
                label: c == null ? 'Enviar certificado A1 (.pfx)' : 'Trocar certificado',
                icon: Icons.verified_user_rounded,
                kind: BtnKind.glass,
                small: true,
                loading: _busy,
                onPressed: _upload,
              ),
              if (c != null)
                GlassButton(
                  label: 'Remover',
                  kind: BtnKind.ghost,
                  small: true,
                  onPressed: () async {
                    if (!await confirm(context, title: 'Remover certificado', body: 'O AFD e o AEJ passam a sair sem assinatura até um novo certificado ser enviado.', confirmLabel: 'Remover')) return;
                    if (!mounted) return;
                    if (await act(this.context, () => api.delete('/companies/${widget.companyId}/certificate'), success: 'Certificado removido') && mounted) setState(() => _cert = null);
                  },
                ),
            ],
          ),
        ],
      ],
    );
  }
}
