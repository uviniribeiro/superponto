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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { AlertCircle, Plus, CheckCircle2, XCircle, Clock, Search, FileText, Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PageHeader } from '@/components/shared/PageHeader';

interface Occurrence {
  id: string;
  profile_id: string;
  occurrence_date: string;
  occurrence_type: string;
  description: string;
  justification_id: string | null;
  document_url: string | null;
  registered_by: string;
  is_approved: boolean | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  profile?: { full_name: string; registration_number: string | null };
  registrant?: { full_name: string };
}

interface Justification {
  id: string;
  description: string;
  code: string | null;
}

const OCCURRENCE_TYPES: Record<string, { label: string; color: string }> = {
  late_arrival: { label: 'Atraso', color: 'bg-yellow-500' },
  early_departure: { label: 'Saída antecipada', color: 'bg-yellow-500' },
  absence: { label: 'Falta', color: 'bg-red-500' },
  overtime: { label: 'Hora extra', color: 'bg-blue-500' },
  schedule_change: { label: 'Alteração de horário', color: 'bg-purple-500' },
  external_work: { label: 'Trabalho externo', color: 'bg-indigo-500' },
  training: { label: 'Treinamento', color: 'bg-emerald-500' },
  medical: { label: 'Atestado médico', color: 'bg-orange-500' },
  personal: { label: 'Pessoal', color: 'bg-gray-500' },
  other: { label: 'Outro', color: 'bg-gray-400' },
};

