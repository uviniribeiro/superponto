import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { HelpButton } from '@/components/HelpButton';
import {
  Search,
  BookOpen,
  Users,
  Clock,
  FileText,
  Settings,
  Server,
  Shield,
  Calendar,
  MapPin,
  Building2,
  TrendingUp,
  Briefcase,
  GraduationCap,
  ClipboardList,
} from 'lucide-react';
import { getFullVersionInfo } from '@/lib/version';

interface ManualSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  topics: ManualTopic[];
}

interface ManualTopic {
  title: string;
  content: string;
}

const manualSections: ManualSection[] = [
  {
    id: 'inicio',
    title: 'Introdução',
    icon: BookOpen,
    description: 'Visão geral do sistema Ponto Max',
    topics: [
      {
        title: 'O que é o Ponto Max?',
        content: `O Ponto Max é um sistema completo de controle de ponto eletrônico desenvolvido para empresas e prefeituras. 
        
Ele oferece:
• Registro de ponto via web e dispositivos móveis
• Geolocalização para validação de registros
• Reconhecimento facial para identificação
• Conformidade com as Portarias 1510 e 671 do MTE
• Gestão completa de funcionários, jornadas e escalas
• Relatórios detalhados e exportações para folha de pagamento`,
      },
      {
        title: 'Requisitos do Sistema',
        content: `Para utilizar o Ponto Max, você precisa:

• Navegador moderno (Chrome, Firefox, Safari, Edge)
• Conexão com internet
• Para registro de ponto móvel: smartphone com GPS
• Para reconhecimento facial: câmera no dispositivo`,
      },
      {
        title: 'Primeiros Passos',
        content: `1. Acesse o sistema com suas credenciais fornecidas pelo administrador
2. No primeiro acesso, você será solicitado a alterar sua senha
3. Navegue pelo menu lateral para acessar as funcionalidades
4. Use a barra de favoritos para acesso rápido às telas mais usadas`,
      },
    ],
  },
  {
    id: 'funcionarios',
    title: 'Gestão de Funcionários',
    icon: Users,
    description: 'Cadastro e gerenciamento de funcionários',
    topics: [
      {
        title: 'Cadastrar Funcionário',
        content: `Para cadastrar um novo funcionário:

1. Acesse Cadastros > Funcionários
2. Clique em "Novo Funcionário"
3. Preencha os dados pessoais (nome, CPF, e-mail)
4. Defina cargo, departamento e jornada de trabalho
5. Configure o método de identificação (senha, biometria, facial)
6. Salve o cadastro`,
      },
      {
        title: 'Importação em Lote',
        content: `É possível importar múltiplos funcionários via arquivo CSV:

1. Prepare o arquivo CSV com os campos obrigatórios
2. Acesse Cadastros > Funcionários > Importar
3. Faça upload do arquivo
4. Revise os dados antes de confirmar
5. O sistema validará e importará os registros`,
      },
      {
        title: 'Métodos de Identificação',
        content: `O sistema suporta diversos métodos:

• Senha: login tradicional com usuário e senha
• Biometria: leitura de impressão digital via equipamento
• Reconhecimento Facial: identificação por câmera
• Cartão/Crachá: leitura via equipamento REP`,
      },
    ],
  },
  {
    id: 'ponto',
    title: 'Registro de Ponto',
    icon: Clock,
    description: 'Como registrar e gerenciar marcações',
    topics: [
      {
        title: 'Registrar Ponto',
        content: `Para registrar seu ponto:

1. Acesse "Registrar Ponto" no menu
2. O sistema detectará sua localização (se habilitado)
3. Confirme o registro clicando no botão
4. Um comprovante será gerado com hash de validação`,
      },
      {
        title: 'Tipos de Registro',
        content: `O sistema registra automaticamente:

• Entrada: primeiro registro do dia
• Saída para intervalo
• Retorno do intervalo  
• Saída: último registro do dia

O sistema identifica o tipo baseado na jornada configurada.`,
      },
      {
        title: 'Registros com Geolocalização',
        content: `Se a empresa exige validação por GPS:

1. Permita o acesso à localização no navegador
2. Você só poderá registrar dentro do raio permitido
3. O endereço será registrado junto com a marcação`,
      },
    ],
  },
  {
    id: 'espelho',
    title: 'Espelho de Ponto',
    icon: ClipboardList,
    description: 'Visualização e gestão do espelho de ponto',
    topics: [
      {
        title: 'Visualizar Espelho',
        content: `O espelho de ponto mostra:

• Todas as marcações do período
• Horas trabalhadas vs. horas esperadas
• Atrasos, faltas e horas extras
• Justificativas aplicadas

Acesse via Espelhos de Ponto > Espelho de Ponto`,
      },
      {
        title: 'Solicitar Ajuste',
        content: `Se uma marcação estiver incorreta:

1. Localize o dia no espelho
2. Clique em "Solicitar Ajuste"
3. Informe o horário correto e justificativa
4. Aguarde aprovação do gestor`,
      },
      {
        title: 'Folha de Ponto',
        content: `A folha de ponto é o documento oficial:

• Pode ser impressa ou exportada em PDF
• Inclui assinatura digital
• Contém hash de validação conforme Portaria 671`,
      },
    ],
  },
  {
    id: 'jornadas',
    title: 'Jornadas e Escalas',
    icon: Calendar,
    description: 'Configuração de horários de trabalho',
    topics: [
      {
        title: 'Criar Jornada',
        content: `Para criar uma nova jornada:

1. Acesse Cadastros > Jornadas e Escalas
2. Clique em "Nova Jornada"
3. Defina os horários de entrada/saída
4. Configure intervalos
5. Defina tolerâncias de atraso/saída`,
      },
      {
        title: 'Escalas de Trabalho',
        content: `Escalas disponíveis:

• Escala Fixa: mesmos horários todos os dias
• Escala 12x36, 5x2, 6x1
• Escalas personalizadas com ciclos
• Escalas com revezamento`,
      },
      {
        title: 'Atribuir Jornada a Funcionário',
        content: `1. Acesse o cadastro do funcionário
2. Na seção "Jornada", selecione a jornada
3. Defina a data de início
4. Salve as alterações`,
      },
    ],
  },
  {
    id: 'banco-horas',
    title: 'Banco de Horas',
    icon: TrendingUp,
    description: 'Gestão do banco de horas',
    topics: [
      {
        title: 'Como Funciona',
        content: `O banco de horas registra:

• Horas extras realizadas (crédito)
• Horas devidas/compensadas (débito)
• Saldo atual

As regras de acúmulo seguem a legislação e acordo coletivo.`,
      },
      {
        title: 'Compensação',
        content: `Para compensar horas:

1. O gestor registra a compensação
2. Define o período e quantidade de horas
3. O saldo é atualizado automaticamente`,
      },
    ],
  },
  {
    id: 'relatorios',
    title: 'Relatórios',
    icon: FileText,
    description: 'Tipos de relatórios disponíveis',
    topics: [
      {
        title: 'Relatórios Disponíveis',
        content: `• Presença: frequência por período
• Horas Trabalhadas: detalhamento de horas
• Horas Extras: relatório de extras
• Faltas/Atrasos: ocorrências
• Banco de Horas: saldos e movimentações
• AFD/AFDT: exportações para MTE`,
      },
      {
        title: 'Exportar para Folha',
        content: `Para exportar para o sistema de folha:

1. Acesse Relatórios > Exportar Folha
2. Selecione o período de competência
3. Escolha o formato de exportação
4. Gere o arquivo`,
      },
    ],
  },
  {
    id: 'equipamentos',
    title: 'Equipamentos REP',
    icon: Server,
    description: 'Gestão de relógios de ponto',
    topics: [
      {
        title: 'Adicionar Equipamento',
        content: `Para conectar um REP:

1. Acesse Equipamentos REP > Adicionar
2. Informe o modelo e número de série
3. Configure IP e porta de comunicação
4. Teste a conexão`,
      },
      {
        title: 'Sincronização',
        content: `A sincronização pode ser:

• Automática: em intervalos definidos
• Manual: sob demanda

Os registros são baixados e processados automaticamente.`,
      },
      {
        title: 'Conformidade MTE',
        content: `O sistema garante conformidade com:

• Portaria 1510/2009
• Portaria 671/2021
• Geração de AFD e AFDT
• MRP - Memória de Registro de Ponto`,
      },
    ],
  },
  {
    id: 'configuracoes',
    title: 'Configurações',
    icon: Settings,
    description: 'Configurações do sistema',
    topics: [
      {
        title: 'Dados da Empresa',
        content: `Configure:

• Razão social e nome fantasia
• CNPJ/CEI
• Endereço completo
• Logo da empresa`,
      },
      {
        title: 'Usuários',
        content: `Gerencie usuários e permissões:

• Administrador: acesso total
• Gestor: gestão de equipe
• Funcionário: acesso básico`,
      },
      {
        title: 'Segurança',
        content: `Configurações de segurança:

• Política de senhas
• Autenticação em duas etapas
• Logs de auditoria`,
      },
    ],
  },
];

