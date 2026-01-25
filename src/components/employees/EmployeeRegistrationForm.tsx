import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { UserPlus, Eye, EyeOff, User, Briefcase, FileText, MapPin, Settings, Loader2 } from 'lucide-react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { PhotoCapture } from '@/components/employees/PhotoCapture';
import { MaskedInput } from '@/components/ui/masked-input';
import { StateCitySelector } from '@/components/employees/StateCitySelector';
import { getStateCodeByName } from '@/lib/brazilianLocations';

const employeeSchema = z.object({
  fullName: z.string().trim().min(2, 'Nome completo é obrigatório (mínimo 2 caracteres)').max(100),
  login: z.string().trim().min(3, 'Login deve ter pelo menos 3 caracteres').max(50).regex(/^[a-zA-Z0-9._-]+$/, 'Login pode conter apenas letras, números, pontos, underscores e hífens'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres').max(100),
  cpf: z.string().min(11, 'CPF é obrigatório'),
  pis: z.string().min(11, 'PIS é obrigatório'),
  registration_number: z.string().min(1, 'Matrícula é obrigatória'),
  hire_date: z.string().min(1, 'Data de admissão é obrigatória'),
});

interface Schedule {
  id: string;
  name: string;
}

interface Department {
  id: string;
  name: string;
}

interface Position {
  id: string;
  name: string;
  department_id: string | null;
}

interface MaritalStatus {
  id: string;
  description: string;
}

interface JobFunction {
  id: string;
  description: string;
}

interface EmployeeRegistrationFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

// ViaCEP API response interface
interface ViaCEPResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

export function EmployeeRegistrationForm({ onSuccess, onCancel }: EmployeeRegistrationFormProps) {
  const { createEmployee, profile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [activeTab, setActiveTab] = useState('credentials');
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [maritalStatuses, setMaritalStatuses] = useState<MaritalStatus[]>([]);
  const [jobFunctions, setJobFunctions] = useState<JobFunction[]>([]);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(true);
  
  const [formData, setFormData] = useState({
    // Credentials
    login: '',
    password: '',
    // Personal Data
    fullName: '',
    socialName: '',
    cpf: '',
    rg: '',
    rgIssuer: '',
    birthDate: '',
    gender: '',
    maritalStatusId: '',
    nationality: 'Brasileiro(a)',
    birthState: '',
    birthCity: '',
    motherName: '',
    fatherName: '',
    // Professional Data
    pis: '',
    registration_number: '',
    ctps: '',
    ctpsSeries: '',
    department: '',
    position: '',
    department_id: '',
    position_id: '',
    jobFunctionId: '',
    hire_date: '',
    phone: '',
    email: '',
    schedule_id: '',
    // Address
    addressZipCode: '',
    addressStreet: '',
    addressNumber: '',
    addressComplement: '',
    addressNeighborhood: '',
    addressState: '',
    addressCity: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [schedulesRes, deptsRes, posRes, maritalRes, functionsRes] = await Promise.all([
      supabase.from('work_schedules').select('id, name'),
      supabase.from('departments').select('id, name').eq('is_active', true).order('name'),
      supabase.from('positions').select('id, name, department_id').eq('is_active', true).order('name'),
      supabase.from('marital_statuses').select('id, description').eq('is_active', true).order('description'),
      supabase.from('job_functions').select('id, description').eq('is_active', true).order('description'),
    ]);
    setSchedules(schedulesRes.data || []);
    setDepartments(deptsRes.data || []);
    setPositions(posRes.data || []);
    setMaritalStatuses(maritalRes.data || []);
    setJobFunctions(functionsRes.data || []);
  };

  // CEP auto-completion using ViaCEP API
  const fetchAddressByCep = useCallback(async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '');
    
    if (cleanCep.length !== 8) {
      return;
    }
    
    setIsLoadingCep(true);
    
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data: ViaCEPResponse = await response.json();
      
      if (data.erro) {
        toast.error('CEP não encontrado');
        return;
      }
      
      // Map UF to state code
      const stateCode = getStateCodeByName(data.uf);
      
      setFormData(prev => ({
        ...prev,
        addressStreet: data.logradouro || prev.addressStreet,
        addressNeighborhood: data.bairro || prev.addressNeighborhood,
        addressCity: data.localidade || prev.addressCity,
        addressState: stateCode || prev.addressState,
        addressComplement: data.complemento || prev.addressComplement,
      }));
      
      toast.success('Endereço preenchido automaticamente!');
    } catch (error) {
      console.error('Error fetching CEP:', error);
      toast.error('Erro ao buscar CEP. Tente novamente.');
    } finally {
      setIsLoadingCep(false);
    }
  }, []);

  const handleCepChange = useCallback((value: string) => {
    setFormData(prev => ({ ...prev, addressZipCode: value }));
    
    // Auto-fetch when CEP is complete (8 digits)
    const cleanCep = value.replace(/\D/g, '');
    if (cleanCep.length === 8) {
      fetchAddressByCep(value);
    }
  }, [fetchAddressByCep]);

  const handleDepartmentChange = (deptId: string) => {
    const dept = departments.find(d => d.id === deptId);
    setFormData({
      ...formData,
      department_id: deptId === 'none' ? '' : deptId,
      department: dept?.name || '',
      position_id: '',
      position: ''
    });
  };

  const handlePositionChange = (posId: string) => {
    const pos = positions.find(p => p.id === posId);
    setFormData({
      ...formData,
      position_id: posId === 'none' ? '' : posId,
      position: pos?.name || ''
    });
  };

  const filteredPositions = formData.department_id
    ? positions.filter(p => p.department_id === formData.department_id || !p.department_id)
    : positions;

  const handlePhotoCapture = (blob: Blob) => {
    setPhotoBlob(blob);
    setCapturedImage(URL.createObjectURL(blob));
  };

  const handlePhotoClear = () => {
    setPhotoBlob(null);
    if (capturedImage) {
      URL.revokeObjectURL(capturedImage);
    }
    setCapturedImage(null);
  };

  const uploadPhoto = async (userId: string): Promise<string | null> => {
    if (!photoBlob) return null;

    const fileName = `${userId}-${Date.now()}.jpg`;
    const filePath = `${profile?.company_id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('employee-photos')
      .upload(filePath, photoBlob, {
        contentType: 'image/jpeg',
        upsert: true
      });

    if (uploadError) {
      console.error('Error uploading photo:', uploadError);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('employee-photos')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validData = employeeSchema.parse(formData);
      
      const { error, user } = await createEmployee({
        username: validData.login,
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
        if (error.message.includes('já está em uso')) {
          toast.error('Este login já está cadastrado');
        } else {
          toast.error(error.message);
        }
        return;
      }

      if (user) {
        const photoUrl = await uploadPhoto(user.id);
        
        const { data: newProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (newProfile) {
          // Build address details JSON
          const addressDetails = {
            zipCode: formData.addressZipCode,
            street: formData.addressStreet,
            number: formData.addressNumber,
            complement: formData.addressComplement,
            neighborhood: formData.addressNeighborhood,
            state: formData.addressState,
            city: formData.addressCity,
          };

          await supabase
            .from('profiles')
            .update({ 
              photo_url: photoUrl,
              must_change_password: mustChangePassword,
              social_name: formData.socialName || null,
              rg: formData.rg || null,
              ctps: formData.ctps ? `${formData.ctps}${formData.ctpsSeries ? '/' + formData.ctpsSeries : ''}` : null,
              birth_date: formData.birthDate || null,
              gender: formData.gender || null,
              marital_status_id: formData.maritalStatusId || null,
              nationality: formData.nationality || null,
              birth_state: formData.birthState || null,
              birth_city: formData.birthCity || null,
              mother_name: formData.motherName || null,
              father_name: formData.fatherName || null,
              job_function_id: formData.jobFunctionId || null,
              address_details: addressDetails,
              email: formData.email || null,
            })
            .eq('id', newProfile.id);

          // Assign schedule if selected
          if (formData.schedule_id) {
            await supabase.from('employee_schedules').insert({
              profile_id: newProfile.id,
              schedule_id: formData.schedule_id,
              start_date: new Date().toISOString().split('T')[0],
              company_id: profile?.company_id
            });
          }
        }
      }

      toast.success('Funcionário cadastrado com sucesso!');
      onSuccess();
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Photo Capture Section */}
      <PhotoCapture
        onCapture={handlePhotoCapture}
        capturedImage={capturedImage}
        onClear={handlePhotoClear}
        required={false}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Dados do Funcionário
          </CardTitle>
          <CardDescription>
            Campos marcados com * são obrigatórios
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="credentials" className="gap-2">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Acesso</span>
              </TabsTrigger>
              <TabsTrigger value="personal" className="gap-2">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">Pessoal</span>
              </TabsTrigger>
              <TabsTrigger value="professional" className="gap-2">
                <Briefcase className="h-4 w-4" />
                <span className="hidden sm:inline">Profissional</span>
              </TabsTrigger>
              <TabsTrigger value="address" className="gap-2">
                <MapPin className="h-4 w-4" />
                <span className="hidden sm:inline">Endereço</span>
              </TabsTrigger>
            </TabsList>

            {/* Credentials Tab */}
            <TabsContent value="credentials" className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg space-y-4">
                <p className="text-sm font-medium">Credenciais de Acesso</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="login">Login *</Label>
                    <Input
                      id="login"
                      type="text"
                      placeholder="joao.silva"
                      value={formData.login}
                      onChange={(e) => setFormData({ ...formData, login: e.target.value })}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Apenas letras, números, pontos, underscores e hífens
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha Inicial *</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Mínimo 6 caracteres"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox
                    id="must-change-password"
                    checked={mustChangePassword}
                    onCheckedChange={(checked) => setMustChangePassword(checked as boolean)}
                  />
                  <Label htmlFor="must-change-password" className="text-sm cursor-pointer">
                    Exigir alteração de senha no primeiro login
                  </Label>
                </div>
              </div>
            </TabsContent>

            {/* Personal Data Tab */}
            <TabsContent value="personal" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="fullName">Nome Completo *</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Nome completo do funcionário"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="socialName">Nome Social</Label>
                  <Input
                    id="socialName"
                    type="text"
                    placeholder="Nome social (opcional)"
                    value={formData.socialName}
                    onChange={(e) => setFormData({ ...formData, socialName: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="cpf">CPF *</Label>
                  <MaskedInput
                    id="cpf"
                    mask="cpf"
                    value={formData.cpf}
                    onChange={(value) => setFormData({ ...formData, cpf: value })}
                    showValidation
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rg">RG</Label>
                  <Input
                    id="rg"
                    type="text"
                    placeholder="Número do RG"
                    value={formData.rg}
                    onChange={(e) => setFormData({ ...formData, rg: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="birthDate">Data de Nascimento</Label>
                  <Input
                    id="birthDate"
                    type="date"
                    value={formData.birthDate}
                    onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gender">Sexo</Label>
                  <Select
                    value={formData.gender || 'none'}
                    onValueChange={(v) => setFormData({ ...formData, gender: v === 'none' ? '' : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50">
                      <SelectItem value="none">Selecione...</SelectItem>
                      <SelectItem value="masculino">Masculino</SelectItem>
                      <SelectItem value="feminino">Feminino</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maritalStatus">Estado Civil</Label>
                  <Select
                    value={formData.maritalStatusId || 'none'}
                    onValueChange={(v) => setFormData({ ...formData, maritalStatusId: v === 'none' ? '' : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50">
                      <SelectItem value="none">Selecione...</SelectItem>
                      {maritalStatuses.map((status) => (
                        <SelectItem key={status.id} value={status.id}>
                          {status.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nationality">Nacionalidade</Label>
                  <Input
                    id="nationality"
                    type="text"
                    placeholder="Nacionalidade"
                    value={formData.nationality}
                    onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                  />
                </div>
              </div>

              {/* Birth Location */}
              <div className="pt-4 border-t">
                <h4 className="font-medium mb-4">Naturalidade</h4>
                <StateCitySelector
                  stateValue={formData.birthState}
                  cityValue={formData.birthCity}
                  onStateChange={(v) => setFormData({ ...formData, birthState: v })}
                  onCityChange={(v) => setFormData({ ...formData, birthCity: v })}
                  stateLabel="Estado de Nascimento"
                  cityLabel="Cidade de Nascimento"
                />
              </div>

              {/* Filiation */}
              <div className="pt-4 border-t">
                <h4 className="font-medium mb-4">Filiação</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="motherName">Nome da Mãe</Label>
                    <Input
                      id="motherName"
                      type="text"
                      placeholder="Nome completo da mãe"
                      value={formData.motherName}
                      onChange={(e) => setFormData({ ...formData, motherName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fatherName">Nome do Pai</Label>
                    <Input
                      id="fatherName"
                      type="text"
                      placeholder="Nome completo do pai"
                      value={formData.fatherName}
                      onChange={(e) => setFormData({ ...formData, fatherName: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Professional Data Tab */}
            <TabsContent value="professional" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pis">PIS/PASEP *</Label>
                  <MaskedInput
                    id="pis"
                    mask="pis"
                    value={formData.pis}
                    onChange={(value) => setFormData({ ...formData, pis: value })}
                    showValidation
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="registration_number">Matrícula *</Label>
                  <Input
                    id="registration_number"
                    type="text"
                    placeholder="Número da matrícula"
                    value={formData.registration_number}
                    onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ctps">CTPS</Label>
                  <Input
                    id="ctps"
                    type="text"
                    placeholder="Número da CTPS"
                    value={formData.ctps}
                    onChange={(e) => setFormData({ ...formData, ctps: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ctpsSeries">Série CTPS</Label>
                  <Input
                    id="ctpsSeries"
                    type="text"
                    placeholder="Série"
                    value={formData.ctpsSeries}
                    onChange={(e) => setFormData({ ...formData, ctpsSeries: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="hire_date">Data de Admissão *</Label>
                  <Input
                    id="hire_date"
                    type="date"
                    value={formData.hire_date}
                    onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone/WhatsApp</Label>
                  <MaskedInput
                    id="phone"
                    mask="phone"
                    value={formData.phone}
                    onChange={(value) => setFormData({ ...formData, phone: value })}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="email@exemplo.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="department">Departamento</Label>
                  <Select
                    value={formData.department_id || 'none'}
                    onValueChange={handleDepartmentChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um departamento" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50">
                      <SelectItem value="none">Nenhum</SelectItem>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="position">Cargo</Label>
                  <Select
                    value={formData.position_id || 'none'}
                    onValueChange={handlePositionChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um cargo" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50">
                      <SelectItem value="none">Nenhum</SelectItem>
                      {filteredPositions.map((pos) => (
                        <SelectItem key={pos.id} value={pos.id}>
                          {pos.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="jobFunction">Função</Label>
                  <Select
                    value={formData.jobFunctionId || 'none'}
                    onValueChange={(v) => setFormData({ ...formData, jobFunctionId: v === 'none' ? '' : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma função" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50">
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {jobFunctions.map((func) => (
                        <SelectItem key={func.id} value={func.id}>
                          {func.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="schedule">Jornada de Trabalho</Label>
                  <Select 
                    value={formData.schedule_id || 'none'} 
                    onValueChange={(v) => setFormData({ ...formData, schedule_id: v === 'none' ? '' : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma jornada" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50">
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {schedules.map((schedule) => (
                        <SelectItem key={schedule.id} value={schedule.id}>
                          {schedule.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            {/* Address Tab */}
            <TabsContent value="address" className="space-y-4">
              <div className="p-4 bg-muted/30 rounded-lg mb-4">
                <p className="text-sm text-muted-foreground">
                  💡 Digite o CEP para preencher o endereço automaticamente
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="addressZipCode">CEP</Label>
                  <div className="relative">
                    <MaskedInput
                      id="addressZipCode"
                      mask="cep"
                      value={formData.addressZipCode}
                      onChange={handleCepChange}
                      placeholder="00000-000"
                    />
                    {isLoadingCep && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="addressStreet">Logradouro</Label>
                  <Input
                    id="addressStreet"
                    type="text"
                    placeholder="Rua, Avenida, etc."
                    value={formData.addressStreet}
                    onChange={(e) => setFormData({ ...formData, addressStreet: e.target.value })}
                    disabled={isLoadingCep}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="addressNumber">Número</Label>
                  <Input
                    id="addressNumber"
                    type="text"
                    placeholder="Número"
                    value={formData.addressNumber}
                    onChange={(e) => setFormData({ ...formData, addressNumber: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="addressComplement">Complemento</Label>
                  <Input
                    id="addressComplement"
                    type="text"
                    placeholder="Apto, Bloco, etc."
                    value={formData.addressComplement}
                    onChange={(e) => setFormData({ ...formData, addressComplement: e.target.value })}
                    disabled={isLoadingCep}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="addressNeighborhood">Bairro</Label>
                  <Input
                    id="addressNeighborhood"
                    type="text"
                    placeholder="Bairro"
                    value={formData.addressNeighborhood}
                    onChange={(e) => setFormData({ ...formData, addressNeighborhood: e.target.value })}
                    disabled={isLoadingCep}
                  />
                </div>
              </div>

              <StateCitySelector
                stateValue={formData.addressState}
                cityValue={formData.addressCity}
                onStateChange={(v) => setFormData({ ...formData, addressState: v })}
                onCityChange={(v) => setFormData({ ...formData, addressCity: v })}
                disabled={isLoadingCep}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" className="gradient-primary" disabled={isLoading}>
          {isLoading ? 'Cadastrando...' : 'Cadastrar Funcionário'}
        </Button>
      </div>
    </form>
  );
}
