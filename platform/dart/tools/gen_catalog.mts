// Gera lib/src/generated/catalog.dart a partir do catálogo de permissões da API em TypeScript.
import { writeFileSync } from 'node:fs';
import { ACTION_LABELS, AVAILABLE_RESOURCES, MODULE_LABELS, PERMISSIONS, RESOURCE_LABELS } from '../../apps/api/src/authorization/catalog.ts';

const q = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\$/g, '\\$')}'`;
const map = (o: Record<string, string>) => `{\n${Object.entries(o).map(([k, v]) => `  ${q(k)}: ${q(v)},`).join('\n')}\n}`;
const out = `// GERADO por tools/gen_catalog.mts a partir de apps/api/src/authorization/catalog.ts. Não edite à mão.
// ignore_for_file: lines_longer_than_80_chars

const permissions = <String, String>${map(PERMISSIONS)};

const moduleLabels = <String, String>${map(MODULE_LABELS)};

const resourceLabels = <String, String>${map(RESOURCE_LABELS)};

const actionLabels = <String, String>${map(ACTION_LABELS)};

const availableResources = <String>{${[...AVAILABLE_RESOURCES].map(q).join(', ')}};
`;
writeFileSync(new URL('../server/lib/src/generated/catalog.dart', import.meta.url), out);
