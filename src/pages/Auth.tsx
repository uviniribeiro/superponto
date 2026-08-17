import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Building2, Landmark, Shield, Eye, EyeOff, GraduationCap, Heart, Palette, Bus, Settings2, Users, Loader2 } from 'lucide-react';
import { z } from 'zod';
import superpontoLogo from '@/assets/pontomax-logo.png';

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

export default function Auth() {
  const navigate = useNavigate();
  const { signIn, user, loading, mustChangePassword, isSuperAdmin } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [loginType, setLoginType] = useState<LoginType>('company');
  const [cityHalls, setCityHalls] = useState<{ id: string; name: string; code: string }[]>([]);
  const [sectors, setSectors] = useState<{ id: string; name: string; sector: string; code: string }[]>([]);
  const [selectedCityHall, setSelectedCityHall] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [loginData, setLoginData] = useState({ 
    username: '', 
    password: '', 
    companyCode: '' 
  });

  useEffect(() => {
    if (!loading && user) {
      if (mustChangePassword && !isSuperAdmin) {
        toast.info('Você precisa alterar sua senha antes de continuar');
        navigate('/settings');
        return;
      }
      navigate('/dashboard');
    }
  }, [user, loading, navigate, mustChangePassword, isSuperAdmin]);

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
    try {
      const { data, error } = await supabase.functions.invoke('validate-company-login', {
        body: { action: 'list-city-halls' }
      });
      
      if (error) {
        console.error('Error fetching city halls:', error);
        return;
      }
      
      if (data?.success && data?.data) {
        setCityHalls(data.data);
      }
    } catch (error) {
      console.error('Error fetching city halls:', error);
    }
  };

  const fetchSectors = async (cityHallId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('validate-company-login', {
        body: { action: 'list-sectors', cityHallId }
      });
      
      if (error) {
        console.error('Error fetching sectors:', error);
        return;
      }
      
      if (data?.success && data?.data) {
        setSectors(data.data);
      }
    } catch (error) {
      console.error('Error fetching sectors:', error);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (loginType === 'super_admin') {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: loginData.username,
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        {/* Logo Ponto Max */}
        <div className="flex flex-col items-center mb-8">
          <img 
            src={superpontoLogo} 
            alt="Ponto Max" 
            className="h-20 w-20 mb-3"
          />
          <h1 className="text-2xl font-bold text-foreground">Ponto Max</h1>
          <p className="text-sm text-muted-foreground">Sistema de Ponto Eletrônico</p>
        </div>

        <Card className="border shadow-lg">
          <form onSubmit={handleLogin}>
            <CardHeader className="pb-4 text-center">
              <CardTitle className="text-lg">Bem-vindo</CardTitle>
              <CardDescription className="text-sm">
                Entre com suas credenciais
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Login Type Selector */}
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant={loginType === 'company' ? 'default' : 'outline'}
                  size="sm"
                  className="flex flex-col h-auto py-2.5 gap-1"
                  onClick={() => {
                    setLoginType('company');
                    setLoginData({ ...loginData, companyCode: '' });
                  }}
                >
                  <Building2 className="h-4 w-4" />
                  <span className="text-xs">Empresa</span>
                </Button>
                <Button
                  type="button"
                  variant={loginType === 'city_hall' ? 'default' : 'outline'}
                  size="sm"
                  className="flex flex-col h-auto py-2.5 gap-1"
                  onClick={() => {
                    setLoginType('city_hall');
                    setLoginData({ ...loginData, companyCode: '' });
                    setSelectedCityHall('');
                  }}
                >
                  <Landmark className="h-4 w-4" />
                  <span className="text-xs">Prefeitura</span>
                </Button>
                <Button
                  type="button"
                  variant={loginType === 'super_admin' ? 'default' : 'outline'}
                  size="sm"
                  className="flex flex-col h-auto py-2.5 gap-1"
                  onClick={() => setLoginType('super_admin')}
                >
                  <Shield className="h-4 w-4" />
                  <span className="text-xs">Admin</span>
                </Button>
              </div>

              {loginType === 'company' && (
                <div className="space-y-1.5">
                  <Label htmlFor="login-company" className="text-sm">CNPJ da Empresa</Label>
                  <Input
                    id="login-company"
                    type="text"
                    placeholder="00.000.000/0000-00"
                    value={loginData.companyCode}
                    onChange={(e) => setLoginData({ ...loginData, companyCode: e.target.value })}
                    required
                    className="h-10"
                  />
                </div>
              )}

              {loginType === 'city_hall' && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Prefeitura</Label>
                    <Select
                      value={selectedCityHall}
                      onValueChange={(value) => {
                        setSelectedCityHall(value);
                        setLoginData({ ...loginData, companyCode: '' });
                      }}
                    >
                      <SelectTrigger className="h-10">
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
                    <div className="space-y-1.5">
                      <Label className="text-sm">Setor</Label>
                      <Select
                        value={loginData.companyCode}
                        onValueChange={(value) => setLoginData({ ...loginData, companyCode: value })}
                      >
                        <SelectTrigger className="h-10">
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
                </>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="login-username" className="text-sm">
                  {loginType === 'super_admin' ? 'Email' : 'Login'}
                </Label>
                <Input
                  id="login-username"
                  type="text"
                  placeholder={loginType === 'super_admin' ? 'admin@sistema.com' : 'seu.login'}
                  value={loginData.username}
                  onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                  required
                  className="h-10"
                />
              </div>
              
              <div className="space-y-1.5">
                <Label htmlFor="login-password" className="text-sm">Senha</Label>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••"
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    required
                    className="h-10 pr-10"
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
            </CardContent>
            
            <CardFooter>
              <Button 
                type="submit" 
                className="w-full h-10"
                disabled={isLoading || (loginType === 'city_hall' && !loginData.companyCode)}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  'Entrar'
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <div className="text-center mt-4">
          <a href="/terminal" className="text-xs text-primary underline underline-offset-4">
            Usar este dispositivo como Terminal de Ponto (login por CNPJ)
          </a>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Ponto Max v2.0.0 © 2026
        </p>
      </div>
    </div>
  );
}
