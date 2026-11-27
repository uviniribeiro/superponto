import { TERMINAL_URL } from '@/lib/adminHost';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { CheckCircle2, MapPin, MonitorSmartphone, ShieldCheck, Users, XCircle, Power } from 'lucide-react';
import { useSEO } from '@/hooks/useSEO';

interface Terminal {
  id: string;
  name: string;
  status: string;
  is_active: boolean;
  activation_code: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  allow_all_employees: boolean;
  last_used_at: string | null;
  created_at: string;
}

interface Profile { id: string; full_name: string; registration_number: string | null; department: string | null }

export default function KioskTerminals() {
  useSEO({
    title: 'Terminais de Ponto | Ponto Max',
    description: 'Autorize terminais de ponto, veja a localização de cada um e defina quais funcionários podem usá-los.',
  });

  const { user, isAdmin } = useAuth();
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Terminal | null>(null);
  const [authorized, setAuthorized] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: t }, { data: p }] = await Promise.all([
      supabase.from('kiosk_terminals').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, full_name, registration_number, department').eq('is_active', true).order('full_name'),
    ]);
    setTerminals((t as Terminal[]) || []);
    setProfiles((p as Profile[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (terminal: Terminal, status: 'approved' | 'rejected') => {
    const { error } = await supabase.from('kiosk_terminals').update({
      status,
      approved_by: user?.id ?? null,
      approved_at: new Date().toISOString(),
      is_active: status === 'approved',
    }).eq('id', terminal.id);
    if (error) return toast.error('Não foi possível atualizar o terminal.');
    toast.success(status === 'approved' ? 'Terminal liberado para uso.' : 'Terminal recusado.');
    load();
  };

  const toggleActive = async (terminal: Terminal) => {
    const { error } = await supabase.from('kiosk_terminals').update({ is_active: !terminal.is_active }).eq('id', terminal.id);
    if (error) return toast.error('Não foi possível alterar o terminal.');
    load();
  };

  const openAuthorization = async (terminal: Terminal) => {
    setSelected(terminal);
    const { data } = await supabase.from('kiosk_terminal_employees').select('profile_id').eq('terminal_id', terminal.id);
    setAuthorized(new Set((data || []).map(r => r.profile_id)));
  };

  const saveAuthorization = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const { data: company } = await supabase.from('profiles').select('company_id').eq('user_id', user?.id ?? '').maybeSingle();
      const companyId = company?.company_id;
      await supabase.from('kiosk_terminal_employees').delete().eq('terminal_id', selected.id);
      if (authorized.size > 0 && companyId) {
        await supabase.from('kiosk_terminal_employees').insert(
          Array.from(authorized).map(profile_id => ({
            terminal_id: selected.id, profile_id, company_id: companyId, created_by: user?.id ?? null,
          }))
        );
      }
      await supabase.from('kiosk_terminals')
        .update({ allow_all_employees: selected.allow_all_employees })
        .eq('id', selected.id);
      toast.success('Funcionários autorizados atualizados.');
      setSelected(null);
      load();
    } catch {
      toast.error('Não foi possível salvar as autorizações.');
    } finally {
      setSaving(false);
    }
  };

  const filteredProfiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter(p => `${p.full_name} ${p.registration_number ?? ''} ${p.department ?? ''}`.toLowerCase().includes(q));
  }, [profiles, search]);

  if (!isAdmin) {
    return <p className="text-muted-foreground">Apenas administradores podem gerenciar terminais de ponto.</p>;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <MonitorSmartphone className="h-6 w-6 text-primary" /> Terminais de Ponto
        </h1>
        <p className="text-sm text-muted-foreground">
          Nenhum terminal funciona antes da sua liberação. Aqui você aprova o dispositivo, confere onde ele está
          instalado e escolhe quais funcionários aparecem nele.
        </p>
      </header>

      <Card className="rounded-3xl">
        <CardContent className="flex flex-wrap items-center gap-5 p-5">
          <div className="min-w-[260px] flex-1 space-y-1">
            <p className="font-semibold">App SuperPonto Terminal (independente do sistema)</p>
            <p className="text-sm text-muted-foreground">
              No tablet, abra <a className="font-medium text-primary underline" href={TERMINAL_URL} target="_blank" rel="noreferrer">{TERMINAL_URL.replace('https://', '')}</a> e
              instale ("Adicionar à tela inicial"). Informe o CNPJ: o app reconhece sozinho se a empresa usa a v1 ou a v2.
              Funciona com QR Code, código de barras, PIN, matrícula, CPF e reconhecimento facial, e guarda as marcações quando fica sem internet.
            </p>
          </div>
          <Button variant="outline" onClick={() => { navigator.clipboard?.writeText(TERMINAL_URL); toast.success('Endereço copiado'); }}>Copiar endereço</Button>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-3">{[0, 1].map(i => <Skeleton key={i} className="h-28 w-full" />)}</div>
      ) : terminals.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          Nenhum terminal solicitou ativação ainda. Abra <strong>{TERMINAL_URL.replace('https://', '')}</strong> no tablet e informe o CNPJ da empresa.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {terminals.map(t => (
            <Card key={t.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{t.name}</CardTitle>
                    <CardDescription className="space-y-0.5">
                      <span className="block">Solicitado em {new Date(t.created_at).toLocaleString('pt-BR')}</span>
                      {t.activation_code && <span className="block">Código de conferência: <strong>{t.activation_code}</strong></span>}
                      {(t.latitude != null && t.longitude != null) && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {t.address || `${t.latitude.toFixed(5)}, ${t.longitude.toFixed(5)}`}
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <Badge variant={t.status === 'approved' ? 'default' : t.status === 'rejected' ? 'destructive' : 'secondary'}>
                    {t.status === 'approved' ? 'Liberado' : t.status === 'rejected' ? 'Recusado' : 'Aguardando liberação'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2">
                {t.status !== 'approved' && (
                  <Button size="sm" onClick={() => setStatus(t, 'approved')}>
                    <ShieldCheck className="mr-2 h-4 w-4" /> Autorizar conexão
                  </Button>
                )}
                {t.status !== 'rejected' && (
                  <Button size="sm" variant="outline" onClick={() => setStatus(t, 'rejected')}>
                    <XCircle className="mr-2 h-4 w-4" /> Recusar
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => openAuthorization(t)}>
                  <Users className="mr-2 h-4 w-4" /> Funcionários autorizados
                </Button>
                <Button size="sm" variant="ghost" onClick={() => toggleActive(t)}>
                  <Power className="mr-2 h-4 w-4" /> {t.is_active ? 'Desativar' : 'Reativar'}
                </Button>
                {t.allow_all_employees && (
                  <Badge variant="outline" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Todos os funcionários</Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Funcionários autorizados</DialogTitle>
            <DialogDescription>
              Somente quem estiver marcado aqui poderá se identificar e registrar ponto neste terminal.
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label htmlFor="allow-all" className="text-sm">Liberar para todos os funcionários da empresa</Label>
                <Switch
                  id="allow-all"
                  checked={selected.allow_all_employees}
                  onCheckedChange={(v) => setSelected({ ...selected, allow_all_employees: v })}
                />
              </div>

              {!selected.allow_all_employees && (
                <>
                  <Input placeholder="Buscar funcionário" value={search} onChange={(e) => setSearch(e.target.value)} />
                  <ScrollArea className="h-72 rounded-md border">
                    <div className="divide-y">
                      {filteredProfiles.map(p => (
                        <label key={p.id} className="flex cursor-pointer items-center gap-3 p-3 text-sm hover:bg-muted/50">
                          <Checkbox
                            checked={authorized.has(p.id)}
                            onCheckedChange={(v) => {
                              const next = new Set(authorized);
                              if (v) next.add(p.id); else next.delete(p.id);
                              setAuthorized(next);
                            }}
                          />
                          <span className="flex-1">
                            {p.full_name}
                            <span className="block text-xs text-muted-foreground">
                              {[p.registration_number && `Matrícula ${p.registration_number}`, p.department].filter(Boolean).join(' · ')}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </ScrollArea>
                  <p className="text-xs text-muted-foreground">{authorized.size} funcionário(s) selecionado(s)</p>
                </>
              )}

              <Button className="w-full" onClick={saveAuthorization} disabled={saving}>Salvar autorizações</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
