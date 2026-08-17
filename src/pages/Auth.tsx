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
import { Building2, Landmark, Shield, Eye, EyeOff, GraduationCap, Heart, Palette, Bus, Settings2, Users, Loader2, Fingerprint, MapPin, FileCheck2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { z } from 'zod';
import { CnpjInput } from '@/components/shared/CnpjInput';
import { getCNPJFeedback, cleanCNPJ } from '@/lib/validators';
import { cn } from '@/lib/utils';
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

  const isConnectionError = (message?: string) => {
    if (!message) return false;
    const m = message.toLowerCase();
    return (
      m.includes('failed to fetch') ||
      m.includes('load failed') ||
      m.includes('networkerror') ||
      m.includes('network request failed') ||
      m.includes('fetch failed') ||
      m.includes('timeout') ||
      m.includes('service unavailable') ||
      m.includes('upstream')
    );
  };

  const CONNECTION_MESSAGE =
    'Não foi possível conectar ao servidor. Verifique sua internet e tente novamente em alguns instantes.';

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
          toast.error(
            isConnectionError(authError.message) ? CONNECTION_MESSAGE : 'Credenciais inválidas'
          );
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
          if (isConnectionError(error.message)) {
            toast.error(CONNECTION_MESSAGE);
          } else if (error.message.includes('Login ou senha incorretos')) {
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
      } else {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Login error:', error);
        toast.error(isConnectionError(message) ? CONNECTION_MESSAGE : `Erro ao entrar: ${message}`);
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
    <div className="min-h-screen w-full lg:grid lg:grid-cols-[1.1fr_1fr]">
      {/* Painel de marca */}
      <aside className="brand-panel hidden lg:flex flex-col justify-between p-12 text-primary-foreground">
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
            <img src={superpontoLogo} alt="Ponto Max" className="h-8 w-8" />
          </div>
          <div>
            <p className="font-heading text-xl font-bold leading-none">Ponto Max</p>
            <p className="text-[11px] uppercase tracking-[0.2em] text-primary-foreground/60">
              Ponto eletrônico
            </p>
          </div>
        </div>

        <div className="relative z-10 max-w-md">
          <h2 className="font-heading text-4xl font-bold leading-tight tracking-tight">
            Controle de jornada com precisão institucional.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-primary-foreground/70">
            Registro, apuração e conformidade legal em uma plataforma única — para empresas
            e prefeituras.
          </p>

          <ul className="mt-10 space-y-4">
            {[
              { icon: Fingerprint, label: 'Identificação biométrica, facial e QR Code' },
              { icon: MapPin, label: 'Geolocalização e postos de trabalho monitorados' },
              { icon: FileCheck2, label: 'Conformidade com a Portaria 671 do MTE' },
            ].map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3 text-sm text-primary-foreground/85">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                  <Icon className="h-4 w-4 text-white" />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-primary-foreground/50">
          Ponto Max © 2026 — Todos os direitos reservados
        </p>
      </aside>

      {/* Coluna do formulário */}
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm animate-fade-in">
        {/* Logo (mobile) */}
        <div className="mb-8 flex flex-col items-center text-center lg:hidden">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl border border-border bg-card shadow-sm">
            <img src={superpontoLogo} alt="Ponto Max" className="h-14 w-14" />
          </div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">Ponto Max</h1>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Sistema de Ponto Eletrônico
          </p>
        </div>

        <Card className="rounded-3xl border-border/70 shadow-xl">
          <form onSubmit={handleLogin}>
            <CardHeader className="pb-4">
              <CardTitle className="font-heading text-2xl font-bold tracking-tight">Bem-vindo</CardTitle>
              <CardDescription className="text-sm">
                Entre com suas credenciais para acessar o sistema
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

        <div className="mt-5 rounded-2xl border border-dashed border-border bg-muted/40 p-3 text-center">
          <a href="/terminal" className="text-xs font-medium text-primary hover:underline underline-offset-4">
            Usar este dispositivo como Terminal de Ponto (login por CNPJ)
          </a>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Ponto Max © 2026
        </p>
        </div>
      </div>
    </div>
  );
}
