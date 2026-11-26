import { useState } from 'react';
import { KeyRound, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Chave do equipamento para o agente local + servidor de comunicação (mesmo protocolo da v2).
 * A chave (spd_…) aparece uma única vez; o banco guarda só o SHA-256. Gerar de novo invalida a anterior.
 */
export function AgentKeyButton({ equipmentId, name }: { equipmentId: string; name: string }) {
  const [key, setKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    if (!confirm(`Gerar uma nova chave do agente para "${name}"? A chave anterior deixa de funcionar.`)) return;
    setBusy(true);
    try {
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      const k = 'spd_' + btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(k)))).map((b) => b.toString(16).padStart(2, '0')).join('');
      const { error } = await supabase.from('time_clock_equipment').update({ agent_key_hash: hash } as never).eq('id', equipmentId);
      if (error) throw error;
      setKey(k);
    } catch (e) {
      toast.error('Não foi possível gerar a chave', { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="ghost" size="icon" onClick={generate} disabled={busy} title="Chave do agente (servidor de comunicação)">
        <KeyRound className="h-4 w-4" />
      </Button>
      <Dialog open={!!key} onOpenChange={(o) => !o && setKey(null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Chave do agente — {name}</DialogTitle>
            <DialogDescription>
              Configure esta chave no agente local (driver do relógio). Ele fala com o servidor de comunicação, que repassa ao sistema.
              Anote agora: ela não aparece de novo.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-2xl border bg-muted/50 p-3">
            <code className="flex-1 break-all text-xs">{key}</code>
            <Button size="icon" variant="ghost" onClick={() => { navigator.clipboard.writeText(key ?? ''); toast.success('Chave copiada'); }} title="Copiar"><Copy className="h-4 w-4" /></Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
