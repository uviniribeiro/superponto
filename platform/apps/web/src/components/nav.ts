import { CalendarClock, Clock3, Gauge, Network as NetworkIcon, MapPinned, BadgeCheck, Boxes, BookOpen, FileSpreadsheet, ShieldBan, UserRound, UsersRound, Briefcase, Building2, CalendarDays, CalendarRange, FolderTree, KeyRound, Landmark, Tags, Users, Wallet, LayoutDashboard, Network, Scale, ShieldCheck, type LucideIcon } from 'lucide-react';
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
          children: [
            { id: 'companies', label: 'Empresas', href: '/empresas', icon: Building2, dot: '#fcc419' },
            ...(can(me, 'org.units:read') ? [{ id: 'units', label: 'Unidades e locais', href: '/estrutura/unidades', icon: MapPinned, dot: '#f87171' }] : []),
            ...(can(me, 'org.departments:read') ? [{ id: 'departments', label: 'Departamentos', href: '/estrutura/departamentos', icon: FolderTree, dot: '#60a5fa' }] : []),
            ...(can(me, 'org.positions:read') ? [{ id: 'positions', label: 'Cargos', href: '/estrutura/cargos', icon: Briefcase, dot: '#a78bfa' }] : []),
            ...(can(me, 'org.functions:read') ? [{ id: 'functions', label: 'Funções', href: '/estrutura/funcoes', icon: BadgeCheck, dot: '#34d399' }] : []),
            ...(can(me, 'org.costcenters:read') ? [{ id: 'costcenters', label: 'Centros de custo', href: '/estrutura/centros-de-custo', icon: Wallet, dot: '#f472b6' }] : []),
            ...(can(me, 'org.employeetypes:read') ? [{ id: 'employeetypes', label: 'Tipos de funcionário', href: '/estrutura/tipos-de-funcionario', icon: Tags, dot: '#fb923c' }] : []),
            ...(can(me, 'org.unions:read') ? [{ id: 'unions', label: 'Sindicatos', href: '/estrutura/sindicatos', icon: Landmark, dot: '#22d3ee' }] : []),
          ],
        },
        ...(can(me, 'org.holidays:read') ? [{ id: 'holidays', label: 'Feriados', href: '/feriados', icon: CalendarDays } satisfies NavItem] : []),
        ...(can(me, 'org.competences:read') ? [{ id: 'competences', label: 'Competências', href: '/estrutura/competencias', icon: CalendarRange } satisfies NavItem] : []),
        ...(can(me, 'org.groupings:read') ? [{ id: 'groupings', label: 'Agrupamentos', href: '/estrutura/agrupamentos', icon: Boxes } satisfies NavItem] : []),
      ],
    });
  }
  if (can(me, 'people.employments:read')) {
    sections.push({
      id: 'people',
      label: 'Pessoas',
      items: [
        { id: 'employees', label: 'Funcionários', href: '/funcionarios', icon: UsersRound },
        ...(can(me, 'people.employments:import') ? [{ id: 'import', label: 'Importar planilha', href: '/funcionarios/importar', icon: FileSpreadsheet } satisfies NavItem] : []),
      ],
    });
  }
  const jornada: NavItem[] = [
    ...(can(me, 'schedules.schedules:read') ? [{ id: 'grid', label: 'Escalas', href: '/jornada/escalas', icon: CalendarClock } satisfies NavItem] : []),
    ...(can(me, 'schedules.timetables:read') ? [{ id: 'timetables', label: 'Horários', href: '/jornada/horarios', icon: Clock3 } satisfies NavItem, { id: 'rules', label: 'Regras de apuração', href: '/jornada/regras', icon: Gauge } satisfies NavItem] : []),
  ];
  if (jornada.length) sections.push({ id: 'jornada', label: 'Jornada', items: jornada });
  if (can(me, 'admin.users:read')) {
    sections.push({
      id: 'admin',
      label: 'Administração',
      items: [
        { id: 'users', label: 'Usuários', href: '/usuarios', icon: Users },
        { id: 'roles', label: 'Perfis e permissões', href: '/perfis', icon: KeyRound },
        { id: 'blocks', label: 'Bloqueios de acesso', href: '/bloqueios', icon: ShieldBan },
        ...(can(me, 'admin.ldap:manage') ? [{ id: 'ldap', label: 'Login pela rede (LDAP)', href: '/usuarios/ldap', icon: NetworkIcon } satisfies NavItem] : []),
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
  if (me) sections.push({ id: 'account', label: 'Conta', items: [{ id: 'my-account', label: 'Minha conta', href: '/minha-conta', icon: UserRound }] });
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
