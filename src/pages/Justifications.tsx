import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { FileCheck, Plus, Edit, Trash2, Search } from 'lucide-react';
import { HelpButton } from '@/components/HelpButton';

interface Justification {
  id: string;
  code: string | null;
  description: string;
  justify_type: string;
  deduct_hours: boolean;
  generate_extra: boolean;
  payroll_code: string | null;
  absence_days: number | null;
  usage_limit: number | null;
  usage_limit_period_months: number | null;
  visible_to_employees: boolean;
  is_active: boolean;
}

const justifyTypes = [
  { value: 'absence', label: 'Falta' },
  { value: 'delay', label: 'Atraso' },
  { value: 'early_leave', label: 'Saída Antecipada' },
  { value: 'overtime', label: 'Hora Extra' },
  { value: 'medical', label: 'Atestado Médico' },
  { value: 'vacation', label: 'Férias' },
  { value: 'leave', label: 'Licença' },
  { value: 'other', label: 'Outros' },
];

export default function Justifications() {
  const { profile } = useAuth();
  const [justifications, setJustifications] = useState<Justification[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingJustification, setEditingJustification] = useState<Justification | null>(null);

  const [formData, setFormData] = useState({
    code: '',
    description: '',
    justify_type: 'absence',
    deduct_hours: false,
    generate_extra: false,
    payroll_code: '',
    absence_days: '',
    usage_limit: '',
    usage_limit_period_months: '',
    visible_to_employees: false,
    is_active: true,
  });

  useEffect(() => {
    fetchJustifications();
  }, []);

  const fetchJustifications = async () => {
    try {
      const { data, error } = await supabase
        .from('justifications')
        .select('*')
        .order('description');

      if (error) throw error;
      setJustifications(data || []);
    } catch (error) {
      console.error('Error fetching justifications:', error);
      toast.error('Erro ao carregar justificativas');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.description.trim() || formData.description.length < 3) {
      toast.error('Descrição deve ter pelo menos 3 caracteres');
      return;
    }

    try {
      const data = {
        code: formData.code.trim() || null,
        description: formData.description.trim(),
        justify_type: formData.justify_type,
        deduct_hours: formData.deduct_hours,
        generate_extra: formData.generate_extra,
        payroll_code: formData.payroll_code.trim() || null,
        absence_days: formData.absence_days ? parseInt(formData.absence_days) : null,
        usage_limit: formData.usage_limit ? parseInt(formData.usage_limit) : null,
        usage_limit_period_months: formData.usage_limit_period_months ? parseInt(formData.usage_limit_period_months) : null,
        visible_to_employees: formData.visible_to_employees,
        is_active: formData.is_active,
        company_id: profile?.company_id,
      };

      if (editingJustification) {
        const { error } = await supabase
          .from('justifications')
          .update(data)
          .eq('id', editingJustification.id);
        if (error) throw error;
        toast.success('Justificativa atualizada!');
      } else {
        const { error } = await supabase.from('justifications').insert(data);
        if (error) throw error;
        toast.success('Justificativa criada!');
      }

      setIsDialogOpen(false);
      resetForm();
      fetchJustifications();
    } catch (error: unknown) {
      console.error('Error saving justification:', error);
      const code = error instanceof Error && 'code' in error ? (error as { code: string }).code : '';
      if (code === '23505') {
        toast.error('Já existe uma justificativa com essa descrição');
      } else {
        toast.error('Erro ao salvar justificativa');
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta justificativa?')) return;

    try {
      const { error } = await supabase.from('justifications').delete().eq('id', id);
      if (error) throw error;
      toast.success('Justificativa excluída!');
      fetchJustifications();
    } catch (error) {
      console.error('Error deleting justification:', error);
      toast.error('Erro ao excluir. A justificativa pode estar em uso.');
    }
  };

  const openEditDialog = (justification: Justification) => {
    setEditingJustification(justification);
    setFormData({
      code: justification.code || '',
      description: justification.description,
      justify_type: justification.justify_type,
      deduct_hours: justification.deduct_hours,
      generate_extra: justification.generate_extra,
      payroll_code: justification.payroll_code || '',
      absence_days: justification.absence_days?.toString() || '',
      usage_limit: justification.usage_limit?.toString() || '',
      usage_limit_period_months: justification.usage_limit_period_months?.toString() || '',
      visible_to_employees: justification.visible_to_employees,
      is_active: justification.is_active,
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingJustification(null);
    setFormData({
      code: '',
      description: '',
      justify_type: 'absence',
      deduct_hours: false,
      generate_extra: false,
      payroll_code: '',
      absence_days: '',
      usage_limit: '',
      usage_limit_period_months: '',
      visible_to_employees: false,
      is_active: true,
    });
  };

  const filteredJustifications = justifications.filter(j =>
    j.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    j.code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTypeLabel = (type: string) => {
    return justifyTypes.find(t => t.value === type)?.label || type;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileCheck className="h-8 w-8 text-primary" />
            Justificativas
          </h1>
          <p className="text-muted-foreground">Gerencie os tipos de justificativas para abonos e afastamentos</p>
        </div>
        <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="gradient-primary">
          <Plus className="h-4 w-4 mr-2" />
          Nova Justificativa
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Lista de Justificativas</CardTitle>
            <CardDescription>{justifications.length} justificativas cadastradas</CardDescription>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Carregando...</div>
          ) : filteredJustifications.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Desconta Horas</TableHead>
                  <TableHead>Gera Extra</TableHead>
                  <TableHead>Visível Func.</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredJustifications.map((justification) => (
                  <TableRow key={justification.id}>
                    <TableCell>{justification.code || '-'}</TableCell>
                    <TableCell className="font-medium">{justification.description}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{getTypeLabel(justification.justify_type)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={justification.deduct_hours ? 'destructive' : 'outline'}>
                        {justification.deduct_hours ? 'Sim' : 'Não'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={justification.generate_extra ? 'default' : 'outline'}>
                        {justification.generate_extra ? 'Sim' : 'Não'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={justification.visible_to_employees ? 'default' : 'outline'}>
                        {justification.visible_to_employees ? 'Sim' : 'Não'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={justification.is_active ? 'default' : 'secondary'}>
                        {justification.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(justification)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(justification.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma justificativa cadastrada
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingJustification ? 'Editar' : 'Nova'} Justificativa</DialogTitle>
            <DialogDescription>Preencha os dados da justificativa</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="Código opcional"
                  maxLength={5}
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={formData.justify_type}
                  onValueChange={(v) => setFormData({ ...formData, justify_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {justifyTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Nome da justificativa"
                maxLength={50}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código Folha</Label>
                <Input
                  value={formData.payroll_code}
                  onChange={(e) => setFormData({ ...formData, payroll_code: e.target.value })}
                  placeholder="Código para folha"
                  maxLength={20}
                />
              </div>
              <div className="space-y-2">
                <Label>Dias de Afastamento</Label>
                <Input
                  type="number"
                  value={formData.absence_days}
                  onChange={(e) => setFormData({ ...formData, absence_days: e.target.value })}
                  placeholder="Quantidade padrão"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Limite de Uso</Label>
                <Input
                  type="number"
                  value={formData.usage_limit}
                  onChange={(e) => setFormData({ ...formData, usage_limit: e.target.value })}
                  placeholder="Sem limite"
                />
              </div>
              <div className="space-y-2">
                <Label>Período (meses)</Label>
                <Input
                  type="number"
                  value={formData.usage_limit_period_months}
                  onChange={(e) => setFormData({ ...formData, usage_limit_period_months: e.target.value })}
                  placeholder="Para limite de uso"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Desconta Horas</Label>
                <Switch
                  checked={formData.deduct_hours}
                  onCheckedChange={(checked) => setFormData({ ...formData, deduct_hours: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Gera Hora Extra</Label>
                <Switch
                  checked={formData.generate_extra}
                  onCheckedChange={(checked) => setFormData({ ...formData, generate_extra: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Visível para Funcionários</Label>
                <Switch
                  checked={formData.visible_to_employees}
                  onCheckedChange={(checked) => setFormData({ ...formData, visible_to_employees: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Ativo</Label>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} className="gradient-primary">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <HelpButton pageKey="justifications" />
    </div>
  );
}
