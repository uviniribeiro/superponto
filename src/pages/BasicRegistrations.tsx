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
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { 
  Layers, Tag, DollarSign, Grid3X3, Building, Briefcase, MapPin, 
  Plus, Edit, Trash2, Search, FileText, Users
} from 'lucide-react';
import { HelpButton } from '@/components/HelpButton';

type RegistrationType = 'groupings' | 'specialties' | 'cost_centers' | 'sections' | 'employee_types' | 'job_functions' | 'work_locations';

interface BaseRecord {
  id: string;
  code: string | null;
  description: string;
  is_active: boolean;
  company_id: string | null;
}

interface WorkLocation extends BaseRecord {
  parent_id: string | null;
  current_employees: number;
  max_employees: number | null;
  anti_passback_enabled: boolean;
}

interface JobFunction extends BaseRecord {
  exempt_from_time_clock: boolean;
}

interface EmployeeType extends BaseRecord {
  validate_pis: boolean;
}

const registrationTypes = [
  { key: 'groupings', label: 'Agrupamentos', icon: Layers, description: 'Grupos para filtros e identificação' },
  { key: 'specialties', label: 'Especialidades', icon: Tag, description: 'Títulos e habilidades dos funcionários' },
  { key: 'cost_centers', label: 'Centro de Custo', icon: DollarSign, description: 'Centros de custo para gestão' },
  { key: 'sections', label: 'Seções', icon: Grid3X3, description: 'Divisões organizacionais' },
  { key: 'employee_types', label: 'Tipos de Funcionário', icon: Users, description: 'Categorias de funcionários' },
  { key: 'job_functions', label: 'Funções', icon: Briefcase, description: 'Funções exercidas na empresa' },
  { key: 'work_locations', label: 'Locais de Trabalho', icon: MapPin, description: 'Locais físicos de trabalho' },
] as const;

