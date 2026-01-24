import { useState, useEffect } from 'react';
import { Fingerprint, Smartphone, Laptop, Trash2, Plus, RefreshCw, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface WebAuthnCredential {
  id: string;
  name: string;
  device_type: string;
  created_at: string;
  last_used_at: string | null;
}

export function WebAuthnSettings() {
  const [credentials, setCredentials] = useState<WebAuthnCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCredential, setSelectedCredential] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // Verificar suporte WebAuthn
    setIsSupported(
      typeof window !== 'undefined' && 
      'PublicKeyCredential' in window &&
      typeof window.PublicKeyCredential === 'function'
    );
    fetchCredentials();
  }, []);

  const fetchCredentials = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('webauthn', {
        body: { action: 'list-credentials' },
      });

      if (error) throw error;
      setCredentials(data.credentials || []);
    } catch (error) {
      console.error('Erro ao buscar credenciais:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!isSupported) {
      toast.error('WebAuthn não é suportado neste navegador');
      return;
    }

    setRegistering(true);
    try {
      // Obter opções de registro
      const { data: optionsData, error: optionsError } = await supabase.functions.invoke('webauthn', {
        body: { action: 'register-options', attachment: 'platform' },
      });

      if (optionsError) throw optionsError;

      const options = optionsData.options;

      // Converter challenge para Uint8Array
      const challengeBuffer = Uint8Array.from(
        atob(options.challenge.replace(/-/g, '+').replace(/_/g, '/')),
        c => c.charCodeAt(0)
      );

      // Converter user.id para Uint8Array
      const userIdBuffer = Uint8Array.from(
        atob(options.user.id.replace(/-/g, '+').replace(/_/g, '/')),
        c => c.charCodeAt(0)
      );

      // Criar credencial
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: challengeBuffer,
          rp: options.rp,
          user: {
            ...options.user,
            id: userIdBuffer,
          },
          pubKeyCredParams: options.pubKeyCredParams,
          timeout: options.timeout,
          attestation: options.attestation,
          authenticatorSelection: options.authenticatorSelection,
          excludeCredentials: options.excludeCredentials?.map((c: { id: string; type: string }) => ({
            ...c,
            id: Uint8Array.from(atob(c.id.replace(/-/g, '+').replace(/_/g, '/')), ch => ch.charCodeAt(0)),
          })) || [],
        },
      }) as PublicKeyCredential;

      if (!credential) {
        throw new Error('Falha ao criar credencial');
      }

      const response = credential.response as AuthenticatorAttestationResponse;

      // Converter para base64url
      const credentialId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      
      const publicKey = btoa(String.fromCharCode(...new Uint8Array(response.getPublicKey() || new ArrayBuffer(0))))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

      // Verificar e salvar
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke('webauthn', {
        body: {
          action: 'register-verify',
          credential: {
            id: credentialId,
            publicKey,
            authenticatorAttachment: credential.authenticatorAttachment,
            transports: response.getTransports?.() || [],
          },
          name: deviceName || undefined,
        },
      });

      if (verifyError) throw verifyError;

      toast.success('Dispositivo registrado com sucesso!');
      setRegisterDialogOpen(false);
      setDeviceName('');
      fetchCredentials();
    } catch (error: any) {
      console.error('Erro ao registrar:', error);
      if (error.name === 'NotAllowedError') {
        toast.error('Operação cancelada pelo usuário');
      } else if (error.name === 'SecurityError') {
        toast.error('Erro de segurança. Verifique se está usando HTTPS.');
      } else {
        toast.error('Erro ao registrar dispositivo');
      }
    } finally {
      setRegistering(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCredential) return;

    try {
      const { error } = await supabase.functions.invoke('webauthn', {
        body: { action: 'remove-credential', credentialId: selectedCredential },
      });

      if (error) throw error;

      toast.success('Dispositivo removido');
      setDeleteDialogOpen(false);
      setSelectedCredential(null);
      fetchCredentials();
    } catch (error) {
      console.error('Erro ao remover:', error);
      toast.error('Erro ao remover dispositivo');
    }
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'platform':
        return <Fingerprint className="h-5 w-5" />;
      case 'cross-platform':
        return <Shield className="h-5 w-5" />;
      default:
        return <Smartphone className="h-5 w-5" />;
    }
  };

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fingerprint className="h-5 w-5" />
            Login Biométrico
          </CardTitle>
          <CardDescription>
            Use impressão digital, Face ID ou chave de segurança para login
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              Seu navegador não suporta autenticação biométrica (WebAuthn).
              Tente usar Chrome, Edge, Safari ou Firefox em versões recentes.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Fingerprint className="h-5 w-5" />
          Login Biométrico (WebAuthn)
        </CardTitle>
        <CardDescription>
          Use impressão digital, Face ID ou chave de segurança para login sem senha
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950">
          <Fingerprint className="h-4 w-4 text-blue-500" />
          <AlertDescription className="text-blue-700 dark:text-blue-300">
            O login biométrico oferece segurança máxima sem necessidade de digitar senhas.
          </AlertDescription>
        </Alert>

        {/* Lista de dispositivos */}
        {loading ? (
          <div className="flex justify-center py-4">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : credentials.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Fingerprint className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Nenhum dispositivo biométrico registrado</p>
          </div>
        ) : (
          <div className="space-y-3">
            {credentials.map((cred) => (
              <div 
                key={cred.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-primary/10 text-primary">
                    {getDeviceIcon(cred.device_type)}
                  </div>
                  <div>
                    <p className="font-medium">{cred.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Registrado em {format(new Date(cred.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </p>
                    {cred.last_used_at && (
                      <p className="text-xs text-muted-foreground">
                        Último uso: {formatDistanceToNow(new Date(cred.last_used_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    setSelectedCredential(cred.id);
                    setDeleteDialogOpen(true);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Botão de adicionar */}
        <Dialog open={registerDialogOpen} onOpenChange={setRegisterDialogOpen}>
          <Button 
            className="w-full" 
            onClick={() => setRegisterDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Dispositivo
          </Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Dispositivo Biométrico</DialogTitle>
              <DialogDescription>
                Use a biometria do seu dispositivo (impressão digital, Face ID) ou uma chave de segurança física.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="device-name">Nome do Dispositivo (opcional)</Label>
                <Input
                  id="device-name"
                  placeholder="Ex: iPhone Pessoal, MacBook do Trabalho"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                />
              </div>
              <Alert>
                <Fingerprint className="h-4 w-4" />
                <AlertDescription>
                  Ao clicar em "Registrar", seu navegador solicitará autenticação biométrica.
                </AlertDescription>
              </Alert>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRegisterDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleRegister} disabled={registering}>
                {registering ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Aguardando...
                  </>
                ) : (
                  <>
                    <Fingerprint className="h-4 w-4 mr-2" />
                    Registrar
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de confirmação de exclusão */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remover Dispositivo</DialogTitle>
              <DialogDescription>
                Tem certeza que deseja remover este dispositivo? Você não poderá mais usar a biometria deste dispositivo para login.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Remover
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
