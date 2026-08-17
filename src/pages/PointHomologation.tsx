import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Clock, AlertTriangle, Search, Users, Calendar, FileCheck, Eye, Filter } from 'lucide-react';
import { format, subMonths, startOfMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PageHeader } from '@/components/shared/PageHeader';

interface Employee {
  id: string;
  full_name: string;
  registration_number: string | null;
  department: string | null;
  position: string | null;
}

interface Homologation {
  id: string;
  profile_id: string;
  reference_month: string;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;
  profile?: Employee;
  pendencies_count?: number;
}

interface Pendency {
  id: string;
  profile_id: string;
  reference_date: string;
  pendency_type: string;
  description: string;
  is_resolved: boolean;
  resolution_notes: string | null;
}

const PENDENCY_TYPES: Record<string, { label: string; color: string }> = {
  missing_entry: { label: 'Entrada não registrada', color: 'bg-red-500' },
  missing_exit: { label: 'Saída não registrada', color: 'bg-red-500' },
  missing_break: { label: 'Intervalo não registrado', color: 'bg-yellow-500' },
  unjustified_absence: { label: 'Falta não justificada', color: 'bg-red-600' },
  incomplete_record: { label: 'Registro incompleto', color: 'bg-orange-500' },
  excessive_overtime: { label: 'Hora extra excessiva', color: 'bg-purple-500' },
  missing_justification: { label: 'Justificativa pendente', color: 'bg-yellow-600' },
  other: { label: 'Outro', color: 'bg-gray-500' },
};

