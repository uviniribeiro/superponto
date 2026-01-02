import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Clock, Fingerprint, Shield, Users, Building2, Landmark, GraduationCap, Heart, Palette, Bus, Settings2 } from 'lucide-react';
import { z } from 'zod';

type LoginType = 'company' | 'city_hall' | 'super_admin';

const sectorLabels: Record<string, { label: string; icon: React.ElementType }> = {
  education: { label: 'Educação', icon: GraduationCap },
  health: { label: 'Saúde', icon: Heart },
  culture: { label: 'Cultura', icon: Palette },
  transport: { label: 'Transportes', icon: Bus },
  administration: { label: 'Administração', icon: Settings2 },
  finance: { label: 'Finanças', icon: Building2 },
  environment: { label: 'Meio Ambiente', icon: Landmark },
  social_assistance: { label: 'Assistência Social', icon: Users },
  urban_planning: { label: 'Planejamento Urbano', icon: Building2 },
  other: { label: 'Outros', icon: Settings2 },
};

const loginSchema = z.object({
  username: z.string().trim().min(3, 'Login deve ter pelo menos 3 caracteres').max(50),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres').max(100),
  companyCode: z.string().trim().min(1, 'Código é obrigatório').max(50),
});

const cnpjRegex = /^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/;

const signupSchema = z.object({
  username: z.string().trim().min(3, 'Login deve ter pelo menos 3 caracteres').max(50).regex(/^[a-zA-Z0-9._-]+$/, 'Login pode conter apenas letras, números, pontos, underscores e hífens'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres').max(100),
  confirmPassword: z.string(),
  fullName: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100),
  companyName: z.string().trim().min(2, 'Nome da organização é obrigatório').max(100),
  companyCnpj: z.string().trim().min(14, 'CNPJ é obrigatório').max(18).refine(
    (val) => cnpjRegex.test(val),
    { message: 'CNPJ inválido' }
  ),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Senhas não coincidem",
  path: ["confirmPassword"],
});

