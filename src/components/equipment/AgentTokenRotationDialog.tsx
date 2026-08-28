import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Copy, KeyRound, ShieldCheck, TimerReset } from 'lucide-react';
import type { CommunicationAgent } from '@/hooks/useCommunicationAgents';

interface Props {
  agent: CommunicationAgent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStart: (input: { agent: CommunicationAgent; windowMinutes: number }) => Promise<{ token: string; expiresAt: string }>;
  onCancel: (agentId: string) => void;
  onSavePolicy: (input: {
    agentId: string;
    enabled: boolean;
    intervalDays: number;
    maxAgeDays: number;
    renewBeforeDays: number;
  }) => void;
  isBusy?: boolean;
}

const countdown = (target?: string | null) => {
  if (!target) return null;
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return 'expirada';
  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
};

export function AgentTokenRotationDialog({
  agent,
  open,
  onOpenChange,
  onStart,
  onCancel,
  onSavePolicy,
  isBusy,
}: Props) {
  const [windowMinutes, setWindowMinutes] = useState('60');
  const [autoRotation, setAutoRotation] = useState(false);
  const [intervalDays, setIntervalDays] = useState('90');
  const [maxAgeDays, setMaxAgeDays] = useState('90');
  const [renewBeforeDays, setRenewBeforeDays] = useState('7');
  const [newToken, setNewToken] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
     if (!agent) return;
     setAutoRotation(!!agent.token_auto_rotation);
     setIntervalDays(String(agent.token_rotation_interval_days ?? 90));
     setMaxAgeDays(String(agent.token_max_age_days ?? 90));
     setRenewBeforeDays(String(agent.token_renew_before_days ?? 7));
     setNewToken(null);
  }, [agent?.id, open]);

  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [open]);

  if (!agent) return null;

  const pending = agent.token_rotation_status === 'pending' && !!agent.pending_token_expires_at;
  const remaining = countdown(agent.pending_token_expires_at);
  void tick;

  const handleStart = async () => {
    const result = await onStart({ agent, windowMinutes: Number(windowMinutes) });
    setNewToken(result.token);
  };

  const copy = () => {
    if (!newToken) return;
    navigator.clipboard.writeText(newToken);
    toast({ title: 'Novo token copiado', description: 'Configure o robô antes da janela expirar.' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Rotação de token — {agent.name}
          </DialogTitle>
          <DialogDescription>
            O token novo só substitui o atual depois que o robô se autenticar com ele. Nada é
            interrompido durante a janela de transição.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant={pending ? 'secondary' : 'default'}>
              {pending ? 'Rotação em andamento' : 'Token estável'}
            </Badge>
            {agent.token_rotated_at && (
              <span className="text-muted-foreground">
                Última troca: {new Date(agent.token_rotated_at).toLocaleString('pt-BR')}
              </span>
            )}
          </div>

          {pending && (
            <Alert>
              <TimerReset className="h-4 w-4" />
              <AlertTitle>Janela de transição ativa</AlertTitle>
              <AlertDescription>
                Tempo restante: <strong>{remaining}</strong>. O token antigo continua funcionando até a
                validação. Após validar, ele ainda é aceito por 30 minutos de tolerância.
              </AlertDescription>
            </Alert>
          )}

          {newToken && (
            <Alert>
              <ShieldCheck className="h-4 w-4" />
              <AlertTitle>Novo token (exibido apenas uma vez)</AlertTitle>
              <AlertDescription className="mt-2 flex flex-col gap-2">
                <code className="break-all rounded-lg bg-muted px-3 py-2 text-xs">{newToken}</code>
                <Button size="sm" variant="outline" onClick={copy} className="self-start">
                  <Copy className="mr-2 h-4 w-4" />
                  Copiar
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {!pending && (
            <div className="space-y-2">
              <Label>Janela de transição</Label>
              <Select value={windowMinutes} onValueChange={setWindowMinutes}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutos</SelectItem>
                  <SelectItem value="60">1 hora</SelectItem>
                  <SelectItem value="240">4 horas</SelectItem>
                  <SelectItem value="1440">24 horas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

           <div className="rounded-xl border p-3">
             <div className="flex items-center justify-between gap-3">
               <div>
                 <Label className="text-sm">Rotação automática</Label>
                 <p className="text-xs text-muted-foreground">
                   O sistema emite um token novo periodicamente e o robô troca sozinho, com validação.
                 </p>
               </div>
               <Switch checked={autoRotation} onCheckedChange={setAutoRotation} />
             </div>
             <div className="mt-3 grid gap-3 sm:grid-cols-3">
               <div className="space-y-2">
                 <Label className="text-xs">Validade máxima (dias)</Label>
                 <Input
                   type="number"
                   min={1}
                   max={730}
                   value={maxAgeDays}
                   onChange={(event) => setMaxAgeDays(event.target.value)}
                 />
               </div>
               <div className="space-y-2">
                 <Label className="text-xs">Renovar antes (dias)</Label>
                 <Input
                   type="number"
                   min={1}
                   max={30}
                   value={renewBeforeDays}
                   onChange={(event) => setRenewBeforeDays(event.target.value)}
                 />
               </div>
               {autoRotation && (
                 <div className="space-y-2">
                   <Label className="text-xs">Intervalo (dias)</Label>
                   <Input
                     type="number"
                     min={1}
                     max={365}
                     value={intervalDays}
                     onChange={(event) => setIntervalDays(event.target.value)}
                   />
                 </div>
               )}
             </div>
             <p className="mt-2 text-xs text-muted-foreground">
               Token atual: {agent.token_expires_at ? `expira em ${new Date(agent.token_expires_at).toLocaleString('pt-BR')}` : 'sem validade configurada'}.
             </p>
             {autoRotation && agent.next_token_rotation_at && (
               <p className="mt-1 text-xs text-muted-foreground">
                 Próxima rotação prevista: {new Date(agent.next_token_rotation_at).toLocaleString('pt-BR')}
               </p>
             )}
             <Button
               size="sm"
               variant="outline"
               className="mt-3"
               onClick={() =>
                 onSavePolicy({
                   agentId: agent.id,
                   enabled: autoRotation,
                   intervalDays: Math.min(365, Math.max(1, Number(intervalDays) || 90)),
                   maxAgeDays: Math.min(730, Math.max(1, Number(maxAgeDays) || 90)),
                   renewBeforeDays: Math.min(30, Math.max(1, Number(renewBeforeDays) || 7)),
                 })
               }
             >
               Salvar política
             </Button>
           </div>
        </div>

        <DialogFooter className="gap-2">
          {pending ? (
            <Button variant="destructive" onClick={() => onCancel(agent.id)} disabled={isBusy}>
              Cancelar rotação
            </Button>
          ) : (
            <Button onClick={handleStart} disabled={isBusy}>
              <KeyRound className="mr-2 h-4 w-4" />
              Gerar novo token
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
