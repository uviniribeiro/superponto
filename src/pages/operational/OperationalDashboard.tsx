import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, AlertTriangle, Bus, CalendarClock, FileSpreadsheet, Gauge, Route, ShieldCheck, Users } from 'lucide-react';
import { useOperationalStore } from '@/hooks/useOperationalStore';
import { OperationalLivePanel } from '@/components/operational/OperationalLivePanel';


export default function OperationalDashboard() {
  const navigate = useNavigate();
  const { data } = useOperationalStore();
  const today = new Date().toISOString().slice(0, 10);

  const stats = useMemo(() => {
    const todaySchedules = data.schedules.filter((s) => s.date === today);
    return [
      { label: 'Escalas de hoje', value: todaySchedules.length, icon: CalendarClock, hint: `${todaySchedules.filter((s) => s.status === 'em_andamento').length} em andamento` },
      { label: 'Motoristas ativos', value: data.drivers.filter((d) => d.status === 'ativo').length, icon: Users, hint: `${data.drivers.length} cadastrados` },
      { label: 'Veículos operando', value: data.vehicles.filter((v) => v.status === 'operando').length, icon: Bus, hint: `${data.vehicles.filter((v) => v.status === 'manutencao').length} em manutenção` },
      { label: 'Linhas ativas', value: data.lines.filter((l) => l.active).length, icon: Route, hint: `${data.services.length} serviços` },
    ];
  }, [data, today]);

  const openOccurrences = data.occurrences.filter((o) => !o.resolved);

  const todaySchedules = data.schedules.filter((s) => s.date === today);
  const withoutDriver = todaySchedules.filter((s) => !s.driverId);
  const late = todaySchedules
    .filter((s) => s.driverId)
    .map((s) => {
      const first = data.timeRecords
        .filter((r) => r.profileId === s.driverId && r.recordedAt.slice(0, 10) === today)
        .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))[0];
      const [ph, pm] = s.startTime.split(':').map(Number);
      const planned = ph * 60 + pm;
      const name = data.drivers.find((d) => d.id === s.driverId)?.name ?? 'Motorista';
      if (!first) {
        const now = new Date();
        const minutes = now.getHours() * 60 + now.getMinutes() - planned;
        return minutes > 5 ? { id: s.id, name, minutes, text: 'sem batida de ponto' } : null;
      }
      const rec = new Date(first.recordedAt);
      const minutes = rec.getHours() * 60 + rec.getMinutes() - planned;
      return minutes > 5 ? { id: s.id, name, minutes, text: 'entrou depois do horário' } : null;
    })
    .filter(Boolean) as { id: string; name: string; minutes: number; text: string }[];

  const shortcuts = [
    { title: 'Escalas', description: 'Planejar motorista, veículo, linha e serviço.', icon: CalendarClock, to: '/operational/schedules' },
    { title: 'Operação do Dia', description: 'Acompanhar a operação e trocar motorista.', icon: Gauge, to: '/operational/day' },
    { title: 'Ponto x Escala', description: 'Conferir atrasos entre escala e batida de ponto.', icon: AlertTriangle, to: '/operational/time-check' },
    { title: 'Motoristas', description: 'Cadastro operacional, CNH e situação.', icon: Users, to: '/operational/drivers' },
    { title: 'Veículos', description: 'Frota, garagem e disponibilidade.', icon: Bus, to: '/operational/vehicles' },
    { title: 'Linhas e Serviços', description: 'Itinerários, horários e viagens.', icon: Route, to: '/operational/lines' },
    { title: 'Permissões', description: 'Quem pode escalar, trocar e alterar ocorrências.', icon: ShieldCheck, to: '/operational/permissions' },
    { title: 'Alertas Operacionais', description: 'Bloqueios, permissões e falhas de comunicação.', icon: AlertCircle, to: '/operational/alerts' },
    { title: 'Jornadas por Linha', description: 'Horários, distância, paradas e exportação Excel.', icon: FileSpreadsheet, to: '/operational/line-report' },
  ];


  return (
    <div className="container mx-auto px-4 py-6">
      <PageHeader
        title="Controle Operacional"
        description="Visão da operação do dia: escalas, motoristas, frota e ocorrências."
        icon={Gauge}
        actions={<Button size="sm" onClick={() => navigate('/operational/day')}>Operação do dia</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, hint }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="font-heading text-3xl font-semibold">{value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Motoristas atrasados hoje</CardTitle>
            <CardDescription>Comparação entre o horário da escala e a batida de ponto.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {late.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Nenhum atraso identificado.</p>
            ) : late.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-2 rounded-xl border border-border/60 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{l.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{l.text}</p>
                </div>
                <Badge variant="destructive">+{l.minutes} min</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Escalas sem motorista</CardTitle>
            <CardDescription>Serviços do dia que ainda precisam de alguém escalado.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {withoutDriver.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Todas as escalas têm motorista.</p>
            ) : withoutDriver.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 rounded-xl border border-border/60 p-3">
                <p className="truncate text-sm font-medium">
                  {data.lines.find((l) => l.id === s.lineId)?.name ?? 'Linha não informada'}
                </p>
                <Badge variant="secondary">{s.startTime}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">

        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Ocorrências em aberto
          </CardTitle>
          <CardDescription>Situações que ainda precisam de tratamento pela equipe de tráfego.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {openOccurrences.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma ocorrência em aberto.</p>
          ) : (
            openOccurrences.map((o) => (
              <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{o.type}</p>
                  <p className="truncate text-xs text-muted-foreground">{o.description}</p>
                </div>
                <Badge variant={o.severity === 'alta' ? 'destructive' : 'secondary'}>{o.severity}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {shortcuts.map(({ title, description, icon: Icon, to }) => (
          <button
            key={to}
            onClick={() => navigate(to)}
            className="group rounded-2xl border border-border/60 bg-card/80 p-5 text-left transition hover:border-primary/50 hover:shadow-md"
          >
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-[image:var(--gradient-brand)]">
              <Icon className="h-5 w-5 text-white" />
            </div>
            <p className="font-heading text-base font-semibold">{title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </button>
        ))}
      </div>

      <div className="mt-6">
        <OperationalLivePanel />
      </div>
    </div>

  );
}
