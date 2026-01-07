import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Cookie, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function CookiePolicy() {
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
            <Cookie className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">Política de Cookies</h1>
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
              <h2 className="text-lg font-semibold">1. O que são Cookies?</h2>
              <p>
                Cookies são pequenos arquivos de texto armazenados em seu dispositivo quando 
                você acessa um site ou aplicativo. Eles permitem que o sistema se lembre de 
                suas preferências e mantenha você conectado.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">2. Tipos de Cookies Utilizados</h2>
              
              <h3 className="text-md font-medium mt-4">2.1 Cookies Essenciais (Obrigatórios)</h3>
              <p>
                Necessários para o funcionamento básico do sistema. Sem eles, você não 
                conseguiria fazer login ou usar o serviço.
              </p>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Cookie</th>
                    <th className="text-left p-2">Finalidade</th>
                    <th className="text-left p-2">Duração</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="p-2">sb-*-auth-token</td>
                    <td className="p-2">Autenticação do usuário</td>
                    <td className="p-2">7 dias</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2">session_id</td>
                    <td className="p-2">Identificador de sessão</td>
                    <td className="p-2">Sessão</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2">csrf_token</td>
                    <td className="p-2">Proteção contra ataques CSRF</td>
                    <td className="p-2">Sessão</td>
                  </tr>
                </tbody>
              </table>

              <h3 className="text-md font-medium mt-4">2.2 Cookies de Preferências</h3>
              <p>
                Permitem lembrar suas escolhas e personalizar sua experiência.
              </p>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Cookie</th>
                    <th className="text-left p-2">Finalidade</th>
                    <th className="text-left p-2">Duração</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="p-2">theme</td>
                    <td className="p-2">Preferência de tema (claro/escuro)</td>
                    <td className="p-2">1 ano</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2">sidebar_state</td>
                    <td className="p-2">Estado da barra lateral</td>
                    <td className="p-2">30 dias</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2">language</td>
                    <td className="p-2">Idioma preferido</td>
                    <td className="p-2">1 ano</td>
                  </tr>
                </tbody>
              </table>
            </section>

            <section>
              <h2 className="text-lg font-semibold">3. Cookies de Terceiros</h2>
              <p>
                O sistema não utiliza cookies de rastreamento ou publicidade de terceiros. 
                Os únicos cookies de terceiros são técnicos, utilizados pelos serviços de 
                infraestrutura:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><strong>Supabase:</strong> Autenticação e gerenciamento de sessão</li>
                <li><strong>Cloudflare:</strong> Proteção contra ataques e cache</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">4. Armazenamento Local (Local Storage)</h2>
              <p>
                Além de cookies, utilizamos o armazenamento local do navegador para:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Favoritos de menu (localStorage)</li>
                <li>Rotas recentes visitadas</li>
                <li>Preferências de interface</li>
                <li>Cache de dados para performance</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">5. Gerenciamento de Cookies</h2>
              <p>
                Você pode gerenciar cookies através das configurações do seu navegador:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><strong>Chrome:</strong> Configurações → Privacidade e segurança → Cookies</li>
                <li><strong>Firefox:</strong> Opções → Privacidade e Segurança → Cookies</li>
                <li><strong>Safari:</strong> Preferências → Privacidade → Gerenciar dados</li>
                <li><strong>Edge:</strong> Configurações → Privacidade → Cookies</li>
              </ul>
              <p className="mt-2">
                <strong>Atenção:</strong> Desativar cookies essenciais impedirá o funcionamento 
                do sistema.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">6. Cookies em Dispositivos Móveis</h2>
              <p>
                No aplicativo móvel (Android/iOS), utilizamos mecanismos similares para 
                armazenamento de dados de sessão e preferências. Esses dados são armazenados 
                localmente no dispositivo e não são compartilhados com terceiros.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">7. Retenção</h2>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><strong>Cookies de sessão:</strong> Removidos ao fechar o navegador</li>
                <li><strong>Cookies persistentes:</strong> Conforme duração especificada</li>
                <li><strong>Local Storage:</strong> Até limpeza manual ou logout</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">8. Atualizações</h2>
              <p>
                Esta política pode ser atualizada periodicamente. Alterações significativas 
                serão notificadas. Recomendamos revisar esta página regularmente.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">9. Contato</h2>
              <p>
                Para dúvidas sobre cookies ou esta política:
              </p>
              <ul className="list-none space-y-1 ml-4">
                <li><strong>E-mail:</strong> privacidade@pontomax.com.br</li>
              </ul>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
