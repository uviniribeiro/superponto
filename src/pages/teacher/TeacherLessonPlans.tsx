import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { 
  FileText, 
  Plus, 
  Search,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  Eye,
  School,
  BookOpen,
  RefreshCw
} from 'lucide-react';
import useSEO from '@/hooks/useSEO';
import { useAuth } from '@/contexts/AuthContext';

interface LessonPlan {
  id: string;
  profile_id: string;
  school_id: string | null;
  class_group_id: string | null;
  class_date: string;
  subject: string | null;
  topic: string;
  objectives: string | null;
  content: string | null;
  methodology: string | null;
  resources: string | null;
  evaluation: string | null;
  observations: string | null;
  number_of_classes: number;
  total_minutes: number | null;
  status: string;
  profile?: { full_name: string };
  school?: { name: string };
  class_group?: { name: string; grade: string | null };
}

interface SchoolData {
  id: string;
  name: string;
  school_type: string | null;
}

interface ClassGroup {
  id: string;
  name: string;
  grade: string | null;
  shift: string | null;
  school_id: string | null;
}

const statusLabels: Record<string, string> = {
  'planned': 'Planejado',
  'executed': 'Executado',
  'cancelled': 'Cancelado',
};

const statusColors: Record<string, string> = {
  'planned': 'bg-yellow-500/10 text-yellow-700',
  'executed': 'bg-green-500/10 text-green-700',
  'cancelled': 'bg-red-500/10 text-red-700',
};

const subjects = [
  'Português',
  'Matemática',
  'Ciências',
  'História',
  'Geografia',
  'Educação Física',
  'Artes',
  'Inglês',
  'Informática',
  'Educação Infantil',
  'Outra',
];

