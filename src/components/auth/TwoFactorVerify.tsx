import { useState } from 'react';
import { Shield, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTwoFactor } from '@/hooks/useTwoFactor';

interface TwoFactorVerifyProps {
  onVerified: () => void;
  onCancel?: () => void;
}

export function TwoFactorVerify({ onVerified, onCancel }: TwoFactorVerifyProps) {
  const { loading, verify, verifyBackupCode } = useTwoFactor();
  const [token, setToken] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [activeTab, setActiveTab] = useState('totp');

  const handleVerifyTOTP = async () => {
    const success = await verify(token);
    if (success) {
      onVerified();
    }
  };

  const handleVerifyBackup = async () => {
    const success = await verifyBackupCode(backupCode);
    if (success) {
      onVerified();
    }
  };

  const formatBackupCode = (value: string) => {
    // Remove tudo exceto letras e números
    const cleaned = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    // Adiciona hífen após 4 caracteres
    if (cleaned.length > 4) {
      return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}`;
    }
    return cleaned;
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-primary/10 rounded-full">
            <Shield className="h-8 w-8 text-primary" />
          </div>
        </div>
        <CardTitle>Verificação em Duas Etapas</CardTitle>
        <CardDescription>
          Digite o código do seu aplicativo autenticador para continuar
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="totp" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Autenticador
            </TabsTrigger>
            <TabsTrigger value="backup" className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              Código Backup
            </TabsTrigger>
          </TabsList>

          <TabsContent value="totp" className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Código de 6 dígitos
              </label>
              <Input
                type="text"
                placeholder="000000"
                maxLength={6}
                value={token}
                onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))}
                className="text-center text-3xl tracking-[0.5em] font-mono"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && token.length === 6) {
                    handleVerifyTOTP();
                  }
                }}
              />
            </div>
            <Button 
              onClick={handleVerifyTOTP}
              disabled={loading || token.length !== 6}
              className="w-full"
            >
              {loading ? 'Verificando...' : 'Verificar'}
            </Button>
          </TabsContent>

          <TabsContent value="backup" className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Código de Backup
              </label>
              <Input
                type="text"
                placeholder="XXXX-XXXX"
                maxLength={9}
                value={backupCode}
                onChange={(e) => setBackupCode(formatBackupCode(e.target.value))}
                className="text-center text-2xl tracking-widest font-mono uppercase"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && backupCode.length === 9) {
                    handleVerifyBackup();
                  }
                }}
              />
              <p className="text-xs text-muted-foreground text-center">
                Use um dos seus códigos de backup salvos
              </p>
            </div>
            <Button 
              onClick={handleVerifyBackup}
              disabled={loading || backupCode.length !== 9}
              className="w-full"
            >
              {loading ? 'Verificando...' : 'Usar Código de Backup'}
            </Button>
          </TabsContent>
        </Tabs>

        {onCancel && (
          <Button 
            variant="ghost" 
            onClick={onCancel}
            className="w-full mt-4"
          >
            Cancelar
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
