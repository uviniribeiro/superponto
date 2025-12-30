import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { UserPlus, Shield, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';

const employeeSchema = z.object({
  fullName: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100),
  email: z.string().trim().email('Email inválido').max(255),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres').max(100),
  cpf: z.string().optional(),
  pis: z.string().optional(),
  registration_number: z.string().optional(),
  department: z.string().optional(),
  position: z.string().optional(),
  hire_date: z.string().optional(),
  phone: z.string().optional(),
  schedule_id: z.string().optional(),
});

interface Schedule {
  id: string;
  name: string;
}

export default function RegisterEmployee() {
  const navigate = useNavigate();
  const { isAdmin, createEmployee, profile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    cpf: '',
    pis: '',
    registration_number: '',
    department: '',
    position: '',
    hire_date: '',
    phone: '',
    schedule_id: ''
  });

  React.useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    const { data } = await supabase
      .from('work_schedules')
      .select('id, name');
    setSchedules(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validData = employeeSchema.parse(formData);
      
      const { error, user } = await createEmployee({
        email: validData.email,
        password: validData.password,
        fullName: validData.fullName,
        cpf: formData.cpf || undefined,
        pis: formData.pis || undefined,
        registration_number: formData.registration_number || undefined,
        department: formData.department || undefined,
        position: formData.position || undefined,
        hire_date: formData.hire_date || undefined,
        phone: formData.phone || undefined,
      });

      if (error) {
        if (error.message.includes('already registered')) {
          toast.error('Este email já está cadastrado');
        } else {
          toast.error(error.message);
        }
        return;
      }

      // Assign schedule if selected
      if (formData.schedule_id && user) {
        const { data: newProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (newProfile) {
          await supabase.from('employee_schedules').insert({
            profile_id: newProfile.id,
            schedule_id: formData.schedule_id,
            start_date: new Date().toISOString().split('T')[0],
            company_id: profile?.company_id
          });
        }
      }

      toast.success('Funcionário cadastrado com sucesso!');
      
      // Reset form
      setFormData({
        fullName: '',
        email: '',
        password: '',
        cpf: '',
        pis: '',
        registration_number: '',
        department: '',
        position: '',
        hire_date: '',
        phone: '',
        schedule_id: ''
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        console.error('Error creating employee:', error);
        toast.error('Erro ao cadastrar funcionário');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground">
              Apenas administradores podem cadastrar funcionários.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/employees')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <UserPlus className="h-8 w-8 text-primary" />
            Cadastrar Funcionário
          </h1>
          <p className="text-muted-foreground">Adicione um novo colaborador à empresa</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados do Funcionário</CardTitle>
          <CardDescription>
            Preencha os dados para criar a conta do funcionário
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="p-4 bg-muted/50 rounded-lg space-y-4">
              <p className="text-sm font-medium">Credenciais de Acesso</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="funcionario@empresa.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha Inicial *</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="fullName">Nome Completo *</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Nome do funcionário"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  type="text"
                  placeholder="000.000.000-00"
                  value={formData.cpf}
                  onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="pis">PIS</Label>
                <Input
                  id="pis"
                  type="text"
                  placeholder="PIS/PASEP"
                  value={formData.pis}
                  onChange={(e) => setFormData({ ...formData, pis: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="registration_number">Matrícula</Label>
                <Input
                  id="registration_number"
                  type="text"
                  placeholder="Número da matrícula"
                  value={formData.registration_number}
                  onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone/WhatsApp</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(11) 99999-9999"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="department">Departamento</Label>
                <Input
                  id="department"
                  type="text"
                  placeholder="Ex: TI, RH, Comercial"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="position">Cargo</Label>
                <Input
                  id="position"
                  type="text"
                  placeholder="Ex: Analista, Gerente"
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="hire_date">Data de Admissão</Label>
                <Input
                  id="hire_date"
                  type="date"
                  value={formData.hire_date}
                  onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="schedule">Jornada de Trabalho</Label>
                <Select 
                  value={formData.schedule_id} 
                  onValueChange={(v) => setFormData({ ...formData, schedule_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma jornada" />
                  </SelectTrigger>
                  <SelectContent>
                    {schedules.map((schedule) => (
                      <SelectItem key={schedule.id} value={schedule.id}>
                        {schedule.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-4 justify-end pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => navigate('/employees')}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                className="gradient-primary"
                disabled={isLoading}
              >
                {isLoading ? 'Cadastrando...' : 'Cadastrar Funcionário'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
