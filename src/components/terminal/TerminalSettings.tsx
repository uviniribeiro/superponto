// Configuração do terminal (protegida pela senha do administrador no aparelho):
// finalidade (ponto, refeitório ou portaria), catraca com busca automática na rede local, sentido da
// portaria, cartão NFC sem rosto, atalhos do sistema (Wi-Fi, configurações) e informações do aparelho.
import { useEffect, useState } from 'react';
import { Clock, DoorOpen, Loader2, Radar, Settings2, ShieldCheck, UtensilsCrossed, Wifi, X, Nfc, LogOut, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { deviceInfo, exitKiosk, isNativeTerminal, openSystemSettings, openWifiSettings, scanLan, hashPin } from '@/lib/terminalDevice';
import { unlockTurnstile, turnstileOnline, type TurnstileConfig } from '@/lib/turnstile';

export type TerminalPurpose = 'punch' | 'meal' | 'gate';
export interface TerminalConfig {
  name: string;
  purpose: TerminalPurpose;
  turnstile: TurnstileConfig | null;
  gateDirection: 'auto' | 'in' | 'out';
  cardWithoutFace: boolean;
}

const PURPOSES: { key: TerminalPurpose; label: string; desc: string; icon: typeof Clock }[] = [
  { key: 'punch', label: 'Registro de ponto', desc: 'Entrada, intervalo e saída (como hoje)', icon: Clock },
  { key: 'meal', label: 'Controle de refeitório', desc: 'Refeição do horário + catraca do refeitório', icon: UtensilsCrossed },
  { key: 'gate', label: 'Controle de portaria', desc: 'Entrada e saída + catraca da portaria', icon: DoorOpen },
];

export function TerminalSettings({ initial, onSave, onClose, onDeactivate, version }: {
  initial: TerminalConfig;
  onSave: (c: TerminalConfig, newPin?: string) => Promise<void>;
  onClose?: () => void;
  onDeactivate?: () => void;
  version?: string;
}) {
  const [c, setC] = useState<TerminalConfig>(initial);
  const [info, setInfo] = useState<{ ip: string | null; model: string; android: string; nfc: boolean } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [found, setFound] = useState<{ ip: string; kind: string }[] | null>(null);
  const [pin, setPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const gate = c.turnstile ?? { vendor: 'controlid' as const, entry: 'clockwise' as const, exitButton: true, offlineUnlock: true };
  const setGate = (g: Partial<TurnstileConfig>) => setC({ ...c, turnstile: { ...gate, ...g } as TurnstileConfig });
  const needsGate = c.purpose !== 'punch';

  useEffect(() => { deviceInfo().then(setInfo); }, []);

  const scan = async () => {
    setScanning(true);
    setFound(null);
    try {
      const r = await scanLan();
      setFound(r.devices.sort((a, b) => (a.kind === 'controlid' ? -1 : 1) - (b.kind === 'controlid' ? -1 : 1)));
      if (!r.devices.length) toast.info(`Nenhum equipamento encontrado na rede ${r.ip.replace(/\.\d+$/, '.x')}.`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Não foi possível procurar na rede.');
    } finally {
      setScanning(false);
    }
  };

  const test = async () => {
    setTesting(true);
    const cfg = { ...gate, vendor: gate.vendor === 'none' ? 'controlid' : gate.vendor } as TurnstileConfig;
    const online = await turnstileOnline(cfg);
    const ok = await unlockTurnstile(cfg, 'entry');
    setTesting(false);
    if (ok) toast.success('Catraca liberada! Comunicação funcionando.');
    else toast.error(online === false ? 'A catraca não aceitou o usuário/senha ou não respondeu.' : 'A catraca não respondeu ao comando.');
  };

  const save = async () => {
    if (pin && !/^\d{4,8}$/.test(pin)) return toast.error('A senha do administrador deve ter de 4 a 8 números.');
    if (needsGate && c.turnstile && c.turnstile.vendor !== 'none' && !c.turnstile.host?.trim()) return toast.error('Informe ou escolha o endereço da catraca.');
    setSaving(true);
    try {
      await onSave({ ...c, turnstile: needsGate || c.turnstile?.onPunch ? c.turnstile : c.turnstile }, pin || undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-background">
      <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
        <div className="flex items-center gap-3">
          <Settings2 className="h-7 w-7 text-primary" />
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Configuração do terminal</h1>
            <p className="text-sm text-muted-foreground">{info ? `${info.model}${info.android ? ` · Android ${info.android}` : ''}${info.ip ? ` · IP ${info.ip}` : ''}` : '…'}{version ? ` · ${version === 'v2' ? 'SuperPonto v2' : 'SuperPonto v1'}` : ''}</p>
          </div>
          {onClose && <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar"><X className="h-5 w-5" /></Button>}
        </div>

        <section className="space-y-3">
          <Label className="text-base">Nome do terminal</Label>
          <Input value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} placeholder="Ex.: Portaria principal" />
        </section>

        <section className="space-y-3">
          <Label className="text-base">O que este terminal faz</Label>
          <div className="grid gap-3 md:grid-cols-3">
            {PURPOSES.map(({ key, label, desc, icon: Icon }) => (
              <button key={key} type="button" onClick={() => setC({ ...c, purpose: key, turnstile: key !== 'punch' && !c.turnstile ? { vendor: 'controlid', entry: 'clockwise', exitButton: true, offlineUnlock: true } : c.turnstile })}
                className={`rounded-2xl border p-4 text-left transition ${c.purpose === key ? 'border-primary bg-primary/10 ring-2 ring-primary/30' : 'hover:bg-muted'}`}>
                <Icon className="mb-2 h-7 w-7 text-primary" />
                <p className="font-semibold">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </button>
            ))}
          </div>
        </section>

        {needsGate && (
          <section className="space-y-4 rounded-2xl border p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">Catraca {c.purpose === 'meal' ? 'do refeitório' : 'da portaria'}</p>
                <p className="text-xs text-muted-foreground">O terminal libera a catraca na hora, pela rede local.</p>
              </div>
              <Switch checked={!!c.turnstile && c.turnstile.vendor !== 'none'} onCheckedChange={(v) => setC({ ...c, turnstile: v ? { ...gate, vendor: gate.vendor === 'none' ? 'controlid' : gate.vendor } : null })} />
            </div>
            {c.turnstile && c.turnstile.vendor !== 'none' && (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={scan} disabled={scanning || !isNativeTerminal()}>
                    {scanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Radar className="mr-2 h-4 w-4" />}
                    {scanning ? 'Procurando na rede…' : 'Procurar catraca na rede'}
                  </Button>
                  {!isNativeTerminal() && <span className="self-center text-xs text-muted-foreground">A busca automática funciona no app do terminal (APK). Aqui, digite o IP.</span>}
                </div>
                {found && found.length > 0 && (
                  <div className="grid gap-2">
                    {found.map((d) => (
                      <button key={d.ip} type="button" onClick={() => setGate({ host: d.ip, vendor: d.kind === 'controlid' ? 'controlid' : 'http' })}
                        className={`flex items-center justify-between rounded-xl border p-3 text-left ${gate.host === d.ip ? 'border-primary bg-primary/10' : 'hover:bg-muted'}`}>
                        <span className="font-mono">{d.ip}</span>
                        <span className="text-sm text-muted-foreground">{d.kind === 'controlid' ? 'Control iD (catraca/acesso)' : 'Equipamento com HTTP'}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="grid gap-1"><Label>Tipo</Label>
                    <select className="h-10 rounded-md border bg-background px-3" value={gate.vendor} onChange={(e) => setGate({ vendor: e.target.value as TurnstileConfig['vendor'] })}>
                      <option value="controlid">Control iD (iDBlock, iDFlex…)</option>
                      <option value="http">HTTP genérico (placa de relé)</option>
                    </select>
                  </div>
                  <div className="grid gap-1"><Label>{gate.vendor === 'controlid' ? 'IP da catraca' : 'URL de liberação da entrada'}</Label><Input value={gate.host ?? ''} onChange={(e) => setGate({ host: e.target.value })} placeholder={gate.vendor === 'controlid' ? '192.168.0.50' : 'http://192.168.0.60/relay/0?turn=on'} /></div>
                  {gate.vendor === 'controlid' ? (
                    <>
                      <div className="grid gap-1"><Label>Usuário</Label><Input value={gate.login ?? ''} onChange={(e) => setGate({ login: e.target.value })} placeholder="admin" /></div>
                      <div className="grid gap-1"><Label>Senha</Label><Input type="password" value={gate.password ?? ''} onChange={(e) => setGate({ password: e.target.value })} placeholder="admin" /></div>
                      <div className="grid gap-1"><Label>Sentido da entrada</Label>
                        <select className="h-10 rounded-md border bg-background px-3" value={gate.entry ?? 'clockwise'} onChange={(e) => setGate({ entry: e.target.value as TurnstileConfig['entry'] })}>
                          <option value="clockwise">Horário</option><option value="anticlockwise">Anti-horário</option><option value="both">Os dois</option>
                        </select>
                      </div>
                    </>
                  ) : (
                    <div className="grid gap-1"><Label>URL de liberação da saída (opcional)</Label><Input value={gate.exitUrl ?? ''} onChange={(e) => setGate({ exitUrl: e.target.value })} /></div>
                  )}
                </div>
                <div className="space-y-2 text-sm">
                  <label className="flex items-center justify-between gap-3">Botão "Liberar saída" na tela<Switch checked={gate.exitButton !== false} onCheckedChange={(v) => setGate({ exitButton: v })} /></label>
                  <label className="flex items-center justify-between gap-3">Sem internet, liberar mesmo assim<Switch checked={gate.offlineUnlock !== false} onCheckedChange={(v) => setGate({ offlineUnlock: v })} /></label>
                </div>
                <Button variant="outline" onClick={test} disabled={testing || !gate.host}>{testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}Testar liberação</Button>
              </>
            )}
          </section>
        )}

        {c.purpose === 'gate' && (
          <section className="space-y-3 rounded-2xl border p-4">
            <p className="font-semibold">Sentido da portaria</p>
            <div className="grid grid-cols-3 gap-2">
              {([['auto', 'Automático (alterna)'], ['in', 'Só entrada'], ['out', 'Só saída']] as const).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setC({ ...c, gateDirection: k })} className={`rounded-xl border p-3 text-sm font-medium ${c.gateDirection === k ? 'border-primary bg-primary/10' : 'hover:bg-muted'}`}>{l}</button>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-3 rounded-2xl border p-4">
          <div className="flex items-center gap-2"><Nfc className="h-5 w-5 text-primary" /><p className="font-semibold">Cartão NFC (MIFARE)</p></div>
          <p className="text-sm text-muted-foreground">{info?.nfc ? 'Este aparelho tem NFC: o funcionário aproxima o cartão da parte de trás do terminal, como um cartão por aproximação.' : 'Este aparelho não tem NFC (ou ele está desligado). Os cartões funcionam em terminais com NFC.'}</p>
          {needsGate && (
            <label className="flex items-center justify-between gap-3 text-sm">Cartão libera sem conferir o rosto (como numa catraca convencional)<Switch checked={c.cardWithoutFace} onCheckedChange={(v) => setC({ ...c, cardWithoutFace: v })} /></label>
          )}
          {!needsGate && <p className="text-xs text-muted-foreground">No registro de ponto o rosto é sempre conferido depois do cartão.</p>}
        </section>

        <section className="space-y-3 rounded-2xl border p-4">
          <p className="font-semibold">Senha do administrador do terminal</p>
          <p className="text-sm text-muted-foreground">Pedida para abrir esta tela (toque e segure o relógio por 3 segundos). Deixe em branco para manter.</p>
          <Input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="Nova senha (4 a 8 números)" className="max-w-xs" />
        </section>

        {isNativeTerminal() && (
          <section className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => openWifiSettings()}><Wifi className="mr-2 h-4 w-4" />Wi-Fi</Button>
            <Button variant="outline" onClick={() => openSystemSettings()}><Settings2 className="mr-2 h-4 w-4" />Configurações do Android</Button>
            <Button variant="outline" onClick={() => exitKiosk().then(() => toast.info('Modo quiosque desligado até reabrir o app.'))}>Sair do modo quiosque</Button>
          </section>
        )}

        <div className="flex flex-wrap justify-between gap-2 border-t pt-4">
          {onDeactivate ? <Button variant="ghost" className="text-destructive" onClick={() => { if (confirm('Desativar este terminal? Será preciso ativar de novo com o CNPJ.')) onDeactivate(); }}><LogOut className="mr-2 h-4 w-4" />Desativar terminal</Button> : <span />}
          <Button size="lg" onClick={save} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Salvar configuração</Button>
        </div>
      </div>
    </div>
  );
}

export { hashPin };
