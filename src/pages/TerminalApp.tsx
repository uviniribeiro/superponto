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
import { PageHeader } from '@/components/shared/PageHeader';

const APK_PATH = '/downloads/pontomax-terminal.apk';
const EMPLOYEE_APK_PATH = '/downloads/pontomax-funcionario.apk';

function useFileAvailable(path: string) {
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    fetch(path, { method: 'HEAD' })
      .then((r) => active && setAvailable(r.ok && !(r.headers.get('content-type') ?? '').includes('text/html')))
      .catch(() => active && setAvailable(false));
    return () => { active = false; };
  }, [path]);
  return available;
}

export default function TerminalApp() {
  const apkAvailable = useFileAvailable(APK_PATH);
  const employeeApkAvailable = useFileAvailable(EMPLOYEE_APK_PATH);

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <PageHeader
          title="Apps de Ponto"
          description="Aplicativos de registro de ponto: terminal fixo da empresa e app no celular do funcionário." icon={Smartphone}
          className="mb-0 min-w-0 flex-1 border-0 bg-transparent p-0 backdrop-blur-none sm:p-0"
        />

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">PontoMax Terminal — Android</CardTitle>
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
                O arquivo do aplicativo é gerado na VPS com <code className="px-1 rounded bg-muted text-xs">scripts/build-mobile.sh terminal</code>. Assim que o
                <code className="mx-1 px-1 rounded bg-muted text-xs">pontomax-terminal.apk</code>
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">PontoMax — app do funcionário (Android)</CardTitle>
              <CardDescription>
                Registro de ponto no celular de cada funcionário, com localização e selfie conforme as regras da empresa.
              </CardDescription>
            </div>
            <Badge variant={employeeApkAvailable ? 'default' : 'secondary'}>
              {employeeApkAvailable === null ? 'Verificando...' : employeeApkAvailable ? 'Disponível' : 'Aguardando publicação'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Button asChild disabled={!employeeApkAvailable}>
            <a href={EMPLOYEE_APK_PATH} download>
              <Download className="h-4 w-4 mr-2" />
              Baixar .apk do funcionário
            </a>
          </Button>
          <ol className="list-decimal pl-5 space-y-1.5 text-muted-foreground">
            <li>Envie o link de download aos funcionários (ou distribua pela loja/MDM da empresa).</li>
            <li>No primeiro acesso, o funcionário entra com o código da empresa, usuário e senha.</li>
            <li>Permita câmera e localização quando o app pedir — são usadas apenas no registro do ponto.</li>
          </ol>
          {employeeApkAvailable === false && (
            <p className="text-muted-foreground">
              Gere o arquivo na VPS com <code className="px-1 rounded bg-muted text-xs">scripts/build-mobile.sh funcionario</code>.
            </p>
          )}
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