export default function BasicRegistrations() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<RegistrationType>('groupings');
  const [records, setRecords] = useState<BaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<BaseRecord | null>(null);
  
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    is_active: true,
    parent_id: '',
    max_employees: '',
    anti_passback_enabled: false,
    exempt_from_time_clock: false,
    validate_pis: true,
  });

  useEffect(() => {
    fetchRecords();
  }, [activeTab]);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from(activeTab)
        .select('*')
        .order('description');

      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      console.error('Error fetching records:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.description.trim()) {
      toast.error('Descrição é obrigatória');
      return;
    }

    if (formData.description.length < 3) {
      toast.error('Descrição deve ter pelo menos 3 caracteres');
      return;
    }

    try {
      const baseData: Record<string, unknown> = {
        code: formData.code.trim() || null,
        description: formData.description.trim(),
        is_active: formData.is_active,
        company_id: profile?.company_id,
      };

      if (activeTab === 'work_locations') {
        baseData.parent_id = formData.parent_id || null;
        baseData.max_employees = formData.max_employees ? parseInt(formData.max_employees) : null;
        baseData.anti_passback_enabled = formData.anti_passback_enabled;
      }

      if (activeTab === 'job_functions') {
        baseData.exempt_from_time_clock = formData.exempt_from_time_clock;
      }

      if (activeTab === 'employee_types') {
        baseData.validate_pis = formData.validate_pis;
      }

      if (editingRecord) {
        const { error } = await supabase
          .from(activeTab)
          .update(baseData)
          .eq('id', editingRecord.id);
        if (error) throw error;
        toast.success('Registro atualizado!');
      } else {
        const { error } = await supabase.from(activeTab).insert(baseData);
        if (error) throw error;
        toast.success('Registro criado!');
      }

      setIsDialogOpen(false);
      resetForm();
      fetchRecords();
    } catch (error: unknown) {
      console.error('Error saving:', error);
      const message = error instanceof Error && 'code' in error && (error as { code: string }).code === '23505' 
        ? 'Já existe um registro com essa descrição' 
        : 'Erro ao salvar';
      toast.error(message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este registro?')) return;

    try {
      const { error } = await supabase.from(activeTab).delete().eq('id', id);
      if (error) throw error;
      toast.success('Registro excluído!');
      fetchRecords();
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Erro ao excluir. O registro pode estar vinculado a outros dados.');
    }
  };

  const openEditDialog = (record: BaseRecord) => {
    setEditingRecord(record);
    setFormData({
      code: record.code || '',
      description: record.description,
      is_active: record.is_active,
      parent_id: (record as WorkLocation).parent_id || '',
      max_employees: (record as WorkLocation).max_employees?.toString() || '',
      anti_passback_enabled: (record as WorkLocation).anti_passback_enabled || false,
      exempt_from_time_clock: (record as JobFunction).exempt_from_time_clock || false,
      validate_pis: (record as EmployeeType).validate_pis ?? true,
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingRecord(null);
    setFormData({
      code: '',
      description: '',
      is_active: true,
      parent_id: '',
      max_employees: '',
      anti_passback_enabled: false,
      exempt_from_time_clock: false,
      validate_pis: true,
    });
  };

  const filteredRecords = records.filter(r =>
    r.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const currentType = registrationTypes.find(t => t.key === activeTab);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileText className="h-8 w-8 text-primary" />
            Cadastros Básicos
          </h1>
          <p className="text-muted-foreground">Gerencie os cadastros auxiliares do sistema</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as RegistrationType)} className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1">
          {registrationTypes.map((type) => (
            <TabsTrigger key={type.key} value={type.key} className="gap-2">
              <type.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{type.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {registrationTypes.map((type) => (
          <TabsContent key={type.key} value={type.key} className="mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <type.icon className="h-5 w-5" />
                    {type.label}
                  </CardTitle>
                  <CardDescription>{type.description}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="gradient-primary">
                    <Plus className="h-4 w-4 mr-2" />
                    Novo
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">Carregando...</div>
                ) : filteredRecords.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Descrição</TableHead>
                        {activeTab === 'work_locations' && <TableHead>Funcionários</TableHead>}
                        {activeTab === 'job_functions' && <TableHead>Dispensa Ponto</TableHead>}
                        {activeTab === 'employee_types' && <TableHead>Valida PIS</TableHead>}
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRecords.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>{record.code || '-'}</TableCell>
                          <TableCell className="font-medium">{record.description}</TableCell>
                          {activeTab === 'work_locations' && (
                            <TableCell>
                              {(record as WorkLocation).current_employees || 0}
                              {(record as WorkLocation).max_employees && ` / ${(record as WorkLocation).max_employees}`}
                            </TableCell>
                          )}
                          {activeTab === 'job_functions' && (
                            <TableCell>
                              <Badge variant={(record as JobFunction).exempt_from_time_clock ? 'default' : 'outline'}>
                                {(record as JobFunction).exempt_from_time_clock ? 'Sim' : 'Não'}
                              </Badge>
                            </TableCell>
                          )}
                          {activeTab === 'employee_types' && (
                            <TableCell>
                              <Badge variant={(record as EmployeeType).validate_pis ? 'default' : 'outline'}>
                                {(record as EmployeeType).validate_pis ? 'Sim' : 'Não'}
                              </Badge>
                            </TableCell>
                          )}
                          <TableCell>
                            <Badge variant={record.is_active ? 'default' : 'secondary'}>
                              {record.is_active ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="icon" onClick={() => openEditDialog(record)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDelete(record.id)}>
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
                    Nenhum registro encontrado
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingRecord ? 'Editar' : 'Novo'} {currentType?.label}
            </DialogTitle>
            <DialogDescription>Preencha os dados do registro</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Código</Label>
              <Input
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="Código opcional"
                maxLength={20}
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Nome/descrição do registro"
                maxLength={50}
              />
            </div>

            {activeTab === 'work_locations' && (
              <>
                <div className="space-y-2">
                  <Label>Local Superior</Label>
                  <Select
                    value={formData.parent_id}
                    onValueChange={(v) => setFormData({ ...formData, parent_id: v === 'none' ? '' : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Nenhum (raiz)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum (raiz)</SelectItem>
                      {records
                        .filter(r => r.id !== editingRecord?.id)
                        .map((r) => (
                          <SelectItem key={r.id} value={r.id}>{r.description}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Máximo de Funcionários</Label>
                  <Input
                    type="number"
                    value={formData.max_employees}
                    onChange={(e) => setFormData({ ...formData, max_employees: e.target.value })}
                    placeholder="Sem limite"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Anti-PassBack</Label>
                  <Switch
                    checked={formData.anti_passback_enabled}
                    onCheckedChange={(checked) => setFormData({ ...formData, anti_passback_enabled: checked })}
                  />
                </div>
              </>
            )}

            {activeTab === 'job_functions' && (
              <div className="flex items-center justify-between">
                <Label>Dispensa de Ponto</Label>
                <Switch
                  checked={formData.exempt_from_time_clock}
                  onCheckedChange={(checked) => setFormData({ ...formData, exempt_from_time_clock: checked })}
                />
              </div>
            )}

            {activeTab === 'employee_types' && (
              <div className="flex items-center justify-between">
                <Label>Validar PIS/PASEP</Label>
                <Switch
                  checked={formData.validate_pis}
                  onCheckedChange={(checked) => setFormData({ ...formData, validate_pis: checked })}
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label>Ativo</Label>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} className="gradient-primary">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <HelpButton 
        title="Cadastros Básicos"
        description="Gerencie os cadastros auxiliares do sistema como agrupamentos, especialidades, centros de custo, seções, tipos de funcionário, funções e locais de trabalho."
      />
    </div>
  );
}