export default function SystemManual() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSection, setActiveSection] = useState('inicio');
  const versionInfo = getFullVersionInfo();

  const filteredSections = manualSections.filter(section => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      section.title.toLowerCase().includes(searchLower) ||
      section.description.toLowerCase().includes(searchLower) ||
      section.topics.some(topic =>
        topic.title.toLowerCase().includes(searchLower) ||
        topic.content.toLowerCase().includes(searchLower)
      )
    );
  });

  const currentSection = manualSections.find(s => s.id === activeSection) || manualSections[0];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            Manual do Sistema
          </h1>
          <p className="text-muted-foreground">
            Documentação completa do Ponto Max • {versionInfo.displayString}
          </p>
        </div>
        <HelpButton pageKey="system-manual" />
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar no manual..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 max-w-md"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Navigation */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Índice</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <nav className="space-y-1 p-3">
                {filteredSections.map((section) => {
                  const Icon = section.icon;
                  const isActive = activeSection === section.id;
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{section.title}</span>
                    </button>
                  );
                })}
              </nav>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Content Area */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <currentSection.icon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>{currentSection.title}</CardTitle>
                <CardDescription>{currentSection.description}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px] pr-4">
              <Accordion type="single" collapsible className="w-full">
                {currentSection.topics.map((topic, index) => (
                  <AccordionItem key={index} value={`topic-${index}`}>
                    <AccordionTrigger className="text-left">
                      {topic.title}
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <pre className="whitespace-pre-wrap font-sans text-sm text-muted-foreground leading-relaxed bg-transparent p-0">
                          {topic.content}
                        </pre>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Version Info */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Badge variant="outline">{versionInfo.displayString}</Badge>
              <span className="text-sm text-muted-foreground">
                Atualizado em {new Date(versionInfo.buildDate).toLocaleDateString('pt-BR')}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              © 2026 Ponto Max. Todos os direitos reservados.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
