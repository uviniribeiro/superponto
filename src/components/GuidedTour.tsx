import { useEffect, useState } from 'react';
import { driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useLocation } from 'react-router-dom';

interface TourConfig {
  [key: string]: DriveStep[];
}

const tourSteps: TourConfig = {
  '/home': [
    {
      element: '[data-tour="home-welcome"]',
      popover: {
        title: 'Bem-vindo ao Ponto Max! 👋',
        description: 'Este é o seu painel inicial. Aqui você pode acessar rapidamente todas as funcionalidades do sistema.',
        side: 'bottom',
        align: 'center'
      }
    },
    {
      element: '[data-tour="sidebar"]',
      popover: {
        title: 'Menu Lateral',
        description: 'Use o menu lateral para navegar entre as diferentes seções do sistema.',
        side: 'right',
        align: 'start'
      }
    },
    {
      element: '[data-tour="time-clock"]',
      popover: {
        title: 'Registro de Ponto',
        description: 'Clique aqui para registrar sua entrada, saída ou intervalos.',
        side: 'bottom',
        align: 'center'
      }
    }
  ],
  '/dashboard': [
    {
      element: '[data-tour="dashboard-stats"]',
      popover: {
        title: 'Estatísticas Gerais',
        description: 'Visualize as estatísticas principais do seu ponto eletrônico.',
        side: 'bottom',
        align: 'center'
      }
    },
    {
      element: '[data-tour="dashboard-chart"]',
      popover: {
        title: 'Gráficos de Análise',
        description: 'Acompanhe a evolução dos registros através dos gráficos interativos.',
        side: 'top',
        align: 'center'
      }
    }
  ],
  '/employees': [
    {
      element: '[data-tour="employees-list"]',
      popover: {
        title: 'Lista de Funcionários',
        description: 'Aqui você pode ver todos os funcionários cadastrados no sistema.',
        side: 'bottom',
        align: 'center'
      }
    },
    {
      element: '[data-tour="employees-add"]',
      popover: {
        title: 'Adicionar Funcionário',
        description: 'Clique neste botão para cadastrar um novo funcionário.',
        side: 'left',
        align: 'center'
      }
    },
    {
      element: '[data-tour="employees-search"]',
      popover: {
        title: 'Pesquisar Funcionário',
        description: 'Use o campo de busca para encontrar funcionários por nome ou matrícula.',
        side: 'bottom',
        align: 'center'
      }
    }
  ],
  '/teacher-module': [
    {
      element: '[data-tour="teacher-tabs"]',
      popover: {
        title: 'Módulo Professor 📚',
        description: 'Este módulo é dividido em abas para gerenciar todas as funções dos professores.',
        side: 'bottom',
        align: 'center'
      }
    },
    {
      element: '[data-tour="teacher-config"]',
      popover: {
        title: 'Configurações de Hora Aula',
        description: 'Configure os parâmetros de hora aula, valores e tipos de contrato.',
        side: 'bottom',
        align: 'center'
      }
    },
    {
      element: '[data-tour="teacher-assignments"]',
      popover: {
        title: 'Atribuições de Professores',
        description: 'Atribua professores às configurações e defina suas cargas horárias.',
        side: 'bottom',
        align: 'center'
      }
    },
    {
      element: '[data-tour="teacher-schedule"]',
      popover: {
        title: 'Quadro de Horários',
        description: 'Monte o quadro de horários semanal de cada professor.',
        side: 'bottom',
        align: 'center'
      }
    },
    {
      element: '[data-tour="teacher-records"]',
      popover: {
        title: 'Registro de Aulas',
        description: 'Registre as aulas ministradas pelos professores.',
        side: 'bottom',
        align: 'center'
      }
    },
    {
      element: '[data-tour="teacher-timesheet"]',
      popover: {
        title: 'Espelho de Ponto',
        description: 'Visualize e imprima o espelho de ponto dos professores.',
        side: 'bottom',
        align: 'center'
      }
    }
  ],
  '/schedules': [
    {
      element: '[data-tour="schedules-list"]',
      popover: {
        title: 'Escalas de Trabalho',
        description: 'Gerencie as diferentes escalas e jornadas de trabalho.',
        side: 'bottom',
        align: 'center'
      }
    },
    {
      element: '[data-tour="schedules-create"]',
      popover: {
        title: 'Criar Nova Escala',
        description: 'Crie novas escalas como 5x1, 6x1, 12x36 ou horários personalizados.',
        side: 'left',
        align: 'center'
      }
    }
  ],
  '/mirror-point': [
    {
      element: '[data-tour="mirror-employee"]',
      popover: {
        title: 'Selecionar Funcionário',
        description: 'Escolha o funcionário para visualizar seu espelho de ponto.',
        side: 'bottom',
        align: 'center'
      }
    },
    {
      element: '[data-tour="mirror-period"]',
      popover: {
        title: 'Período',
        description: 'Selecione o mês e ano para visualizar os registros.',
        side: 'bottom',
        align: 'center'
      }
    },
    {
      element: '[data-tour="mirror-print"]',
      popover: {
        title: 'Imprimir Espelho',
        description: 'Imprima o espelho de ponto no formato Portaria 671.',
        side: 'left',
        align: 'center'
      }
    }
  ],
  '/equipment': [
    {
      element: '[data-tour="equipment-status"]',
      popover: {
        title: 'Status dos Equipamentos',
        description: 'Monitore em tempo real o status de todos os REPs cadastrados.',
        side: 'bottom',
        align: 'center'
      }
    },
    {
      element: '[data-tour="equipment-sync"]',
      popover: {
        title: 'Sincronização',
        description: 'Sincronize os registros de ponto dos equipamentos.',
        side: 'bottom',
        align: 'center'
      }
    }
  ]
};

