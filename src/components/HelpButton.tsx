import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HelpCircle, ChevronRight, Lightbulb, BookOpen } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface HelpStep {
  title: string;
  description: string;
}

interface HelpSection {
  title: string;
  icon?: React.ReactNode;
  steps: HelpStep[];
}

interface PageHelpContent {
  title: string;
  description: string;
  sections: HelpSection[];
  tips?: string[];
}

// Help content for each page
const helpContent: Record<string, PageHelpContent> = {
  dashboard: {
    title: "Dashboard",
    description: "Visão geral do sistema de ponto eletrônico",
    sections: [
      {
        title: "Entendendo o Dashboard",
        steps: [
          { title: "Cards de Resumo", description: "Visualize os indicadores principais como total de funcionários, registros do dia e alertas." },
          { title: "Gráficos", description: "Analise os gráficos de horas trabalhadas e registros por período." },
          { title: "Ações Rápidas", description: "Use os botões de ação para acessar funcionalidades comuns rapidamente." }
        ]
      }
    ],
    tips: ["O dashboard atualiza automaticamente a cada 5 minutos", "Clique nos cards para ver mais detalhes"]
  },
  employees: {
    title: "Cadastro de Funcionários",
    description: "Gerenciamento completo de funcionários",
    sections: [
      {
        title: "Adicionar Funcionário",
        steps: [
          { title: "Clique em 'Novo Funcionário'", description: "Botão localizado no canto superior direito da página." },
          { title: "Preencha os dados pessoais", description: "Nome completo, CPF, PIS e data de admissão são obrigatórios." },
          { title: "Configure o email", description: "O email será usado para login no sistema." },
          { title: "Defina cargo e departamento", description: "Selecione ou digite o cargo e departamento do funcionário." },
          { title: "Salve o cadastro", description: "Clique em 'Salvar' para confirmar o cadastro." }
        ]
      },
      {
        title: "Editar Funcionário",
        steps: [
          { title: "Localize o funcionário", description: "Use a barra de pesquisa para encontrar pelo nome ou matrícula." },
          { title: "Clique em 'Editar'", description: "Botão de lápis na linha do funcionário." },
          { title: "Faça as alterações", description: "Modifique os campos desejados." },
          { title: "Salve as alterações", description: "Confirme clicando em 'Salvar'." }
        ]
      },
      {
        title: "Importar Funcionários (CSV)",
        steps: [
          { title: "Clique em 'Importar CSV'", description: "Botão localizado no topo da página." },
          { title: "Baixe o modelo", description: "Use o link para baixar o modelo de planilha." },
          { title: "Preencha a planilha", description: "Siga o formato exato do modelo." },
          { title: "Faça upload do arquivo", description: "Selecione o arquivo CSV preenchido." },
          { title: "Confirme a importação", description: "Revise os dados e confirme." }
        ]
      }
    ],
    tips: [
      "O CPF deve ter 11 dígitos e ser válido",
      "O PIS deve ter 11 dígitos",
      "A matrícula é gerada automaticamente se não informada",
      "Use o filtro de status para ver apenas funcionários ativos ou inativos"
    ]
  },
  timeclock: {
    title: "Relógio de Ponto",
    description: "Registro de ponto eletrônico",
    sections: [
      {
        title: "Registrar Ponto",
        steps: [
          { title: "Selecione o tipo de registro", description: "Escolha entre Entrada, Saída para Intervalo, Retorno de Intervalo ou Saída." },
          { title: "Posicione-se para a foto", description: "A foto será capturada automaticamente." },
          { title: "Confirme o registro", description: "Clique em 'Registrar Ponto' para confirmar." }
        ]
      }
    ],
    tips: [
      "O sistema usa reconhecimento facial para validar o registro",
      "A geolocalização é registrada automaticamente",
      "Você receberá uma confirmação após cada registro"
    ]
  },
  schedules: {
    title: "Jornadas de Trabalho",
    description: "Configuração de escalas e horários",
    sections: [
      {
        title: "Criar Nova Jornada",
        steps: [
          { title: "Clique em 'Nova Jornada'", description: "Botão no canto superior direito." },
          { title: "Defina o nome", description: "Ex: 'Jornada Comercial 8h'." },
          { title: "Selecione o tipo de escala", description: "5x2, 6x1, 12x36, plantão, etc." },
          { title: "Configure os horários", description: "Defina entrada, saída e intervalo para cada dia." },
          { title: "Defina tolerância", description: "Configure a tolerância em minutos para atrasos." },
          { title: "Salve a jornada", description: "Confirme clicando em 'Salvar'." }
        ]
      },
      {
        title: "Atribuir Jornada a Funcionário",
        steps: [
          { title: "Acesse a aba 'Atribuições'", description: "Segunda aba na página de jornadas." },
          { title: "Clique em 'Nova Atribuição'", description: "Botão para criar nova atribuição." },
          { title: "Selecione o funcionário", description: "Escolha o funcionário na lista." },
          { title: "Selecione a jornada", description: "Escolha a jornada a ser atribuída." },
          { title: "Defina o período", description: "Data de início e fim (opcional)." },
          { title: "Confirme", description: "Salve a atribuição." }
        ]
      }
    ],
    tips: [
      "Jornadas podem ser editadas a qualquer momento",
      "A atribuição pode ter data de término para jornadas temporárias",
      "Use as folgas manuais para dias específicos de folga"
    ]
  },
  mirrorpoint: {
    title: "Espelho de Ponto",
    description: "Visualização e impressão do espelho de ponto",
    sections: [
      {
        title: "Gerar Espelho de Ponto",
        steps: [
          { title: "Selecione o funcionário", description: "Use o campo de busca para encontrar pelo nome ou matrícula." },
          { title: "Escolha o mês/ano", description: "Selecione o período desejado." },
          { title: "Visualize os registros", description: "Os dados são carregados automaticamente." },
          { title: "Gere o PDF", description: "Clique em 'Gerar PDF' para baixar o espelho." }
        ]
      },
      {
        title: "Editar Registros (Admin)",
        steps: [
          { title: "Localize o dia", description: "Encontre o dia que precisa de correção." },
          { title: "Clique no ícone de edição", description: "Botão de lápis na linha do dia." },
          { title: "Faça as correções", description: "Adicione, edite ou remova registros." },
          { title: "Salve as alterações", description: "Confirme as mudanças." }
        ]
      }
    ],
    tips: [
      "O espelho é gerado conforme Portaria 671/2021",
      "Feriados e folgas são destacados automaticamente",
      "O saldo de horas é calculado automaticamente"
    ]
  },
  adjustments: {
    title: "Ajustes de Ponto",
    description: "Solicitação e aprovação de ajustes",
    sections: [
      {
        title: "Solicitar Ajuste",
        steps: [
          { title: "Clique em 'Nova Solicitação'", description: "Botão para criar nova solicitação." },
          { title: "Selecione o tipo", description: "Inclusão, alteração ou exclusão de registro." },
          { title: "Informe a data e hora", description: "Data e hora do registro." },
          { title: "Descreva o motivo", description: "Justifique a necessidade do ajuste." },
          { title: "Envie a solicitação", description: "Aguarde aprovação do gestor." }
        ]
      },
      {
        title: "Aprovar Ajustes (Gestor)",
        steps: [
          { title: "Acesse as solicitações pendentes", description: "Lista de ajustes aguardando aprovação." },
          { title: "Analise a solicitação", description: "Verifique os detalhes e justificativa." },
          { title: "Aprove ou rejeite", description: "Clique no botão correspondente." },
          { title: "Adicione observações", description: "Opcional: inclua comentários sobre a decisão." }
        ]
      }
    ],
    tips: [
      "Solicitações aprovadas são aplicadas automaticamente",
      "Você receberá notificação sobre o status da solicitação",
      "Mantenha as justificativas claras e detalhadas"
    ]
  },
  reports: {
    title: "Relatórios",
    description: "Geração de relatórios do sistema",
    sections: [
      {
        title: "Gerar Relatório",
        steps: [
          { title: "Selecione o tipo de relatório", description: "Escolha entre os tipos disponíveis." },
          { title: "Configure os filtros", description: "Período, funcionários, departamentos." },
          { title: "Clique em 'Gerar'", description: "O relatório será processado." },
          { title: "Exporte se necessário", description: "Baixe em PDF ou Excel." }
        ]
      }
    ],
    tips: [
      "Relatórios grandes podem demorar alguns segundos",
      "Use filtros para resultados mais precisos",
      "Relatórios são salvos no histórico por 30 dias"
    ]
  },
  equipment: {
    title: "Equipamentos REP",
    description: "Gerenciamento de equipamentos de ponto",
    sections: [
      {
        title: "Adicionar Equipamento",
        steps: [
          { title: "Clique em 'Adicionar Equipamento'", description: "Botão no canto superior direito." },
          { title: "Informe o fabricante e modelo", description: "Selecione da lista de equipamentos homologados." },
          { title: "Configure a conexão", description: "IP, porta e credenciais de acesso." },
          { title: "Teste a conexão", description: "Verifique se o equipamento está acessível." },
          { title: "Salve o cadastro", description: "Confirme as configurações." }
        ]
      },
      {
        title: "Sincronizar Registros",
        steps: [
          { title: "Selecione o equipamento", description: "Escolha o equipamento na lista." },
          { title: "Clique em 'Sincronizar'", description: "Inicia a coleta de registros." },
          { title: "Aguarde o processamento", description: "Os registros serão importados." },
          { title: "Verifique o resultado", description: "Confira os registros importados." }
        ]
      }
    ],
    tips: [
      "Configure a sincronização automática para coleta periódica",
      "Verifique a conectividade antes de sincronizar",
      "Registros pendentes podem ser processados manualmente"
    ]
  },
  holidays: {
    title: "Feriados",
    description: "Gerenciamento de feriados",
    sections: [
      {
        title: "Adicionar Feriado",
        steps: [
          { title: "Clique em 'Novo Feriado'", description: "Botão no canto superior direito." },
          { title: "Informe o nome", description: "Ex: 'Natal', 'Ano Novo'." },
          { title: "Selecione a data", description: "Escolha a data do feriado." },
          { title: "Marque como recorrente", description: "Se o feriado se repete todo ano." },
          { title: "Salve", description: "Confirme o cadastro." }
        ]
      }
    ],
    tips: [
      "Feriados recorrentes são aplicados automaticamente a cada ano",
      "Feriados afetam o cálculo de horas extras",
      "Você pode importar feriados nacionais com um clique"
    ]
  },
  users: {
    title: "Usuários do Sistema",
    description: "Gerenciamento de usuários e permissões",
    sections: [
      {
        title: "Alterar Permissão",
        steps: [
          { title: "Localize o usuário", description: "Use a busca para encontrar." },
          { title: "Clique em 'Alterar Permissão'", description: "Botão na linha do usuário." },
          { title: "Selecione a nova permissão", description: "Admin, Gestor ou Funcionário." },
          { title: "Confirme", description: "Salve a alteração." }
        ]
      }
    ],
    tips: [
      "Administradores têm acesso total ao sistema",
      "Gestores podem aprovar ajustes e ver relatórios",
      "Funcionários acessam apenas seus próprios dados"
    ]
  },
  transfer: {
    title: "Transferência de Funcionários",
    description: "Transferência entre setores",
    sections: [
      {
        title: "Transferência Individual",
        steps: [
          { title: "Selecione o setor de origem", description: "Escolha de onde o funcionário será transferido." },
          { title: "Busque o funcionário", description: "Use o filtro por nome ou matrícula." },
          { title: "Selecione o setor de destino", description: "Escolha para onde será transferido." },
          { title: "Informe o motivo", description: "Descreva o motivo da transferência." },
          { title: "Confirme", description: "Clique em 'Transferir'." }
        ]
      },
      {
        title: "Transferência em Massa",
        steps: [
          { title: "Selecione o setor de origem", description: "Escolha o setor atual dos funcionários." },
          { title: "Selecione os funcionários", description: "Marque os funcionários a serem transferidos." },
          { title: "Selecione o setor de destino", description: "Escolha o novo setor." },
          { title: "Informe o motivo", description: "Descreva o motivo da transferência em massa." },
          { title: "Confirme", description: "Clique em 'Transferir X Funcionários'." }
        ]
      }
    ],
    tips: [
      "O histórico de ponto permanece no setor anterior",
      "Novos registros serão vinculados ao novo setor",
      "Você pode visualizar o histórico de transferências na aba correspondente"
    ]
  },
  timebank: {
    title: "Banco de Horas",
    description: "Gerenciamento do banco de horas",
    sections: [
      {
        title: "Visualizar Saldo",
        steps: [
          { title: "Selecione o funcionário", description: "Escolha o funcionário desejado." },
          { title: "Visualize o saldo atual", description: "O saldo é exibido em horas e minutos." },
          { title: "Veja o histórico", description: "Consulte as movimentações anteriores." }
        ]
      },
      {
        title: "Fazer Ajuste",
        steps: [
          { title: "Clique em 'Novo Ajuste'", description: "Botão para criar ajuste manual." },
          { title: "Selecione o tipo", description: "Crédito ou débito de horas." },
          { title: "Informe a quantidade", description: "Horas e minutos do ajuste." },
          { title: "Descreva o motivo", description: "Justifique o ajuste." },
          { title: "Confirme", description: "Salve o ajuste." }
        ]
      }
    ],
    tips: [
      "Ajustes manuais ficam registrados para auditoria",
      "O saldo é atualizado automaticamente com os registros de ponto",
      "Configure regras de expiração nas configurações"
    ]
  },
  company: {
    title: "Dados da Empresa",
    description: "Configurações da empresa",
    sections: [
      {
        title: "Editar Dados",
        steps: [
          { title: "Preencha os dados básicos", description: "Razão social, CNPJ, endereço." },
          { title: "Configure o REP", description: "Dados do equipamento para relatórios." },
          { title: "Faça upload do logo", description: "Imagem para relatórios e recibos." },
          { title: "Salve as alterações", description: "Confirme as configurações." }
        ]
      }
    ],
    tips: [
      "O CNPJ é usado para identificar a empresa nos relatórios",
      "O logo aparece no espelho de ponto e recibos",
      "Configure os limites de horas extras nas configurações avançadas"
    ]
  },
  superadmin: {
    title: "Super Admin",
    description: "Painel de administração geral",
    sections: [
      {
        title: "Gerenciar Empresas",
        steps: [
          { title: "Acesse 'Empresas'", description: "Menu lateral do Super Admin." },
          { title: "Adicione ou edite empresas", description: "Gerencie os cadastros." },
          { title: "Configure licenças", description: "Defina validade e limites." }
        ]
      },
      {
        title: "Gerenciar Prefeituras",
        steps: [
          { title: "Acesse 'Prefeituras'", description: "Menu lateral do Super Admin." },
          { title: "Adicione prefeituras", description: "Cadastre novas prefeituras." },
          { title: "Gerencie setores", description: "Crie e configure setores." },
          { title: "Configure licenças", description: "Atribua licenças por setor." }
        ]
      }
    ],
    tips: [
      "Cada empresa/setor tem banco de dados isolado",
      "Usuários suporte e admin são criados automaticamente",
      "Monitore o uso nas estatísticas do dashboard"
    ]
  },
  basicregistrations: {
    title: "Cadastros Básicos",
    description: "Gerencie os cadastros auxiliares do sistema",
    sections: [
      {
        title: "Cadastrar Registros",
        steps: [
          { title: "Selecione o tipo", description: "Escolha entre agrupamentos, especialidades, centros de custo, etc." },
          { title: "Clique em 'Novo'", description: "Botão no canto superior direito da aba." },
          { title: "Preencha os dados", description: "Código (opcional) e descrição (obrigatório, mínimo 3 caracteres)." },
          { title: "Salve o registro", description: "Confirme clicando em 'Salvar'." }
        ]
      }
    ],
    tips: [
      "O código é opcional mas facilita a identificação",
      "A descrição deve ter entre 3 e 50 caracteres",
      "Não é possível excluir registros vinculados a outros cadastros"
    ]
  },
  unions: {
    title: "Sindicatos",
    description: "Cadastre e gerencie os sindicatos vinculados aos funcionários",
    sections: [
      {
        title: "Cadastrar Sindicato",
        steps: [
          { title: "Clique em 'Novo Sindicato'", description: "Botão no canto superior direito." },
          { title: "Preencha os dados", description: "Nome, CNPJ, endereço e contato." },
          { title: "Configure as taxas", description: "Defina percentuais de contribuição sindical." },
          { title: "Salve o cadastro", description: "Confirme clicando em 'Salvar'." }
        ]
      }
    ],
    tips: [
      "O CNPJ deve ser válido e único no sistema",
      "Sindicatos podem ser vinculados a múltiplos funcionários",
      "Configure as taxas conforme acordo coletivo"
    ]
  },
  justifications: {
    title: "Justificativas",
    description: "Cadastre justificativas para abonos e afastamentos",
    sections: [
      {
        title: "Cadastrar Justificativa",
        steps: [
          { title: "Clique em 'Nova Justificativa'", description: "Botão no canto superior direito." },
          { title: "Preencha descrição", description: "Nome da justificativa." },
          { title: "Configure regras", description: "Descontar horas, gerar extra, visibilidade." },
          { title: "Defina código de folha", description: "Código para integração com folha de pagamento." }
        ]
      }
    ],
    tips: [
      "Justificativas podem descontar ou não horas do funcionário",
      "Configure visibilidade para funcionários solicitarem",
      "Use códigos de folha para integração com sistemas externos"
    ]
  },
  scales: {
    title: "Escalas de Trabalho",
    description: "Configure escalas fixas e agendadas",
    sections: [
      {
        title: "Escala Fixa",
        steps: [
          { title: "Clique em 'Nova Escala'", description: "Botão no canto superior direito." },
          { title: "Defina o padrão", description: "Ex: 12x36, 5x2, 6x1." },
          { title: "Configure ciclos", description: "Dias de trabalho e folga." },
          { title: "Vincule horários", description: "Associe jornadas aos ciclos." }
        ]
      }
    ],
    tips: [
      "Escalas fixas seguem ciclos regulares de trabalho/folga",
      "Configure tratamento de feriados conforme necessário",
      "Funcionários podem ter escala fixa ou agendada"
    ]
  },
  overtimepercentages: {
    title: "Percentuais de Hora Extra",
    description: "Configure os percentuais de acréscimo",
    sections: [
      {
        title: "Cadastrar Percentual",
        steps: [
          { title: "Clique em 'Novo Percentual'", description: "Botão no canto superior direito." },
          { title: "Defina o valor", description: "Percentual de acréscimo (ex: 50%, 100%)." },
          { title: "Configure tipo", description: "Diurno ou noturno." },
          { title: "Informe código externo", description: "Para integração com folha." }
        ]
      }
    ],
    tips: [
      "Percentuais comuns: 50% (dia útil) e 100% (feriado/domingo)",
      "Hora noturna pode ter acréscimo adicional",
      "Configure conforme legislação ou acordo coletivo"
    ]
  },
  competencyperiods: {
    title: "Competências",
    description: "Períodos para filtros de relatórios",
    sections: [
      {
        title: "Cadastrar Competência",
        steps: [
          { title: "Clique em 'Nova Competência'", description: "Botão no canto superior direito." },
          { title: "Defina a descrição", description: "Ex: Janeiro/2025." },
          { title: "Configure o período", description: "Data inicial e final." },
          { title: "Defina mês/ano referência", description: "Para exportação de ocorrências." }
        ]
      }
    ],
    tips: [
      "Competências facilitam filtros em relatórios",
      "O período pode ultrapassar um mês se necessário",
      "Marque como ativa para aparecer nos filtros"
    ]
  },
  georeferencedlocations: {
    title: "Locais Georreferenciados",
    description: "Configure locais com GPS para validação de ponto mobile",
    sections: [
      {
        title: "Cadastrar Local",
        steps: [
          { title: "Clique em 'Novo Local'", description: "Botão no canto superior direito." },
          { title: "Informe descrição e endereço", description: "Nome e localização do ponto." },
          { title: "Configure coordenadas", description: "Latitude, longitude e raio em metros." },
          { title: "Vincule funcionários", description: "Defina quem pode marcar ponto neste local." }
        ]
      }
    ],
    tips: [
      "O raio define a área de validação do GPS",
      "Funcionários fora do raio não conseguem registrar ponto",
      "Use múltiplos locais para equipes externas"
    ]
  }
};

