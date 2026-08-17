import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Shield, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PrivacyPolicy() {
  const navigate = useNavigate();
  const lastUpdated = '07 de Janeiro de 2026';

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">Política de Privacidade</h1>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Última atualização: {lastUpdated}</span>
            </div>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-lg font-semibold">1. Introdução</h2>
              <p>
                A Ponto Max ("nós", "nosso" ou "Empresa") está comprometida em proteger sua privacidade. 
                Esta Política de Privacidade explica como coletamos, usamos, divulgamos e protegemos suas 
                informações pessoais quando você utiliza nosso sistema de controle de ponto eletrônico 
                ("Serviço"), em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">2. Dados Coletados</h2>
              <p>Coletamos os seguintes tipos de dados pessoais:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><strong>Dados de Identificação:</strong> Nome completo, CPF, PIS/PASEP, número de matrícula, foto do funcionário</li>
                <li><strong>Dados de Contato:</strong> Endereço de e-mail corporativo, número de telefone</li>
                <li><strong>Dados Profissionais:</strong> Cargo, departamento, data de admissão, jornada de trabalho</li>
                <li><strong>Dados de Registro de Ponto:</strong> Data, hora, localização geográfica (GPS), endereço IP</li>
                <li><strong>Dados Biométricos:</strong> Foto facial para validação de identidade (opcional)</li>
                <li><strong>Dados de Dispositivo:</strong> Informações do navegador/dispositivo usado para acesso</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">3. Finalidades do Tratamento</h2>
              <p>Utilizamos seus dados pessoais para:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Registrar e gerenciar sua jornada de trabalho</li>
                <li>Calcular horas trabalhadas, extras e banco de horas</li>
                <li>Gerar relatórios obrigatórios para o Ministério do Trabalho (Portaria 671/2021)</li>
                <li>Integração com sistemas de folha de pagamento</li>
                <li>Validar sua identidade no momento do registro de ponto</li>
                <li>Cumprir obrigações legais e regulatórias trabalhistas</li>
                <li>Prevenir fraudes e garantir a integridade dos registros</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">4. Base Legal</h2>
              <p>O tratamento de seus dados pessoais está fundamentado nas seguintes bases legais da LGPD:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><strong>Cumprimento de obrigação legal:</strong> CLT e Portaria 671/2021 do MTE</li>
                <li><strong>Execução de contrato:</strong> Contrato de trabalho entre você e seu empregador</li>
                <li><strong>Legítimo interesse:</strong> Gestão administrativa e prevenção de fraudes</li>
                <li><strong>Consentimento:</strong> Para coleta de dados biométricos (quando aplicável)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">5. Compartilhamento de Dados</h2>
              <p>Seus dados podem ser compartilhados com:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Seu empregador (empresa contratante do serviço)</li>
                <li>Órgãos governamentais quando exigido por lei (Ministério do Trabalho, Receita Federal)</li>
                <li>Prestadores de serviços essenciais (hospedagem em nuvem, processamento de dados)</li>
                <li>Escritórios de contabilidade autorizados pelo empregador</li>
              </ul>
              <p>Não vendemos ou comercializamos seus dados pessoais.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">6. Retenção de Dados</h2>
              <p>
                Os registros de ponto são mantidos pelo período mínimo de 5 (cinco) anos, conforme 
                exigência da legislação trabalhista brasileira. Após este período, os dados podem 
                ser anonimizados ou eliminados, respeitando outras obrigações legais aplicáveis.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">7. Segurança dos Dados</h2>
              <p>Adotamos medidas técnicas e organizacionais para proteger seus dados:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Criptografia de dados em trânsito (HTTPS/TLS) e em repouso</li>
                <li>Controle de acesso baseado em funções (RBAC)</li>
                <li>Autenticação segura com senhas criptografadas</li>
                <li>Logs de auditoria para rastreabilidade de acessos</li>
                <li>Backups regulares e planos de recuperação de desastres</li>
                <li>Hospedagem em infraestrutura certificada (SOC 2, ISO 27001)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">8. Seus Direitos (LGPD)</h2>
              <p>Você tem direito a:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Confirmar a existência de tratamento de dados</li>
                <li>Acessar seus dados pessoais</li>
                <li>Solicitar correção de dados incompletos ou desatualizados</li>
                <li>Solicitar anonimização, bloqueio ou eliminação de dados desnecessários</li>
                <li>Portabilidade dos dados</li>
                <li>Revogar consentimento (quando aplicável)</li>
                <li>Obter informações sobre compartilhamento de dados</li>
              </ul>
              <p>
                Para exercer seus direitos, entre em contato com o RH de sua empresa ou com nosso 
                Encarregado de Proteção de Dados (DPO).
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">9. Cookies e Tecnologias Similares</h2>
              <p>
                Utilizamos cookies essenciais para funcionamento do sistema (autenticação, preferências). 
                Para mais detalhes, consulte nossa Política de Cookies.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">10. Contato</h2>
              <p>
                Para dúvidas, solicitações ou reclamações relacionadas a esta política ou ao 
                tratamento de seus dados pessoais, entre em contato:
              </p>
              <ul className="list-none space-y-1 ml-4">
                <li><strong>E-mail:</strong> privacidade@pontomax.com.br</li>
                <li><strong>DPO:</strong> dpo@pontomax.com.br</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">11. Alterações</h2>
              <p>
                Esta política pode ser atualizada periodicamente. Notificaremos sobre mudanças 
                significativas através do sistema. A versão mais atual estará sempre disponível 
                nesta página.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
