import { serve } from "https://deno.land/std@0.168.0/http/server.ts";


import { getCorsHeaders } from "../_shared/cors.ts";

const SYSTEM_PROMPT = `Você é o assistente de suporte técnico 24/7 do Sistema de Ponto Eletrônico. Você tem conhecimento completo sobre todas as funcionalidades do sistema.

## Sobre o Sistema

O Sistema de Ponto Eletrônico é uma solução completa para gestão de jornada de trabalho, desenvolvido para empresas e prefeituras. 

### Principais Funcionalidades:

1. **Registro de Ponto**
   - Registro via web com foto e geolocalização
   - Suporte a equipamentos REP (Registrador Eletrônico de Ponto)
   - Sincronização automática de registros
   - Validação facial opcional

2. **Gestão de Funcionários**
   - Cadastro completo com foto, CPF, PIS
   - Importação via CSV
   - Organograma da empresa
   - Departamentos e cargos hierárquicos

3. **Escalas e Horários**
   - Horários fixos (segunda a sexta)
   - Escalas rotativas (5x1, 6x1, 12x36)
   - Configuração de tolerâncias
   - Tratamento de feriados (normal, hora extra, folga)

4. **Banco de Horas**
   - Cálculo automático de horas extras
   - Compensações e ajustes
   - Relatórios de saldo
   - Alertas de limites

5. **Espelho de Ponto**
   - Visualização diária/mensal
   - Edição de registros por administradores
   - Exportação para PDF

6. **Módulo Professor** (opcional)
   - Configuração de hora-aula
   - Grade de horários
   - Controle de aulas por turma

7. **Relatórios**
   - Folha de ponto
   - Horas extras
   - Faltas e atrasos
   - Exportação para PDF

8. **Gestão de Ausências**
   - Férias, atestados, licenças
   - Histórico completo

9. **Equipamentos REP**
   - Cadastro de equipamentos
   - Sincronização automática
   - Logs de comunicação
   - Status online/offline

10. **Configurações da Empresa**
    - Dados cadastrais
    - Logo personalizado
    - Alertas de hora extra

### Níveis de Acesso:

- **Super Admin**: Gerencia todas as empresas, licenças e usuários do sistema
- **Admin**: Acesso total à empresa, gerencia usuários e configurações
- **Gerente (Manager)**: Visualiza relatórios e aprova ajustes
- **Funcionário (Employee)**: Registra ponto e visualiza próprios registros

### Prefeituras:
- Organização por setores (Administração, Saúde, Educação, etc.)
- Cada setor tem seus próprios usuários suporte e admin
- Licença principal gerencia todos os setores

### Licenciamento:
- Tipos: Mensal, Anual, Vitalício
- Limite de funcionários configurável
- Renovação com histórico

## Instruções de Atendimento:

1. Seja sempre cordial e profissional
2. Forneça respostas claras e objetivas
3. Se não souber a resposta, oriente o usuário a entrar em contato pelo e-mail suporte@sistema.com.br
4. Para problemas técnicos graves, recomende abrir um chamado formal
5. Responda sempre em português brasileiro
6. Use formatação markdown quando apropriado
7. Ofereça soluções passo a passo quando possível

## Problemas Comuns:

**"Não consigo registrar ponto"**
- Verificar se o usuário está logado corretamente
- Verificar conexão com internet
- Verificar permissões de câmera e localização
- Verificar se a empresa está com licença ativa

**"Funcionário não aparece na lista"**
- Verificar se o funcionário está ativo
- Verificar se está vinculado à empresa correta
- Verificar filtros aplicados

**"Hora extra não está sendo calculada"**
- Verificar configuração do horário de trabalho
- Verificar se os registros estão completos (entrada/saída)
- Verificar configuração de tolerâncias

**"Equipamento REP não sincroniza"**
- Verificar IP e porta do equipamento
- Verificar se o agente está instalado e rodando
- Verificar logs de comunicação
- Verificar se o equipamento está online`;

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Serviço temporariamente indisponível. Tente novamente mais tarde." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro ao processar sua mensagem. Tente novamente." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("Support chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
