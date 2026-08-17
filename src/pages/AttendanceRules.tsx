import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Save, SlidersHorizontal, Moon, Clock, Scale, CalendarClock } from 'lucide-react';
import {
import { PageHeader } from '@/components/shared/PageHeader';
  AttendanceRules,
  DEFAULT_ATTENDANCE_RULES,
  calculateDay,
  formatMinutes,
} from '@/lib/timeCalculation';

type RulesRow = AttendanceRules & { id?: string; company_id?: string; name?: string };

export default function AttendanceRulesPage() {
  const { profile } = useAuth();
  const [rules, setRules] = useState<RulesRow>({ ...DEFAULT_ATTENDANCE_RULES });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('attendance_rules')
          .select('*')
          .eq('is_default', true)
          .maybeSingle();
        if (error) throw error;
        if (data) setRules({ ...DEFAULT_ATTENDANCE_RULES, ...(data as unknown as RulesRow) });
      } catch (error) {
        console.error('Erro ao carregar regras de apuração:', error);
        toast.error('Erro ao carregar as regras de apuração');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const set = <K extends keyof RulesRow>(key: K, value: RulesRow[K]) =>
    setRules((prev) => ({ ...prev, [key]: value }));

  const num = (key: keyof RulesRow) => (e: React.ChangeEvent<HTMLInputElement>) =>
    set(key, (e.target.value === '' ? 0 : Number(e.target.value)) as never);

  const handleSave = async () => {
    if (!profile?.company_id) {
      toast.error('Empresa não identificada no seu perfil');
      return;
    }
    setSaving(true);
    try {
      const { id, ...values } = rules;
      const payload = { ...values, company_id: profile.company_id, is_default: true };
      const { error } = id
        ? await supabase.from('attendance_rules').update(payload).eq('id', id)
        : await supabase.from('attendance_rules').insert(payload);
      if (error) throw error;
      toast.success('Regras de apuração salvas com sucesso');
      if (!id) {
        const { data } = await supabase
          .from('attendance_rules')
          .select('*')
          .eq('is_default', true)
          .maybeSingle();
        if (data) setRules({ ...DEFAULT_ATTENDANCE_RULES, ...(data as unknown as RulesRow) });
      }
    } catch (error: any) {
      console.error('Erro ao salvar regras:', error);
      toast.error(error?.message || 'Erro ao salvar as regras de apuração');
    } finally {
      setSaving(false);
    }
  };

  // Simulação com uma jornada 08:00–17:00 e 1h de intervalo
  const preview = useMemo(() => {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    const at = (h: number, m: number) => {
      const d = new Date(day);
      d.setHours(h, m, 0, 0);
      return d.toISOString();
    };
    return calculateDay({
      date: day,
      dayKind: 'normal',
      rules,
      journey: { start: '08:00', end: '17:00', expectedMinutes: 480, breakMinutes: 60 },
      punches: [
        { record_type: 'entry', recorded_at: at(8, 12) },
        { record_type: 'break_start', recorded_at: at(12, 0) },
        { record_type: 'break_end', recorded_at: at(12, 40) },
        { record_type: 'exit', recorded_at: at(19, 30) },
      ],
    });
  }, [rules]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title="Regras de Apuração"
          description="Parâmetros de tolerância, horas extras, adicional noturno, intrajornada e compensação." icon={SlidersHorizontal}
          className="mb-0 min-w-0 flex-1 border-0 bg-transparent p-0 backdrop-blur-none sm:p-0"
        />
        <div className="flex items-center gap-2">

          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar
          </Button>
        </div>
      </div>

      <Tabs defaultValue="tolerance">
        <TabsList className="flex-wrap">
          <TabsTrigger value="tolerance">Tolerâncias</TabsTrigger>
          <TabsTrigger value="overtime">Horas Extras</TabsTrigger>
          <TabsTrigger value="night">Noturno</TabsTrigger>
          <TabsTrigger value="break">Intrajornada</TabsTrigger>
          <TabsTrigger value="compensation">Compensação</TabsTrigger>
          <TabsTrigger value="journey">Jornada</TabsTrigger>
        </TabsList>

        <TabsContent value="tolerance">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" /> Tolerâncias e arredondamento
              </CardTitle>
              <CardDescription>Minutos desprezados na apuração e regra de arredondamento.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Tolerância na entrada (min)</Label>
                <Input type="number" min={0} value={rules.entry_tolerance_minutes} onChange={num('entry_tolerance_minutes')} />
              </div>
              <div className="space-y-2">
                <Label>Tolerância na saída (min)</Label>
                <Input type="number" min={0} value={rules.exit_tolerance_minutes} onChange={num('exit_tolerance_minutes')} />
              </div>
              <div className="space-y-2">
                <Label>Tolerância diária total (min)</Label>
                <Input type="number" min={0} value={rules.daily_tolerance_minutes} onChange={num('daily_tolerance_minutes')} />
              </div>
              <div className="space-y-2">
                <Label>Tolerância por marcação (min)</Label>
                <Input type="number" min={0} value={rules.per_punch_tolerance_minutes} onChange={num('per_punch_tolerance_minutes')} />
              </div>
              <div className="space-y-2">
                <Label>Arredondamento (min)</Label>
                <Input type="number" min={0} value={rules.rounding_minutes} onChange={num('rounding_minutes')} />
              </div>
              <div className="space-y-2">
                <Label>Modo de arredondamento</Label>
                <Select value={rules.rounding_mode} onValueChange={(v) => set('rounding_mode', v as RulesRow['rounding_mode'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nearest">Mais próximo</SelectItem>
                    <SelectItem value="up">Para cima</SelectItem>
                    <SelectItem value="down">Para baixo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overtime">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5" /> Horas extras
              </CardTitle>
              <CardDescription>Percentuais por tipo de dia e limite diário.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Dia normal (%)</Label>
                <Input type="number" min={0} value={rules.overtime_normal_percent} onChange={num('overtime_normal_percent')} />
              </div>
              <div className="space-y-2">
                <Label>Extra noturna (%)</Label>
                <Input type="number" min={0} value={rules.overtime_night_percent} onChange={num('overtime_night_percent')} />
              </div>
              <div className="space-y-2">
                <Label>Descanso semanal / folga (%)</Label>
                <Input type="number" min={0} value={rules.overtime_rest_day_percent} onChange={num('overtime_rest_day_percent')} />
              </div>
              <div className="space-y-2">
                <Label>Feriado (%)</Label>
                <Input type="number" min={0} value={rules.overtime_holiday_percent} onChange={num('overtime_holiday_percent')} />
              </div>
              <div className="space-y-2">
                <Label>Extra em intervalo (%)</Label>
                <Input type="number" min={0} value={rules.overtime_break_percent} onChange={num('overtime_break_percent')} />
              </div>
              <div className="space-y-2">
                <Label>Limite diário de extras (min)</Label>
                <Input type="number" min={0} value={rules.daily_overtime_limit_minutes} onChange={num('daily_overtime_limit_minutes')} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4 md:col-span-2">
                <div>
                  <Label>Considerar intervalo não usufruído como hora extra</Label>
                  <p className="text-sm text-muted-foreground">Intrajornada abaixo do mínimo gera horas extras.</p>
                </div>
                <Switch checked={rules.count_break_overtime} onCheckedChange={(v) => set('count_break_overtime', v)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="night">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Moon className="h-5 w-5" /> Adicional noturno
              </CardTitle>
              <CardDescription>Faixa horária, percentual e hora noturna reduzida (52min30s).</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Início do período noturno</Label>
                <Input type="time" value={rules.night_start?.slice(0, 5)} onChange={(e) => set('night_start', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Fim do período noturno</Label>
                <Input type="time" value={rules.night_end?.slice(0, 5)} onChange={(e) => set('night_end', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Percentual noturno (%)</Label>
                <Input type="number" min={0} value={rules.night_percent} onChange={num('night_percent')} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label>Hora noturna reduzida</Label>
                  <p className="text-sm text-muted-foreground">Converter 52min30s em 1 hora.</p>
                </div>
                <Switch checked={rules.use_reduced_night_hour} onCheckedChange={(v) => set('use_reduced_night_hour', v)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="break">
          <Card>
            <CardHeader>
              <CardTitle>Intrajornada</CardTitle>
              <CardDescription>Intervalo mínimo e desconto automático.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Intervalo mínimo (min)</Label>
                <Input type="number" min={0} value={rules.min_break_minutes} onChange={num('min_break_minutes')} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label>Descontar intervalo automaticamente</Label>
                  <p className="text-sm text-muted-foreground">Quando não houver marcação de intervalo.</p>
                </div>
                <Switch checked={rules.auto_deduct_break} onCheckedChange={(v) => set('auto_deduct_break', v)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compensation">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5" /> Compensação automática
              </CardTitle>
              <CardDescription>Atrasos e saídas antecipadas compensados dentro dos limites definidos.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg border p-4 md:col-span-2">
                <div>
                  <Label>Compensar automaticamente</Label>
                  <p className="text-sm text-muted-foreground">Abate atrasos e saídas antecipadas com o crédito do período.</p>
                </div>
                <Switch checked={rules.auto_compensation} onCheckedChange={(v) => set('auto_compensation', v)} />
              </div>
              <div className="space-y-2">
                <Label>Prazo para compensação (dias)</Label>
                <Input type="number" min={0} value={rules.compensation_deadline_days} onChange={num('compensation_deadline_days')} />
              </div>
              <div className="space-y-2">
                <Label>Máximo de ocorrências no mês</Label>
                <Input type="number" min={0} value={rules.max_occurrences_per_month} onChange={num('max_occurrences_per_month')} />
              </div>
              <div className="space-y-2">
                <Label>Máximo de minutos compensáveis no mês</Label>
                <Input type="number" min={0} value={rules.max_compensation_minutes_per_month} onChange={num('max_compensation_minutes_per_month')} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="journey">
          <Card>
            <CardHeader>
              <CardTitle>Regras de jornada</CardTitle>
              <CardDescription>Reconhecimento do dia, alocação de ocorrências e faltas.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Reconhecer o dia da jornada pela</Label>
                <Select value={rules.journey_day_reference} onValueChange={(v) => set('journey_day_reference', v as RulesRow['journey_day_reference'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entry">Data da entrada</SelectItem>
                    <SelectItem value="exit">Data da saída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Alocação das ocorrências</Label>
                <Select value={rules.occurrence_allocation} onValueChange={(v) => set('occurrence_allocation', v as RulesRow['occurrence_allocation'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="journey_day">No dia da jornada</SelectItem>
                    <SelectItem value="real_day">No dia real do fato</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label>Saldo em dia com marcação única</Label>
                  <p className="text-sm text-muted-foreground">Gera saldo sem permitir compensação.</p>
                </div>
                <Switch checked={rules.single_punch_balance} onCheckedChange={(v) => set('single_punch_balance', v)} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label>Exigir anuência da chefia</Label>
                  <p className="text-sm text-muted-foreground">Para entradas e saídas antecipadas.</p>
                </div>
                <Switch checked={rules.require_manager_approval_early} onCheckedChange={(v) => set('require_manager_approval_early', v)} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4 md:col-span-2">
                <div>
                  <Label>Descontar faltas automaticamente</Label>
                  <p className="text-sm text-muted-foreground">Dias sem marcação com jornada prevista geram débito.</p>
                </div>
                <Switch checked={rules.auto_discount_absences} onCheckedChange={(v) => set('auto_discount_absences', v)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Simulação com as regras atuais</CardTitle>
          <CardDescription>
            Jornada 08:00–17:00 com 1h de intervalo · marcações 08:12, 12:00, 12:40 e 19:30.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Trabalhadas', value: formatMinutes(preview.workedMinutes) },
              { label: 'Saldo', value: formatMinutes(preview.balanceMinutes) },
              { label: 'Horas extras', value: formatMinutes(preview.overtimeMinutes) },
              { label: 'Noturnas (ajustadas)', value: formatMinutes(preview.nightAdjustedMinutes) },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <p className="text-xl font-semibold">{item.value}</p>
              </div>
            ))}
          </div>
          <Separator />
          <div className="space-y-1 text-sm text-muted-foreground">
            {preview.overtimeByPercent.map((item) => (
              <p key={item.percent}>
                Extras a {item.percent}%: {formatMinutes(item.minutes)}
              </p>
            ))}
            {preview.occurrences.map((occurrence) => (
              <p key={occurrence}>• {occurrence}</p>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
