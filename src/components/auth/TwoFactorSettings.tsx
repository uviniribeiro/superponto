import { useState, useEffect } from 'react';
import { Shield, ShieldCheck, Copy, RefreshCw, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTwoFactor } from '@/hooks/useTwoFactor';
import { toast } from 'sonner';

export function TwoFactorSettings() {
  const { 
    loading, 
    status, 
    setupData,
    getStatus, 
    startSetup, 
    verifySetup,
    disable,
    regenerateBackupCodes 
  } = useTwoFactor();

  const [verifyToken, setVerifyToken] = useState('');
  const [disableToken, setDisableToken] = useState('');
  const [regenerateToken, setRegenerateToken] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [newBackupCodes, setNewBackupCodes] = useState<string[] | null>(null);
  const [setupDialogOpen, setSetupDialogOpen] = useState(false);
  const [disableDialogOpen, setDisableDialogOpen] = useState(false);
  const [backupDialogOpen, setBackupDialogOpen] = useState(false);

  useEffect(() => {
    getStatus();
  }, []);

  const handleStartSetup = async () => {
    await startSetup();
    setSetupDialogOpen(true);
  };

  const handleVerifySetup = async () => {
    const success = await verifySetup(verifyToken);
    if (success) {
      setSetupDialogOpen(false);
      setVerifyToken('');
    }
  };

  const handleDisable = async () => {
    const success = await disable(disableToken);
    if (success) {
      setDisableDialogOpen(false);
      setDisableToken('');
    }
  };

  const handleRegenerateBackupCodes = async () => {
    const codes = await regenerateBackupCodes(regenerateToken);
    if (codes) {
      setNewBackupCodes(codes);
      setRegenerateToken('');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado para a área de transferência');
  };

  const copyAllBackupCodes = (codes: string[]) => {
    navigator.clipboard.writeText(codes.join('\n'));
    toast.success('Todos os códigos copiados');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {status?.enabled ? (
            <ShieldCheck className="h-5 w-5 text-green-500" />
          ) : (
            <Shield className="h-5 w-5 text-muted-foreground" />
          )}
          Autenticação de Dois Fatores (2FA)
        </CardTitle>
        <CardDescription>
          Adicione uma camada extra de segurança à sua conta usando um aplicativo autenticador
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status?.enabled ? (
          <>
            <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
              <ShieldCheck className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-green-700 dark:text-green-300">
                2FA está ativo. Sua conta está protegida com autenticação de dois fatores.
              </AlertDescription>
            </Alert>

            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <p className="font-medium">Códigos de Backup</p>
                <p className="text-sm text-muted-foreground">
                  {status.backupCodesRemaining} códigos restantes
                </p>
              </div>
              <Dialog open={backupDialogOpen} onOpenChange={setBackupDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Regenerar
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Gerar Novos Códigos de Backup</DialogTitle>
                    <DialogDescription>
                      Isso invalidará todos os códigos anteriores. Guarde os novos códigos em um local seguro.
                    </DialogDescription>
                  </DialogHeader>
                  
                  {!newBackupCodes ? (
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium">
                          Digite o código do seu autenticador
                        </label>
                        <Input
                          type="text"
                          placeholder="000000"
                          maxLength={6}
                          value={regenerateToken}
                          onChange={(e) => setRegenerateToken(e.target.value.replace(/\D/g, ''))}
                          className="text-center text-2xl tracking-widest"
                        />
                      </div>
                      <Button 
                        onClick={handleRegenerateBackupCodes} 
                        disabled={loading || regenerateToken.length !== 6}
                        className="w-full"
                      >
                        {loading ? 'Gerando...' : 'Gerar Novos Códigos'}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          Guarde estes códigos em um local seguro. Eles não serão exibidos novamente.
                        </AlertDescription>
                      </Alert>
                      <div className="grid grid-cols-2 gap-2">
                        {newBackupCodes.map((code, i) => (
                          <div 
                            key={i}
                            className="p-2 bg-muted rounded text-center font-mono cursor-pointer hover:bg-muted/80"
                            onClick={() => copyToClipboard(code)}
                          >
                            {code}
                          </div>
                        ))}
                      </div>
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => copyAllBackupCodes(newBackupCodes)}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copiar Todos
                      </Button>
                      <Button 
                        className="w-full"
                        onClick={() => {
                          setNewBackupCodes(null);
                          setBackupDialogOpen(false);
                        }}
                      >
                        Entendido, salvei os códigos
                      </Button>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </div>

            <Dialog open={disableDialogOpen} onOpenChange={setDisableDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  Desabilitar 2FA
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Desabilitar 2FA</DialogTitle>
                  <DialogDescription>
                    Isso removerá a proteção adicional da sua conta. 
                    Digite o código do seu autenticador para confirmar.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    type="text"
                    placeholder="000000"
                    maxLength={6}
                    value={disableToken}
                    onChange={(e) => setDisableToken(e.target.value.replace(/\D/g, ''))}
                    className="text-center text-2xl tracking-widest"
                  />
                  <DialogFooter>
                    <Button 
                      variant="outline" 
                      onClick={() => setDisableDialogOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      variant="destructive"
                      onClick={handleDisable}
                      disabled={loading || disableToken.length !== 6}
                    >
                      {loading ? 'Desabilitando...' : 'Desabilitar'}
                    </Button>
                  </DialogFooter>
                </div>
              </DialogContent>
            </Dialog>
          </>
        ) : (
          <>
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Sua conta não está protegida com autenticação de dois fatores.
                Recomendamos ativar para maior segurança.
              </AlertDescription>
            </Alert>

            <Dialog open={setupDialogOpen} onOpenChange={setSetupDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={handleStartSetup} disabled={loading} className="w-full">
                  <Shield className="h-4 w-4 mr-2" />
                  {loading ? 'Carregando...' : 'Ativar 2FA'}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Configurar 2FA</DialogTitle>
                  <DialogDescription>
                    Escaneie o QR Code com seu aplicativo autenticador
                  </DialogDescription>
                </DialogHeader>

                {setupData && (
                  <div className="space-y-4">
                    {/* QR Code placeholder - em produção usar biblioteca de QR code */}
                    <div className="flex justify-center">
                      <div className="p-4 bg-white rounded-lg">
                        <img 
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(setupData.otpauthUrl)}`}
                          alt="QR Code 2FA"
                          className="w-48 h-48"
                        />
                      </div>
                    </div>

                    {/* Secret manual */}
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground text-center">
                        Ou digite o código manualmente:
                      </p>
                      <div className="flex items-center gap-2">
                        <Input
                          type={showSecret ? 'text' : 'password'}
                          value={setupData.secret}
                          readOnly
                          className="font-mono text-center"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setShowSecret(!showSecret)}
                        >
                          {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyToClipboard(setupData.secret)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Backup codes */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Códigos de Backup</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowBackupCodes(!showBackupCodes)}
                        >
                          {showBackupCodes ? 'Ocultar' : 'Mostrar'}
                        </Button>
                      </div>
                      {showBackupCodes && (
                        <>
                          <Alert>
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>
                              Guarde estes códigos em um local seguro. 
                              Eles só serão exibidos uma vez!
                            </AlertDescription>
                          </Alert>
                          <div className="grid grid-cols-2 gap-2">
                            {setupData.backupCodes.map((code, i) => (
                              <div 
                                key={i}
                                className="p-2 bg-muted rounded text-center font-mono text-sm cursor-pointer hover:bg-muted/80"
                                onClick={() => copyToClipboard(code)}
                              >
                                {code}
                              </div>
                            ))}
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="w-full"
                            onClick={() => copyAllBackupCodes(setupData.backupCodes)}
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Copiar Todos
                          </Button>
                        </>
                      )}
                    </div>

                    {/* Verificação */}
                    <div className="space-y-2 pt-4 border-t">
                      <label className="text-sm font-medium">
                        Digite o código do seu autenticador para confirmar
                      </label>
                      <Input
                        type="text"
                        placeholder="000000"
                        maxLength={6}
                        value={verifyToken}
                        onChange={(e) => setVerifyToken(e.target.value.replace(/\D/g, ''))}
                        className="text-center text-2xl tracking-widest"
                      />
                      <Button 
                        onClick={handleVerifySetup}
                        disabled={loading || verifyToken.length !== 6}
                        className="w-full"
                      >
                        {loading ? 'Verificando...' : 'Ativar 2FA'}
                      </Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </>
        )}
      </CardContent>
    </Card>
  );
}
