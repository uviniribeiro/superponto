import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
  FileText,
  TrendingUp,
  Timer,
  AlertTriangle,
  Users,
  ClipboardList,
  FileDown,
  Calendar,
} from 'lucide-react';

interface ReportItem {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  badges?: string[];
  color?: string;
}

interface ReportCategory {
  title: string;
  subtitle: string;
  items: ReportItem[];
}

const reportCategories: ReportCategory[] = [
  {
    title: 'Relatórios Legais',
    subtitle: 'Exigidos pela legislação trabalhista',
    items: [
      {
        title: 'Espelho de Ponto',
        description: 'Relatório individual de marcações e apontamentos',
        icon: Clock,
        href: '/reports/mirror-point',
        badges: ['Portaria 1510', 'Portaria 373', 'Portaria 671'],
        color: 'text-blue-600',
      },
      {
        title: 'AFDT - Arquivo Fonte de Dados Tratados',
        description: 'Arquivo exigido pela Portaria 1510/671 do MTE',
        icon: FileText,
        href: '/reports/mte',
        badges: ['Portaria 1510', 'Portaria 671'],
        color: 'text-amber-600',
      },
      {
        title: 'ACJEF - Arquivo de Controle de Jornada',
        description: 'Arquivo de controle de jornada para fiscalização',
        icon: FileDown,
        href: '/reports/mte',
        badges: ['Portaria 1510', 'Portaria 671'],
        color: 'text-amber-600',
      },
    ],
  },
  {
    title: 'Relatórios Gerenciais',
    subtitle: 'Para gestão e tomada de decisão',
    items: [
      {
        title: 'Horas Extras',
        description: 'Relatório de horas extras por funcionário/departamento',
        icon: TrendingUp,
        href: '/reports/overtime',
        color: 'text-green-600',
      },
      {
        title: 'Banco de Horas',
        description: 'Saldo do banco de horas dos funcionários',
        icon: Timer,
        href: '/reports/time-bank',
        color: 'text-purple-600',
      },
      {
        title: 'Absenteísmo',
        description: 'Índice de faltas e ausências por período',
        icon: AlertTriangle,
        href: '/reports/absences',
        color: 'text-red-600',
      },
      {
        title: 'Atrasos e Saídas Antecipadas',
        description: 'Relatório de irregularidades de horário',
        icon: Clock,
        href: '/reports/absences',
        color: 'text-orange-600',
      },
    ],
  },
  {
    title: 'Cadastros',
    subtitle: 'Listagem de dados cadastrais',
    items: [
      {
        title: 'Cadastro de Funcionários',
        description: 'Lista completa de funcionários com dados cadastrais',
        icon: Users,
        href: '/employees',
        color: 'text-blue-600',
      },
    ],
  },
  {
    title: 'Relatórios Operacionais',
    subtitle: 'Acompanhamento do dia a dia',
    items: [
      {
        title: 'Marcações por Período',
        description: 'Todas as marcações de ponto em um período',
        icon: Clock,
        href: '/reports/worked-hours',
        color: 'text-blue-600',
      },
      {
        title: 'Ajustes de Ponto',
        description: 'Relatório de ajustes solicitados e aprovados',
        icon: ClipboardList,
        href: '/adjustments',
        color: 'text-amber-600',
      },
      {
        title: 'Afastamentos',
        description: 'Férias, atestados e licenças por período',
        icon: Calendar,
        href: '/leave-management',
        color: 'text-purple-600',
      },
    ],
  },
  {
    title: 'Integração',
    subtitle: 'Arquivos para outros sistemas',
    items: [
      {
        title: 'Integração Folha de Pagamento',
        description: 'Arquivo para integração com sistema de folha',
        icon: FileDown,
        href: '/payroll-exports',
        color: 'text-teal-600',
      },
    ],
  },
];

export default function NewReports() {
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <p className="text-muted-foreground">Geração de relatórios e arquivos fiscais</p>
      </div>

      {/* Report Categories */}
      {reportCategories.map((category) => (
        <div key={category.title} className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">{category.title}</h2>
            <p className="text-sm text-muted-foreground">{category.subtitle}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {category.items.map((item) => (
              <Card
                key={item.title}
                className="cursor-pointer hover:shadow-md transition-shadow border-border/50"
                onClick={() => navigate(item.href)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg bg-muted ${item.color || 'text-primary'}`}>
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm text-primary">
                        {item.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {item.description}
                      </p>
                      {item.badges && item.badges.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {item.badges.map((badge) => (
                            <Badge
                              key={badge}
                              variant="secondary"
                              className="text-[10px] px-1.5 py-0 h-5 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            >
                              {badge}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
