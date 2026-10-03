import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOperationalLive } from '@/hooks/useOperationalLive';
import { JourneyTimer } from '@/components/operational/JourneyTimer';
import { useDriverGps } from '@/hooks/useDriverGps';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Building2, Bus, CalendarClock, Clock3, LogOut, MapPin, Navigation, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Terminal do motorista: login único do sistema, escalas do dia, horário
 * previsto, status e cronômetro da jornada. Não depende do robô local.
 */
export default function DriverTerminal() {
  const { user, profile, company, loading, signIn, signOut } = useAuth();
  const [form, setForm] = useState({ username: '', password: '', companyCode: '' });
  const [busy, setBusy] = useState(false);

  const profileId = (profile as { id?: string } | null)?.id ?? null;
  const companyId = (profile as { company_id?: string | null } | null)?.company_id ?? null;
  const name = (profile as { full_name?: string } | null)?.full_name ?? 'Motorista';
  const { schedules, updatedAt, refetch, loading: loadingOps } = useOperationalLive(undefined, profileId);
  const activeSchedule = schedules.find((schedule) => schedule.actualStartAt && !schedule.actualEndAt) ?? null;
  const { lastSentAt: gpsSentAt, error: gpsError } = useDriverGps({
    enabled: Boolean(user && activeSchedule),
    companyId,
    profileId,
    vehicleId: activeSchedule?.vehicleId ?? null,
    scheduleId: activeSchedule?.id ?? null,
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await signIn(form.username, form.password, form.companyCode);
    setBusy(false);
    if (error) toast.error('Não foi possível entrar', { description: error.message });
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Carregando...</div>;
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[image:var(--gradient-brand)]">
              <Bus className="h-7 w-7 text-white" />
            </div>
            <CardTitle>Terminal do Motorista</CardTitle>
            <CardDescription>Entre com o mesmo login do sistema para ver sua operação do dia.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleLogin}>
              <div className="space-y-2">
                <Label htmlFor="dt-company">Código da empresa</Label>
                <Input id="dt-company" value={form.companyCode} autoComplete="organization"
                  onChange={(e) => setForm({ ...form, companyCode: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dt-user">Usuário</Label>
                <Input id="dt-user" value={form.username} autoComplete="username"
                  onChange={(e) => setForm({ ...form, username: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dt-pass">Senha</Label>
                <Input id="dt-pass" type="password" value={form.password} autoComplete="current-password"
                  onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? 'Entrando...' : 'Entrar'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <header className="mx-auto mb-5 flex max-w-3xl items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold">Olá, {name}</h1>
          <p className="text-sm text-muted-foreground">
            Sua operação de hoje {updatedAt && `· atualizado ${updatedAt.toLocaleTimeString('pt-BR')}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void signOut()}>
            <LogOut className="mr-1 h-4 w-4" /> Sair
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-4">
        <section className="rounded-lg border bg-card p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><Building2 className="h-5 w-5" /></div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase text-muted-foreground">Empresa</p>
              <h2 className="truncate font-heading text-lg font-semibold">{company?.name ?? 'Empresa vinculada'}</h2>
              <p className="text-sm text-muted-foreground">Código {company?.company_code ?? '—'}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2">
            <div><p className="text-xs text-muted-foreground">Linha em andamento</p><p className="mt-1 flex items-center gap-2 font-semibold"><Bus className="h-4 w-4 text-primary" />{activeSchedule?.lineLabel ?? 'Nenhuma jornada iniciada'}</p></div>
            <div><p className="text-xs text-muted-foreground">Rota</p><p className="mt-1 flex items-start gap-2 font-semibold"><Navigation className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{activeSchedule ? [activeSchedule.lineOrigin, activeSchedule.lineDestination].filter(Boolean).join(' → ') || 'Rota não informada' : 'Aguardando início'}</p></div>
          </div>
        </section>
        <section className="grid grid-cols-2 gap-3 rounded-lg border bg-card p-3 sm:grid-cols-4">
          <div><p className="text-xs text-muted-foreground">Escalas hoje</p><p className="text-xl font-semibold">{schedules.length}</p></div>
          <div><p className="text-xs text-muted-foreground">Próximo horário</p><p className="flex items-center gap-1 font-semibold"><Clock3 className="h-4 w-4" /> {activeSchedule?.startTime ?? schedules[0]?.startTime ?? '—'}</p></div>
          <div><p className="text-xs text-muted-foreground">Operação</p><p className="font-semibold">{activeSchedule ? 'Em andamento' : 'A iniciar'}</p></div>
          <div><p className="text-xs text-muted-foreground">Localização</p><p className="flex items-center gap-1 font-semibold"><MapPin className="h-4 w-4" /> {gpsError ? 'Indisponível' : activeSchedule ? 'Ativa' : 'Aguardando'}</p></div>
        </section>
        {activeSchedule && (
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <span>GPS do terminal ativo · {activeSchedule.vehicleLabel} · {activeSchedule.lineLabel}</span>
              <Badge variant={gpsError ? 'destructive' : 'secondary'}>
                {gpsError ? 'GPS sem envio' : gpsSentAt ? `Enviado ${gpsSentAt.toLocaleTimeString('pt-BR')}` : 'Obtendo posição'}
              </Badge>
            </CardContent>
          </Card>
        )}
        {loadingOps && <p className="text-sm text-muted-foreground">Carregando escalas...</p>}
        {!loadingOps && schedules.length === 0 && (
          <Card><CardContent className="py-10 text-center text-muted-foreground">
            Nenhuma escala para você hoje.
          </CardContent></Card>
        )}
        {schedules.map((s) => (
          <div key={s.id} className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline"><CalendarClock className="mr-1 h-3.5 w-3.5" /> Previsto {s.startTime} – {s.endTime}</Badge>
              <Badge variant={s.actualStartAt && !s.actualEndAt ? 'default' : 'outline'}>{s.actualEndAt ? 'Concluída' : s.actualStartAt ? 'Em andamento' : s.status}</Badge>
            </div>
            <JourneyTimer schedule={s} profileId={profileId} onChange={() => void refetch()} />
          </div>
        ))}
      </div>
    </main>
  );
}
