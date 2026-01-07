import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { format, differenceInDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Check, X, Calendar, FileText, Clock, Plane, Baby, Heart, User } from 'lucide-react';

interface Profile {
  id: string;
  full_name: string;
  registration_number: string | null;
}

interface Absence {
  id: string;
  profile_id: string;
  absence_type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  profiles?: {
    full_name: string;
    registration_number: string | null;
  };
}

const absenceTypes = [
  { value: 'vacation', label: 'Férias', icon: Plane },
  { value: 'medical_leave', label: 'Licença Médica', icon: Heart },
  { value: 'maternity', label: 'Licença Maternidade', icon: Baby },
  { value: 'paternity', label: 'Licença Paternidade', icon: Baby },
  { value: 'personal', label: 'Licença Pessoal', icon: User },
  { value: 'bereavement', label: 'Luto', icon: Heart },
  { value: 'wedding', label: 'Casamento', icon: Heart },
  { value: 'other', label: 'Outro', icon: FileText },
];

export default function LeaveManagement() {
  const { isAdmin, isManager, profile, company, user } = useAuth();
  const canManage = isAdmin || isManager;
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState('all');
  
  const [formData, setFormData] = useState({
    profile_id: '',
    absence_type: 'vacation',
    start_date: '',
    end_date: '',
    reason: '',
    notes: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch absences
    let query = supabase
      .from('employee_absences')
      .select(`
        *,
        profiles:profile_id (full_name, registration_number)
      `)
      .order('start_date', { ascending: false });

    if (!canManage && profile) {
      query = query.eq('profile_id', profile.id);
    }

    const { data: absencesData, error: absencesError } = await query;

    if (absencesError) {
      toast({
        title: 'Erro ao carregar afastamentos',
        description: absencesError.message,
        variant: 'destructive',
      });
    } else {
      setAbsences(absencesData || []);
    }

    // Fetch employees for admin/manager
    if (canManage) {
      const { data: employeesData } = await supabase
        .from('profiles')
        .select('id, full_name, registration_number')
        .eq('is_active', true)
        .order('full_name');
      
      setEmployees(employeesData || []);
    }

    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!formData.start_date || !formData.end_date) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha as datas de início e fim',
        variant: 'destructive',
      });
      return;
    }

    const profileId = canManage ? formData.profile_id : profile?.id;
    if (!profileId) {
      toast({
        title: 'Erro',
        description: 'Funcionário não selecionado',
        variant: 'destructive',
      });
      return;
    }

    const totalDays = differenceInDays(parseISO(formData.end_date), parseISO(formData.start_date)) + 1;

    const { error } = await supabase
      .from('employee_absences')
      .insert({
        profile_id: profileId,
        company_id: company?.id,
        absence_type: formData.absence_type,
        start_date: formData.start_date,
        end_date: formData.end_date,
        total_days: totalDays,
        reason: formData.reason || null,
        notes: formData.notes || null,
        status: canManage ? 'approved' : 'pending',
        approved_by: canManage ? user?.id : null,
        approved_at: canManage ? new Date().toISOString() : null,
      });

    if (error) {
      toast({
        title: 'Erro ao registrar afastamento',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Afastamento registrado',
        description: canManage ? 'O afastamento foi aprovado automaticamente' : 'Aguardando aprovação',
      });
      setDialogOpen(false);
      resetForm();
      fetchData();
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    const { error } = await supabase
      .from('employee_absences')
      .update({
        status: newStatus,
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      toast({
        title: 'Erro ao atualizar',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: newStatus === 'approved' ? 'Afastamento aprovado' : 'Afastamento rejeitado',
      });
      fetchData();
    }
  };

  const resetForm = () => {
    setFormData({
      profile_id: '',
      absence_type: 'vacation',
      start_date: '',
      end_date: '',
      reason: '',
      notes: '',
    });
  };

  const getTypeInfo = (type: string) => {
    return absenceTypes.find(t => t.value === type) || absenceTypes[absenceTypes.length - 1];
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500 hover:bg-green-600">Aprovado</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejeitado</Badge>;
      default:
        return <Badge variant="secondary">Pendente</Badge>;
    }
  };

  const filteredAbsences = absences.filter(a => {
    if (selectedTab === 'pending') return a.status === 'pending';
    if (selectedTab === 'approved') return a.status === 'approved';
    if (selectedTab === 'rejected') return a.status === 'rejected';
    return true;
  });

  const pendingCount = absences.filter(a => a.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestão de Afastamentos</h1>
          <p className="text-muted-foreground">
            Férias, licenças, atestados e outros afastamentos
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              {canManage ? 'Novo Afastamento' : 'Solicitar Afastamento'}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {canManage ? 'Registrar Afastamento' : 'Solicitar Afastamento'}
              </DialogTitle>
              <DialogDescription>
                {canManage 
                  ? 'Registre um afastamento para um funcionário'
                  : 'Sua solicitação será enviada para aprovação'}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              {canManage && (
                <div className="space-y-2">
                  <Label>Funcionário *</Label>
                  <Select
                    value={formData.profile_id}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, profile_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um funcionário" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.full_name} {emp.registration_number && `(${emp.registration_number})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Tipo de Afastamento *</Label>
                <Select
                  value={formData.absence_type}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, absence_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {absenceTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <type.icon className="h-4 w-4" />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data Início *</Label>
                  <Input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data Fim *</Label>
                  <Input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Motivo</Label>
                <Textarea
                  value={formData.reason}
                  onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Descreva o motivo do afastamento"
                  rows={3}
                />
              </div>

              {canManage && (
                <div className="space-y-2">
                  <Label>Observações Internas</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Observações (visível apenas para gestores)"
                    rows={2}
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit}>
                {canManage ? 'Registrar' : 'Solicitar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total de Afastamentos</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              {absences.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pendentes</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2 text-yellow-500">
              <Clock className="h-5 w-5" />
              {pendingCount}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Aprovados</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2 text-green-500">
              <Check className="h-5 w-5" />
              {absences.filter(a => a.status === 'approved').length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Rejeitados</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2 text-destructive">
              <X className="h-5 w-5" />
              {absences.filter(a => a.status === 'rejected').length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Absences Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Afastamentos</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">Todos</TabsTrigger>
              <TabsTrigger value="pending" className="relative">
                Pendentes
                {pendingCount > 0 && (
                  <span className="ml-2 bg-yellow-500 text-white text-xs rounded-full px-1.5">
                    {pendingCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="approved">Aprovados</TabsTrigger>
              <TabsTrigger value="rejected">Rejeitados</TabsTrigger>
            </TabsList>

            <TabsContent value={selectedTab}>
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : filteredAbsences.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum afastamento encontrado
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      {canManage && <TableHead>Funcionário</TableHead>}
                      <TableHead>Tipo</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Dias</TableHead>
                      <TableHead>Status</TableHead>
                      {canManage && <TableHead className="text-right">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAbsences.map((absence) => {
                      const typeInfo = getTypeInfo(absence.absence_type);
                      return (
                        <TableRow key={absence.id}>
                          {canManage && (
                            <TableCell className="font-medium">
                              {absence.profiles?.full_name}
                              {absence.profiles?.registration_number && (
                                <span className="text-xs text-muted-foreground ml-2">
                                  ({absence.profiles.registration_number})
                                </span>
                              )}
                            </TableCell>
                          )}
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <typeInfo.icon className="h-4 w-4 text-muted-foreground" />
                              {typeInfo.label}
                            </div>
                          </TableCell>
                          <TableCell>
                            {format(parseISO(absence.start_date), 'dd/MM/yyyy')} - {format(parseISO(absence.end_date), 'dd/MM/yyyy')}
                          </TableCell>
                          <TableCell>{absence.total_days} dias</TableCell>
                          <TableCell>{getStatusBadge(absence.status)}</TableCell>
                          {canManage && (
                            <TableCell className="text-right">
                              {absence.status === 'pending' && (
                                <div className="flex justify-end gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-green-500 hover:text-green-600"
                                    onClick={() => handleStatusChange(absence.id, 'approved')}
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => handleStatusChange(absence.id, 'rejected')}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
