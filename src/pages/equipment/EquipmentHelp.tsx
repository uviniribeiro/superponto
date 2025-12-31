import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Copy, Check, Info, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function EquipmentHelp() {
  const [copied, setCopied] = useState(false);
  const serverUrl = 'https://sfbyujjvfxicuuafjtoy.supabase.co/functions/v1/equipment-sync';

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copiado para a área de transferência');
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Ajuda na Configuração</h1>
        <p className="text-muted-foreground">Como configurar os relógios de ponto</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            URL do Servidor para Configuração nos Equipamentos
          </CardTitle>
          <CardDescription>
            Configure esta URL nos equipamentos para comunicação via webservice
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>URL de Comunicação</AlertTitle>
            <AlertDescription className="flex items-center gap-2 mt-2">
              <code className="bg-muted px-2 py-1 rounded text-sm break-all flex-1">
                {serverUrl}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(serverUrl)}
              >
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <h4 className="font-medium">Instruções de Configuração:</h4>
            
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
              <div key={brand} className="p-2 bg-muted/50 rounded text-sm">
                {brand}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
