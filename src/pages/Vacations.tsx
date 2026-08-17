import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, differenceInDays, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Plus, Check, X, Clock, CalendarDays, History } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';

export default function Vacations() {
  const { profile, isAdmin, isManager } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Fetch vacation periods
  const { data: periods = [] } = useQuery({
    queryKey: ['vacation-periods', profile?.id],
    queryFn: async () => {
      const query = supabase
        .from('vacation_periods')
        .select('*')
        .order('period_start', { ascending: false });
      
      if (!isAdmin && !isManager) {
        query.eq('profile_id', profile?.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id
  });

  // Fetch vacation requests
  const { data: requests = [] } = useQuery({
    queryKey: ['vacation-requests', profile?.id],
    queryFn: async () => {
      const query = supabase
        .from('vacation_requests')
        .select(`
          *,
          profiles:profile_id(full_name),
          reviewer:reviewed_by(full_name)
        `)
        .order('created_at', { ascending: false });
      
      if (!isAdmin && !isManager) {
        query.eq('profile_id', profile?.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id
  });

  // Create vacation request
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!startDate || !endDate) throw new Error('Datas são obrigatórias');
      
      const daysRequested = differenceInDays(new Date(endDate), new Date(startDate)) + 1;
      const availablePeriod = periods.find(p => p.status === 'available' && p.days_remaining >= daysRequested);
      
      if (!availablePeriod) {
        throw new Error('Saldo de férias insuficiente');
      }

      const { error } = await supabase.from('vacation_requests').insert({
        profile_id: profile?.id,
        company_id: profile?.company_id,
        acquisition_period_start: availablePeriod.period_start,
        acquisition_period_end: availablePeriod.period_end,
        requested_start_date: startDate,
        requested_end_date: endDate,
        days_requested: daysRequested,
        days_available: availablePeriod.days_remaining
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Sucesso', description: 'Solicitação de férias enviada' });
      queryClient.invalidateQueries({ queryKey: ['vacation-requests'] });
      setIsDialogOpen(false);
      setStartDate('');
      setEndDate('');
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  });

  // Approve/Reject mutation
  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: 'approved' | 'rejected'; notes?: string }) => {
      const { error } = await supabase
        .from('vacation_requests')
        .update({
          status,
          reviewed_by: profile?.id,
          reviewed_at: new Date().toISOString(),
          review_notes: notes
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      toast({ 
        title: 'Sucesso', 
        description: status === 'approved' ? 'Férias aprovadas' : 'Férias rejeitadas' 
      });
      queryClient.invalidateQueries({ queryKey: ['vacation-requests'] });
    },
    onError: () => {
      toast({ title: 'Erro', description: 'Falha ao processar solicitação', variant: 'destructive' });
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case 'approved': return <Badge className="bg-green-500"><Check className="h-3 w-3 mr-1" />Aprovado</Badge>;
      case 'rejected': return <Badge variant="destructive"><X className="h-3 w-3 mr-1" />Rejeitado</Badge>;
      case 'cancelled': return <Badge variant="outline">Cancelado</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const getPeriodStatusBadge = (status: string) => {
    switch (status) {
      case 'acquiring': return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Em Aquisição</Badge>;
      case 'available': return <Badge className="bg-green-500"><Check className="h-3 w-3 mr-1" />Disponível</Badge>;
      case 'used': return <Badge variant="secondary">Usufruído</Badge>;
      case 'expired': return <Badge variant="destructive">Expirado</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const myTotalAvailable = periods
    .filter(p => p.status === 'available')
    .reduce((sum, p) => sum + (p.days_remaining || 0), 0);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <PageHeader
          title="Gestão de Férias"
          description="Solicite e acompanhe suas férias"
          className="mb-0 min-w-0 flex-1 border-0 bg-transparent p-0 backdrop-blur-none sm:p-0"
        />
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Solicitar Férias
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Solicitação de Férias</DialogTitle>
              <DialogDescription>
                Saldo disponível: <strong>{myTotalAvailable} dias</strong>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data Início</Label>
                  <Input 
                    type="date" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data Fim</Label>
                  <Input 
                    type="date" 
                    value={endDate} 
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate}
                  />
                </div>
              </div>
              {startDate && endDate && (
                <p className="text-sm text-muted-foreground">
                  Total de dias: {differenceInDays(new Date(endDate), new Date(startDate)) + 1}
                </p>
              )}
              <Button 
                onClick={() => createMutation.mutate()} 
                disabled={createMutation.isPending || !startDate || !endDate}
                className="w-full"
              >
                Enviar Solicitação
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo Disponível</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{myTotalAvailable} dias</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Solicitações Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">
              {requests.filter(r => r.status === 'pending').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Férias Aprovadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {requests.filter(r => r.status === 'approved').length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">
            <CalendarDays className="h-4 w-4 mr-2" />
            Solicitações
          </TabsTrigger>
          <TabsTrigger value="periods">
            <History className="h-4 w-4 mr-2" />
            Períodos Aquisitivos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Solicitações de Férias</CardTitle>
              <CardDescription>
                {isAdmin || isManager ? 'Todas as solicitações' : 'Minhas solicitações'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {requests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma solicitação encontrada
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      {(isAdmin || isManager) && <TableHead>Funcionário</TableHead>}
                      <TableHead>Período Solicitado</TableHead>
                      <TableHead>Dias</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data Solicitação</TableHead>
                      {(isAdmin || isManager) && <TableHead>Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((request: any) => (
                      <TableRow key={request.id}>
                        {(isAdmin || isManager) && (
                          <TableCell className="font-medium">
                            {request.profiles?.full_name || 'N/A'}
                          </TableCell>
                        )}
                        <TableCell>
                          {format(new Date(request.requested_start_date), 'dd/MM/yyyy', { locale: ptBR })} - {' '}
                          {format(new Date(request.requested_end_date), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        <TableCell>{request.days_requested}</TableCell>
                        <TableCell>{getStatusBadge(request.status)}</TableCell>
                        <TableCell>
                          {format(new Date(request.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        {(isAdmin || isManager) && request.status === 'pending' && (
                          <TableCell>
                            <div className="flex gap-2">
                              <Button 
                                size="sm" 
                                variant="default"
                                onClick={() => reviewMutation.mutate({ id: request.id, status: 'approved' })}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="destructive"
                                onClick={() => reviewMutation.mutate({ id: request.id, status: 'rejected' })}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="periods" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Períodos Aquisitivos</CardTitle>
              <CardDescription>Histórico de direito a férias</CardDescription>
            </CardHeader>
            <CardContent>
              {periods.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum período encontrado
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Período Aquisitivo</TableHead>
                      <TableHead>Dias de Direito</TableHead>
                      <TableHead>Dias Usados</TableHead>
                      <TableHead>Saldo</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {periods.map((period: any) => (
                      <TableRow key={period.id}>
                        <TableCell>
                          {format(new Date(period.period_start), 'dd/MM/yyyy', { locale: ptBR })} - {' '}
                          {format(new Date(period.period_end), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        <TableCell>{period.days_entitled}</TableCell>
                        <TableCell>{period.days_taken}</TableCell>
                        <TableCell className="font-bold text-green-600">{period.days_remaining}</TableCell>
                        <TableCell>{getPeriodStatusBadge(period.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
