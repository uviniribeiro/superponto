// Documentos legais (LGPD — Lei 13.709/2018; Marco Civil — Lei 12.965/2014; CLT; Portaria MTP 671/2021)
// e aceite no primeiro acesso. Abertos sem login em /privacidade, /termos e /consentimento.
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../core/api.dart';
import '../core/glass.dart';
import '../core/tokens.dart';

/// Versão dos documentos: ao mudar, todos aceitam de novo.
const legalVersion = '2026-11-22';

/// Canal do Encarregado (DPO) do SuperPonto — ajuste aqui quando houver e-mail próprio.
const dpoContact = 'o Encarregado (DPO) pelo e-mail suporte@maxponto.com';

typedef _Doc = (String title, String subtitle, List<(String, String)> sections);

const _privacy = <(String, String)>[
  (
    '1. Quem somos e papéis',
    'O SuperPonto é um sistema de controle de jornada (ponto eletrônico). A empresa empregadora que contrata o SuperPonto é a CONTROLADORA dos dados dos seus trabalhadores (LGPD, art. 5º, VI). O SuperPonto atua como OPERADOR, tratando os dados apenas conforme as instruções da empresa e este documento (art. 5º, VII e art. 39).',
  ),
  (
    '2. Dados tratados',
    'Identificação: nome, CPF, PIS/NIS, matrícula, cargo, departamento, unidade e e-mail/telefone (quando informados). Jornada: marcações de ponto, escalas, ajustes, abonos, afastamentos, banco de horas e espelho de ponto. Acesso: usuário, data/hora de login, endereço IP e aparelho. Quando a empresa usar: localização no momento da marcação e biometria (digital/face) — esta é dado pessoal SENSÍVEL (art. 5º, II), guardada cifrada.',
  ),
  (
    '3. Finalidades e bases legais',
    'Registro e controle da jornada e geração dos arquivos fiscais (AFD/AEJ) e do espelho de ponto: cumprimento de obrigação legal (art. 7º, II; CLT art. 74; Portaria MTP 671/2021). Execução do contrato de trabalho e folha: art. 7º, V. Segurança, prevenção a fraudes e registros de acesso: legítimo interesse e Marco Civil (art. 7º, IX; Lei 12.965/2014, art. 15). Biometria: garantia da prevenção à fraude e segurança do titular na identificação (art. 11, II, "g") ou obrigação legal (art. 11, II, "a"). Comunicações opcionais: consentimento (art. 7º, I), que pode ser revogado a qualquer momento.',
  ),
  (
    '4. Compartilhamento',
    'Os dados não são vendidos. Podem ser compartilhados: com a própria empresa empregadora; com autoridades (Auditoria-Fiscal do Trabalho, Justiça, ANPD) quando exigido por lei; e com fornecedores de infraestrutura (hospedagem e banco de dados em nuvem), sob contrato e confidencialidade.',
  ),
  (
    '5. Transferência internacional',
    'A infraestrutura de nuvem pode estar fora do Brasil (ex.: Canadá e EUA). A transferência ocorre com garantias de proteção adequadas e cláusulas contratuais, nos termos do art. 33 da LGPD e da Resolução CD/ANPD nº 19/2024.',
  ),
  (
    '6. Isolamento e segurança',
    'Cada empresa cliente enxerga somente os próprios dados (isolamento por cliente no banco de dados). Usamos conexão cifrada (HTTPS), senhas guardadas com hash, verificação em duas etapas opcional, biometria cifrada, controle de permissões por perfil e trilha de auditoria (art. 46). Incidentes relevantes são comunicados à ANPD e aos titulares (art. 48).',
  ),
  (
    '7. Prazo de guarda',
    'Registros de ponto, AFD/AEJ e espelhos são mantidos pelo prazo legal (no mínimo 5 anos — Portaria MTP 671/2021 e prescrição trabalhista, CF art. 7º, XXIX), e registros de acesso por no mínimo 6 meses (Marco Civil, art. 15). Depois disso, os dados são eliminados ou anonimizados, salvo outra obrigação legal (art. 16).',
  ),
  (
    '8. Seus direitos (art. 18)',
    'Você pode pedir: confirmação e acesso aos dados; correção; anonimização, bloqueio ou eliminação de dados desnecessários; portabilidade; informação sobre compartilhamentos; e revogação do consentimento, quando for essa a base. Dados exigidos por lei (como as marcações de ponto) não podem ser apagados antes do prazo legal. O trabalhador também pode consultar e imprimir o próprio espelho de ponto no sistema.',
  ),
  (
    '9. Cookies e armazenamento local',
    'Usamos apenas armazenamento local essencial: manter o login, o tema escolhido, a empresa ativa e o que você já viu (novidades e tour). Não usamos cookies de publicidade nem rastreamento de terceiros.',
  ),
  ('10. Contato', 'Pedidos sobre dados pessoais: $dpoContact. Você também pode peticionar à Autoridade Nacional de Proteção de Dados (ANPD).'),
];

