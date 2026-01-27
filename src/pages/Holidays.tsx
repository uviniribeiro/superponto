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
import { CalendarIcon, Plus, Trash2, CalendarDays, Clock, CalendarRange } from 'lucide-react';
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

const Holidays = () => {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newHoliday, setNewHoliday] = useState({
    name: '',
    date: undefined as Date | undefined,
    end_date: undefined as Date | undefined,
    is_recurring: false,
    holiday_type: 'full' as HolidayType,
    partial_end_time: '12:00'
  });

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
    } catch (error: any) {
      toast({
        title: "Erro ao carregar feriados",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateHoliday = async () => {
    if (!newHoliday.name || !newHoliday.date) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      });
      return;
    }

    if (newHoliday.holiday_type === 'extended' && !newHoliday.end_date) {
      toast({
        title: "Erro",
        description: "Para feriados prolongados, informe a data de término",
        variant: "destructive"
      });
      return;
    }

    if (newHoliday.holiday_type === 'extended' && newHoliday.end_date && newHoliday.end_date < newHoliday.date) {
      toast({
        title: "Erro",
        description: "A data de término deve ser posterior à data de início",
        variant: "destructive"
      });
      return;
    }

    try {
      const insertData: any = {
        name: newHoliday.name,
        date: format(newHoliday.date, 'yyyy-MM-dd'),
        is_recurring: newHoliday.is_recurring,
        holiday_type: newHoliday.holiday_type,
        is_partial: newHoliday.holiday_type === 'partial'
      };

      if (newHoliday.holiday_type === 'partial') {
        insertData.partial_end_time = newHoliday.partial_end_time;
      }

      if (newHoliday.holiday_type === 'extended' && newHoliday.end_date) {
        insertData.end_date = format(newHoliday.end_date, 'yyyy-MM-dd');
      }

      const { error } = await supabase
        .from('holidays')
        .insert(insertData);

      if (error) throw error;

      toast({
        title: "Feriado criado",
        description: "O feriado foi cadastrado com sucesso"
      });

      setDialogOpen(false);
      setNewHoliday({ 
        name: '', 
        date: undefined, 
        end_date: undefined,
        is_recurring: false, 
        holiday_type: 'full',
        partial_end_time: '12:00'
      });
      fetchHolidays();
    } catch (error: any) {
      toast({
        title: "Erro ao criar feriado",
        description: error.message,
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
    } catch (error: any) {
      toast({
        title: "Erro ao excluir feriado",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const addNationalHolidays = async () => {
    const currentYear = new Date().getFullYear();
    const nationalHolidays = [
      { name: 'Confraternização Universal', date: `${currentYear}-01-01`, is_recurring: true, holiday_type: 'full', is_partial: false },
      { name: 'Tiradentes', date: `${currentYear}-04-21`, is_recurring: true, holiday_type: 'full', is_partial: false },
      { name: 'Dia do Trabalho', date: `${currentYear}-05-01`, is_recurring: true, holiday_type: 'full', is_partial: false },
      { name: 'Independência do Brasil', date: `${currentYear}-09-07`, is_recurring: true, holiday_type: 'full', is_partial: false },
      { name: 'Nossa Senhora Aparecida', date: `${currentYear}-10-12`, is_recurring: true, holiday_type: 'full', is_partial: false },
      { name: 'Finados', date: `${currentYear}-11-02`, is_recurring: true, holiday_type: 'full', is_partial: false },
      { name: 'Proclamação da República', date: `${currentYear}-11-15`, is_recurring: true, holiday_type: 'full', is_partial: false },
      { name: 'Natal', date: `${currentYear}-12-25`, is_recurring: true, holiday_type: 'full', is_partial: false }
    ];

    try {
      const { data: existingHolidays } = await supabase
        .from('holidays')
        .select('date');
      
      const existingDates = new Set((existingHolidays || []).map(h => h.date));
      const newHolidays = nationalHolidays.filter(h => !existingDates.has(h.date));

      if (newHolidays.length === 0) {
        toast({
          title: "Feriados já cadastrados",
          description: "Todos os feriados nacionais já estão cadastrados"
        });
        return;
      }

      const { error } = await supabase
        .from('holidays')
        .insert(newHolidays);

      if (error) throw error;

      toast({
        title: "Feriados nacionais adicionados",
        description: `${newHolidays.length} feriados foram cadastrados com sucesso`
      });

      fetchHolidays();
    } catch (error: any) {
      toast({
        title: "Erro ao adicionar feriados",
        description: error.message,
        variant: "destructive"
      });
    }
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
        <div className="flex gap-2">
          <Button variant="outline" onClick={addNationalHolidays}>
            <CalendarDays className="mr-2 h-4 w-4" />
            Adicionar Feriados Nacionais
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Novo Feriado
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Novo Feriado</DialogTitle>
                <DialogDescription>
                  Cadastre um novo feriado ou dia não útil
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Feriado</Label>
                  <Input
                    id="name"
                    value={newHoliday.name}
                    onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                    placeholder="Ex: Natal"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tipo de Feriado</Label>
                  <Select 
                    value={newHoliday.holiday_type} 
                    onValueChange={(value: HolidayType) => setNewHoliday({ ...newHoliday, holiday_type: value })}
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
                    <Label>{newHoliday.holiday_type === 'extended' ? 'Data de Início' : 'Data'}</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !newHoliday.date && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {newHoliday.date ? format(newHoliday.date, "dd/MM/yyyy") : "Selecione"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={newHoliday.date}
                          onSelect={(date) => setNewHoliday({ ...newHoliday, date })}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {newHoliday.holiday_type === 'extended' && (
                    <div className="space-y-2">
                      <Label>Data de Término</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !newHoliday.end_date && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {newHoliday.end_date ? format(newHoliday.end_date, "dd/MM/yyyy") : "Selecione"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={newHoliday.end_date}
                            onSelect={(date) => setNewHoliday({ ...newHoliday, end_date: date })}
                            disabled={(date) => newHoliday.date ? date < newHoliday.date : false}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}

                  {newHoliday.holiday_type === 'partial' && (
                    <div className="space-y-2">
                      <Label>Feriado até</Label>
                      <Select 
                        value={newHoliday.partial_end_time} 
                        onValueChange={(value) => setNewHoliday({ ...newHoliday, partial_end_time: value })}
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
                    checked={newHoliday.is_recurring}
                    onCheckedChange={(checked) => 
                      setNewHoliday({ ...newHoliday, is_recurring: checked as boolean })
                    }
                  />
                  <Label htmlFor="recurring">Feriado recorrente (repete todo ano)</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateHoliday}>
                  Salvar
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
            Lista de todos os feriados cadastrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {holidays.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum feriado cadastrado. Clique em "Adicionar Feriados Nacionais" para começar.
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteHoliday(holiday.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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