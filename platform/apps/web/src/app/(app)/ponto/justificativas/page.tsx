'use client';

import { FileCheck2 } from 'lucide-react';
import { CatalogPage, type CatalogDef } from '@/components/catalog-page';

const DEF: CatalogDef = {
  title: 'Justificativas', singular: 'Justificativa', feminine: true, path: 'justifications', icon: FileCheck2,
  description: 'Códigos usados em abonos, afastamentos e solicitações. "Abona" tira o débito; sem abonar, a falta fica justificada mas é descontada.',
  readPermission: 'time.calculations:read', managePermission: 'time.justifications:manage',
  fields: [
    { key: 'name', label: 'Descrição', type: 'text', required: true, max: 120, placeholder: 'Ex.: Atestado médico' },
    { key: 'code', label: 'Código', type: 'text', max: 20, mono: true, hint: 'Opcional; vai na exportação para a folha' },
    { key: 'disregardsDebits', label: 'Efeito', type: 'select', options: [['true', 'Abona (não gera débito)'], ['false', 'Só justifica (desconta)']] },
    { key: 'usageLimit', label: 'Limite de uso por funcionário', type: 'text', max: 3, mono: true, hint: 'Vazio = sem limite' },
    { key: 'limitPeriod', label: 'Período do limite', type: 'select', options: [['MONTH', 'Por mês'], ['YEAR', 'Por ano']] },
    { key: 'active', label: 'Ativa', type: 'active' },
  ],
  subtitle: (r) => [r.code ? `Código ${r.code}` : null, r.disregardsDebits === false ? 'só justifica' : 'abona', r.usageLimit ? `até ${r.usageLimit} por ${r.limitPeriod === 'YEAR' ? 'ano' : 'mês'}` : 'sem limite'].filter(Boolean).join(' · '),
};

export default function Page() {
  return <CatalogPage def={DEF} />;
}
