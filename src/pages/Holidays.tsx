import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Plus, Trash2, CalendarDays, Clock, CalendarRange, Pencil, RefreshCw } from 'lucide-react';
import { HelpButton } from '@/components/HelpButton';
import { cn } from '@/lib/utils';

interface Holiday {
  id: string;
  name: string;
  date: string;
  end_date: string | null;
  is_recurring: boolean;
  is_partial: boolean;
  partial_end_time: string | null;
  holiday_type: 'full' | 'partial' | 'extended';
}

type HolidayType = 'full' | 'partial' | 'extended';

interface HolidayFormState {
  id?: string;
  name: string;
  date: Date | undefined;
  end_date: Date | undefined;
  is_recurring: boolean;
  holiday_type: HolidayType;
  partial_end_time: string;
}

const initialFormState: HolidayFormState = {
  name: '',
  date: undefined,
  end_date: undefined,
  is_recurring: false,
  holiday_type: 'full',
  partial_end_time: '12:00'
};

const Holidays = () => {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formState, setFormState] = useState<HolidayFormState>(initialFormState);

  useEffect(() => {
    fetchHolidays();
  }, []);

  const fetchHolidays = async () => {
    try {
      const { data, error } = await supabase
        .from('holidays')
        .select('*')
        .order('date', { ascending: true });

      if (error) throw error;
      setHolidays((data || []).map(h => ({
        id: h.id,
        name: h.name,
        date: h.date,
        is_recurring: h.is_recurring,
        holiday_type: (h.holiday_type as HolidayType) || 'full',
        is_partial: h.is_partial || false,
        partial_end_time: h.partial_end_time || null,
        end_date: h.end_date || null
      })));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: "Erro ao carregar feriados",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setFormState(initialFormState);
    setIsEditing(false);
    setDialogOpen(true);
  };

  const handleOpenEdit = (holiday: Holiday) => {
    setFormState({
      id: holiday.id,
      name: holiday.name,
      date: parseISO(holiday.date),
      end_date: holiday.end_date ? parseISO(holiday.end_date) : undefined,
      is_recurring: holiday.is_recurring,
      holiday_type: holiday.holiday_type,
      partial_end_time: holiday.partial_end_time || '12:00'
    });
    setIsEditing(true);
    setDialogOpen(true);
  };

  const handleSaveHoliday = async () => {
    if (!formState.name || !formState.date) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      });
      return;
    }

    if (formState.holiday_type === 'extended' && !formState.end_date) {
      toast({
        title: "Erro",
        description: "Para feriados prolongados, informe a data de término",
        variant: "destructive"
      });
      return;
    }

    if (formState.holiday_type === 'extended' && formState.end_date && formState.end_date < formState.date) {
      toast({
        title: "Erro",
        description: "A data de término deve ser posterior à data de início",
        variant: "destructive"
      });
      return;
    }

    try {
      const holidayData: Record<string, unknown> = {
        name: formState.name,
        date: format(formState.date, 'yyyy-MM-dd'),
        is_recurring: formState.is_recurring,
        holiday_type: formState.holiday_type,
        is_partial: formState.holiday_type === 'partial',
        partial_end_time: formState.holiday_type === 'partial' ? formState.partial_end_time : null,
        end_date: formState.holiday_type === 'extended' && formState.end_date 
          ? format(formState.end_date, 'yyyy-MM-dd') 
          : null
      };

      if (isEditing && formState.id) {
        const { error } = await supabase
          .from('holidays')
          .update({
            name: holidayData.name as string,
            date: holidayData.date as string,
            is_recurring: holidayData.is_recurring as boolean,
            holiday_type: holidayData.holiday_type as string,
            is_partial: holidayData.is_partial as boolean,
            partial_end_time: holidayData.partial_end_time as string | null,
            end_date: holidayData.end_date as string | null
          })
          .eq('id', formState.id);

        toast({
          title: "Feriado atualizado",
          description: "O feriado foi atualizado com sucesso"
        });
      } else {
        const { error } = await supabase
          .from('holidays')
          .insert({
            name: holidayData.name as string,
            date: holidayData.date as string,
            is_recurring: holidayData.is_recurring as boolean,
            holiday_type: holidayData.holiday_type as string,
            is_partial: holidayData.is_partial as boolean,
            partial_end_time: holidayData.partial_end_time as string | null,
            end_date: holidayData.end_date as string | null
          });

        if (error) throw error;

        toast({
          title: "Feriado criado",
          description: "O feriado foi cadastrado com sucesso"
        });
      }

      setDialogOpen(false);
      setFormState(initialFormState);
      setIsEditing(false);
      fetchHolidays();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: isEditing ? "Erro ao atualizar feriado" : "Erro ao criar feriado",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    try {
      const { error } = await supabase
        .from('holidays')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Feriado excluído",
        description: "O feriado foi removido com sucesso"
      });

      fetchHolidays();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: "Erro ao excluir feriado",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

  const syncNationalHolidays = async (year?: number) => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-national-holidays', {
        body: year ? { year } : {}
      });

      if (error) throw error;

      toast({
        title: data.success ? "Sincronização concluída" : "Aviso",
        description: data.message,
        variant: data.success ? "default" : "destructive"
      });

      if (data.success && data.inserted > 0) {
        fetchHolidays();
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: "Erro na sincronização",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setSyncing(false);
    }
  };

  const addNationalHolidays = async () => {
    const currentYear = new Date().getFullYear();
    await syncNationalHolidays(currentYear);
  };

  const getHolidayTypeLabel = (holiday: Holiday) => {
    if (holiday.holiday_type === 'partial' || holiday.is_partial) {
      return (
        <Badge variant="secondary" className="gap-1">
          <Clock className="h-3 w-3" />
          Até {holiday.partial_end_time?.slice(0, 5) || '12:00'}
        </Badge>
      );
    }
    if (holiday.holiday_type === 'extended' && holiday.end_date) {
      const days = differenceInDays(parseISO(holiday.end_date), parseISO(holiday.date)) + 1;
      return (
        <Badge variant="outline" className="gap-1">
          <CalendarRange className="h-3 w-3" />
          {days} dias
        </Badge>
      );
    }
    return <Badge>Dia inteiro</Badge>;
  };

  const formatHolidayDate = (holiday: Holiday) => {
    const startDate = format(parseISO(holiday.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    
    if (holiday.holiday_type === 'extended' && holiday.end_date) {
      const endDate = format(parseISO(holiday.end_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
      return `${startDate} até ${endDate}`;
    }
    
    return startDate;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Feriados</h1>
          <p className="text-muted-foreground">
            Gerencie os feriados e dias não úteis
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button 
            variant="outline" 
            onClick={addNationalHolidays}
            disabled={syncing}
          >
            {syncing ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CalendarDays className="mr-2 h-4 w-4" />
            )}
            Sincronizar Feriados Nacionais
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleOpenCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Feriado
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>{isEditing ? 'Editar Feriado' : 'Novo Feriado'}</DialogTitle>
                <DialogDescription>
                  {isEditing ? 'Altere os dados do feriado' : 'Cadastre um novo feriado ou dia não útil'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Feriado</Label>
                  <Input
                    id="name"
                    value={formState.name}
                    onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                    placeholder="Ex: Natal"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tipo de Feriado</Label>
                  <Select 
                    value={formState.holiday_type} 
                    onValueChange={(value: HolidayType) => setFormState({ ...formState, holiday_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4" />
                          Dia inteiro
                        </div>
                      </SelectItem>
                      <SelectItem value="partial">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Parcial (até horário)
                        </div>
                      </SelectItem>
                      <SelectItem value="extended">
                        <div className="flex items-center gap-2">
                          <CalendarRange className="h-4 w-4" />
                          Prolongado (vários dias)
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{formState.holiday_type === 'extended' ? 'Data de Início' : 'Data'}</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !formState.date && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formState.date ? format(formState.date, "dd/MM/yyyy") : "Selecione"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formState.date}
                          onSelect={(date) => setFormState({ ...formState, date })}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {formState.holiday_type === 'extended' && (
                    <div className="space-y-2">
                      <Label>Data de Término</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !formState.end_date && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {formState.end_date ? format(formState.end_date, "dd/MM/yyyy") : "Selecione"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={formState.end_date}
                            onSelect={(date) => setFormState({ ...formState, end_date: date })}
                            disabled={(date) => formState.date ? date < formState.date : false}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}

                  {formState.holiday_type === 'partial' && (
                    <div className="space-y-2">
                      <Label>Feriado até</Label>
                      <Select 
                        value={formState.partial_end_time} 
                        onValueChange={(value) => setFormState({ ...formState, partial_end_time: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Horário" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10:00">10:00</SelectItem>
                          <SelectItem value="11:00">11:00</SelectItem>
                          <SelectItem value="12:00">12:00</SelectItem>
                          <SelectItem value="13:00">13:00</SelectItem>
                          <SelectItem value="14:00">14:00</SelectItem>
                          <SelectItem value="15:00">15:00</SelectItem>
                          <SelectItem value="16:00">16:00</SelectItem>
                          <SelectItem value="17:00">17:00</SelectItem>
                          <SelectItem value="18:00">18:00</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="recurring"
                    checked={formState.is_recurring}
                    onCheckedChange={(checked) => 
                      setFormState({ ...formState, is_recurring: checked as boolean })
                    }
                  />
                  <Label htmlFor="recurring">Feriado recorrente (repete todo ano)</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveHoliday}>
                  {isEditing ? 'Salvar Alterações' : 'Salvar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Calendário de Feriados</CardTitle>
          <CardDescription>
            Lista de todos os feriados cadastrados. Os feriados nacionais são sincronizados automaticamente em 31/12 e 01/01.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {holidays.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum feriado cadastrado. Clique em "Sincronizar Feriados Nacionais" para começar.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Recorrente</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holidays.map((holiday) => (
                  <TableRow key={holiday.id}>
                    <TableCell className="font-medium">{holiday.name}</TableCell>
                    <TableCell>{formatHolidayDate(holiday)}</TableCell>
                    <TableCell>{getHolidayTypeLabel(holiday)}</TableCell>
                    <TableCell>
                      {holiday.is_recurring ? (
                        <Badge variant="outline">Sim</Badge>
                      ) : (
                        <span className="text-muted-foreground">Não</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(holiday)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteHoliday(holiday.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      <HelpButton pageKey="holidays" />
    </div>
  );
};

export default Holidays;
