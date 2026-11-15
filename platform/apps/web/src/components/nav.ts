import { BookOpen, Building2, CalendarDays, LayoutDashboard, Network, Scale, ShieldCheck, type LucideIcon } from 'lucide-react';
import type { Me } from '@/lib/api';
import { can } from './providers';

export interface NavLeaf {
  id: string;
  label: string;
  href: string;
  icon?: LucideIcon;
  /** cor do ponto na árvore de subitens */
  dot?: string;
  badge?: number;
}

export interface NavItem extends NavLeaf {
  icon: LucideIcon;
  children?: NavLeaf[];
}

export interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
}

/**
 * Navegação montada pelas permissões do usuário. Só entram telas que já funcionam:
 * cada módulo novo acrescenta seus itens aqui quando a API e a tela estiverem prontas.
 */
export function buildNav(me: Me | undefined): NavSection[] {
  const sections: NavSection[] = [
    { id: 'main', label: 'Principal', items: [{ id: 'overview', label: 'Visão geral', href: '/', icon: LayoutDashboard }] },
  ];
  if (can(me, 'org.companies:read')) {
    sections.push({
      id: 'org',
      label: 'Organização',
      items: [
        {
          id: 'structure',
          label: 'Estrutura',
          href: '/empresas',
          icon: Network,
          children: [{ id: 'companies', label: 'Empresas', href: '/empresas', icon: Building2, dot: '#fcc419' }],
        },
        { id: 'holidays', label: 'Feriados', href: '/feriados', icon: CalendarDays },
      ],
    });
  }
  if (me?.isPlatformAdmin) {
    sections.push({
      id: 'platform',
      label: 'Plataforma',
      items: [{ id: 'tenants', label: 'Clientes', href: '/plataforma/clientes', icon: ShieldCheck }],
    });
  }
  sections.push({
    id: 'help',
    label: 'Ajuda',
    items: [
      { id: 'manual', label: 'Manual', href: '/manual', icon: BookOpen },
      { id: 'compliance', label: 'Conformidade MTE', href: '/conformidade', icon: Scale },
    ],
  });
  return sections;
}

export function flattenNav(sections: NavSection[]): NavLeaf[] {
  return sections.flatMap((s) => s.items.flatMap((i) => (i.children?.length ? i.children : [i])));
}
