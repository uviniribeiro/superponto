import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, Check, Info, HelpCircle, Download, Monitor, Wifi, Server, FileCode, Terminal, Bot, Settings, Gauge, Package, Cpu } from 'lucide-react';
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

      {/* Tabs for Windows/Linux */}
      <Tabs defaultValue="windows" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 max-w-2xl">
          <TabsTrigger value="windows" className="flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            Windows
          </TabsTrigger>
          <TabsTrigger value="linux" className="flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            Linux
          </TabsTrigger>
          <TabsTrigger value="packages" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            .deb / .rpm
          </TabsTrigger>
          <TabsTrigger value="build" className="flex items-center gap-2">
            <Cpu className="h-4 w-4" />
            Criar .EXE
          </TabsTrigger>
        </TabsList>

        {/* Windows Tab */}
        <TabsContent value="windows" className="space-y-6">
          {/* Windows Service Section */}
          <Card className="border-green-500/50 bg-gradient-to-r from-green-500/5 to-green-500/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-green-500" />
                Serviço Windows com Dashboard
                <Badge className="bg-green-500">Recomendado</Badge>
              </CardTitle>
              <CardDescription>
                Instale como serviço Windows que inicia automaticamente com o sistema e inclui dashboard de monitoramento
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-green-500/30 bg-green-500/5">
                <Gauge className="h-4 w-4" />
                <AlertTitle>Dashboard de Monitoramento</AlertTitle>
                <AlertDescription className="mt-2">
                  Após a instalação, acesse <code className="bg-muted px-2 py-0.5 rounded">http://localhost:8765</code> para 
                  monitorar sincronizações, ver histórico de eventos, erros e configurar o agente.
                </AlertDescription>
              </Alert>

              <div className="grid gap-4 md:grid-cols-2">
                <Card className="bg-card hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => downloadFile('install-service.bat')}>
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <div className="p-3 rounded-full bg-green-500/10">
                        <Settings className="h-8 w-8 text-green-500" />
                      </div>
                      <div>
                        <h4 className="font-semibold">Instalador Windows</h4>
                        <p className="text-sm text-muted-foreground">install-service.bat</p>
                        <p className="text-xs text-muted-foreground mt-1">Execute como Administrador</p>
                      </div>
                      <Button variant="outline" size="sm" className="w-full">
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => downloadFile('equipment-service.py')}>
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <div className="p-3 rounded-full bg-blue-500/10">
                        <FileCode className="h-8 w-8 text-blue-500" />
                      </div>
                      <div>
                        <h4 className="font-semibold">Script do Serviço</h4>
                        <p className="text-sm text-muted-foreground">equipment-service.py</p>
                        <p className="text-xs text-muted-foreground mt-1">Código fonte do serviço</p>
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
                  <Gauge className="h-4 w-4" />
                  Recursos do Dashboard:
                </h4>
                <ul className="grid gap-2 md:grid-cols-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    Estatísticas de sincronizações em tempo real
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    Histórico completo de eventos
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    Log de erros com detalhes
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    Configuração via interface web
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    Scan manual de rede
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    Sincronização sob demanda
                  </li>
                </ul>
              </div>

              <div className="bg-muted/30 rounded-lg p-4">
                <h4 className="font-medium mb-2">Comandos do Serviço:</h4>
                <div className="grid gap-2 text-sm font-mono">
                  <div className="flex items-center gap-2">
                    <code className="bg-muted px-2 py-1 rounded flex-1">python equipment-service.py install</code>
                    <span className="text-muted-foreground text-xs">Instala o serviço</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="bg-muted px-2 py-1 rounded flex-1">python equipment-service.py start</code>
                    <span className="text-muted-foreground text-xs">Inicia o serviço</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="bg-muted px-2 py-1 rounded flex-1">python equipment-service.py stop</code>
                    <span className="text-muted-foreground text-xs">Para o serviço</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="bg-muted px-2 py-1 rounded flex-1">python equipment-service.py remove</code>
                    <span className="text-muted-foreground text-xs">Remove o serviço</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Simple Agent Section */}
          <Card className="border-primary/50 bg-gradient-to-r from-primary/5 to-primary/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                Agente Simples
                <Badge variant="secondary">Modo Manual</Badge>
              </CardTitle>
              <CardDescription>
                Versão simplificada para detecção e configuração manual de relógios
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* Linux Tab */}
        <TabsContent value="linux" className="space-y-6">
          <Card className="border-orange-500/50 bg-gradient-to-r from-orange-500/5 to-orange-500/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="h-5 w-5 text-orange-500" />
                Serviço Linux com Systemd
                <Badge className="bg-orange-500">Linux</Badge>
              </CardTitle>
              <CardDescription>
                Serviço nativo para Linux com suporte a systemd, inicia automaticamente com o sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-orange-500/30 bg-orange-500/5">
                <Cpu className="h-4 w-4" />
                <AlertTitle>Instalação Automática</AlertTitle>
                <AlertDescription className="mt-2">
                  Execute o script de instalação com <code className="bg-muted px-2 py-0.5 rounded">sudo bash install-linux.sh</code>.
                  O script cria usuário, diretórios, configura o serviço e inicia automaticamente.
                </AlertDescription>
              </Alert>

              <div className="grid gap-4 md:grid-cols-3">
                <Card className="bg-card hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => downloadFile('install-linux.sh')}>
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <div className="p-3 rounded-full bg-orange-500/10">
                        <Terminal className="h-8 w-8 text-orange-500" />
                      </div>
                      <div>
                        <h4 className="font-semibold">Instalador Linux</h4>
                        <p className="text-sm text-muted-foreground">install-linux.sh</p>
                        <p className="text-xs text-muted-foreground mt-1">Execute com sudo</p>
                      </div>
                      <Button variant="outline" size="sm" className="w-full">
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => downloadFile('equipment-agent-linux.py')}>
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <div className="p-3 rounded-full bg-blue-500/10">
                        <FileCode className="h-8 w-8 text-blue-500" />
                      </div>
                      <div>
                        <h4 className="font-semibold">Agente Linux</h4>
                        <p className="text-sm text-muted-foreground">equipment-agent-linux.py</p>
                        <p className="text-xs text-muted-foreground mt-1">Script principal</p>
                      </div>
                      <Button variant="outline" size="sm" className="w-full">
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => downloadFile('equipment-agent.service')}>
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <div className="p-3 rounded-full bg-green-500/10">
                        <Settings className="h-8 w-8 text-green-500" />
                      </div>
                      <div>
                        <h4 className="font-semibold">Arquivo Systemd</h4>
                        <p className="text-sm text-muted-foreground">equipment-agent.service</p>
                        <p className="text-xs text-muted-foreground mt-1">Configuração do serviço</p>
                      </div>
                      <Button variant="outline" size="sm" className="w-full">
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="bg-muted/30 rounded-lg p-4">
                <h4 className="font-medium mb-2">Comandos Systemd:</h4>
                <div className="grid gap-2 text-sm font-mono">
                  <div className="flex items-center gap-2">
                    <code className="bg-muted px-2 py-1 rounded flex-1">systemctl status equipment-agent</code>
                    <span className="text-muted-foreground text-xs">Ver status</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="bg-muted px-2 py-1 rounded flex-1">systemctl restart equipment-agent</code>
                    <span className="text-muted-foreground text-xs">Reiniciar</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="bg-muted px-2 py-1 rounded flex-1">journalctl -u equipment-agent -f</code>
                    <span className="text-muted-foreground text-xs">Ver logs</span>
                  </div>
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Recursos:
                </h4>
                <ul className="grid gap-2 md:grid-cols-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    Dashboard em http://localhost:8765
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    Inicia automaticamente no boot
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    Executa como serviço seguro
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    Logs via journalctl
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    Suporta Ubuntu, Debian, CentOS, Fedora
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    Configuração firewall automática
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Packages Tab - .deb / .rpm */}
        <TabsContent value="packages" className="space-y-6">
          <Card className="border-red-500/50 bg-gradient-to-r from-red-500/5 to-red-500/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-red-500" />
                Pacotes Linux (.deb / .rpm)
                <Badge className="bg-red-500">Pronto para Instalar</Badge>
              </CardTitle>
              <CardDescription>
                Scripts para criar pacotes de instalação nativos para distribuições Linux
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-red-500/30 bg-red-500/5">
                <Package className="h-4 w-4" />
                <AlertTitle>Instalação Simplificada</AlertTitle>
                <AlertDescription className="mt-2">
                  Os pacotes .deb e .rpm permitem instalação com um único comando, sem necessidade de compilação.
                  O serviço é configurado automaticamente para iniciar com o sistema.
                </AlertDescription>
              </Alert>

              <div className="grid gap-4 md:grid-cols-2">
                <Card className="bg-card hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => downloadFile('build-deb.sh')}>
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <div className="p-3 rounded-full bg-orange-500/10">
                        <Package className="h-8 w-8 text-orange-500" />
                      </div>
                      <div>
                        <h4 className="font-semibold">Criar Pacote .deb</h4>
                        <p className="text-sm text-muted-foreground">build-deb.sh</p>
                        <p className="text-xs text-muted-foreground mt-1">Debian, Ubuntu, Mint</p>
                      </div>
                      <Button variant="outline" size="sm" className="w-full">
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => downloadFile('build-rpm.sh')}>
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <div className="p-3 rounded-full bg-red-500/10">
                        <Package className="h-8 w-8 text-red-500" />
                      </div>
                      <div>
                        <h4 className="font-semibold">Criar Pacote .rpm</h4>
                        <p className="text-sm text-muted-foreground">build-rpm.sh</p>
                        <p className="text-xs text-muted-foreground mt-1">RHEL, CentOS, Fedora</p>
                      </div>
                      <Button variant="outline" size="sm" className="w-full">
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                  <h4 className="font-medium flex items-center gap-2 text-orange-500">
                    <Package className="h-4 w-4" />
                    Pacote .deb (Debian/Ubuntu)
                  </h4>
                  <div className="space-y-2 text-sm font-mono">
                    <div className="bg-muted/50 p-2 rounded">
                      <p className="text-xs text-muted-foreground mb-1">1. Gerar o pacote:</p>
                      <code>chmod +x build-deb.sh && ./build-deb.sh</code>
                    </div>
                    <div className="bg-muted/50 p-2 rounded">
                      <p className="text-xs text-muted-foreground mb-1">2. Instalar:</p>
                      <code>sudo dpkg -i equipment-sync-agent_1.0.0_all.deb</code>
                    </div>
                    <div className="bg-muted/50 p-2 rounded">
                      <p className="text-xs text-muted-foreground mb-1">3. Dependências (se necessário):</p>
                      <code>sudo apt-get install -f</code>
                    </div>
                  </div>
                </div>

                <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                  <h4 className="font-medium flex items-center gap-2 text-red-500">
                    <Package className="h-4 w-4" />
                    Pacote .rpm (RHEL/Fedora)
                  </h4>
                  <div className="space-y-2 text-sm font-mono">
                    <div className="bg-muted/50 p-2 rounded">
                      <p className="text-xs text-muted-foreground mb-1">1. Instalar rpmbuild:</p>
                      <code>sudo dnf install rpm-build</code>
                    </div>
                    <div className="bg-muted/50 p-2 rounded">
                      <p className="text-xs text-muted-foreground mb-1">2. Gerar o pacote:</p>
                      <code>chmod +x build-rpm.sh && ./build-rpm.sh</code>
                    </div>
                    <div className="bg-muted/50 p-2 rounded">
                      <p className="text-xs text-muted-foreground mb-1">3. Instalar:</p>
                      <code>sudo dnf install ./equipment-sync-agent-1.0.0*.rpm</code>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  O que os pacotes incluem:
                </h4>
                <ul className="grid gap-2 md:grid-cols-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    Agente de sincronização completo
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    Dashboard web em localhost:8765
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    Configuração systemd automática
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    Instalação de dependências Python
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    Diretórios de log configurados
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    Scripts de pós-instalação
                  </li>
                </ul>
              </div>

              <Alert variant="default" className="border-blue-500/50 bg-blue-500/5">
                <HelpCircle className="h-4 w-4 text-blue-500" />
                <AlertTitle className="text-blue-500">Após a instalação</AlertTitle>
                <AlertDescription className="text-muted-foreground">
                  Edite o arquivo <code className="bg-muted px-1 rounded">/opt/equipment-sync-agent/config.json</code> para 
                  configurar o código da empresa e as faixas de rede. Depois reinicie o serviço com 
                  <code className="bg-muted px-1 rounded ml-1">systemctl restart equipment-sync-agent</code>.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Build Tab */}
        <TabsContent value="build" className="space-y-6">
          <Card className="border-purple-500/50 bg-gradient-to-r from-purple-500/5 to-purple-500/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-purple-500" />
                Criar Executável (.EXE / Binário)
                <Badge className="bg-purple-500">Avançado</Badge>
              </CardTitle>
              <CardDescription>
                Compile o agente em um executável standalone que não requer Python instalado
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-purple-500/30 bg-purple-500/5">
                <Package className="h-4 w-4" />
                <AlertTitle>PyInstaller</AlertTitle>
                <AlertDescription className="mt-2">
                  O script de build usa PyInstaller para criar executáveis. No Windows gera .exe, no Linux gera binário ELF.
                </AlertDescription>
              </Alert>

              <Card className="bg-card hover:bg-accent/50 transition-colors cursor-pointer" onClick={() => downloadFile('build-executable.py')}>
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="p-3 rounded-full bg-purple-500/10">
                      <Package className="h-8 w-8 text-purple-500" />
                    </div>
                    <div>
                      <h4 className="font-semibold">Script de Compilação</h4>
                      <p className="text-sm text-muted-foreground">build-executable.py</p>
                      <p className="text-xs text-muted-foreground mt-1">Gera .exe ou binário Linux</p>
                    </div>
                    <Button variant="outline" size="sm" className="w-full">
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="bg-muted/30 rounded-lg p-4 space-y-4">
                <h4 className="font-medium">Como criar o executável:</h4>
                
                <div className="space-y-3">
                  <div className="bg-muted/50 p-3 rounded">
                    <p className="text-sm font-medium mb-1">1. Instale as dependências:</p>
                    <code className="text-sm bg-background px-2 py-1 rounded block">pip install pyinstaller pywin32</code>
                  </div>
                  
                  <div className="bg-muted/50 p-3 rounded">
                    <p className="text-sm font-medium mb-1">2. Coloque os arquivos na mesma pasta:</p>
                    <ul className="text-sm text-muted-foreground ml-4 list-disc">
                      <li>build-executable.py</li>
                      <li>equipment-service.py (Windows)</li>
                      <li>equipment-agent-linux.py (Linux)</li>
                    </ul>
                  </div>
                  
                  <div className="bg-muted/50 p-3 rounded">
                    <p className="text-sm font-medium mb-1">3. Execute o script de build:</p>
                    <code className="text-sm bg-background px-2 py-1 rounded block">python build-executable.py</code>
                  </div>
                  
                  <div className="bg-muted/50 p-3 rounded">
                    <p className="text-sm font-medium mb-1">4. O executável será criado em:</p>
                    <code className="text-sm bg-background px-2 py-1 rounded block">dist/EquipmentAgentSetup.exe (Windows)</code>
                    <code className="text-sm bg-background px-2 py-1 rounded block mt-1">dist/equipment-agent (Linux)</code>
                  </div>
                </div>
              </div>

              <Alert variant="default" className="border-amber-500/50 bg-amber-500/5">
                <HelpCircle className="h-4 w-4 text-amber-500" />
                <AlertTitle className="text-amber-500">Instalador Profissional (NSIS)</AlertTitle>
                <AlertDescription className="text-muted-foreground">
                  O script também gera um arquivo <code className="bg-muted px-1 rounded">installer.nsi</code> para criar um instalador 
                  profissional Windows com NSIS, incluindo desinstalador e atalhos no menu iniciar.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
              utilize o <strong>Serviço Windows</strong>, <strong>Serviço Linux</strong> ou o <strong>Agente de Sincronização</strong> para fazer a ponte entre o equipamento e o servidor cloud.
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
              'Primme Acesso',
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
