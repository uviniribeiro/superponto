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
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Building2, Briefcase, Plus, Edit, Trash2, ChevronRight, Network, Search, Users } from 'lucide-react';
import { OrgChart } from '@/components/orgchart/OrgChart';
import { useScreenSize } from '@/hooks/useScreenSize';
import { cn } from '@/lib/utils';

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

export default function NewPositionsDepartments() {
  const { profile } = useAuth();
  const screen = useScreenSize();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

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

  const getParentPosName = (id: string | null) => {
    if (!id) return '-';
    return positions.find(p => p.id === id)?.name || '-';
  };

  const filteredDepartments = departments.filter(d =>
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPositions = positions.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const buildDeptHierarchy = (parentId: string | null = null, level = 0): JSX.Element[] => {
    return filteredDepartments
      .filter(d => d.parent_id === parentId)
      .flatMap(dept => [
        <TableRow key={dept.id} className="hover:bg-muted/50">
          <TableCell>
            <div style={{ paddingLeft: `${level * 20}px` }} className="flex items-center gap-2">
              {level > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              <span className="font-medium">{dept.name}</span>
            </div>
          </TableCell>
          <TableCell className="text-muted-foreground">{dept.description || '-'}</TableCell>
          <TableCell>
            <Badge variant={dept.is_active ? 'default' : 'secondary'} className={cn(
              dept.is_active && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
            )}>
              {dept.is_active ? 'Ativo' : 'Inativo'}
            </Badge>
          </TableCell>
          <TableCell className="text-right">
            <div className="flex justify-end gap-1">
              <Button variant="ghost" size="icon" onClick={() => openDeptDialog(dept)} className="h-8 w-8">
                <Edit className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => deleteDepartment(dept.id)} className="h-8 w-8 text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </TableCell>
        </TableRow>,
        ...buildDeptHierarchy(dept.id, level + 1)
      ]);
  };

  // Responsive grid columns based on screen size
  const getGridCols = () => {
    if (screen.is1080x1920) return 'grid-cols-1';
    if (screen.isMobile) return 'grid-cols-1';
    if (screen.isTablet) return 'grid-cols-2';
    return 'grid-cols-3';
  };

  // Responsive tab orientation
  const tabOrientation = screen.is1080x1920 || screen.isMobile ? 'horizontal' : 'horizontal';

  return (
    <div className={cn(
      "space-y-4 animate-fade-in",
      screen.is1920x1080 && "px-2",
      screen.is1080x1920 && "px-1"
    )}>
      {/* Header */}
      <div className={cn(
        "flex gap-4",
        screen.is1080x1920 ? "flex-col" : "flex-row items-center justify-between"
      )}>
        <div>
          <h1 className={cn(
            "font-bold flex items-center gap-2",
            screen.is1920x1080 ? "text-2xl" : "text-xl"
          )}>
            <Building2 className={cn(
              "text-primary",
              screen.is1920x1080 ? "h-7 w-7" : "h-6 w-6"
            )} />
            Cargos e Departamentos
          </h1>
          <p className="text-sm text-muted-foreground">Gerencie a estrutura organizacional</p>
        </div>
        
        {/* Stats */}
        <div className={cn(
          "flex gap-3",
          screen.is1080x1920 && "flex-wrap"
        )}>
          <Badge variant="outline" className="gap-1.5 py-1.5 px-3">
            <Building2 className="h-3.5 w-3.5" />
            {departments.length} departamentos
          </Badge>
          <Badge variant="outline" className="gap-1.5 py-1.5 px-3">
            <Briefcase className="h-3.5 w-3.5" />
            {positions.length} cargos
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="orgchart" className="w-full">
        <TabsList className={cn(
          "h-auto gap-1 flex-wrap",
          screen.is1080x1920 ? "w-full grid grid-cols-3" : "inline-flex"
        )}>
          <TabsTrigger value="orgchart" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Network className="h-4 w-4" />
            <span className={screen.isMobile ? "hidden" : ""}>Organograma</span>
          </TabsTrigger>
          <TabsTrigger value="departments" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Building2 className="h-4 w-4" />
            <span className={screen.isMobile ? "hidden" : ""}>Departamentos</span>
          </TabsTrigger>
          <TabsTrigger value="positions" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Briefcase className="h-4 w-4" />
            <span className={screen.isMobile ? "hidden" : ""}>Cargos</span>
          </TabsTrigger>
        </TabsList>

        {/* Organogram Tab */}
        <TabsContent value="orgchart" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Organograma</CardTitle>
              <CardDescription>Visualização hierárquica da estrutura</CardDescription>
            </CardHeader>
            <CardContent>
              <OrgChart departments={departments} positions={positions} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Departments Tab */}
        <TabsContent value="departments" className="mt-4">
          <Card>
            <CardHeader className={cn(
              "pb-3",
              screen.is1080x1920 ? "flex-col gap-3" : "flex flex-row items-center justify-between"
            )}>
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  Departamentos
                </CardTitle>
                <CardDescription>{departments.length} cadastrados</CardDescription>
              </div>
              <div className={cn(
                "flex gap-2",
                screen.is1080x1920 && "flex-col"
              )}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 w-full md:w-48"
                  />
                </div>
                <Button onClick={() => openDeptDialog()} size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Novo
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : departments.length > 0 ? (
                <ScrollArea className={cn(
                  screen.is1920x1080 ? "h-[500px]" : "h-[400px]"
                )}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right w-24">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {buildDeptHierarchy()}
                    </TableBody>
                  </Table>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhum departamento cadastrado</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Positions Tab */}
        <TabsContent value="positions" className="mt-4">
          <Card>
            <CardHeader className={cn(
              "pb-3",
              screen.is1080x1920 ? "flex-col gap-3" : "flex flex-row items-center justify-between"
            )}>
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-primary" />
                  Cargos
                </CardTitle>
                <CardDescription>{positions.length} cadastrados</CardDescription>
              </div>
              <div className={cn(
                "flex gap-2",
                screen.is1080x1920 && "flex-col"
              )}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 w-full md:w-48"
                  />
                </div>
                <Button onClick={() => openPosDialog()} size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Novo
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : positions.length > 0 ? (
                <ScrollArea className={cn(
                  screen.is1920x1080 ? "h-[500px]" : "h-[400px]"
                )}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead className={screen.isMobile ? "hidden" : ""}>Departamento</TableHead>
                        <TableHead>Nível</TableHead>
                        <TableHead className={screen.isMobile ? "hidden" : ""}>Superior</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right w-24">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPositions.map((pos) => (
                        <TableRow key={pos.id} className="hover:bg-muted/50">
                          <TableCell className="font-medium">{pos.name}</TableCell>
                          <TableCell className={cn("text-muted-foreground", screen.isMobile && "hidden")}>
                            {getDepartmentName(pos.department_id)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              Nível {pos.level}
                            </Badge>
                          </TableCell>
                          <TableCell className={cn("text-muted-foreground", screen.isMobile && "hidden")}>
                            {getParentPosName(pos.parent_id)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={pos.is_active ? 'default' : 'secondary'} className={cn(
                              pos.is_active && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            )}>
                              {pos.is_active ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openPosDialog(pos)} className="h-8 w-8">
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => deletePosition(pos.id)} className="h-8 w-8 text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Briefcase className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhum cargo cadastrado</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Department Dialog */}
      <Dialog open={isDeptDialogOpen} onOpenChange={setIsDeptDialogOpen}>
        <DialogContent className={cn(
          "max-w-md",
          screen.is1080x1920 && "max-w-[95vw]"
        )}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {editingDept ? 'Editar Departamento' : 'Novo Departamento'}
            </DialogTitle>
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
                rows={3}
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

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDeptDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveDepartment}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Position Dialog */}
      <Dialog open={isPosDialogOpen} onOpenChange={setIsPosDialogOpen}>
        <DialogContent className={cn(
          "max-w-md",
          screen.is1080x1920 && "max-w-[95vw]"
        )}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              {editingPos ? 'Editar Cargo' : 'Novo Cargo'}
            </DialogTitle>
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
                rows={3}
              />
            </div>
            <div className={cn(
              "gap-4",
              screen.is1080x1920 ? "space-y-4" : "grid grid-cols-2"
            )}>
              <div className="space-y-2">
                <Label>Departamento</Label>
                <Select
                  value={posForm.department_id}
                  onValueChange={(v) => setPosForm({ ...posForm, department_id: v === 'none' ? '' : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
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
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((l) => (
                      <SelectItem key={l} value={l.toString()}>Nível {l}</SelectItem>
                    ))}
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

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsPosDialogOpen(false)}>Cancelar</Button>
            <Button onClick={savePosition}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
