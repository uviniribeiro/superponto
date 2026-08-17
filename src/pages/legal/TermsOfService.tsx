import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function TermsOfService() {
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
            <FileText className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">Termos de Uso</h1>
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
              <h2 className="text-lg font-semibold">1. Aceitação dos Termos</h2>
              <p>
                Ao acessar ou utilizar o sistema Ponto Max ("Serviço"), você concorda em cumprir 
                estes Termos de Uso. Se você não concordar com qualquer parte destes termos, 
                não poderá utilizar o Serviço.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">2. Descrição do Serviço</h2>
              <p>
                O Ponto Max é um sistema de controle de ponto eletrônico que permite:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Registro de entrada, saída e intervalos de trabalho</li>
                <li>Gestão de jornadas e escalas de trabalho</li>
                <li>Controle de banco de horas e horas extras</li>
                <li>Geração de relatórios em conformidade com a Portaria 671/2021</li>
                <li>Integração com equipamentos REP e folha de pagamento</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">3. Cadastro e Acesso</h2>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>O acesso é fornecido pelo empregador (empresa contratante)</li>
                <li>Você é responsável por manter a confidencialidade de suas credenciais</li>
                <li>Você deve notificar imediatamente sobre uso não autorizado</li>
                <li>É proibido compartilhar ou ceder suas credenciais a terceiros</li>
                <li>Cada registro de ponto deve ser realizado pelo próprio funcionário</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">4. Obrigações do Usuário</h2>
              <p>Ao utilizar o Serviço, você concorda em:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Registrar ponto apenas para si mesmo, nunca para terceiros</li>
                <li>Fornecer informações verdadeiras e atualizadas</li>
                <li>Não tentar burlar, fraudar ou manipular registros</li>
                <li>Não utilizar o sistema para fins ilegais ou não autorizados</li>
                <li>Não interferir na segurança ou funcionamento do sistema</li>
                <li>Respeitar os direitos de propriedade intelectual</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">5. Registro de Ponto</h2>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Os registros são permanentes e rastreáveis conforme legislação</li>
                <li>Alterações devem seguir procedimento de ajuste autorizado</li>
                <li>A localização pode ser registrada para validação</li>
                <li>Fotos podem ser capturadas para validação de identidade</li>
                <li>Todos os registros geram comprovante em conformidade com MTE</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">6. Propriedade Intelectual</h2>
              <p>
                Todo o conteúdo do sistema, incluindo software, design, textos, gráficos, 
                logotipos e marcas são de propriedade da Ponto Max ou de seus licenciadores 
                e estão protegidos por leis de propriedade intelectual.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">7. Disponibilidade</h2>
              <p>
                Nos esforçamos para manter o Serviço disponível 24/7, mas não garantimos 
                disponibilidade ininterrupta. Manutenções programadas serão comunicadas 
                com antecedência. Não nos responsabilizamos por indisponibilidades causadas 
                por fatores fora de nosso controle.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">8. Limitação de Responsabilidade</h2>
              <p>
                O Serviço é fornecido "como está". Não nos responsabilizamos por:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Danos indiretos, incidentais ou consequenciais</li>
                <li>Perda de dados causada por falha do usuário ou terceiros</li>
                <li>Decisões trabalhistas baseadas nos dados do sistema</li>
                <li>Uso indevido do sistema pelo usuário ou empregador</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">9. Penalidades</h2>
              <p>
                O uso indevido do sistema, incluindo fraude em registro de ponto, pode resultar em:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Suspensão ou cancelamento do acesso</li>
                <li>Medidas disciplinares aplicadas pelo empregador</li>
                <li>Responsabilização civil e criminal conforme legislação vigente</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">10. Rescisão</h2>
              <p>
                Seu acesso pode ser encerrado pelo empregador a qualquer momento. Em caso de 
                desligamento, seu acesso será desativado, mas os registros históricos serão 
                mantidos conforme obrigação legal.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">11. Alterações</h2>
              <p>
                Reservamo-nos o direito de modificar estes termos a qualquer momento. 
                Alterações significativas serão comunicadas. O uso continuado após 
                alterações constitui aceitação dos novos termos.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">12. Lei Aplicável</h2>
              <p>
                Estes termos são regidos pelas leis da República Federativa do Brasil. 
                Fica eleito o foro da comarca da sede da empresa contratante para dirimir 
                quaisquer controvérsias.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">13. Contato</h2>
              <p>
                Para dúvidas sobre estes termos:
              </p>
              <ul className="list-none space-y-1 ml-4">
                <li><strong>E-mail:</strong> suporte@pontomax.com.br</li>
                <li><strong>Site:</strong> www.pontomax.com.br</li>
              </ul>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
