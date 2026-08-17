import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Calculator, Clock, Sun, Moon, DollarSign, Plus, Trash2, RefreshCw } from 'lucide-react';
import useSEO from '@/hooks/useSEO';

interface TimeEntry {
  id: string;
  entry: string;
  exit: string;
  isNight: boolean;
}

interface CalculationResult {
  totalMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
  nightMinutes: number;
  totalFormatted: string;
  regularFormatted: string;
  overtimeFormatted: string;
  nightFormatted: string;
  nightReduction: number;
  estimatedValue: number;
}

export default function HoursCalculator() {
  useSEO({
    title: 'Calculadora de Horas | Ponto Max',
    description: 'Calculadora de horas extras e adicional noturno.',
  });

  const [entries, setEntries] = useState<TimeEntry[]>([
    { id: '1', entry: '08:00', exit: '12:00', isNight: false },
    { id: '2', entry: '13:00', exit: '17:00', isNight: false },
  ]);
  const [dailyHours, setDailyHours] = useState('8');
  const [overtime50, setOvertime50] = useState('50');
  const [overtime100, setOvertime100] = useState('100');
  const [nightAddition, setNightAddition] = useState('20');
  const [hourlyRate, setHourlyRate] = useState('30');
  const [nightStartTime, setNightStartTime] = useState('22:00');
  const [nightEndTime, setNightEndTime] = useState('05:00');
  const [result, setResult] = useState<CalculationResult | null>(null);

  const addEntry = () => {
    const newId = Date.now().toString();
    setEntries([...entries, { id: newId, entry: '', exit: '', isNight: false }]);
  };

  const removeEntry = (id: string) => {
    if (entries.length > 1) {
      setEntries(entries.filter(e => e.id !== id));
    }
  };

  const updateEntry = (id: string, field: 'entry' | 'exit', value: string) => {
    setEntries(entries.map(e => 
      e.id === id ? { ...e, [field]: value } : e
    ));
  };

  const timeToMinutes = (time: string): number => {
    if (!time) return 0;
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const minutesToTime = (minutes: number): string => {
    const hours = Math.floor(Math.abs(minutes) / 60);
    const mins = Math.abs(minutes) % 60;
    const sign = minutes < 0 ? '-' : '';
    return `${sign}${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  const isNightTime = (time: string): boolean => {
    const minutes = timeToMinutes(time);
    const nightStart = timeToMinutes(nightStartTime);
    const nightEnd = timeToMinutes(nightEndTime);
    
    if (nightStart > nightEnd) {
      // Crosses midnight (e.g., 22:00 to 05:00)
      return minutes >= nightStart || minutes < nightEnd;
    }
    return minutes >= nightStart && minutes < nightEnd;
  };

  const calculateNightMinutes = (entry: string, exit: string): number => {
    const entryMin = timeToMinutes(entry);
    let exitMin = timeToMinutes(exit);
    
    // Handle overnight shifts
    if (exitMin < entryMin) {
      exitMin += 24 * 60;
    }

    const nightStart = timeToMinutes(nightStartTime);
    let nightEnd = timeToMinutes(nightEndTime);
    if (nightEnd < nightStart) nightEnd += 24 * 60;

    let nightMinutes = 0;
    
    // Check overlap with night period
    const overlapStart = Math.max(entryMin, nightStart);
    const overlapEnd = Math.min(exitMin, nightStart + (24 * 60)); // Extend if crosses midnight
    
    if (overlapStart < overlapEnd && entryMin < nightEnd) {
      // Complex calculation for night hours
      for (let m = entryMin; m < exitMin; m++) {
        const normalizedMin = m % (24 * 60);
        if (isNightTime(minutesToTime(normalizedMin))) {
          nightMinutes++;
        }
      }
    }
    
    return nightMinutes;
  };

  const calculate = () => {
    let totalMinutes = 0;
    let nightMinutes = 0;

    entries.forEach(entry => {
      if (entry.entry && entry.exit) {
        let entryMin = timeToMinutes(entry.entry);
        let exitMin = timeToMinutes(entry.exit);
        
        // Handle overnight
        if (exitMin < entryMin) {
          exitMin += 24 * 60;
        }
        
        const duration = exitMin - entryMin;
        totalMinutes += duration;
        
        // Calculate night hours
        nightMinutes += calculateNightMinutes(entry.entry, entry.exit);
      }
    });

    const dailyMinutes = parseFloat(dailyHours) * 60;
    const regularMinutes = Math.min(totalMinutes, dailyMinutes);
    const overtimeMinutes = Math.max(0, totalMinutes - dailyMinutes);
    
    // Night reduction (52.5 minutes = 60 night minutes, so ~12.5% reduction)
    const nightReduction = Math.round(nightMinutes * 0.1428);
    
    // Calculate estimated value
    const rate = parseFloat(hourlyRate) || 0;
    const regularValue = (regularMinutes / 60) * rate;
    const overtime50Value = (overtimeMinutes / 60) * rate * (1 + parseFloat(overtime50) / 100);
    const nightValue = (nightMinutes / 60) * rate * (parseFloat(nightAddition) / 100);
    
    setResult({
      totalMinutes,
      regularMinutes,
      overtimeMinutes,
      nightMinutes,
      totalFormatted: minutesToTime(totalMinutes),
      regularFormatted: minutesToTime(regularMinutes),
      overtimeFormatted: minutesToTime(overtimeMinutes),
      nightFormatted: minutesToTime(nightMinutes),
      nightReduction,
      estimatedValue: regularValue + overtime50Value + nightValue
    });
  };

  const reset = () => {
    setEntries([
      { id: '1', entry: '08:00', exit: '12:00', isNight: false },
      { id: '2', entry: '13:00', exit: '17:00', isNight: false },
    ]);
    setResult(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calculator className="h-6 w-6 text-primary" />
            Calculadora de Horas
          </h1>
          <p className="text-muted-foreground">
            Calcule horas extras, adicional noturno e valores estimados
          </p>
        </div>
        <Button variant="outline" onClick={reset}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Limpar
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input Section */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Registros de Ponto
              </CardTitle>
              <CardDescription>
                Informe os horários de entrada e saída
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {entries.map((entry, index) => (
                <div key={entry.id} className="flex items-center gap-3">
                  <span className="text-sm font-medium text-muted-foreground w-6">
                    {index + 1}.
                  </span>
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Entrada</Label>
                      <Input
                        type="time"
                        value={entry.entry}
                        onChange={(e) => updateEntry(entry.id, 'entry', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Saída</Label>
                      <Input
                        type="time"
                        value={entry.exit}
                        onChange={(e) => updateEntry(entry.id, 'exit', e.target.value)}
                      />
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive shrink-0"
                    onClick={() => removeEntry(entry.id)}
                    disabled={entries.length <= 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" className="w-full" onClick={addEntry}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Registro
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sun className="h-5 w-5" />
                Parâmetros de Cálculo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Jornada Diária (horas)</Label>
                  <Input
                    type="number"
                    value={dailyHours}
                    onChange={(e) => setDailyHours(e.target.value)}
                    min="1"
                    max="24"
                  />
                </div>
                <div>
                  <Label>Valor/Hora (R$)</Label>
                  <Input
                    type="number"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>HE 50% (%)</Label>
                  <Input
                    type="number"
                    value={overtime50}
                    onChange={(e) => setOvertime50(e.target.value)}
                    min="0"
                    max="200"
                  />
                </div>
                <div>
                  <Label>HE 100% (%)</Label>
                  <Input
                    type="number"
                    value={overtime100}
                    onChange={(e) => setOvertime100(e.target.value)}
                    min="0"
                    max="200"
                  />
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Adicional Noturno (%)</Label>
                  <Input
                    type="number"
                    value={nightAddition}
                    onChange={(e) => setNightAddition(e.target.value)}
                    min="0"
                    max="100"
                  />
                </div>
                <div>
                  <Label>Início Noturno</Label>
                  <Input
                    type="time"
                    value={nightStartTime}
                    onChange={(e) => setNightStartTime(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Fim Noturno</Label>
                  <Input
                    type="time"
                    value={nightEndTime}
                    onChange={(e) => setNightEndTime(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Button onClick={calculate} className="w-full gradient-primary" size="lg">
            <Calculator className="h-5 w-5 mr-2" />
            Calcular
          </Button>
        </div>

        {/* Results Section */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Resultado do Cálculo
              </CardTitle>
              <CardDescription>
                Horas trabalhadas e valores estimados
              </CardDescription>
            </CardHeader>
            <CardContent>
              {result ? (
                <div className="space-y-6">
                  {/* Total Hours */}
                  <div className="text-center p-6 bg-primary/10 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Total de Horas</p>
                    <p className="text-4xl font-bold text-primary">{result.totalFormatted}</p>
                  </div>

                  {/* Breakdown */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg text-center">
                      <Sun className="h-6 w-6 mx-auto mb-2 text-amber-500" />
                      <p className="text-sm text-muted-foreground">Horas Normais</p>
                      <p className="text-xl font-bold">{result.regularFormatted}</p>
                    </div>
                    <div className="p-4 border rounded-lg text-center">
                      <Clock className="h-6 w-6 mx-auto mb-2 text-violet-500" />
                      <p className="text-sm text-muted-foreground">Horas Extras</p>
                      <p className="text-xl font-bold text-violet-600">{result.overtimeFormatted}</p>
                    </div>
                  </div>

                  {/* Night Hours */}
                  {result.nightMinutes > 0 && (
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Moon className="h-5 w-5 text-indigo-500" />
                          <span className="font-medium">Horas Noturnas</span>
                        </div>
                        <Badge variant="secondary">{result.nightFormatted}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        Redução noturna: {result.nightReduction} minutos ({nightAddition}% adicional)
                      </p>
                    </div>
                  )}

                  <Separator />

                  {/* Estimated Value */}
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-emerald-600" />
                        <span className="font-medium">Valor Estimado</span>
                      </div>
                      <span className="text-2xl font-bold text-emerald-600">
                        R$ {result.estimatedValue.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      *Valor estimado com base no valor/hora informado. Não inclui descontos.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Calculator className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg">Informe os horários e clique em calcular</p>
                  <p className="text-sm mt-2">
                    O resultado aparecerá aqui
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tips */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Dicas de Uso</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>• Para turnos noturnos que ultrapassam meia-noite, o sistema calcula automaticamente.</p>
              <p>• O adicional noturno padrão CLT é de 20% sobre a hora normal.</p>
              <p>• Horas extras em dias úteis: 50%. Em domingos/feriados: 100%.</p>
              <p>• A hora noturna tem duração de 52min30seg (redução de 12,5%).</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
