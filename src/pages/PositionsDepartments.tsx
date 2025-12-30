import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Building2, Briefcase, Plus, Edit, Trash2, ChevronRight, Network } from 'lucide-react';
import { OrgChart } from '@/components/orgchart/OrgChart';

interface Department {
  id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  is_active: boolean;
  company_id: string | null;
}

interface Position {
  id: string;
  name: string;
  description: string | null;
  department_id: string | null;
  parent_id: string | null;
  level: number;
  is_active: boolean;
  company_id: string | null;
}

export default function PositionsDepartments() {
  const { profile } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);

  // Department dialog state
  const [isDeptDialogOpen, setIsDeptDialogOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deptForm, setDeptForm] = useState({ name: '', description: '', parent_id: '' });

  // Position dialog state
  const [isPosDialogOpen, setIsPosDialogOpen] = useState(false);
  const [editingPos, setEditingPos] = useState<Position | null>(null);
  const [posForm, setPosForm] = useState({ name: '', description: '', department_id: '', parent_id: '', level: '1' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [deptRes, posRes] = await Promise.all([
        supabase.from('departments').select('*').order('name'),
        supabase.from('positions').select('*').order('level').order('name')
      ]);

      if (deptRes.error) throw deptRes.error;
      if (posRes.error) throw posRes.error;

      setDepartments(deptRes.data || []);
      setPositions(posRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  // Department functions
  const openDeptDialog = (dept?: Department) => {
    if (dept) {
      setEditingDept(dept);
      setDeptForm({
        name: dept.name,
        description: dept.description || '',
        parent_id: dept.parent_id || ''
      });
    } else {
      setEditingDept(null);
      setDeptForm({ name: '', description: '', parent_id: '' });
    }
    setIsDeptDialogOpen(true);
  };

  const saveDepartment = async () => {
    if (!deptForm.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    try {
      const data = {
        name: deptForm.name.trim(),
        description: deptForm.description.trim() || null,
        parent_id: deptForm.parent_id || null,
        company_id: profile?.company_id
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

      setIsDeptDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving department:', error);
      toast.error('Erro ao salvar departamento');
    }
  };

  const deleteDepartment = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este departamento?')) return;

    try {
      const { error } = await supabase.from('departments').delete().eq('id', id);
      if (error) throw error;
      toast.success('Departamento excluído!');
      fetchData();
    } catch (error) {
      console.error('Error deleting department:', error);
      toast.error('Erro ao excluir departamento');
    }
  };

  // Position functions
  const openPosDialog = (pos?: Position) => {
    if (pos) {
      setEditingPos(pos);
      setPosForm({
        name: pos.name,
        description: pos.description || '',
        department_id: pos.department_id || '',
        parent_id: pos.parent_id || '',
        level: pos.level.toString()
      });
    } else {
      setEditingPos(null);
      setPosForm({ name: '', description: '', department_id: '', parent_id: '', level: '1' });
    }
    setIsPosDialogOpen(true);
  };

  const savePosition = async () => {
    if (!posForm.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    try {
      const data = {
        name: posForm.name.trim(),
        description: posForm.description.trim() || null,
        department_id: posForm.department_id || null,
        parent_id: posForm.parent_id || null,
        level: parseInt(posForm.level) || 1,
        company_id: profile?.company_id
      };

      if (editingPos) {
        const { error } = await supabase
          .from('positions')
          .update(data)
          .eq('id', editingPos.id);
        if (error) throw error;
        toast.success('Cargo atualizado!');
      } else {
        const { error } = await supabase.from('positions').insert(data);
        if (error) throw error;
        toast.success('Cargo criado!');
      }

      setIsPosDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving position:', error);
      toast.error('Erro ao salvar cargo');
    }
  };

  const deletePosition = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este cargo?')) return;

    try {
      const { error } = await supabase.from('positions').delete().eq('id', id);
      if (error) throw error;
      toast.success('Cargo excluído!');
      fetchData();
    } catch (error) {
      console.error('Error deleting position:', error);
      toast.error('Erro ao excluir cargo');
    }
  };

  const getDepartmentName = (id: string | null) => {
    if (!id) return '-';
    return departments.find(d => d.id === id)?.name || '-';
  };

  const getParentDeptName = (id: string | null) => {
    if (!id) return '-';
    return departments.find(d => d.id === id)?.name || '-';
  };

  const getParentPosName = (id: string | null) => {
    if (!id) return '-';
    return positions.find(p => p.id === id)?.name || '-';
  };

  const buildDeptHierarchy = (parentId: string | null = null, level = 0): JSX.Element[] => {
    return departments
      .filter(d => d.parent_id === parentId)
      .flatMap(dept => [
        <TableRow key={dept.id}>
          <TableCell>
            <div style={{ paddingLeft: `${level * 20}px` }} className="flex items-center gap-2">
              {level > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              {dept.name}
            </div>
          </TableCell>
          <TableCell>{dept.description || '-'}</TableCell>
          <TableCell>
            <Badge variant={dept.is_active ? 'default' : 'secondary'}>
              {dept.is_active ? 'Ativo' : 'Inativo'}
            </Badge>
          </TableCell>
          <TableCell className="text-right">
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="icon" onClick={() => openDeptDialog(dept)}>
                <Edit className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => deleteDepartment(dept.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </TableCell>
        </TableRow>,
        ...buildDeptHierarchy(dept.id, level + 1)
      ]);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="h-8 w-8 text-primary" />
            Cargos e Departamentos
          </h1>
          <p className="text-muted-foreground">Gerencie a estrutura organizacional da empresa</p>
        </div>
      </div>

      <Tabs defaultValue="orgchart" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="orgchart" className="gap-2">
            <Network className="h-4 w-4" />
            Organograma
          </TabsTrigger>
          <TabsTrigger value="departments" className="gap-2">
            <Building2 className="h-4 w-4" />
            Departamentos
          </TabsTrigger>
          <TabsTrigger value="positions" className="gap-2">
            <Briefcase className="h-4 w-4" />
            Cargos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orgchart" className="mt-6">
          <OrgChart departments={departments} positions={positions} />
        </TabsContent>

        <TabsContent value="departments" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Departamentos</CardTitle>
                <CardDescription>{departments.length} departamentos cadastrados</CardDescription>
              </div>
              <Button onClick={() => openDeptDialog()} className="gradient-primary">
                <Plus className="h-4 w-4 mr-2" />
                Novo Departamento
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Carregando...</div>
              ) : departments.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {buildDeptHierarchy()}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum departamento cadastrado
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="positions" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Cargos</CardTitle>
                <CardDescription>{positions.length} cargos cadastrados</CardDescription>
              </div>
              <Button onClick={() => openPosDialog()} className="gradient-primary">
                <Plus className="h-4 w-4 mr-2" />
                Novo Cargo
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Carregando...</div>
              ) : positions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Departamento</TableHead>
                      <TableHead>Nível</TableHead>
                      <TableHead>Superior</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {positions.map((pos) => (
                      <TableRow key={pos.id}>
                        <TableCell className="font-medium">{pos.name}</TableCell>
                        <TableCell>{getDepartmentName(pos.department_id)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">Nível {pos.level}</Badge>
                        </TableCell>
                        <TableCell>{getParentPosName(pos.parent_id)}</TableCell>
                        <TableCell>
                          <Badge variant={pos.is_active ? 'default' : 'secondary'}>
                            {pos.is_active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => openPosDialog(pos)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => deletePosition(pos.id)}>
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
                  Nenhum cargo cadastrado
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Department Dialog */}
      <Dialog open={isDeptDialogOpen} onOpenChange={setIsDeptDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDept ? 'Editar Departamento' : 'Novo Departamento'}</DialogTitle>
            <DialogDescription>Preencha os dados do departamento</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={deptForm.name}
                onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                placeholder="Ex: Recursos Humanos"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={deptForm.description}
                onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                placeholder="Descrição do departamento"
              />
            </div>
            <div className="space-y-2">
              <Label>Departamento Superior</Label>
              <Select
                value={deptForm.parent_id}
                onValueChange={(v) => setDeptForm({ ...deptForm, parent_id: v === 'none' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Nenhum (raiz)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum (raiz)</SelectItem>
                  {departments
                    .filter(d => d.id !== editingDept?.id)
                    .map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeptDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveDepartment} className="gradient-primary">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Position Dialog */}
      <Dialog open={isPosDialogOpen} onOpenChange={setIsPosDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPos ? 'Editar Cargo' : 'Novo Cargo'}</DialogTitle>
            <DialogDescription>Preencha os dados do cargo</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={posForm.name}
                onChange={(e) => setPosForm({ ...posForm, name: e.target.value })}
                placeholder="Ex: Analista de RH"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={posForm.description}
                onChange={(e) => setPosForm({ ...posForm, description: e.target.value })}
                placeholder="Descrição do cargo"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Departamento</Label>
                <Select
                  value={posForm.department_id}
                  onValueChange={(v) => setPosForm({ ...posForm, department_id: v === 'none' ? '' : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nível Hierárquico</Label>
                <Select
                  value={posForm.level}
                  onValueChange={(v) => setPosForm({ ...posForm, level: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 - Operacional</SelectItem>
                    <SelectItem value="2">2 - Técnico</SelectItem>
                    <SelectItem value="3">3 - Supervisão</SelectItem>
                    <SelectItem value="4">4 - Gerência</SelectItem>
                    <SelectItem value="5">5 - Diretoria</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cargo Superior</Label>
              <Select
                value={posForm.parent_id}
                onValueChange={(v) => setPosForm({ ...posForm, parent_id: v === 'none' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {positions
                    .filter(p => p.id !== editingPos?.id)
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPosDialogOpen(false)}>Cancelar</Button>
            <Button onClick={savePosition} className="gradient-primary">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
