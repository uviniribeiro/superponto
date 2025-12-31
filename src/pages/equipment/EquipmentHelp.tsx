import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Copy, Check, Info, HelpCircle, Download, Monitor, Wifi, Server, FileCode, Terminal, Bot } from 'lucide-react';
import { toast } from 'sonner';

export default function EquipmentHelp() {
  const [copied, setCopied] = useState<string | null>(null);
  const serverUrl = 'https://sfbyujjvfxicuuafjtoy.supabase.co/functions/v1/equipment-sync';

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
    toast.success('Copiado para a área de transferência');
  };

  const downloadFile = (filename: string) => {
    const link = document.createElement('a');
    link.href = `/downloads/${filename}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Download iniciado: ${filename}`);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Ajuda na Configuração</h1>
        <p className="text-muted-foreground">Como configurar os relógios de ponto</p>
      </div>

      {/* Agent Download Section */}
      <Card className="border-primary/50 bg-gradient-to-r from-primary/5 to-primary/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Agente de Sincronização Automática
            <Badge variant="secondary">Recomendado</Badge>
          </CardTitle>
          <CardDescription>
            Baixe o agente para detectar e configurar automaticamente os relógios de ponto na sua rede
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-primary/30 bg-primary/5">
            <Monitor className="h-4 w-4" />
            <AlertTitle>Instalação Local</AlertTitle>
            <AlertDescription className="mt-2">
              O agente deve ser instalado em um computador que esteja na mesma rede dos relógios de ponto.
              Ele irá detectar automaticamente os equipamentos e configurar a sincronização com o servidor cloud.
            </AlertDescription>
          </Alert>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-card hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => downloadFile('equipment-agent.py')}>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="p-3 rounded-full bg-primary/10">
                    <FileCode className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold">Script Python</h4>
                    <p className="text-sm text-muted-foreground">equipment-agent.py</p>
                  </div>
                  <Button variant="outline" size="sm" className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => downloadFile('equipment-agent.bat')}>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="p-3 rounded-full bg-green-500/10">
                    <Terminal className="h-8 w-8 text-green-500" />
                  </div>
                  <div>
                    <h4 className="font-semibold">Windows (Batch)</h4>
                    <p className="text-sm text-muted-foreground">equipment-agent.bat</p>
                  </div>
                  <Button variant="outline" size="sm" className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => downloadFile('README.txt')}>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="p-3 rounded-full bg-blue-500/10">
                    <Info className="h-8 w-8 text-blue-500" />
                  </div>
                  <div>
                    <h4 className="font-semibold">Manual de Uso</h4>
                    <p className="text-sm text-muted-foreground">README.txt</p>
                  </div>
                  <Button variant="outline" size="sm" className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <Wifi className="h-4 w-4" />
              O que o agente faz:
            </h4>
            <ul className="grid gap-2 md:grid-cols-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                Escaneia automaticamente a rede local
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                Detecta relógios de ponto por IP
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                Identifica fabricante e modelo
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                Configura sincronização automática
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                Registra equipamentos no cloud
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                Funciona em segundo plano
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Server URL Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Configuração Manual - URL do Servidor
          </CardTitle>
          <CardDescription>
            Para equipamentos que suportam configuração direta via webservice
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Endpoint de Comunicação</AlertTitle>
            <AlertDescription className="flex items-center gap-2 mt-2">
              <code className="bg-muted px-2 py-1 rounded text-sm break-all flex-1 font-mono">
                {serverUrl}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(serverUrl, 'url')}
              >
                {copied === 'url' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </AlertDescription>
          </Alert>

          <Alert variant="default" className="border-amber-500/50 bg-amber-500/5">
            <HelpCircle className="h-4 w-4 text-amber-500" />
            <AlertTitle className="text-amber-500">Nota sobre IPv4</AlertTitle>
            <AlertDescription className="text-muted-foreground">
              Este é um endpoint cloud que funciona globalmente via HTTPS. Se seu equipamento requer um endereço IPv4 fixo, 
              utilize o <strong>Agente de Sincronização</strong> acima para fazer a ponte entre o equipamento e o servidor cloud.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <h4 className="font-medium">Instruções de Configuração Manual:</h4>
            
            <div className="grid gap-4">
              <Card className="bg-muted/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">1. Acesse o equipamento</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Acesse a interface web do equipamento através do navegador usando o IP configurado.
                </CardContent>
              </Card>

              <Card className="bg-muted/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">2. Configure a comunicação</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Procure a seção de configuração de comunicação/webservice e insira a URL acima como destino dos dados.
                </CardContent>
              </Card>

              <Card className="bg-muted/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">3. Configure o intervalo</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Defina o intervalo de envio de dados (recomendado: 60 segundos).
                </CardContent>
              </Card>

              <Card className="bg-muted/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">4. Teste a conexão</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Após salvar, utilize a função "Testar Conexão" neste sistema para verificar se a comunicação está funcionando.
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fabricantes Suportados</CardTitle>
          <CardDescription>
            Lista de fabricantes e modelos compatíveis com o sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {[
              'Henry (Prisma, Orion, Hexa)',
              'Dimep (PrintPoint, Smart Print)',
              'Control iD (iDClass, iDFace)',
              'Topdata (Inner Rep)',
              'Madis (MD 6705, MD FaceID)',
              'Secullum (REP 4, REP Bio)',
              'ZKTeco (K40, SpeedFace)',
              'Anviz (C2 Pro, FacePass)',
              'Suprema/BioStar',
              'Trix (SS 710, SS 810)',
              'RWTech',
              'Hikvision',
              'Intelbras (SS 411, SS 611)',
            ].map(brand => (
              <div key={brand} className="p-2 bg-muted/50 rounded text-sm flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500 shrink-0" />
                {brand}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