export default function PointOccurrences() {
  const { profile, company, isAdmin, isManager } = useAuth();
  const canManage = isAdmin || isManager;
  
  const [loading, setLoading] = useState(false);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [justifications, setJustifications] = useState<Justification[]>([]);
  const [employees, setEmployees] = useState<{ id: string; full_name: string }[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    profile_id: '',
    occurrence_date: format(new Date(), 'yyyy-MM-dd'),
    occurrence_type: 'other',
    description: '',
    justification_id: '',
  });

  useEffect(() => {
    fetchOccurrences();
    fetchJustifications();
    if (canManage) {
      fetchEmployees();
    }
  }, [canManage]);

  const fetchOccurrences = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('point_occurrences')
        .select('*')
        .order('occurrence_date', { ascending: false })
        .order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      
      // Fetch profiles separately
      const profileIds = [...new Set((data || []).map(o => o.profile_id))];
      const registrantIds = [...new Set((data || []).map(o => o.registered_by))];
      const allIds = [...new Set([...profileIds, ...registrantIds])];
      
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, registration_number')
        .in('id', allIds);
      
      const profileMap = new Map((profiles || []).map(p => [p.id, p]));
      
      const enrichedOccurrences = (data || []).map(o => ({
        ...o,
        profile: profileMap.get(o.profile_id),
        registrant: profileMap.get(o.registered_by),
      }));
      
      setOccurrences(enrichedOccurrences);
    } catch (error) {
      console.error('Error fetching occurrences:', error);
      toast.error('Erro ao carregar ocorrências');
    } finally {
      setLoading(false);
    }
  };

  const fetchJustifications = async () => {
    const { data } = await supabase
      .from('justifications')
      .select('id, description, code')
      .eq('is_active', true)
      .order('description');
    setJustifications(data || []);
  };

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('is_active', true)
      .order('full_name');
    setEmployees(data || []);
  };

  const handleSubmit = async () => {
    if (!profile?.id || !company?.id) return;
    if (!formData.description.trim()) {
      toast.error('Preencha a descrição da ocorrência');
      return;
    }
    
    const targetProfileId = canManage && formData.profile_id ? formData.profile_id : profile.id;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('point_occurrences')
        .insert({
          company_id: company.id,
          profile_id: targetProfileId,
          occurrence_date: formData.occurrence_date,
          occurrence_type: formData.occurrence_type,
          description: formData.description,
          justification_id: formData.justification_id || null,
          registered_by: profile.id,
        });

      if (error) throw error;
      
      toast.success('Ocorrência registrada com sucesso');
      setDialogOpen(false);
      setFormData({
        profile_id: '',
        occurrence_date: format(new Date(), 'yyyy-MM-dd'),
        occurrence_type: 'other',
        description: '',
        justification_id: '',
      });
      fetchOccurrences();
    } catch (error) {
      console.error('Error creating occurrence:', error);
      toast.error('Erro ao registrar ocorrência');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (occurrenceId: string, approved: boolean) => {
    if (!profile?.id) return;
    
    try {
      const { error } = await supabase
        .from('point_occurrences')
        .update({
          is_approved: approved,
          approved_by: profile.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', occurrenceId);

      if (error) throw error;
      
      toast.success(approved ? 'Ocorrência aprovada' : 'Ocorrência rejeitada');
      fetchOccurrences();
    } catch (error) {
      toast.error('Erro ao processar ocorrência');
    }
  };

  const getStatusBadge = (occurrence: Occurrence) => {
    if (occurrence.is_approved === true) {
      return (
        <Badge className="bg-emerald-500 gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Aprovada
        </Badge>
      );
    }
    if (occurrence.is_approved === false) {
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          Rejeitada
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="gap-1">
        <Clock className="h-3 w-3" />
        Pendente
      </Badge>
    );
  };

  const filteredOccurrences = occurrences.filter(o => {
    const matchesSearch = !searchTerm ||
      o.profile?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filterType === 'all' || o.occurrence_type === filterType;
    
    const matchesStatus = filterStatus === 'all' ||
      (filterStatus === 'pending' && o.is_approved === null) ||
      (filterStatus === 'approved' && o.is_approved === true) ||
      (filterStatus === 'rejected' && o.is_approved === false);
    
    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <PageHeader
          title="Registro de Ocorrências"
          description="Registre e gerencie ocorrências do ponto eletrônico" icon={AlertCircle}
          className="mb-0 min-w-0 flex-1 border-0 bg-transparent p-0 backdrop-blur-none sm:p-0"
        />
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova Ocorrência
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Ocorrência</DialogTitle>
              <DialogDescription>
                Registre uma ocorrência para justificar irregularidades no ponto.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {canManage && (
                <div className="space-y-2">
                  <Label>Servidor</Label>
                  <Select 
                    value={formData.profile_id} 
                    onValueChange={(v) => setFormData({ ...formData, profile_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um servidor (ou deixe vazio para você)" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data</Label>
                  <Input
                    type="date"
                    value={formData.occurrence_date}
                    onChange={(e) => setFormData({ ...formData, occurrence_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select 
                    value={formData.occurrence_type} 
                    onValueChange={(v) => setFormData({ ...formData, occurrence_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(OCCURRENCE_TYPES).map(([key, { label }]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Justificativa</Label>
                <Select 
                  value={formData.justification_id} 
                  onValueChange={(v) => setFormData({ ...formData, justification_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma justificativa (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {justifications.map(j => (
                      <SelectItem key={j.id} value={j.id}>
                        {j.code ? `${j.code} - ` : ''}{j.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  placeholder="Descreva detalhadamente a ocorrência..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? 'Salvando...' : 'Registrar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome ou descrição..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  {Object.entries(OCCURRENCE_TYPES).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="approved">Aprovada</SelectItem>
                  <SelectItem value="rejected">Rejeitada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Occurrences Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Ocorrências Registradas
          </CardTitle>
          <CardDescription>
            {filteredOccurrences.length} ocorrência(s) encontrada(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Servidor</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Registrado por</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && <TableHead className="text-right">Ações</TableHead>}
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
                ) : filteredOccurrences.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                      Nenhuma ocorrência encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOccurrences.map(o => (
                    <TableRow key={o.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {format(parseISO(o.occurrence_date), 'dd/MM/yyyy')}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {o.profile?.full_name || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={OCCURRENCE_TYPES[o.occurrence_type]?.color || 'bg-gray-500'}>
                          {OCCURRENCE_TYPES[o.occurrence_type]?.label || o.occurrence_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {o.description}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {o.registrant?.full_name || '-'}
                      </TableCell>
                      <TableCell>{getStatusBadge(o)}</TableCell>
                      {canManage && (
                        <TableCell className="text-right">
                          {o.is_approved === null && (
                            <div className="flex gap-2 justify-end">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-emerald-500 hover:text-emerald-600"
                                onClick={() => handleApprove(o.id, true)}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-500 hover:text-red-600"
                                onClick={() => handleApprove(o.id, false)}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