const _terms = <(String, String)>[
  ('1. Aceite', 'Ao usar o SuperPonto você concorda com estes Termos e com a Política de Privacidade. Se não concordar, não use o sistema e procure a sua empresa.'),
  (
    '2. O serviço',
    'O SuperPonto registra e controla a jornada de trabalho nos termos da CLT (art. 74) e da Portaria MTP 671/2021 (REP-C, REP-A e REP-P), gera o comprovante de marcação, o AFD, o AEJ e o espelho de ponto, e oferece cadastros, escalas, banco de horas, relatórios e integrações.',
  ),
  (
    '3. Responsabilidades da empresa contratante',
    'Manter os cadastros corretos, definir escalas e regras conforme a lei e os acordos/convenções coletivas, guardar e apresentar os arquivos à fiscalização, conceder acesso ao trabalhador ao próprio ponto e obter as bases legais necessárias para tratar os dados dos seus trabalhadores (LGPD).',
  ),
  (
    '4. Responsabilidades do usuário',
    'Usar login pessoal e intransferível, manter a senha em sigilo (6+ caracteres com maiúscula, minúscula, número e símbolo), registrar o próprio ponto com veracidade e não tentar acessar dados de terceiros. Marcação por outra pessoa ou fraude pode ter consequências disciplinares e legais.',
  ),
  (
    '5. Integridade dos registros',
    'Marcações originais não são alteradas nem apagadas: ajustes e abonos ficam registrados à parte, com autor, data e motivo, preservando o original (Portaria MTP 671/2021).',
  ),
  (
    '6. Disponibilidade',
    'Buscamos manter o serviço disponível de forma contínua, mas podem ocorrer manutenções e falhas de terceiros (internet, nuvem). Recomendamos que a empresa mantenha meio alternativo de registro em caso de indisponibilidade, conforme a Portaria.',
  ),
  ('7. Propriedade intelectual', 'O software, marca e layout do SuperPonto pertencem aos seus titulares. Os dados inseridos pertencem à empresa contratante e aos titulares.'),
  ('8. Suspensão', 'O acesso pode ser suspenso por inadimplência, uso indevido ou ordem legal. Os dados permanecem guardados pelo prazo legal e podem ser exportados pela empresa.'),
  ('9. Alterações e foro', 'Estes Termos podem ser atualizados; mudanças relevantes pedirão novo aceite. Aplica-se a lei brasileira, incluindo o Código de Defesa do Consumidor quando cabível.'),
];

const _consent = <(String, String)>[
  (
    '1. Para que serve',
    'Este termo registra a ciência e, quando aplicável, o consentimento para o tratamento de dados pessoais de TERCEIROS no SuperPonto — por exemplo, trabalhadores, dependentes ou contatos cadastrados por administradores, gestores e pela equipe de RH.',
  ),
  (
    '2. Declaração de quem cadastra dados',
    'Ao cadastrar ou importar dados de outras pessoas, você declara que: (a) age em nome da empresa empregadora (controladora); (b) os dados são necessários para as finalidades da Política de Privacidade; (c) existe base legal para o tratamento (em regra, obrigação legal e execução do contrato de trabalho — LGPD, art. 7º, II e V); e (d) os titulares foram informados sobre o tratamento (art. 9º).',
  ),
  (
    '3. Dados sensíveis',
    'Biometria e dados de saúde (atestados, afastamentos) são dados sensíveis (art. 11). Só devem ser coletados quando necessários e com a base legal adequada; para biometria, a empresa deve informar o trabalhador e oferecer alternativa de registro quando ele recusar, salvo obrigação legal.',
  ),
  ('4. Menores de idade', 'Dados de adolescentes (aprendizes) devem ser tratados no seu melhor interesse (art. 14), apenas para as finalidades do contrato de aprendizagem.'),
  (
    '5. Consentimento do titular',
    'Quando a base legal for o consentimento (ex.: comunicações opcionais), ele é livre, informado e pode ser revogado a qualquer momento, sem prejuízo do contrato de trabalho.',
  ),
  ('6. Uso proibido', 'É proibido usar os dados de terceiros para finalidade diferente da informada, compartilhá-los fora do sistema sem base legal ou exportá-los sem necessidade.'),
];

