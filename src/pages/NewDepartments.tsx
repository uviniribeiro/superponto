import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Building2, Plus, Edit, Trash2, Users } from 'lucide-react';

interface Department {
  id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  is_active: boolean;
  company_id: string | null;
  code?: string;
}

export default function NewDepartments() {
  const { profile } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [employeeCounts, setEmployeeCounts] = useState<Record<string, number>>({});
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    cost_center: '',
    status: 'active',
  });

  useEffect(() => {
    fetchDepartments();
    fetchEmployeeCounts();
  }, []);

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
      toast.error('Erro ao carregar departamentos');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployeeCounts = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('department')
      .eq('is_active', true);

    const counts: Record<string, number> = {};
    (data || []).forEach((p: any) => {
      if (p.department) {
        counts[p.department] = (counts[p.department] || 0) + 1;
      }
    });
    setEmployeeCounts(counts);
  };

  const getEmployeeCount = (deptName: string) => {
    return employeeCounts[deptName] || 0;
  };

  const openDialog = (dept?: Department) => {
    if (dept) {
      setEditingDept(dept);
      setFormData({
        name: dept.name,
        code: dept.code || '',
        description: dept.description || '',
        cost_center: '',
        status: dept.is_active ? 'active' : 'inactive',
      });
    } else {
      setEditingDept(null);
      setFormData({
        name: '',
        code: '',
        description: '',
        cost_center: '',
        status: 'active',
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    try {
      const data = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        is_active: formData.status === 'active',
        company_id: profile?.company_id,
      };

      if (editingDept) {
        const { error } = await supabase
          .from('departments')
          .update(data)
          .eq('id', editingDept.id);
        if (error) throw error;
        toast.success('Departamento atualizado!');
      } else {
        const { error } = await supabase.from('departments').insert(data);
        if (error) throw error;
        toast.success('Departamento criado!');
      }

      setIsDialogOpen(false);
      fetchDepartments();
    } catch (error) {
      console.error('Error saving department:', error);
      toast.error('Erro ao salvar departamento');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este departamento?')) return;

    try {
      const { error } = await supabase.from('departments').delete().eq('id', id);
      if (error) throw error;
      toast.success('Departamento excluído!');
      fetchDepartments();
    } catch (error) {
      console.error('Error deleting department:', error);
      toast.error('Erro ao excluir. O departamento pode estar vinculado a funcionários.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Departamentos</h1>
          <p className="text-sm text-muted-foreground">
            {departments.length} departamentos cadastrados
          </p>
        </div>
        <Button onClick={() => openDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Departamento
        </Button>
      </div>

      {/* Department Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {departments.map((dept) => (
          <Card key={dept.id} className="relative">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{dept.name}</h3>
                    {dept.code && (
                      <p className="text-xs text-muted-foreground">{dept.code}</p>
                    )}
                  </div>
                </div>
                <Badge 
                  variant={dept.is_active ? 'default' : 'secondary'}
                  className={dept.is_active 
                    ? 'bg-green-100 text-green-700 hover:bg-green-100' 
                    : ''
                  }
                >
                  {dept.is_active ? 'ativo' : 'inativo'}
                </Badge>
              </div>

              {dept.description && (
                <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
                  {dept.description}
                </p>
              )}

              <div className="flex items-center justify-between mt-4 pt-3 border-t">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{getEmployeeCount(dept.name)} funcionário(s)</span>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openDialog(dept)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleDelete(dept.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {departments.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum departamento cadastrado</p>
        </div>
      )}

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingDept ? 'Editar Departamento' : 'Novo Departamento'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome do departamento"
                />
              </div>
              <div className="space-y-2">
                <Label>Código *</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="Código único"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição do departamento"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Centro de Custo</Label>
                <Input
                  value={formData.cost_center}
                  onChange={(e) => setFormData({ ...formData, cost_center: e.target.value })}
                  placeholder="Centro de custo"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData({ ...formData, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
