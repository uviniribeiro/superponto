import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Home as HomeIcon } from 'lucide-react';
import {
  Clock,
  LayoutDashboard,
  Users,
  FileText,
  ClipboardCheck,
  Building2,
  CalendarDays,
  Timer,
  UserX,
  UserCog,
  TrendingUp,
  Briefcase,
  CalendarClock,
  GraduationCap,
  ClipboardList,
  ArrowUpDown,
  Server,
} from 'lucide-react';

interface CategoryItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

interface CategoryData {
  title: string;
  description: string;
  items: CategoryItem[];
}

const categoryConfig: Record<string, CategoryData> = {
  principal: {
    title: 'Principal',
    description: 'Acesso rápido às funções principais do sistema',
    items: [
      { title: 'Início', href: '/home', icon: HomeIcon, description: 'Tela inicial do sistema' },
      { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, description: 'Visão geral e estatísticas' },
      { title: 'Registrar Ponto', href: '/time-clock', icon: Clock, description: 'Registre sua entrada e saída' },
    ]
  },
  'meus-dados': {
    title: 'Meus Dados',
    description: 'Acesse seus registros e banco de horas',
    items: [
      { title: 'Meus Registros', href: '/my-records', icon: FileText, description: 'Visualize seus registros de ponto' },
      { title: 'Banco de Horas', href: '/time-bank', icon: Timer, description: 'Saldo de horas extras e débitos' },
    ]
  },
  cadastros: {
    title: 'Cadastros',
    description: 'Gerencie funcionários, cargos, departamentos e jornadas',
    items: [
      { title: 'Funcionários', href: '/employees', icon: Users, description: 'Cadastro e gestão de funcionários' },
      { title: 'Cargos e Deptos', href: '/positions-departments', icon: Briefcase, description: 'Cargos e departamentos da empresa' },
      { title: 'Jornadas e Escalas', href: '/schedules', icon: CalendarClock, description: 'Horários e escalas de trabalho' },
      { title: 'Feriados', href: '/holidays', icon: CalendarDays, description: 'Calendário de feriados' },
      { title: 'Módulo Professor', href: '/teacher-module', icon: GraduationCap, description: 'Gestão de hora-aula' },
    ]
  },
  'espelhos-ponto': {
    title: 'Espelhos de Ponto',
    description: 'Visualize e gerencie os espelhos de ponto',
    items: [
      { title: 'Espelho de Ponto', href: '/timesheet', icon: ClipboardList, description: 'Folha de ponto dos funcionários' },
      { title: 'Faltas', href: '/absences', icon: UserX, description: 'Gestão de faltas e ausências' },
      { title: 'Ajustes', href: '/adjustments', icon: ClipboardCheck, description: 'Solicitações de ajuste de ponto' },
    ]
  },
  relatorios: {
    title: 'Relatórios',
    description: 'Relatórios e análises do sistema',
    items: [
      { title: 'Relatórios', href: '/reports', icon: FileText, description: 'Relatórios gerenciais' },
      { title: 'Dashboard HE', href: '/overtime-dashboard', icon: TrendingUp, description: 'Dashboard de horas extras' },
      { title: 'Import/Export', href: '/import-export', icon: ArrowUpDown, description: 'Importar e exportar dados' },
    ]
  },
  configuracoes: {
    title: 'Configurações',
    description: 'Configurações do sistema',
    items: [
      { title: 'Equipamentos REP', href: '/equipment', icon: Server, description: 'Relógios de ponto eletrônicos' },
      { title: 'Usuários', href: '/users', icon: UserCog, description: 'Gestão de usuários do sistema' },
      { title: 'Empresa', href: '/company', icon: Building2, description: 'Dados da empresa' },
    ]
  },
};

interface CategoryOverviewProps {
  categoryId: string;
}

export default function CategoryOverview({ categoryId }: CategoryOverviewProps) {
  const navigate = useNavigate();
  const category = categoryConfig[categoryId];

  if (!category) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <p className="text-muted-foreground">Categoria não encontrada</p>
        <Button onClick={() => navigate('/home')}>
          <HomeIcon className="w-4 h-4 mr-2" />
          Voltar ao Início
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{category.title}</h1>
          <p className="text-muted-foreground text-sm">{category.description}</p>
        </div>
      </div>

      {/* Grid of items */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {category.items.map((item) => (
          <Link to={item.href} key={item.href}>
            <Card className="h-full transition-all hover:shadow-md hover:border-primary/50 cursor-pointer group">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <item.icon className="w-5 h-5" />
                  </div>
                  <CardTitle className="text-base">{item.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

export { categoryConfig };
