// Gera MANUAL.md e CONFORMIDADE_MTE.md na raiz de platform/ a partir do conteúdo das telas.
// Uso: npm run docs -w @superponto/web   (rodar sempre que alterar src/content)
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DISCLAIMER, GROUPS, LAST_REVIEW, STATUS_LABEL, summary } from '../src/content/conformidade.ts';
import { MANUAL_VERSION, SECTIONS } from '../src/content/manual.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const header = '<!-- Arquivo gerado por apps/web/scripts/docs.mts a partir de apps/web/src/content. Não edite à mão. -->\n\n';

const manual = [
  header,
  '# Manual do sistema SuperPonto\n',
  `_${MANUAL_VERSION}. O mesmo conteúdo está no sistema, em Ajuda › Manual._\n`,
  '## Sumário\n',
  ...SECTIONS.map((s, i) => `${i + 1}. [${s.title}](#${i + 1}-${s.id})`),
  '',
  ...SECTIONS.flatMap((s, i) => [
    `<a id="${i + 1}-${s.id}"></a>`,
    `## ${i + 1}. ${s.title}\n`,
    `**Para:** ${s.audience}\n`,
    ...s.body.map((p) => `${p}\n`),
    ...(s.steps ? ['**Passo a passo**\n', ...s.steps.map((st, n) => `${n + 1}. ${st}`), ''] : []),
    ...(s.tips ? [...s.tips.map((t) => `> **Dica:** ${t}`), ''] : []),
  ]),
].join('\n');

const sum = summary();
const compliance = [
  header,
  '# Conformidade MTE: exigências legais do registro de ponto\n',
  `_Revisado em ${LAST_REVIEW}. O mesmo conteúdo está no sistema, em Ajuda › Conformidade MTE._\n`,
  `> ${DISCLAIMER}\n`,
  '## Resumo\n',
  '| Situação | Itens |',
  '|---|---|',
  ...(['feito', 'andamento', 'planejado', 'fornecedor', 'cliente'] as const).map((k) => `| ${STATUS_LABEL[k]} | ${sum[k]} |`),
  `| **Total** | **${sum.total}** |`,
  '',
  '## Normas de referência\n',
  '- CLT (Decreto-Lei nº 5.452/1943), arts. 58, 59, 59-A, 62, 66, 67, 71, 73 e 74',
  '- Portaria MTP nº 671/2021: registro eletrônico de ponto (REP-C, REP-A, REP-P), programa de tratamento, AFD, AEJ, comprovante e espelho de ponto',
  '- Lei Complementar nº 150/2015 (empregado doméstico)',
  '- Instrução Normativa RFB nº 2.229/2024 (CNPJ alfanumérico)',
  '- Lei nº 13.709/2018 (LGPD)',
  '- Decreto nº 8.373/2014 (eSocial)',
  '',
  ...GROUPS.flatMap((g) => [
    `## ${g.title}\n`,
    `${g.intro}\n`,
    '| Exigência | Situação | Base legal |',
    '|---|---|---|',
    ...g.items.map((i) => `| [${i.title}](#${i.id}) | ${STATUS_LABEL[i.status]} | ${i.basis} |`),
    '',
    ...g.items.flatMap((i) => [
      `<a id="${i.id}"></a>`,
      `### ${i.title}\n`,
      `- **O que a norma exige:** ${i.rule}`,
      `- **Base legal:** ${i.basis}`,
      `- **Situação:** ${STATUS_LABEL[i.status]}`,
      `- **No SuperPonto:** ${i.howWe}`,
      '',
    ]),
  ]),
].join('\n');

writeFileSync(resolve(root, 'MANUAL.md'), manual);
writeFileSync(resolve(root, 'CONFORMIDADE_MTE.md'), compliance);
console.log(`MANUAL.md (${SECTIONS.length} seções) e CONFORMIDADE_MTE.md (${sum.total} exigências) gerados em ${root}`);