const docs = <String, _Doc>{
  'privacidade': ('Política de Privacidade', 'Como tratamos dados pessoais, conforme a LGPD (Lei 13.709/2018).', _privacy),
  'termos': ('Termos de Uso', 'Regras de uso do SuperPonto, conforme a CLT e a Portaria MTP 671/2021.', _terms),
  'consentimento': ('Termo de Consentimento e Uso de Dados de Terceiros', 'Responsabilidades ao cadastrar dados de outras pessoas (LGPD).', _consent),
};

class LegalPage extends StatelessWidget {
  const LegalPage({super.key, required this.doc});
  final String doc;
  @override
  Widget build(BuildContext context) {
    final t = context.sp;
    final d = docs[doc]!;
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: LiquidBackdrop(
        child: SafeArea(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 860),
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Row(
                    children: [
                      IconButton(tooltip: 'Voltar', onPressed: () => context.canPop() ? context.pop() : context.go(api.signedIn ? '/' : '/login'), icon: const Icon(Icons.arrow_back_rounded)),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          d.$1,
                          style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: t.fg),
                        ),
                      ),
                    ],
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(52, 0, 0, 14),
                    child: Text('${d.$2} Versão de $legalVersion.', style: TextStyle(color: t.muted)),
                  ),
                  Glass(
                    child: SelectionArea(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          for (final s in d.$3) ...[
                            Text(s.$1, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                            const SizedBox(height: 6),
                            Text(s.$2, style: TextStyle(color: t.muted, height: 1.5)),
                            const SizedBox(height: 16),
                          ],
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    children: [
                      for (final e in docs.entries)
                        if (e.key != doc) TextButton(onPressed: () => context.go('/${e.key}'), child: Text(e.value.$1)),
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

/// Links para os documentos (rodapé do login e da conta).
class LegalLinks extends StatelessWidget {
  const LegalLinks({super.key});
  @override
  Widget build(BuildContext context) => Wrap(
    alignment: WrapAlignment.center,
    children: [
      for (final e in docs.entries)
        TextButton(
          onPressed: () => context.push('/${e.key}'),
          child: Text(e.key == 'consentimento' ? 'Dados de terceiros' : e.value.$1, style: TextStyle(fontSize: 12, color: context.sp.muted)),
        ),
    ],
  );
}

/// Aceite dos documentos no primeiro acesso (e a cada nova versão). Fica registrado no aparelho.
Future<void> maybeAskLegalConsent(BuildContext context) async {
  SharedPreferences? p;
  try {
    p = await SharedPreferences.getInstance();
  } catch (_) {}
  final key = 'sp.legal.${api.me?.id ?? ''}';
  if (p?.getString(key) == legalVersion || p?.getString('sp.legal') == legalVersion || !context.mounted) return;
  // O aceite fica registrado no servidor (prova: versão, data/hora, IP e aparelho).
  try {
    final r = await api.getMap('/auth/legal-consent');
    if (r['version'] == legalVersion) {
      await p?.setString(key, legalVersion);
      return;
    }
  } catch (_) {}
  if (!context.mounted) return;
  var ok = false;
  await showDialog<void>(
    context: context,
    barrierDismissible: false,
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, set) {
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
                        'Privacidade e termos',
                        style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: t.fg),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Para continuar, leia e aceite os documentos abaixo. Eles explicam como seus dados são tratados (LGPD) e as regras de uso do ponto eletrônico (CLT e Portaria MTP 671/2021).',
                        style: TextStyle(color: t.muted),
                      ),
                      const SizedBox(height: 8),
                      const LegalLinks(),
                      CheckboxListTile(
                        value: ok,
                        onChanged: (v) => set(() => ok = v ?? false),
                        contentPadding: EdgeInsets.zero,
                        controlAffinity: ListTileControlAffinity.leading,
                        title: const Text('Li e aceito a Política de Privacidade, os Termos de Uso e o Termo de Uso de Dados de Terceiros.', style: TextStyle(fontSize: 13.5)),
                      ),
                      const SizedBox(height: 8),
                      GlassButton(label: 'Continuar', expand: true, onPressed: ok ? () => Navigator.pop(ctx) : null),
                      TextButton(onPressed: () => api.signOut(), child: const Text('Não aceito (sair)')),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      },
    ),
  );
  if (!ok) return;
  // Aceite fica salvo no aparelho na hora (não pergunta de novo) e também no servidor (prova LGPD).
  await p?.setString(key, legalVersion);
  await p?.setString('sp.legal', legalVersion);
  try {
    await api.post('/auth/legal-consent', {'version': legalVersion});
  } catch (_) {}
}