interface HelpButtonProps {
  pageKey: keyof typeof helpContent;
  className?: string;
}

export function HelpButton({ pageKey, className = "" }: HelpButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const content = helpContent[pageKey];

  if (!content) return null;

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className={`fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-all ${className}`}
              onClick={() => setIsOpen(true)}
            >
              <HelpCircle className="h-6 w-6" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>Ajuda</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <BookOpen className="h-6 w-6 text-primary" />
              {content.title}
            </DialogTitle>
            <DialogDescription>{content.description}</DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-6">
              {content.sections.map((section, sectionIndex) => (
                <div key={sectionIndex} className="space-y-3">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    {section.icon}
                    {section.title}
                  </h3>
                  <div className="space-y-2 pl-2">
                    {section.steps.map((step, stepIndex) => (
                      <div key={stepIndex} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                          {stepIndex + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{step.title}</p>
                          <p className="text-sm text-muted-foreground">{step.description}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {content.tips && content.tips.length > 0 && (
                <div className="space-y-3 mt-6">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-warning" />
                    Dicas Úteis
                  </h3>
                  <div className="space-y-2">
                    {content.tips.map((tip, tipIndex) => (
                      <div key={tipIndex} className="flex items-start gap-2 text-sm p-2 rounded bg-warning/10 text-warning-foreground">
                        <span className="text-warning">•</span>
                        <span>{tip}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Export helper for pages that need custom help content
export function usePageHelp(pageKey: keyof typeof helpContent) {
  return helpContent[pageKey];
}
