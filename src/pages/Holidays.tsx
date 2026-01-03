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
import { toast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Plus, Trash2, CalendarDays } from 'lucide-react';
import { HelpButton } from '@/components/HelpButton';
import { cn } from '@/lib/utils';

interface Holiday {
  id: string;
  name: string;
  date: string;
  is_recurring: boolean;
}

const Holidays = () => {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newHoliday, setNewHoliday] = useState({
    name: '',
    date: undefined as Date | undefined,
    is_recurring: false
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
      setHolidays(data || []);
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

    try {
      const { error } = await supabase
        .from('holidays')
        .insert({
          name: newHoliday.name,
          date: format(newHoliday.date, 'yyyy-MM-dd'),
          is_recurring: newHoliday.is_recurring
        });

      if (error) throw error;

      toast({
        title: "Feriado criado",
        description: "O feriado foi cadastrado com sucesso"
      });

      setDialogOpen(false);
      setNewHoliday({ name: '', date: undefined, is_recurring: false });
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
      { name: 'Confraternização Universal', date: `${currentYear}-01-01`, is_recurring: true },
      { name: 'Tiradentes', date: `${currentYear}-04-21`, is_recurring: true },
      { name: 'Dia do Trabalho', date: `${currentYear}-05-01`, is_recurring: true },
      { name: 'Independência do Brasil', date: `${currentYear}-09-07`, is_recurring: true },
      { name: 'Nossa Senhora Aparecida', date: `${currentYear}-10-12`, is_recurring: true },
      { name: 'Finados', date: `${currentYear}-11-02`, is_recurring: true },
      { name: 'Proclamação da República', date: `${currentYear}-11-15`, is_recurring: true },
      { name: 'Natal', date: `${currentYear}-12-25`, is_recurring: true }
    ];

    try {
      const { error } = await supabase
        .from('holidays')
        .upsert(nationalHolidays, { onConflict: 'date' });

      if (error) throw error;

      toast({
        title: "Feriados nacionais adicionados",
        description: "Os feriados nacionais foram cadastrados com sucesso"
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
            <DialogContent>
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
                  <Label>Data</Label>
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
                        {newHoliday.date ? format(newHoliday.date, "PPP", { locale: ptBR }) : "Selecione a data"}
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
                  <TableHead>Recorrente</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holidays.map((holiday) => (
                  <TableRow key={holiday.id}>
                    <TableCell className="font-medium">{holiday.name}</TableCell>
                    <TableCell>
                      {format(parseISO(holiday.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      {holiday.is_recurring ? 'Sim' : 'Não'}
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