export default function Auth() {
  const navigate = useNavigate();
  const { signIn, signUp, user, loading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [loginType, setLoginType] = useState<LoginType>('company');
  const [cityHalls, setCityHalls] = useState<{ id: string; name: string; code: string }[]>([]);
  const [sectors, setSectors] = useState<{ id: string; name: string; sector: string; code: string }[]>([]);
  const [selectedCityHall, setSelectedCityHall] = useState('');
  const [signupOrgType, setSignupOrgType] = useState<'company' | 'city_hall'>('company');
  
  const [loginData, setLoginData] = useState({ 
    username: '', 
    password: '', 
    companyCode: '' 
  });
  const [signupData, setSignupData] = useState({ 
    username: '', 
    password: '', 
    confirmPassword: '', 
    fullName: '',
    companyName: '',
    companyCnpj: ''
  });

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (loginType === 'city_hall') {
      fetchCityHalls();
    }
  }, [loginType]);

  useEffect(() => {
    if (selectedCityHall) {
      fetchSectors(selectedCityHall);
    } else {
      setSectors([]);
    }
  }, [selectedCityHall]);

  const fetchCityHalls = async () => {
    const { data } = await supabase
      .from('companies')
      .select('id, name, company_code')
      .eq('organization_type', 'city_hall')
      .is('parent_organization_id', null)
      .eq('is_active', true)
      .order('name');
    
    if (data) {
      setCityHalls(data.map(ch => ({ id: ch.id, name: ch.name, code: ch.company_code })));
    }
  };

  const fetchSectors = async (cityHallId: string) => {
    const { data } = await supabase
      .from('companies')
      .select('id, name, sector, company_code')
      .eq('parent_organization_id', cityHallId)
      .eq('is_active', true)
      .order('name');
    
    if (data) {
      setSectors(data.map(s => ({ 
        id: s.id, 
        name: s.name, 
        sector: s.sector || 'other',
        code: s.company_code 
      })));
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (loginType === 'super_admin') {
        // Super admin login - still uses email internally
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: loginData.username, // For super admin, username is actually the email
          password: loginData.password
        });

        if (authError) {
          toast.error('Credenciais inválidas');
          setIsLoading(false);
          return;
        }

        if (authData.user) {
          const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', authData.user.id)
            .eq('role', 'super_admin')
            .maybeSingle();

          if (!roleData) {
            await supabase.auth.signOut();
            toast.error('Acesso negado. Você não é um Super Administrador.');
            setIsLoading(false);
            return;
          }

          toast.success('Login realizado com sucesso!');
          navigate('/super-admin');
        }
      } else {
        // Company or City Hall login
        const validData = loginSchema.parse(loginData);
        const { error } = await signIn(validData.username, validData.password, validData.companyCode);
        
        if (error) {
          if (error.message.includes('Login ou senha incorretos')) {
            toast.error('Login ou senha incorretos');
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success('Login realizado com sucesso!');
          navigate('/dashboard');
        }
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validData = signupSchema.parse(signupData);
      const { error } = await signUp(
        validData.username, 
        validData.password, 
        validData.fullName,
        validData.companyName,
        validData.companyCnpj || ''
      );
      
      if (error) {
        if (error.message.includes('já cadastrado')) {
          toast.error('Este login ou CNPJ já está cadastrado');
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success('Empresa e conta criadas com sucesso! Você já pode fazer login.');
        navigate('/dashboard');
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse-soft">
          <Clock className="w-12 h-12 text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 gradient-primary p-12 flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 text-primary-foreground">
            <Fingerprint className="w-10 h-10" />
            <span className="text-2xl font-bold">PontoMax</span>
          </div>
        </div>
        
        <div className="space-y-8">
          <h1 className="text-4xl font-bold text-primary-foreground leading-tight">
            Sistema de Controle de Ponto Eletrônico
          </h1>
          <p className="text-primary-foreground/80 text-lg">
            Para Empresas e Prefeituras • Conforme Portarias 1510 e 671
          </p>
          
          <div className="grid grid-cols-2 gap-6 pt-8">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary-foreground/20 rounded-lg">
                <Building2 className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-primary-foreground">Empresas</h3>
                <p className="text-sm text-primary-foreground/70">Acesso via CNPJ</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary-foreground/20 rounded-lg">
                <Landmark className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-primary-foreground">Prefeituras</h3>
                <p className="text-sm text-primary-foreground/70">Setores organizados</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary-foreground/20 rounded-lg">
                <Clock className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-primary-foreground">Tempo Real</h3>
                <p className="text-sm text-primary-foreground/70">Geolocalização GPS</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary-foreground/20 rounded-lg">
                <Shield className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-primary-foreground">Conformidade</h3>
                <p className="text-sm text-primary-foreground/70">Relatórios AFD/AFDT</p>
              </div>
            </div>
          </div>
        </div>
        
        <p className="text-primary-foreground/60 text-sm">
          © 2024 PontoMax. Todos os direitos reservados.
        </p>
      </div>

      {/* Right Panel - Auth Forms */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md animate-fade-in">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <Fingerprint className="w-8 h-8 text-primary" />
            <span className="text-xl font-bold">PontoMax</span>
          </div>

          <Card className="border-0 shadow-xl">
            <Tabs defaultValue="login" className="w-full">
              <CardHeader className="pb-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">Entrar</TabsTrigger>
                  <TabsTrigger value="signup">Cadastrar</TabsTrigger>
                </TabsList>
              </CardHeader>

              <TabsContent value="login">
                <form onSubmit={handleLogin}>
                  <CardContent className="space-y-4">
                    <CardTitle>Bem-vindo de volta</CardTitle>
                    <CardDescription>
                      Selecione o tipo de acesso e informe suas credenciais
                    </CardDescription>

                    {/* Login Type Selector */}
                    <div className="space-y-2">
                      <Label>Tipo de Acesso</Label>
                      <div className="grid grid-cols-3 gap-2">
                        <Button
                          type="button"
                          variant={loginType === 'company' ? 'default' : 'outline'}
                          className="flex flex-col h-auto py-3 gap-1"
                          onClick={() => {
                            setLoginType('company');
                            setLoginData({ ...loginData, companyCode: '' });
                          }}
                        >
                          <Building2 className="h-5 w-5" />
                          <span className="text-xs">Empresa</span>
                        </Button>
                        <Button
                          type="button"
                          variant={loginType === 'city_hall' ? 'default' : 'outline'}
                          className="flex flex-col h-auto py-3 gap-1"
                          onClick={() => {
                            setLoginType('city_hall');
                            setLoginData({ ...loginData, companyCode: '' });
                            setSelectedCityHall('');
                          }}
                        >
                          <Landmark className="h-5 w-5" />
                          <span className="text-xs">Prefeitura</span>
                        </Button>
                        <Button
                          type="button"
                          variant={loginType === 'super_admin' ? 'default' : 'outline'}
                          className="flex flex-col h-auto py-3 gap-1"
                          onClick={() => setLoginType('super_admin')}
                        >
                          <Shield className="h-5 w-5" />
                          <span className="text-xs">Super Admin</span>
                        </Button>
                      </div>
                    </div>

                    {loginType === 'company' && (
                      <div className="space-y-2">
                        <Label htmlFor="login-company">CNPJ da Empresa</Label>
                        <Input
                          id="login-company"
                          type="text"
                          placeholder="00.000.000/0000-00"
                          value={loginData.companyCode}
                          onChange={(e) => setLoginData({ ...loginData, companyCode: e.target.value })}
                          required
                        />
                      </div>
                    )}

                    {loginType === 'city_hall' && (
                      <>
                        <div className="space-y-2">
                          <Label>Prefeitura</Label>
                          <Select
                            value={selectedCityHall}
                            onValueChange={(value) => {
                              setSelectedCityHall(value);
                              setLoginData({ ...loginData, companyCode: '' });
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a prefeitura" />
                            </SelectTrigger>
                            <SelectContent>
                              {cityHalls.map((ch) => (
                                <SelectItem key={ch.id} value={ch.id}>
                                  {ch.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {selectedCityHall && (
                          <div className="space-y-2">
                            <Label>Setor</Label>
                            <Select
                              value={loginData.companyCode}
                              onValueChange={(value) => setLoginData({ ...loginData, companyCode: value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o setor" />
                              </SelectTrigger>
                              <SelectContent>
                                {sectors.map((s) => {
                                  const sectorInfo = sectorLabels[s.sector] || sectorLabels.other;
                                  const Icon = sectorInfo.icon;
                                  return (
                                    <SelectItem key={s.id} value={s.code}>
                                      <div className="flex items-center gap-2">
                                        <Icon className="h-4 w-4" />
                                        {s.name}
                                      </div>
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {cityHalls.length === 0 && (
                          <p className="text-sm text-muted-foreground">
                            Nenhuma prefeitura cadastrada. Entre em contato com o administrador.
                          </p>
                        )}
                      </>
                    )}

                    {loginType !== 'super_admin' && (
                      <div className="p-3 bg-muted rounded-lg text-xs text-muted-foreground">
                        {loginType === 'company' 
                          ? 'Use o CNPJ da sua empresa como código de acesso' 
                          : 'Selecione sua prefeitura e o setor onde trabalha'}
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <Label htmlFor="login-username">{loginType === 'super_admin' ? 'Email' : 'Login'}</Label>
                      <Input
                        id="login-username"
                        type={loginType === 'super_admin' ? 'email' : 'text'}
                        placeholder={loginType === 'super_admin' ? 'admin@email.com' : 'seu.login'}
                        value={loginData.username}
                        onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="login-password">Senha</Label>
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="••••••••"
                        value={loginData.password}
                        onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                        required
                      />
                    </div>
                  </CardContent>
                  
                  <CardFooter>
                    <Button 
                      type="submit" 
                      className="w-full gradient-primary"
                      disabled={isLoading || (loginType === 'city_hall' && !loginData.companyCode)}
                    >
                      {isLoading ? 'Entrando...' : 'Entrar'}
                    </Button>
                  </CardFooter>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignup}>
                  <CardContent className="space-y-4">
                    <CardTitle>Cadastrar Organização</CardTitle>
                    <CardDescription>
                      Crie uma conta para sua empresa
                    </CardDescription>

                    <div className="space-y-2">
                      <Label>Tipo de Organização</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant={signupOrgType === 'company' ? 'default' : 'outline'}
                          className="flex items-center gap-2"
                          onClick={() => setSignupOrgType('company')}
                        >
                          <Building2 className="h-4 w-4" />
                          Empresa
                        </Button>
                        <Button
                          type="button"
                          variant={signupOrgType === 'city_hall' ? 'default' : 'outline'}
                          className="flex items-center gap-2"
                          onClick={() => setSignupOrgType('city_hall')}
                        >
                          <Landmark className="h-4 w-4" />
                          Prefeitura
                        </Button>
                      </div>
                    </div>
                    
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm font-medium mb-2">
                        {signupOrgType === 'company' ? 'Dados da Empresa' : 'Dados da Prefeitura'}
                      </p>
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="signup-company-name">
                            {signupOrgType === 'company' ? 'Razão Social *' : 'Nome da Prefeitura *'}
                          </Label>
                          <Input
                            id="signup-company-name"
                            type="text"
                            placeholder={signupOrgType === 'company' ? 'Razão Social' : 'Prefeitura Municipal de...'}
                            value={signupData.companyName}
                            onChange={(e) => setSignupData({ ...signupData, companyName: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="signup-cnpj">CNPJ *</Label>
                          <Input
                            id="signup-cnpj"
                            type="text"
                            placeholder="00.000.000/0000-00"
                            value={signupData.companyCnpj}
                            onChange={(e) => setSignupData({ ...signupData, companyCnpj: e.target.value })}
                            required
                          />
                          <p className="text-xs text-muted-foreground">
                            O CNPJ será usado como código de acesso
                          </p>
                        </div>
                      </div>
                    </div>

                    {signupOrgType === 'city_hall' && (
                      <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                          <strong>Nota:</strong> Após criar a prefeitura, você poderá adicionar os setores (Educação, Saúde, etc.) pelo painel de Super Admin.
                        </p>
                      </div>
                    )}

                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm font-medium mb-2">Administrador</p>
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="signup-name">Nome Completo *</Label>
                          <Input
                            id="signup-name"
                            type="text"
                            placeholder="Seu nome"
                            value={signupData.fullName}
                            onChange={(e) => setSignupData({ ...signupData, fullName: e.target.value })}
                            required
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="signup-username">Login *</Label>
                          <Input
                            id="signup-username"
                            type="text"
                            placeholder="admin"
                            value={signupData.username}
                            onChange={(e) => setSignupData({ ...signupData, username: e.target.value })}
                            required
                          />
                          <p className="text-xs text-muted-foreground">
                            Apenas letras, números, pontos, underscores e hífens
                          </p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-2">
                            <Label htmlFor="signup-password">Senha *</Label>
                            <Input
                              id="signup-password"
                              type="password"
                              placeholder="••••••"
                              value={signupData.password}
                              onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                              required
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="signup-confirm">Confirmar *</Label>
                            <Input
                              id="signup-confirm"
                              type="password"
                              placeholder="••••••"
                              value={signupData.confirmPassword}
                              onChange={(e) => setSignupData({ ...signupData, confirmPassword: e.target.value })}
                              required
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  
                  <CardFooter>
                    <Button 
                      type="submit" 
                      className="w-full gradient-primary"
                      disabled={isLoading}
                    >
                      {isLoading ? 'Cadastrando...' : signupOrgType === 'company' ? 'Criar Empresa' : 'Criar Prefeitura'}
                    </Button>
                  </CardFooter>
                </form>
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  );
}
