import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { ClipboardCheck, Check, X, Clock, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AdjustmentRequest {
  id: string;
  profile_id: string;
  time_record_id: string | null;
  request_type: string;
  original_time: string | null;
  requested_time: string | null;
  reason: string;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  profiles?: { full_name: string; email: string };
}

export default function Adjustments() {
  const { profile } = useAuth();
  const [adjustments, setAdjustments] = useState<AdjustmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAdjustment, setSelectedAdjustment] = useState<AdjustmentRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');

  useEffect(() => {
    fetchAdjustments();
  }, []);

  const fetchAdjustments = async () => {
    try {
      const { data, error } = await supabase
        .from('adjustment_requests')
        .select(`
          *,
          profiles!adjustment_requests_profile_id_fkey (full_name, email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAdjustments(data || []);
    } catch (error) {
      console.error('Error fetching adjustments:', error);
      toast.error('Erro ao carregar solicitações');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (approved: boolean) => {
    if (!selectedAdjustment || !profile) return;

    try {
      const { error } = await supabase
        .from('adjustment_requests')
        .update({
          status: approved ? 'approved' : 'rejected',
          reviewed_by: profile.id,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes || null
        })
        .eq('id', selectedAdjustment.id);

      if (error) throw error;

      // If approved and it's an addition, create the time record
      if (approved && selectedAdjustment.request_type === 'addition' && selectedAdjustment.requested_time) {
        await supabase.from('time_records').insert({
          profile_id: selectedAdjustment.profile_id,
          record_type: 'entry',
          recorded_at: selectedAdjustment.requested_time,
          device_info: 'Ajuste aprovado'
        });
      }

      toast.success(approved ? 'Solicitação aprovada!' : 'Solicitação rejeitada');
      setIsDialogOpen(false);
      setSelectedAdjustment(null);
      setReviewNotes('');
      fetchAdjustments();
    } catch (error) {
      console.error('Error reviewing adjustment:', error);
      toast.error('Erro ao processar solicitação');
    }
  };

  const openReviewDialog = (adjustment: AdjustmentRequest) => {
    setSelectedAdjustment(adjustment);
    setReviewNotes('');
    setIsDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      pending: { variant: 'secondary', label: 'Pendente' },
      approved: { variant: 'default', label: 'Aprovado' },
      rejected: { variant: 'destructive', label: 'Rejeitado' }
    };
    const config = variants[status] || variants.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getRequestTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      correction: 'Correção',
      addition: 'Adição',
      deletion: 'Exclusão'
    };
    return labels[type] || type;
  };

  const filteredAdjustments = adjustments.filter(adj => {
    if (activeTab === 'pending') return adj.status === 'pending';
    if (activeTab === 'reviewed') return adj.status !== 'pending';
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ClipboardCheck className="h-8 w-8 text-primary" />
            Aprovação de Ajustes
          </h1>
          <p className="text-muted-foreground">Gerencie as solicitações de ajuste de ponto</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="pending" className="gap-2">
                <Clock className="h-4 w-4" />
                Pendentes
                <Badge variant="secondary" className="ml-1">
                  {adjustments.filter(a => a.status === 'pending').length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="reviewed">Analisados</TabsTrigger>
              <TabsTrigger value="all">Todos</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-pulse-soft">Carregando...</div>
            </div>
          ) : filteredAdjustments.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Data/Hora Original</TableHead>
                    <TableHead>Data/Hora Solicitada</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data Solicitação</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAdjustments.map((adjustment) => (
                    <TableRow key={adjustment.id}>
                      <TableCell className="font-medium">
                        {adjustment.profiles?.full_name || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getRequestTypeLabel(adjustment.request_type)}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {adjustment.original_time 
                          ? format(new Date(adjustment.original_time), 'dd/MM/yyyy HH:mm')
                          : '-'}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {adjustment.requested_time 
                          ? format(new Date(adjustment.requested_time), 'dd/MM/yyyy HH:mm')
                          : '-'}
                      </TableCell>
                      <TableCell className="max-w-xs truncate" title={adjustment.reason}>
                        {adjustment.reason}
                      </TableCell>
                      <TableCell>{getStatusBadge(adjustment.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(adjustment.created_at), 'dd/MM/yyyy HH:mm')}
                      </TableCell>
                      <TableCell className="text-right">
                        {adjustment.status === 'pending' ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-success border-success hover:bg-success/10"
                              onClick={() => openReviewDialog(adjustment)}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Aprovar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive border-destructive hover:bg-destructive/10"
                              onClick={() => openReviewDialog(adjustment)}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Rejeitar
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openReviewDialog(adjustment)}
                          >
                            <MessageSquare className="h-4 w-4 mr-1" />
                            Ver
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8">
              <ClipboardCheck className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                {activeTab === 'pending' 
                  ? 'Nenhuma solicitação pendente'
                  : 'Nenhuma solicitação encontrada'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedAdjustment?.status === 'pending' 
                ? 'Analisar Solicitação' 
                : 'Detalhes da Solicitação'}
            </DialogTitle>
            <DialogDescription>
              Revise os detalhes e tome uma decisão
            </DialogDescription>
          </DialogHeader>

          {selectedAdjustment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Funcionário:</span>
                  <p className="font-medium">{selectedAdjustment.profiles?.full_name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Tipo:</span>
                  <p className="font-medium">{getRequestTypeLabel(selectedAdjustment.request_type)}</p>
                </div>
                {selectedAdjustment.original_time && (
                  <div>
                    <span className="text-muted-foreground">Horário Original:</span>
                    <p className="font-medium font-mono">
                      {format(new Date(selectedAdjustment.original_time), 'dd/MM/yyyy HH:mm')}
                    </p>
                  </div>
                )}
                {selectedAdjustment.requested_time && (
                  <div>
                    <span className="text-muted-foreground">Horário Solicitado:</span>
                    <p className="font-medium font-mono">
                      {format(new Date(selectedAdjustment.requested_time), 'dd/MM/yyyy HH:mm')}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <span className="text-sm text-muted-foreground">Motivo:</span>
                <p className="mt-1 p-3 bg-secondary/50 rounded-lg">{selectedAdjustment.reason}</p>
              </div>

              {selectedAdjustment.status === 'pending' ? (
                <div>
                  <span className="text-sm text-muted-foreground">Observações (opcional):</span>
                  <Textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Adicione observações sobre sua decisão..."
                    className="mt-1"
                  />
                </div>
              ) : selectedAdjustment.review_notes && (
                <div>
                  <span className="text-sm text-muted-foreground">Observações do revisor:</span>
                  <p className="mt-1 p-3 bg-secondary/50 rounded-lg">{selectedAdjustment.review_notes}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {selectedAdjustment?.status === 'pending' ? (
              <>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={() => handleReview(false)}
                >
                  <X className="h-4 w-4 mr-2" />
                  Rejeitar
                </Button>
                <Button 
                  className="bg-success hover:bg-success/90" 
                  onClick={() => handleReview(true)}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Aprovar
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Fechar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}