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
import { toast } from 'sonner';
import { FileText, Printer, Send, CheckCircle2, Clock, Search, Users, Calendar, Download, Undo2, Filter } from 'lucide-react';
import { format, subMonths, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PageHeader } from '@/components/shared/PageHeader';

interface PointCard {
  id: string;
  profile_id: string;
  reference_month: string;
  file_url: string | null;
  generated_at: string;
  sent_for_signature: boolean;
  sent_at: string | null;
  signed: boolean;
  signed_at: string | null;
  returned_at: string | null;
  notes: string | null;
  profile?: { full_name: string; registration_number: string | null; department: string | null };
}

interface Employee {
  id: string;
  full_name: string;
  registration_number: string | null;
  department: string | null;
}

export default function PointCards() {
  const { profile, company } = useAuth();
  const [loading, setLoading] = useState(false);
  const [cards, setCards] = useState<PointCard[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(format(subMonths(new Date(), 1), 'yyyy-MM'));
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [selectedEmployeesForGeneration, setSelectedEmployeesForGeneration] = useState<string[]>([]);

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (employees.length > 0) {
      fetchCards();
    }
  }, [selectedMonth, employees]);

  const fetchEmployees = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, registration_number, department')
      .eq('is_active', true)
      .order('full_name');

    if (error) {
      toast.error('Erro ao carregar funcionários');
      return;
    }
    setEmployees(data || []);
  };

  const fetchCards = async () => {
    setLoading(true);
    const referenceMonth = `${selectedMonth}-01`;

    try {
      const { data, error } = await supabase
        .from('point_cards')
        .select('*')
        .eq('reference_month', referenceMonth);

      if (error) throw error;

      // Map with employee data
      const cardMap = new Map((data || []).map(c => [c.profile_id, c]));
      
      const allCards: PointCard[] = employees.map(emp => {
        const existing = cardMap.get(emp.id);
        if (existing) {
          return { ...existing, profile: emp };
        }
        return {
          id: '',
          profile_id: emp.id,
          reference_month: referenceMonth,
          file_url: null,
          generated_at: '',
          sent_for_signature: false,
          sent_at: null,
          signed: false,
          signed_at: null,
          returned_at: null,
          notes: null,
          profile: emp,
        };
      });

      setCards(allCards);
    } catch (error) {
      console.error('Error fetching cards:', error);
      toast.error('Erro ao carregar cartões de ponto');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (card: PointCard) => {
    if (card.signed) {
      return (
        <Badge className="bg-emerald-500 gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Assinado
        </Badge>
      );
    }
    if (card.sent_for_signature) {
      return (
        <Badge variant="outline" className="border-blue-500 text-blue-500 gap-1">
          <Send className="h-3 w-3" />
          Enviado para Assinatura
        </Badge>
      );
    }
    if (card.id) {
      return (
        <Badge variant="secondary" className="gap-1">
          <FileText className="h-3 w-3" />
          Gerado
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1">
        <Clock className="h-3 w-3" />
        Não gerado
      </Badge>
    );
  };

  const filteredCards = cards.filter(c => {
    const matchesSearch = !searchTerm ||
      c.profile?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.profile?.registration_number?.includes(searchTerm);
    
    const matchesStatus = filterStatus === 'all' ||
      (filterStatus === 'not_generated' && !c.id) ||
      (filterStatus === 'generated' && c.id && !c.sent_for_signature) ||
      (filterStatus === 'sent' && c.sent_for_signature && !c.signed) ||
      (filterStatus === 'signed' && c.signed);
    
    return matchesSearch && matchesStatus;
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedCards(filteredCards.filter(c => c.id && !c.signed).map(c => c.id));
    } else {
      setSelectedCards([]);
    }
  };

  const handleSelectCard = (cardId: string, checked: boolean) => {
    if (checked) {
      setSelectedCards(prev => [...prev, cardId]);
    } else {
      setSelectedCards(prev => prev.filter(id => id !== cardId));
    }
  };

  const handleGenerateCards = async () => {
    if (!profile?.id || !company?.id) return;
    if (selectedEmployeesForGeneration.length === 0) {
      toast.error('Selecione pelo menos um funcionário');
      return;
    }

    setLoading(true);
    const referenceMonth = `${selectedMonth}-01`;

    try {
      for (const employeeId of selectedEmployeesForGeneration) {
        // Check if card already exists
        const existing = cards.find(c => c.profile_id === employeeId && c.id);
        if (existing) continue;

        await supabase
          .from('point_cards')
          .insert({
            company_id: company.id,
            profile_id: employeeId,
            reference_month: referenceMonth,
            generated_by: profile.id,
          });
      }

      toast.success(`${selectedEmployeesForGeneration.length} cartão(ões) gerado(s)`);
      setGenerateDialogOpen(false);
      setSelectedEmployeesForGeneration([]);
      fetchCards();
    } catch (error) {
      console.error('Error generating cards:', error);
      toast.error('Erro ao gerar cartões');
    } finally {
      setLoading(false);
    }
  };

  const handleSendForSignature = async () => {
    if (selectedCards.length === 0) {
      toast.error('Selecione pelo menos um cartão');
      return;
    }

    setLoading(true);
    try {
      await supabase
        .from('point_cards')
        .update({
          sent_for_signature: true,
          sent_at: new Date().toISOString(),
        })
        .in('id', selectedCards);

      toast.success(`${selectedCards.length} cartão(ões) enviado(s) para assinatura`);
      setSelectedCards([]);
      fetchCards();
    } catch (error) {
      toast.error('Erro ao enviar cartões');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsSigned = async (cardId: string) => {
    try {
      await supabase
        .from('point_cards')
        .update({
          signed: true,
          signed_at: new Date().toISOString(),
          returned_at: new Date().toISOString(),
        })
        .eq('id', cardId);

      toast.success('Cartão marcado como assinado');
      fetchCards();
    } catch (error) {
      toast.error('Erro ao atualizar cartão');
    }
  };

  const stats = {
    total: cards.length,
    generated: cards.filter(c => c.id).length,
    sent: cards.filter(c => c.sent_for_signature && !c.signed).length,
    signed: cards.filter(c => c.signed).length,
    pending: cards.filter(c => !c.id).length,
  };

  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM/yyyy', { locale: ptBR }),
    };
  });

  const employeesWithoutCard = employees.filter(e => !cards.find(c => c.profile_id === e.id && c.id));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <PageHeader
          title="Cartões de Ponto"
          description="Gere e gerencie cartões de ponto para coleta de assinaturas" icon={FileText}
          className="mb-0 min-w-0 flex-1 border-0 bg-transparent p-0 backdrop-blur-none sm:p-0"
        />
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setGenerateDialogOpen(true)}>
            <Printer className="h-4 w-4 mr-2" />
            Gerar Cartões
          </Button>
          <Button 
            onClick={handleSendForSignature}
            disabled={selectedCards.length === 0 || loading}
          >
            <Send className="h-4 w-4 mr-2" />
            Enviar para Assinatura ({selectedCards.length})
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Users className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total</p>
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
                <p className="text-sm text-muted-foreground">Não Gerados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <FileText className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold text-blue-500">{stats.generated}</p>
                <p className="text-sm text-muted-foreground">Gerados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Send className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold text-purple-500">{stats.sent}</p>
                <p className="text-sm text-muted-foreground">Aguardando Assinatura</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              <div>
                <p className="text-2xl font-bold text-emerald-500">{stats.signed}</p>
                <p className="text-sm text-muted-foreground">Assinados</p>
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
          <div className="grid gap-4 md:grid-cols-3">
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
                  <SelectItem value="not_generated">Não Gerado</SelectItem>
                  <SelectItem value="generated">Gerado</SelectItem>
                  <SelectItem value="sent">Enviado para Assinatura</SelectItem>
                  <SelectItem value="signed">Assinado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cards Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Cartões - {format(parseISO(`${selectedMonth}-01`), 'MMMM/yyyy', { locale: ptBR })}
          </CardTitle>
          <CardDescription>
            Prazo para envio: até o último dia útil do mês | Prazo para retorno: até o 5º dia útil
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedCards.length > 0 && selectedCards.length === filteredCards.filter(c => c.id && !c.signed).length}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Servidor</TableHead>
                  <TableHead>Matrícula</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Enviado em</TableHead>
                  <TableHead>Retornado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10">
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                        Carregando...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredCards.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                      Nenhum cartão encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCards.map(c => (
                    <TableRow key={c.profile_id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedCards.includes(c.id)}
                          onCheckedChange={(checked) => handleSelectCard(c.id, !!checked)}
                          disabled={!c.id || c.signed}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{c.profile?.full_name}</TableCell>
                      <TableCell>{c.profile?.registration_number || '-'}</TableCell>
                      <TableCell>{c.profile?.department || '-'}</TableCell>
                      <TableCell>{getStatusBadge(c)}</TableCell>
                      <TableCell>
                        {c.sent_at ? format(parseISO(c.sent_at), 'dd/MM/yyyy') : '-'}
                      </TableCell>
                      <TableCell>
                        {c.returned_at ? format(parseISO(c.returned_at), 'dd/MM/yyyy') : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          {c.id && !c.signed && c.sent_for_signature && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleMarkAsSigned(c.id)}
                              className="text-emerald-500"
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Marcar Assinado
                            </Button>
                          )}
                          {c.id && (
                            <Button size="sm" variant="ghost">
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Generate Cards Dialog */}
      <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Gerar Cartões de Ponto</DialogTitle>
            <DialogDescription>
              Selecione os servidores para gerar os cartões de ponto de {format(parseISO(`${selectedMonth}-01`), 'MMMM/yyyy', { locale: ptBR })}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="selectAllGenerate"
                checked={selectedEmployeesForGeneration.length === employeesWithoutCard.length && employeesWithoutCard.length > 0}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setSelectedEmployeesForGeneration(employeesWithoutCard.map(e => e.id));
                  } else {
                    setSelectedEmployeesForGeneration([]);
                  }
                }}
              />
              <Label htmlFor="selectAllGenerate">Selecionar todos ({employeesWithoutCard.length} servidores sem cartão)</Label>
            </div>

            <div className="max-h-64 overflow-y-auto border rounded-md p-4 space-y-2">
              {employeesWithoutCard.map(emp => (
                <div key={emp.id} className="flex items-center gap-2">
                  <Checkbox
                    id={emp.id}
                    checked={selectedEmployeesForGeneration.includes(emp.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedEmployeesForGeneration(prev => [...prev, emp.id]);
                      } else {
                        setSelectedEmployeesForGeneration(prev => prev.filter(id => id !== emp.id));
                      }
                    }}
                  />
                  <Label htmlFor={emp.id} className="flex-1 cursor-pointer">
                    {emp.full_name} {emp.registration_number ? `(${emp.registration_number})` : ''}
                  </Label>
                </div>
              ))}
              {employeesWithoutCard.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  Todos os servidores já possuem cartão gerado para este mês.
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleGenerateCards} 
              disabled={loading || selectedEmployeesForGeneration.length === 0}
            >
              {loading ? 'Gerando...' : `Gerar ${selectedEmployeesForGeneration.length} Cartão(ões)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