export default function TeacherLessonPlans() {
  useSEO({
    title: 'Plano de Aula | Módulo Professor',
    description: 'Gestão de planos de aula para educadores.',
  });

  const { profile } = useAuth();
  const [lessonPlans, setLessonPlans] = useState<LessonPlan[]>([]);
  const [schools, setSchools] = useState<SchoolData[]>([]);
  const [classGroups, setClassGroups] = useState<ClassGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filterMonth, setFilterMonth] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<LessonPlan | null>(null);
  const [viewingPlan, setViewingPlan] = useState<LessonPlan | null>(null);
  
  const [formData, setFormData] = useState({
    school_id: '',
    class_group_id: '',
    class_date: new Date(),
    subject: '',
    topic: '',
    objectives: '',
    content: '',
    methodology: '',
    resources: '',
    evaluation: '',
    observations: '',
    number_of_classes: 1,
    status: 'planned'
  });

  useEffect(() => {
    fetchData();
  }, [filterMonth, profile?.company_id]);

  const fetchData = async () => {
    if (!profile?.company_id) return;
    
    setLoading(true);
    try {
      const startDate = format(startOfMonth(filterMonth), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(filterMonth), 'yyyy-MM-dd');

      const [plansRes, schoolsRes, groupsRes] = await Promise.all([
        supabase.from('lesson_plans').select(`
          *,
          profile:profiles(full_name),
          school:schools(name),
          class_group:class_groups(name, grade)
        `).gte('class_date', startDate).lte('class_date', endDate).order('class_date', { ascending: false }),
        
        supabase.from('schools').select('id, name, school_type').eq('is_active', true),
        
        supabase.from('class_groups').select('id, name, grade, shift, school_id').eq('is_active', true)
      ]);

      if (plansRes.data) setLessonPlans(plansRes.data as unknown as LessonPlan[]);
      if (schoolsRes.data) setSchools(schoolsRes.data);
      if (groupsRes.data) setClassGroups(groupsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const syncSchoolsFromMunicipality = async () => {
    if (!profile?.company_id) return;
    
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-municipal-data', {
        body: { 
          company_id: profile.company_id, 
          type: 'schools' 
        }
      });

      if (error) throw error;
      
      toast.success(`${data.count || 0} escolas sincronizadas`);
      fetchData();
    } catch (error: any) {
      console.error('Error syncing schools:', error);
      toast.error('Erro ao sincronizar escolas: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setSyncing(false);
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(filterMonth);
    newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    setFilterMonth(newDate);
  };

  const handleSubmit = async () => {
    if (!formData.topic) {
      toast.error('Informe o tema/conteúdo da aula');
      return;
    }

    try {
      const data = {
        profile_id: profile?.id,
        company_id: profile?.company_id,
        school_id: formData.school_id || null,
        class_group_id: formData.class_group_id || null,
        class_date: format(formData.class_date, 'yyyy-MM-dd'),
        subject: formData.subject || null,
        topic: formData.topic,
        objectives: formData.objectives || null,
        content: formData.content || null,
        methodology: formData.methodology || null,
        resources: formData.resources || null,
        evaluation: formData.evaluation || null,
        observations: formData.observations || null,
        number_of_classes: formData.number_of_classes,
        total_minutes: formData.number_of_classes * 50,
        status: formData.status
      };

      if (editingPlan) {
        const { error } = await supabase
          .from('lesson_plans')
          .update(data)
          .eq('id', editingPlan.id);
        if (error) throw error;
        toast.success('Plano de aula atualizado');
      } else {
        const { error } = await supabase
          .from('lesson_plans')
          .insert(data);
        if (error) throw error;
        toast.success('Plano de aula criado');
      }

      setIsDialogOpen(false);
      setEditingPlan(null);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error('Error saving plan:', error);
      toast.error('Erro ao salvar: ' + error.message);
    }
  };

  const handleEdit = (plan: LessonPlan) => {
    setEditingPlan(plan);
    setFormData({
      school_id: plan.school_id || '',
      class_group_id: plan.class_group_id || '',
      class_date: new Date(plan.class_date),
      subject: plan.subject || '',
      topic: plan.topic,
      objectives: plan.objectives || '',
      content: plan.content || '',
      methodology: plan.methodology || '',
      resources: plan.resources || '',
      evaluation: plan.evaluation || '',
      observations: plan.observations || '',
      number_of_classes: plan.number_of_classes,
      status: plan.status
    });
    setIsDialogOpen(true);
  };

  const handleView = (plan: LessonPlan) => {
    setViewingPlan(plan);
    setIsViewDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este plano de aula?')) return;

    try {
      const { error } = await supabase.from('lesson_plans').delete().eq('id', id);
      if (error) throw error;
      toast.success('Plano de aula excluído');
      fetchData();
    } catch (error: any) {
      console.error('Error deleting:', error);
      toast.error('Erro ao excluir: ' + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      school_id: '',
      class_group_id: '',
      class_date: new Date(),
      subject: '',
      topic: '',
      objectives: '',
      content: '',
      methodology: '',
      resources: '',
      evaluation: '',
      observations: '',
      number_of_classes: 1,
      status: 'planned'
    });
  };

  const filteredPlans = lessonPlans.filter(p =>
    p.topic?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.school?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredClassGroups = formData.school_id 
    ? classGroups.filter(g => g.school_id === formData.school_id)
    : classGroups;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="h-6 w-6 lg:h-7 lg:w-7 text-primary" />
            </div>
            Plano de Aula
          </h1>
          <p className="text-muted-foreground mt-1">
            Planeje e documente suas aulas
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="outline" onClick={syncSchoolsFromMunicipality} disabled={syncing} className="gap-2">
            <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
            Sincronizar Escolas
          </Button>
          
          <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth('prev')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" className="h-8 px-3 text-sm font-medium">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {format(filterMonth, 'MMMM yyyy', { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <Calendar
                  mode="single"
                  selected={filterMonth}
                  onSelect={(date) => date && setFilterMonth(date)}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth('next')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Plano
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Planos</p>
            <p className="text-2xl font-bold">{filteredPlans.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Executados</p>
            <p className="text-2xl font-bold text-green-600">
              {filteredPlans.filter(p => p.status === 'executed').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Planejados</p>
            <p className="text-2xl font-bold text-yellow-600">
              {filteredPlans.filter(p => p.status === 'planned').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Escolas</p>
            <p className="text-2xl font-bold">{schools.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <CardTitle>Planos de Aula</CardTitle>
              <CardDescription>Planos de {format(filterMonth, 'MMMM yyyy', { locale: ptBR })}</CardDescription>
            </div>
            <div className="relative w-full lg:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por tema, disciplina..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : filteredPlans.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Disciplina</TableHead>
                  <TableHead>Tema</TableHead>
                  <TableHead>Escola</TableHead>
                  <TableHead>Turma</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPlans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell>{format(new Date(plan.class_date), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{plan.subject || '-'}</Badge>
                    </TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate">{plan.topic}</TableCell>
                    <TableCell>{plan.school?.name || '-'}</TableCell>
                    <TableCell>{plan.class_group?.name || '-'}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[plan.status]}>
                        {statusLabels[plan.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleView(plan)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(plan)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(plan.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum plano de aula neste mês</p>
              <Button variant="outline" className="mt-4" onClick={() => setIsDialogOpen(true)}>
                Criar primeiro plano
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPlan ? 'Editar Plano de Aula' : 'Novo Plano de Aula'}</DialogTitle>
            <DialogDescription>
              Preencha os dados do plano de aula
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Escola</Label>
                <Select value={formData.school_id} onValueChange={(v) => setFormData({ ...formData, school_id: v, class_group_id: '' })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a escola" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhuma</SelectItem>
                    {schools.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Turma</Label>
                <Select value={formData.class_group_id} onValueChange={(v) => setFormData({ ...formData, class_group_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a turma" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhuma</SelectItem>
                    {filteredClassGroups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name} {g.grade ? `(${g.grade})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Data da Aula</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(formData.class_date, 'dd/MM/yyyy', { locale: ptBR })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.class_date}
                      onSelect={(date) => date && setFormData({ ...formData, class_date: date })}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Disciplina</Label>
                <Select value={formData.subject} onValueChange={(v) => setFormData({ ...formData, subject: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Número de Aulas</Label>
                <Input
                  type="number"
                  min={1}
                  value={formData.number_of_classes}
                  onChange={(e) => setFormData({ ...formData, number_of_classes: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tema/Conteúdo *</Label>
              <Input
                value={formData.topic}
                onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                placeholder="Ex: Frações e números decimais"
              />
            </div>

            <div className="space-y-2">
              <Label>Objetivos da Aula</Label>
              <Textarea
                value={formData.objectives}
                onChange={(e) => setFormData({ ...formData, objectives: e.target.value })}
                placeholder="O que os alunos devem aprender..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Conteúdo Ministrado</Label>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Detalhamento do conteúdo trabalhado..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Metodologia</Label>
                <Textarea
                  value={formData.methodology}
                  onChange={(e) => setFormData({ ...formData, methodology: e.target.value })}
                  placeholder="Como o conteúdo foi apresentado..."
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Recursos Utilizados</Label>
                <Textarea
                  value={formData.resources}
                  onChange={(e) => setFormData({ ...formData, resources: e.target.value })}
                  placeholder="Materiais, tecnologias..."
                  rows={2}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Avaliação</Label>
                <Textarea
                  value={formData.evaluation}
                  onChange={(e) => setFormData({ ...formData, evaluation: e.target.value })}
                  placeholder="Como foi avaliado o aprendizado..."
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">Planejado</SelectItem>
                    <SelectItem value="executed">Executado</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={formData.observations}
                onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                placeholder="Anotações adicionais..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit}>{editingPlan ? 'Salvar' : 'Criar Plano'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Plano de Aula
            </DialogTitle>
          </DialogHeader>
          {viewingPlan && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Data</p>
                  <p className="font-medium">{format(new Date(viewingPlan.class_date), 'dd/MM/yyyy', { locale: ptBR })}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Disciplina</p>
                  <p className="font-medium">{viewingPlan.subject || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Escola</p>
                  <p className="font-medium">{viewingPlan.school?.name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Turma</p>
                  <p className="font-medium">{viewingPlan.class_group?.name || '-'}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-1">Tema/Conteúdo</p>
                <p className="font-medium">{viewingPlan.topic}</p>
              </div>

              {viewingPlan.objectives && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Objetivos</p>
                  <p className="whitespace-pre-wrap">{viewingPlan.objectives}</p>
                </div>
              )}

              {viewingPlan.content && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Conteúdo Ministrado</p>
                  <p className="whitespace-pre-wrap">{viewingPlan.content}</p>
                </div>
              )}

              {viewingPlan.methodology && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Metodologia</p>
                  <p className="whitespace-pre-wrap">{viewingPlan.methodology}</p>
                </div>
              )}

              {viewingPlan.resources && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Recursos</p>
                  <p className="whitespace-pre-wrap">{viewingPlan.resources}</p>
                </div>
              )}

              {viewingPlan.evaluation && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Avaliação</p>
                  <p className="whitespace-pre-wrap">{viewingPlan.evaluation}</p>
                </div>
              )}

              {viewingPlan.observations && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Observações</p>
                  <p className="whitespace-pre-wrap">{viewingPlan.observations}</p>
                </div>
              )}

              <div className="flex justify-between items-center pt-4 border-t">
                <Badge className={statusColors[viewingPlan.status]}>
                  {statusLabels[viewingPlan.status]}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {viewingPlan.number_of_classes} aula(s)
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
