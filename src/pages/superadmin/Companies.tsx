import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Building2, Plus, Search, Key, CheckCircle, XCircle, RefreshCw, GraduationCap } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';

interface Company {
  id: string;
  name: string;
  cnpj: string | null;
  company_code: string;
  is_active: boolean;
  license_status: string | null;
  created_at: string;
  organization_type: 'company' | 'city_hall';
  teacher_module_enabled: boolean;
}

const companySchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100),
  cnpj: z.string().min(14, 'CNPJ inválido').max(18),
});

export default function SuperAdminCompanies() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', cnpj: '', teacherModuleEnabled: false });

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('organization_type', 'company')
        .order('name');

      if (error) throw error;
      setCompanies((data || []) as Company[]);
    } catch (error) {
      console.error('Error fetching companies:', error);
      toast.error('Erro ao carregar empresas');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCompany = async () => {
    try {
      const validData = companySchema.parse(formData);
      const normalizedCnpj = formData.cnpj.replace(/[^\d]/g, '');
      
      const { data: existingCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('company_code', normalizedCnpj)
        .maybeSingle();
      
      if (existingCompany) {
        toast.error('CNPJ já cadastrado no sistema');
        return;
      }

      const { data: newCompany, error } = await supabase
        .from('companies')
        .insert({
          name: validData.name,
          cnpj: formData.cnpj,
          company_code: normalizedCnpj,
          organization_type: 'company',
          license_status: 'pending',
          teacher_module_enabled: formData.teacherModuleEnabled
        } as any)
        .select()
        .single();

      if (error) throw error;

      // Create support user for the new company
      try {
        const { data: supportData, error: supportError } = await supabase.functions.invoke('create-support-user', {
          body: {
            companyId: newCompany.id,
            companyName: validData.name,
            organizationType: 'company'
          }
        });

        if (supportError) {
          console.error('Error creating support user:', supportError);
          toast.warning('Empresa criada, mas houve erro ao criar usuário de suporte');
        } else if (supportData) {
          toast.success(`Empresa cadastrada! Login de suporte: ${supportData.email} / Senha: Super@25`);
        }
      } catch (supportErr) {
        console.error('Error calling create-support-user:', supportErr);
        toast.warning('Empresa criada, mas houve erro ao criar usuário de suporte');
      }

      setIsDialogOpen(false);
      setFormData({ name: '', cnpj: '', teacherModuleEnabled: false });
      fetchCompanies();
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        console.error('Error creating company:', error);
        toast.error('Erro ao cadastrar empresa');
      }
    }
  };

  const toggleCompanyStatus = async (company: Company) => {
    try {
      const { error } = await supabase
        .from('companies')
        .update({ is_active: !company.is_active })
        .eq('id', company.id);

      if (error) throw error;
      toast.success(company.is_active ? 'Empresa desativada' : 'Empresa ativada');
      fetchCompanies();
    } catch (error) {
      console.error('Error toggling status:', error);
      toast.error('Erro ao alterar status');
    }
  };

  const filteredCompanies = companies.filter(company =>
    company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.cnpj?.includes(searchTerm)
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="h-8 w-8 text-primary" />
            Empresas
          </h1>
          <p className="text-muted-foreground">Gerencie as empresas cadastradas no sistema</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Empresas Cadastradas</CardTitle>
              <CardDescription>{companies.length} empresas no sistema</CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar empresa..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button onClick={() => setIsDialogOpen(true)} className="gradient-primary">
                <Plus className="h-4 w-4 mr-2" />
                Nova Empresa
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-pulse-soft">Carregando...</div>
            </div>
          ) : filteredCompanies.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Licença</TableHead>
                  <TableHead>Módulos</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCompanies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell className="font-medium">{company.name}</TableCell>
                    <TableCell>{company.cnpj || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={company.is_active ? 'default' : 'secondary'}>
                        {company.is_active ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={company.license_status === 'active' ? 'default' : company.license_status === 'expired' ? 'destructive' : 'secondary'}>
                        {company.license_status === 'active' ? 'Ativa' : company.license_status === 'expired' ? 'Expirada' : 'Pendente'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {company.teacher_module_enabled && (
                        <Badge variant="outline" className="gap-1">
                          <GraduationCap className="h-3 w-3" />
                          Professor
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{format(new Date(company.created_at), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/super-admin/licenses?company=${company.id}`)}
                        >
                          <Key className="h-4 w-4 mr-1" />
                          Licença
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleCompanyStatus(company)}
                        >
                          {company.is_active ? <XCircle className="h-4 w-4 text-destructive" /> : <CheckCircle className="h-4 w-4 text-green-500" />}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={fetchCompanies}>
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma empresa encontrada
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Company Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Empresa</DialogTitle>
            <DialogDescription>Cadastre uma nova empresa no sistema</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Empresa</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome da empresa"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input
                id="cnpj"
                value={formData.cnpj}
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                placeholder="00.000.000/0000-00"
              />
            </div>
            
            <div className="p-3 bg-muted/50 rounded-lg space-y-3">
              <Label className="text-sm font-medium">Módulos Adicionais</Label>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="teacher-module"
                  checked={formData.teacherModuleEnabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, teacherModuleEnabled: checked as boolean })}
                />
                <Label htmlFor="teacher-module" className="text-sm cursor-pointer flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" />
                  Habilitar Módulo Professor
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                O módulo professor permite gerenciar hora-aula e escalas de docentes
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateCompany} className="gradient-primary">Cadastrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
