import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Database, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DataProcessingTerms() {
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
            <Database className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">Termo de Tratamento de Dados</h1>
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
              <h2 className="text-lg font-semibold">1. Objeto</h2>
              <p>
                Este Termo de Tratamento de Dados Pessoais ("Termo") estabelece as condições 
                sob as quais a Ponto Max ("Operador") realiza o tratamento de dados pessoais 
                em nome da empresa contratante ("Controlador"), em conformidade com a Lei 
                Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">2. Definições</h2>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><strong>Controlador:</strong> Empresa contratante, empregador dos titulares</li>
                <li><strong>Operador:</strong> Ponto Max, processador dos dados</li>
                <li><strong>Titular:</strong> Funcionário cujos dados são tratados</li>
                <li><strong>Dados Pessoais:</strong> Informações relacionadas a pessoa identificada ou identificável</li>
                <li><strong>Dados Sensíveis:</strong> Dados biométricos (foto facial para reconhecimento)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">3. Finalidades do Tratamento</h2>
              <p>O Operador tratará os dados pessoais exclusivamente para:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Operação do sistema de controle de ponto eletrônico</li>
                <li>Registro de jornada de trabalho dos funcionários</li>
                <li>Geração de relatórios trabalhistas obrigatórios</li>
                <li>Cálculo de horas trabalhadas, extras e banco de horas</li>
                <li>Validação de identidade no registro de ponto</li>
                <li>Cumprimento de obrigações legais trabalhistas</li>
                <li>Suporte técnico e manutenção do sistema</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">4. Categorias de Dados</h2>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Categoria</th>
                    <th className="text-left p-2">Dados</th>
                    <th className="text-left p-2">Base Legal</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="p-2">Identificação</td>
                    <td className="p-2">Nome, CPF, PIS, matrícula</td>
                    <td className="p-2">Obrigação legal</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2">Contato</td>
                    <td className="p-2">E-mail, telefone</td>
                    <td className="p-2">Execução de contrato</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2">Profissional</td>
                    <td className="p-2">Cargo, departamento, admissão</td>
                    <td className="p-2">Execução de contrato</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2">Registro de Ponto</td>
                    <td className="p-2">Data, hora, localização, IP</td>
                    <td className="p-2">Obrigação legal</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2">Biométrico</td>
                    <td className="p-2">Foto facial</td>
                    <td className="p-2">Consentimento</td>
                  </tr>
                </tbody>
              </table>
            </section>

            <section>
              <h2 className="text-lg font-semibold">5. Obrigações do Operador</h2>
              <p>O Operador compromete-se a:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Tratar dados apenas conforme instruções documentadas do Controlador</li>
                <li>Garantir confidencialidade dos funcionários que acessam os dados</li>
                <li>Implementar medidas técnicas e organizacionais de segurança</li>
                <li>Não subcontratar sem autorização prévia por escrito</li>
                <li>Auxiliar o Controlador no atendimento de direitos dos titulares</li>
                <li>Notificar incidentes de segurança em até 48 horas</li>
                <li>Excluir ou devolver dados ao término do contrato</li>
                <li>Disponibilizar informações para auditorias</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">6. Obrigações do Controlador</h2>
              <p>O Controlador compromete-se a:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Garantir base legal para o tratamento de dados</li>
                <li>Informar os titulares sobre o tratamento</li>
                <li>Obter consentimento para dados sensíveis (biometria)</li>
                <li>Fornecer instruções claras ao Operador</li>
                <li>Responder às solicitações dos titulares</li>
                <li>Manter o Operador informado sobre alterações relevantes</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">7. Suboperadores</h2>
              <p>
                O Operador está autorizado a utilizar os seguintes suboperadores para 
                prestação do serviço:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><strong>Supabase Inc.:</strong> Hospedagem e banco de dados (EUA/Europa)</li>
                <li><strong>Google Cloud:</strong> Infraestrutura de nuvem (Brasil/Global)</li>
                <li><strong>Cloudflare:</strong> CDN e segurança</li>
              </ul>
              <p>
                Todos os suboperadores estão sujeitos a cláusulas contratuais equivalentes 
                às deste Termo.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">8. Transferência Internacional</h2>
              <p>
                Os dados podem ser transferidos para servidores localizados fora do Brasil, 
                observando-se:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Países com nível adequado de proteção</li>
                <li>Cláusulas contratuais padrão aprovadas pela ANPD</li>
                <li>Certificações de conformidade (SOC 2, ISO 27001)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">9. Retenção de Dados</h2>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><strong>Registros de ponto:</strong> 5 anos (obrigação legal CLT)</li>
                <li><strong>Dados cadastrais:</strong> Duração do contrato + 5 anos</li>
                <li><strong>Logs de sistema:</strong> 1 ano</li>
                <li><strong>Dados biométricos:</strong> Duração do vínculo empregatício</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">10. Segurança</h2>
              <p>Medidas de segurança implementadas:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Criptografia AES-256 para dados em repouso</li>
                <li>TLS 1.3 para dados em trânsito</li>
                <li>Autenticação multifator disponível</li>
                <li>Controle de acesso baseado em funções (RBAC)</li>
                <li>Monitoramento e detecção de intrusões</li>
                <li>Backups diários com retenção de 30 dias</li>
                <li>Testes de penetração anuais</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">11. Incidentes de Segurança</h2>
              <p>
                Em caso de incidente que afete dados pessoais, o Operador irá:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Notificar o Controlador em até 48 horas</li>
                <li>Fornecer informações sobre natureza e extensão do incidente</li>
                <li>Adotar medidas para mitigar danos</li>
                <li>Colaborar na notificação à ANPD e titulares, se necessário</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">12. Auditorias</h2>
              <p>
                O Controlador pode realizar auditorias mediante aviso prévio de 30 dias, 
                durante horário comercial, para verificar conformidade com este Termo.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">13. Término</h2>
              <p>
                Ao término do contrato, o Operador irá:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Devolver todos os dados em formato legível</li>
                <li>Excluir dados após 90 dias, salvo obrigação legal</li>
                <li>Certificar a destruição por escrito</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">14. Disposições Gerais</h2>
              <p>
                Este Termo é regido pelas leis brasileiras. Alterações devem ser formalizadas 
                por escrito. Em caso de conflito com outros acordos, prevalecem as disposições 
                mais protetivas aos dados pessoais.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