export function useGuidedTour() {
  const location = useLocation();
  const [hasSeenTour, setHasSeenTour] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const stored = localStorage.getItem('pontomax-tour-seen');
    if (stored) {
      setHasSeenTour(JSON.parse(stored));
    }
  }, []);

  const startTour = (path?: string) => {
    const routePath = path || location.pathname;
    const steps = tourSteps[routePath];
    
    if (!steps || steps.length === 0) return;

    const driverInstance = driver({
      showProgress: true,
      showButtons: ['next', 'previous', 'close'],
      nextBtnText: 'Próximo',
      prevBtnText: 'Anterior',
      doneBtnText: 'Concluir',
      progressText: '{{current}} de {{total}}',
      popoverClass: 'driverjs-theme',
      animate: true,
      smoothScroll: true,
      steps: steps,
      onDestroyStarted: () => {
        const newSeen = { ...hasSeenTour, [routePath]: true };
        setHasSeenTour(newSeen);
        localStorage.setItem('pontomax-tour-seen', JSON.stringify(newSeen));
        driverInstance.destroy();
      }
    });

    driverInstance.drive();
  };

  const shouldShowTour = (path?: string) => {
    const routePath = path || location.pathname;
    return tourSteps[routePath] && !hasSeenTour[routePath];
  };

  const resetTours = () => {
    setHasSeenTour({});
    localStorage.removeItem('pontomax-tour-seen');
  };

  return { startTour, shouldShowTour, resetTours, hasSeenTour };
}

export function GuidedTourButton() {
  const { startTour } = useGuidedTour();
  const location = useLocation();

  const hasTourForCurrentPage = tourSteps[location.pathname] && tourSteps[location.pathname].length > 0;

  if (!hasTourForCurrentPage) return null;

  return (
    <button
      onClick={() => startTour()}
      className="fixed bottom-24 right-4 z-50 bg-primary text-primary-foreground rounded-full p-3 shadow-lg hover:scale-105 transition-transform duration-200 flex items-center gap-2"
      title="Iniciar tour guiado"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
        <path d="M12 17h.01"/>
      </svg>
      <span className="hidden md:inline text-sm font-medium">Tour</span>
    </button>
  );
}
