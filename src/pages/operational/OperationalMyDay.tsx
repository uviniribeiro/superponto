import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bus, RefreshCw, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useOperationalLive } from '@/hooks/useOperationalLive';

/** Terminal do motorista: minha operação do dia, com login único do sistema. */
export default function OperationalMyDay() {
  const { profile } = useAuth();
  const profileId = (profile as { id?: string } | null)?.id ?? null;
  const name = (profile as { full_name?: string } | null)?.full_name ?? 'Colaborador';
  const { schedules, occurrences, loading, updatedAt, refetch } = useOperationalLive(undefined, profileId);

  const tone = (s: string) => (s === 'Atrasado' ? 'destructive' : s === 'Em dia' ? 'secondary' : 'outline');

  return (
    <div className="container mx-auto px-4 py-6">
      <PageHeader
        title="Minha Operação"
        description={`Escalas de hoje de ${name}, com horário previsto e situação do ponto.`}
        icon={Bus}
      />

      <div className="mb-4 flex items-center gap-3 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span>Atualizado {updatedAt ? updatedAt.toLocaleTimeString('pt-BR') : '—'}</span>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
        </Button>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Carregando sua operação...</p>}

      {!loading && schedules.length === 0 && (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          Você não tem escala registrada para hoje.
        </CardContent></Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {schedules.map((s) => (
          <Card key={s.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">{s.lineLabel}</CardTitle>
              <Badge variant={tone(s.situation)}>{s.situation}</Badge>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="text-2xl font-semibold">{s.startTime} <span className="text-base font-normal text-muted-foreground">até {s.endTime}</span></p>
              <p className="text-muted-foreground">Serviço: {s.serviceLabel}</p>
              <p className="text-muted-foreground">Veículo: {s.vehicleLabel}</p>
              <p className="text-muted-foreground">
                Primeira batida: {s.firstPunch ?? 'ainda não registrada'}
                {s.diffMinutes != null && ` (${s.diffMinutes > 0 ? '+' : ''}${s.diffMinutes} min)`}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {occurrences.length > 0 && (
        <Card className="mt-6">
          <CardHeader><CardTitle className="text-base">Ocorrências de hoje</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {occurrences.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-3 border-b pb-2 last:border-0">
                <span>{o.type} — {o.description}</span>
                <Badge variant={o.resolved ? 'secondary' : 'destructive'}>{o.resolved ? 'Resolvida' : 'Em aberto'}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
