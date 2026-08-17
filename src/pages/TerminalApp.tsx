import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Smartphone, Download, ShieldCheck, MonitorSmartphone, AlertCircle, ExternalLink,
} from 'lucide-react';
import { APP_VERSION } from '@/lib/version';

const APK_PATH = '/downloads/ponto-max-terminal.apk';

export default function TerminalApp() {
  const [apkAvailable, setApkAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    fetch(APK_PATH, { method: 'HEAD' })
      .then((r) => active && setApkAvailable(r.ok))
      .catch(() => active && setApkAvailable(false));
    return () => { active = false; };
  }, []);

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Smartphone className="h-6 w-6 text-primary" />
          App do Terminal
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Aplicativo dedicado ao registro de ponto: abre direto no login do terminal, sem acesso ao restante do sistema.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Ponto Max Terminal — Android</CardTitle>
              <CardDescription>Versão {APP_VERSION} • Android 8.0 ou superior</CardDescription>
            </div>
            <Badge variant={apkAvailable ? 'default' : 'secondary'}>
              {apkAvailable === null ? 'Verificando...' : apkAvailable ? 'Disponível' : 'Aguardando publicação'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button asChild disabled={!apkAvailable}>
              <a href={APK_PATH} download>
                <Download className="h-4 w-4 mr-2" />
                Baixar .apk do Terminal
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href="/terminal" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Abrir Terminal no navegador
              </a>
            </Button>
          </div>

          {apkAvailable === false && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Instalador ainda não publicado</AlertTitle>
              <AlertDescription className="text-sm">
                O arquivo do aplicativo é gerado pelo build Android do projeto. Assim que o
                <code className="mx-1 px-1 rounded bg-muted text-xs">ponto-max-terminal.apk</code>
                for publicado em <code className="px-1 rounded bg-muted text-xs">public/downloads/</code>,
                o download é liberado automaticamente nesta tela.
              </AlertDescription>
            </Alert>
          )}

          <Separator />

          <div className="space-y-3 text-sm">
            <p className="font-medium flex items-center gap-2">
              <MonitorSmartphone className="h-4 w-4 text-primary" /> Como instalar no tablet/celular do terminal
            </p>
            <ol className="list-decimal pl-5 space-y-1.5 text-muted-foreground">
              <li>Baixe o arquivo .apk no aparelho que ficará fixo no ponto de registro.</li>
              <li>Autorize "Instalar apps de fontes desconhecidas" para o navegador utilizado.</li>
              <li>Abra o arquivo baixado e conclua a instalação.</li>
              <li>No primeiro acesso, informe o CNPJ da unidade e a senha do terminal.</li>
              <li>Fixe o app na tela inicial e ative o modo quiosque do aparelho, se disponível.</li>
            </ol>
          </div>

          <Separator />

          <div className="space-y-3 text-sm">
            <p className="font-medium flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" /> Segurança
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
              <li>O app acessa somente a tela de terminal — nenhum menu administrativo é exposto.</li>
              <li>Login exclusivo por CNPJ da unidade (matriz ou filial) + senha do terminal.</li>
              <li>Registros feitos offline ficam em fila e são enviados assim que a conexão retorna.</li>
              <li>Cada registro recebe assinatura própria, impedindo duplicidade no envio da fila.</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Instalação sem .apk (modo web)</CardTitle>
          <CardDescription>
            Alternativa imediata enquanto o instalador não é distribuído.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Abra <code className="px-1 rounded bg-muted text-xs">/terminal</code> no navegador do aparelho e use
            "Adicionar à tela de início". O terminal roda em tela cheia, com o mesmo login e a mesma fila offline
            do aplicativo instalado.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
