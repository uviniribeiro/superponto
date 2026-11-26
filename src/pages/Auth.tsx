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
import { Building2, Landmark, Shield, Eye, EyeOff, GraduationCap, Heart, Palette, Bus, Settings2, Users, Loader2, Fingerprint, MapPin, FileCheck2, AlertCircle, CheckCircle2, MonitorSmartphone } from 'lucide-react';
import { z } from 'zod';
import { CnpjInput } from '@/components/shared/CnpjInput';
import { getCNPJFeedback, cleanCNPJ } from '@/lib/validators';
import { cn } from '@/lib/utils';
import { PontoMaxLogo } from '@/components/PontoMaxLogo';
import { APP_MODE, homePathFor } from '@/lib/appMode';
import { isAdminHost } from '@/lib/adminHost';


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
  const adminHost = isAdminHost();
  const [loginType, setLoginType] = useState<LoginType>(adminHost ? 'super_admin' : 'company');
  const [cityHalls, setCityHalls] = useState<{ id: string; name: string; code: string }[]>([]);
  const [sectors, setSectors] = useState<{ id: string; name: string; sector: string; code: string }[]>([]);
  const [selectedCityHall, setSelectedCityHall] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [loginData, setLoginData] = useState({ 
    username: '', 
    password: '', 
    companyCode: '' 
  });
  const [touched, setTouched] = useState({ username: false, password: false, companyCode: false });
  const [authError, setAuthError] = useState<string | null>(null);

  const isSuperAdminLogin = loginType === 'super_admin';
  const cnpjFeedback = getCNPJFeedback(loginData.companyCode);

  const usernameError = (() => {
    const v = loginData.username.trim();
    if (!v) return 'Informe seu login';
    if (isSuperAdminLogin) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'E-mail inválido';
    }
    return v.length < 3 ? 'Login deve ter pelo menos 3 caracteres' : null;
  })();

  const passwordError = (() => {
    if (!loginData.password) return 'Informe sua senha';
    return loginData.password.length < 6 ? 'Senha deve ter pelo menos 6 caracteres' : null;
  })();

  const companyCodeError =
    loginType === 'company'
      ? cnpjFeedback.status === 'valid'
        ? null
        : cnpjFeedback.status === 'empty'
          ? 'Informe o CNPJ da empresa'
          : 'CNPJ inválido'
      : loginType === 'city_hall' && !loginData.companyCode
        ? 'Selecione o setor'
        : null;

  const formIsValid = !usernameError && !passwordError && !companyCodeError;


  // Aviso de bloqueio de acesso por período (gravado pelo AuthContext ao encerrar a sessão).
  useEffect(() => {
    try {
      const msg = sessionStorage.getItem('sp.access-block');
      if (msg) { sessionStorage.removeItem('sp.access-block'); toast.error(msg, { duration: 10000 }); }
    } catch { /* sem armazenamento */ }
  }, []);

  useEffect(() => {
    if (!loading && user) {
      if (mustChangePassword && !isSuperAdmin) {
        toast.info('Você precisa alterar sua senha antes de continuar');
        navigate('/settings');
        return;
      }
      navigate(isSuperAdmin ? '/super-admin' : homePathFor(APP_MODE));
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
    setTouched({ username: true, password: true, companyCode: true });
    setAuthError(null);

    if (!formIsValid) {
      const first = companyCodeError || usernameError || passwordError;
      if (first) {
        setAuthError(first);
        toast.error(first);
      }
      return;
    }

    setIsLoading(true);

    try {
      if (loginType === 'super_admin') {
        const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
          email: loginData.username.trim(),
          password: loginData.password
        });

        if (signInError) {
          const msg = isConnectionError(signInError.message)
            ? CONNECTION_MESSAGE
            : 'E-mail ou senha incorretos';
          setAuthError(msg);
          toast.error(msg);
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
            const msg = 'Acesso negado. Você não é um Super Administrador.';
            setAuthError(msg);
            toast.error(msg);
            setIsLoading(false);
            return;
          }

          toast.success('Login realizado com sucesso!');
          navigate('/super-admin');
        }
      } else {
        const payload = {
          username: loginData.username.trim(),
          password: loginData.password,
          companyCode:
            loginType === 'company' ? cleanCNPJ(loginData.companyCode) : loginData.companyCode,
        };
        const validData = loginSchema.parse(payload);
        const { error } = await signIn(validData.username, validData.password, validData.companyCode);
        
        if (error) {
          const msg = isConnectionError(error.message)
            ? CONNECTION_MESSAGE
            : error.message.includes('Login ou senha incorretos')
              ? 'Login ou senha incorretos'
              : error.message;
          setAuthError(msg);
          toast.error(msg);
        } else {
          toast.success('Login realizado com sucesso!');
        }
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        setAuthError(error.errors[0].message);
        toast.error(error.errors[0].message);
      } else {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Login error:', error);
        const msg = isConnectionError(message) ? CONNECTION_MESSAGE : `Erro ao entrar: ${message}`;
        setAuthError(msg);
        toast.error(msg);
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

  const roleTiles: { type: LoginType; label: string; icon: React.ElementType }[] = [
    { type: 'company', label: 'Empresa', icon: Building2 },
    { type: 'city_hall', label: 'Prefeitura', icon: Landmark },
  ];

  const selectRole = (type: LoginType) => {
    setLoginType(type);
    if (type !== 'super_admin') setLoginData({ ...loginData, companyCode: '' });
    if (type === 'city_hall') setSelectedCityHall('');
    setTouched({ username: false, password: false, companyCode: false });
    setAuthError(null);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-muted/50 flex flex-col">
      {/* Fundo desfocado com a cor da marca (como o "Glassy OTP") */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-24 h-[28rem] w-[28rem] rounded-full bg-primary/25 blur-3xl" />
        <div className="absolute top-1/3 -right-32 h-[32rem] w-[32rem] rounded-full bg-accent/25 blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 h-[26rem] w-[26rem] rounded-full bg-primary/15 blur-3xl" />
      </div>
      <header className="relative z-10 flex items-center justify-between gap-4 px-5 py-4 md:px-10">
        <PontoMaxLogo />
        {!adminHost && <Button variant="ghost" asChild className="rounded-full bg-background/50 backdrop-blur-md border border-border/60"><a href="/terminal"><MonitorSmartphone />Terminal de Ponto</a></Button>}
      </header>
      <div className="relative z-10 mx-auto w-full max-w-md flex-1 px-4 pb-10 pt-2 md:pt-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/30 bg-background/60 shadow-lg backdrop-blur-xl">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{adminHost ? 'Painel do Super Admin' : 'Acesse o PontoMax'}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{adminHost ? 'Acesso restrito à administração da plataforma.' : 'Gestão de ponto, jornadas e operações.'}</p>
        </div>
        <div className="flex flex-col overflow-hidden rounded-[28px] border border-white/40 dark:border-white/10 bg-background/60 backdrop-blur-2xl shadow-[0_24px_60px_-20px_rgba(0,0,0,.35)] animate-in fade-in-0 zoom-in-95 duration-500">
          {!adminHost && <div className="grid grid-cols-2 gap-2 p-2">
            {roleTiles.map(({ type, label, icon: Icon }) => {
              const active = loginType === type;
              return (
                <Button variant="ghost"
                  key={type}
                  type="button"
                  onClick={() => selectRole(type)}
                  aria-pressed={active}
                  className={cn(
                    'flex flex-col items-center justify-center gap-1 h-auto rounded-2xl px-2 py-3 transition-all duration-200',
                    active
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
                      : 'bg-background/40 text-secondary-foreground hover:bg-muted',
                  )}
                >
                  <Icon className={cn('h-4 w-4', active ? 'text-accent' : 'text-muted-foreground')} />
                  <span className="text-sm font-semibold">{label}</span>
                </Button>
              );
            })}
          </div>}

          <div className="flex-1 p-6 lg:p-10">
            <form onSubmit={handleLogin} className="mx-auto w-full max-w-sm space-y-5">
              <div className="space-y-1">
                <h2 className="font-heading text-2xl font-bold text-foreground">Bem-vindo</h2>
                <p className="text-sm text-muted-foreground">
                  {isSuperAdminLogin
                    ? 'Acesso restrito ao painel administrativo.'
                    : 'Insira os dados da sua organização.'}
                </p>
              </div>

              {authError && (
                <div
                  className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-xs text-destructive"
                  role="alert"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              {loginType === 'company' && (
                <div className="space-y-2">
                  <Label htmlFor="login-company" className="text-xs font-bold uppercase tracking-wider text-brand">
                    CNPJ da Organização
                  </Label>
                  <CnpjInput
                    id="login-company"
                    value={loginData.companyCode}
                    onChange={(value) => {
                      setAuthError(null);
                      setLoginData({ ...loginData, companyCode: value });
                    }}
                    onBlur={() => setTouched((t) => ({ ...t, companyCode: true }))}
                    disabled={isLoading}
                  />
                </div>
              )}

              {loginType === 'city_hall' && (
                <>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-brand">Prefeitura</Label>
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
                      <Label className="text-xs font-bold uppercase tracking-wider text-brand">Setor</Label>
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
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="login-username" className="text-xs font-bold uppercase tracking-wider text-brand">
                  {isSuperAdminLogin ? 'E-mail de acesso' : 'Usuário'}
                </Label>
                <div className="relative">
                  <Input
                    id="login-username"
                    type={isSuperAdminLogin ? 'email' : 'text'}
                    inputMode={isSuperAdminLogin ? 'email' : 'text'}
                    autoComplete="username"
                    placeholder={isSuperAdminLogin ? 'admin@sistema.com' : 'nome.sobrenome'}
                    value={loginData.username}
                    onChange={(e) => {
                      setAuthError(null);
                      setLoginData({ ...loginData, username: e.target.value });
                    }}
                    onBlur={() => setTouched((t) => ({ ...t, username: true }))}
                    aria-invalid={touched.username && !!usernameError}
                    aria-describedby="login-username-feedback"
                    className={cn(
                      'pr-9',
                      touched.username && usernameError && 'border-destructive focus-visible:ring-destructive',
                      touched.username && !usernameError && 'border-success',
                    )}
                  />
                  {touched.username && loginData.username.length > 0 && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2">
                      {usernameError ? (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      )}
                    </span>
                  )}
                </div>
                <p id="login-username-feedback" aria-live="polite" className="min-h-[1rem] text-xs text-destructive">
                  {touched.username && usernameError ? usernameError : ''}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password" className="text-xs font-bold uppercase tracking-wider text-brand">
                  Senha de Acesso
                </Label>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={loginData.password}
                    onChange={(e) => {
                      setAuthError(null);
                      setLoginData({ ...loginData, password: e.target.value });
                    }}
                    onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                    aria-invalid={touched.password && !!passwordError}
                    aria-describedby="login-password-feedback"
                    className={cn(
                      'pr-10',
                      touched.password && passwordError && 'border-destructive focus-visible:ring-destructive',
                      touched.password && !passwordError && 'border-success',
                    )}
                  />
                  <Button variant="ghost" size="icon"
                    type="button"
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p id="login-password-feedback" aria-live="polite" className="min-h-[1rem] text-xs text-destructive">
                  {touched.password && passwordError ? passwordError : ''}
                </p>
              </div>

              <Button
                type="submit"
                variant="default"
                size="lg"
                className="w-full"
                disabled={isLoading || !formIsValid}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  'Entrar no Sistema'
                )}
              </Button>

              {isSuperAdminLogin && <Button type="button" variant="link" className="w-full" onClick={() => navigate('/forgot-password')}>Esqueci minha senha</Button>}
              <p className="pt-2 text-center text-xs text-muted-foreground">
                Conexão protegida e registros com assinatura criptográfica.
              </p>

              <a
                href="/terminal"
                className="block text-center text-xs font-semibold text-brand underline-offset-4 hover:underline md:hidden"
              >
                Usar este dispositivo como Terminal de Ponto
              </a>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