export default function PointHomologation() {
  const { profile, company } = useAuth();
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [homologations, setHomologations] = useState<Homologation[]>([]);
  const [pendencies, setPendencies] = useState<Record<string, Pendency[]>>({});
  const [selectedMonth, setSelectedMonth] = useState(format(subMonths(new Date(), 1), 'yyyy-MM'));
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [pendencyDialogOpen, setPendencyDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (employees.length > 0) {
      fetchHomologations();
    }
  }, [selectedMonth, employees]);

  const fetchEmployees = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, registration_number, department, position')
      .eq('is_active', true)
      .order('full_name');

    if (error) {
      toast.error('Erro ao carregar funcionários');
      return;
    }
    setEmployees(data || []);
  };

  const fetchHomologations = async () => {
    setLoading(true);
    const referenceMonth = `${selectedMonth}-01`;

    try {
      // Fetch existing homologations
      const { data: homologData, error: homologError } = await supabase
        .from('point_homologations')
        .select('*')
        .eq('reference_month', referenceMonth);

      if (homologError) throw homologError;

      // Fetch pendencies for all employees
      const { data: pendencyData, error: pendencyError } = await supabase
        .from('point_pendencies')
        .select('*')
        .gte('reference_date', referenceMonth)
        .lt('reference_date', format(startOfMonth(subMonths(parseISO(referenceMonth), -1)), 'yyyy-MM-dd'));

      if (pendencyError) throw pendencyError;

      // Group pendencies by profile
      const pendenciesByProfile: Record<string, Pendency[]> = {};
      (pendencyData || []).forEach(p => {
        if (!pendenciesByProfile[p.profile_id]) {
          pendenciesByProfile[p.profile_id] = [];
        }
        pendenciesByProfile[p.profile_id].push(p);
      });
      setPendencies(pendenciesByProfile);

      // Merge homologations with employee data
      const homologMap = new Map((homologData || []).map(h => [h.profile_id, h]));
      
      const mergedHomologations: Homologation[] = employees.map(emp => {
        const existing = homologMap.get(emp.id);
        const empPendencies = pendenciesByProfile[emp.id] || [];
        const unresolvedPendencies = empPendencies.filter(p => !p.is_resolved);
        
        return {
          id: existing?.id || '',
          profile_id: emp.id,
          reference_month: referenceMonth,
          status: existing?.status || (unresolvedPendencies.length > 0 ? 'blocked' : 'pending'),
          approved_by: existing?.approved_by,
          approved_at: existing?.approved_at,
          notes: existing?.notes,
          profile: emp,
          pendencies_count: unresolvedPendencies.length,
        };
      });

      setHomologations(mergedHomologations);
    } catch (error) {
      console.error('Error fetching homologations:', error);
      toast.error('Erro ao carregar dados de homologação');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string, pendenciesCount: number = 0) => {
    if (pendenciesCount > 0) {
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          {pendenciesCount} pendência(s)
        </Badge>
      );
    }
    
    switch (status) {
      case 'approved':
        return (
          <Badge className="bg-emerald-500 gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Homologado
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Rejeitado
          </Badge>
        );
      case 'blocked':
        return (
          <Badge variant="outline" className="border-red-500 text-red-500 gap-1">
            <AlertTriangle className="h-3 w-3" />
            Bloqueado
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            Pendente
          </Badge>
        );
    }
  };

  const filteredHomologations = homologations.filter(h => {
    const matchesSearch = !searchTerm || 
      h.profile?.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      h.profile?.registration_number?.includes(searchTerm);
    
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'pending' && h.status === 'pending' && (h.pendencies_count || 0) === 0) ||
      (filterStatus === 'blocked' && (h.pendencies_count || 0) > 0) ||
      (filterStatus === 'approved' && h.status === 'approved');
    
    return matchesSearch && matchesStatus;
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const selectableIds = filteredHomologations
        .filter(h => h.status !== 'approved' && (h.pendencies_count || 0) === 0)
        .map(h => h.profile_id);
      setSelectedEmployees(selectableIds);
    } else {
      setSelectedEmployees([]);
    }
  };

  const handleSelectEmployee = (profileId: string, checked: boolean) => {
    if (checked) {
      setSelectedEmployees(prev => [...prev, profileId]);
    } else {
      setSelectedEmployees(prev => prev.filter(id => id !== profileId));
    }
  };

  const handleViewPendencies = (employee: Employee) => {
    setSelectedEmployee(employee);
    setPendencyDialogOpen(true);
  };

  const handleApproveSelected = () => {
    if (selectedEmployees.length === 0) {
      toast.error('Selecione pelo menos um funcionário');
      return;
    }
    setApprovalDialogOpen(true);
  };

  const confirmApproval = async () => {
    if (!profile?.id || !company?.id) return;
    
    setLoading(true);
    try {
      const referenceMonth = `${selectedMonth}-01`;
      
      for (const profileId of selectedEmployees) {
        const existing = homologations.find(h => h.profile_id === profileId);
        
        if (existing?.id) {
          await supabase
            .from('point_homologations')
            .update({
              status: 'approved',
              approved_by: profile.id,
              approved_at: new Date().toISOString(),
              notes: approvalNotes || null,
            })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('point_homologations')
            .insert({
              company_id: company.id,
              profile_id: profileId,
              reference_month: referenceMonth,
              status: 'approved',
              approved_by: profile.id,
              approved_at: new Date().toISOString(),
              notes: approvalNotes || null,
            });
        }
      }
      
      toast.success(`${selectedEmployees.length} ponto(s) homologado(s) com sucesso`);
      setSelectedEmployees([]);
      setApprovalNotes('');
      setApprovalDialogOpen(false);
      fetchHomologations();
    } catch (error) {
      console.error('Error approving homologations:', error);
      toast.error('Erro ao homologar pontos');
    } finally {
      setLoading(false);
    }
  };

  const resolvePendency = async (pendencyId: string, notes: string) => {
    if (!profile?.id) return;
    
    try {
      await supabase
        .from('point_pendencies')
        .update({
          is_resolved: true,
          resolved_by: profile.id,
          resolved_at: new Date().toISOString(),
          resolution_notes: notes,
        })
        .eq('id', pendencyId);
      
      toast.success('Pendência resolvida');
      fetchHomologations();
    } catch (error) {
      toast.error('Erro ao resolver pendência');
    }
  };

  const stats = {
    total: homologations.length,
    approved: homologations.filter(h => h.status === 'approved').length,
    pending: homologations.filter(h => h.status === 'pending' && (h.pendencies_count || 0) === 0).length,
    blocked: homologations.filter(h => (h.pendencies_count || 0) > 0).length,
  };

  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM/yyyy', { locale: ptBR }),
    };
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <PageHeader
          title="Homologação de Ponto"
          description="Aprove o ponto eletrônico dos servidores da sua unidade" icon={FileCheck}
          className="mb-0 min-w-0 flex-1 border-0 bg-transparent p-0 backdrop-blur-none sm:p-0"
        />
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Users className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total de Servidores</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              <div>
                <p className="text-2xl font-bold text-emerald-500">{stats.approved}</p>
                <p className="text-sm text-muted-foreground">Homologados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Clock className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold text-yellow-500">{stats.pending}</p>
                <p className="text-sm text-muted-foreground">Pendentes de Aprovação</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <XCircle className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-2xl font-bold text-red-500">{stats.blocked}</p>
                <p className="text-sm text-muted-foreground">Com Pendências</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Mês de Referência</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Buscar Servidor</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome ou matrícula..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendente de Aprovação</SelectItem>
                  <SelectItem value="blocked">Com Pendências</SelectItem>
                  <SelectItem value="approved">Homologado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button 
                onClick={handleApproveSelected}
                disabled={selectedEmployees.length === 0 || loading}
                className="w-full"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Homologar Selecionados ({selectedEmployees.length})
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employees Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Lista de Servidores - {format(parseISO(`${selectedMonth}-01`), 'MMMM/yyyy', { locale: ptBR })}
          </CardTitle>
          <CardDescription>
            Servidores com ✓ verde podem ter o ponto homologado. Servidores com ✗ vermelho possuem pendências.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedEmployees.length > 0 && selectedEmployees.length === filteredHomologations.filter(h => h.status !== 'approved' && (h.pendencies_count || 0) === 0).length}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="w-12">Status</TableHead>
                  <TableHead>Servidor</TableHead>
                  <TableHead>Matrícula</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10">
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                        Carregando...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredHomologations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                      Nenhum servidor encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredHomologations.map(h => {
                    const canSelect = h.status !== 'approved' && (h.pendencies_count || 0) === 0;
                    const hasPendencies = (h.pendencies_count || 0) > 0;
                    
                    return (
                      <TableRow key={h.profile_id} className={hasPendencies ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                        <TableCell>
                          <Checkbox
                            checked={selectedEmployees.includes(h.profile_id)}
                            onCheckedChange={(checked) => handleSelectEmployee(h.profile_id, !!checked)}
                            disabled={!canSelect}
                          />
                        </TableCell>
                        <TableCell>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                {h.status === 'approved' ? (
                                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                                ) : hasPendencies ? (
                                  <XCircle className="h-6 w-6 text-red-500" />
                                ) : (
                                  <Clock className="h-6 w-6 text-yellow-500" />
                                )}
                              </TooltipTrigger>
                              <TooltipContent>
                                {h.status === 'approved' 
                                  ? 'Ponto homologado' 
                                  : hasPendencies 
                                    ? `${h.pendencies_count} pendência(s) - clique para ver` 
                                    : 'Aguardando homologação'}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell className="font-medium">{h.profile?.full_name}</TableCell>
                        <TableCell>{h.profile?.registration_number || '-'}</TableCell>
                        <TableCell>{h.profile?.department || '-'}</TableCell>
                        <TableCell>{getStatusBadge(h.status, h.pendencies_count)}</TableCell>
                        <TableCell className="text-right">
                          {hasPendencies && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewPendencies(h.profile!)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Ver Pendências
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pendency Dialog */}
      <Dialog open={pendencyDialogOpen} onOpenChange={setPendencyDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pendências - {selectedEmployee?.full_name}</DialogTitle>
            <DialogDescription>
              Resolva todas as pendências para poder homologar o ponto deste servidor.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {selectedEmployee && pendencies[selectedEmployee.id]?.filter(p => !p.is_resolved).map(p => (
              <div key={p.id} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={PENDENCY_TYPES[p.pendency_type]?.color}>
                        {PENDENCY_TYPES[p.pendency_type]?.label || p.pendency_type}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {format(parseISO(p.reference_date), 'dd/MM/yyyy')}
                      </span>
                    </div>
                    <p className="text-sm">{p.description}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => resolvePendency(p.id, 'Resolvido pelo gestor')}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Resolver
                  </Button>
                </div>
              </div>
            ))}
            
            {selectedEmployee && (!pendencies[selectedEmployee.id] || pendencies[selectedEmployee.id].filter(p => !p.is_resolved).length === 0) && (
              <p className="text-center text-muted-foreground py-4">
                Nenhuma pendência encontrada
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Approval Dialog */}
      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Homologação</DialogTitle>
            <DialogDescription>
              Você está prestes a homologar o ponto de {selectedEmployees.length} servidor(es) 
              referente a {format(parseISO(`${selectedMonth}-01`), 'MMMM/yyyy', { locale: ptBR })}.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Observações (opcional)</Label>
              <Textarea
                placeholder="Adicione observações sobre esta homologação..."
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setApprovalDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmApproval} disabled={loading}>
              {loading ? 'Processando...' : 'Confirmar Homologação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
