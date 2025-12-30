import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Clock, Fingerprint, Shield, Users, Building2 } from 'lucide-react';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().trim().email('Email inválido').max(255),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres').max(100),
  companyCode: z.string().trim().min(1, 'Código da empresa é obrigatório').max(20),
});

const signupSchema = z.object({
  email: z.string().trim().email('Email inválido').max(255),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres').max(100),
  confirmPassword: z.string(),
  fullName: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100),
  companyName: z.string().trim().min(2, 'Nome da empresa é obrigatório').max(100),
  companyCnpj: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Senhas não coincidem",
  path: ["confirmPassword"],
});

export default function Auth() {
  const navigate = useNavigate();
  const { signIn, signUp, user, loading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  
  const [loginData, setLoginData] = useState({ 
    email: '', 
    password: '', 
    companyCode: '' 
  });
  const [signupData, setSignupData] = useState({ 
    email: '', 
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validData = loginSchema.parse(loginData);
      const { error } = await signIn(validData.email, validData.password, validData.companyCode);
      
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Email ou senha incorretos');
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success('Login realizado com sucesso!');
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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validData = signupSchema.parse(signupData);
      const { error } = await signUp(
        validData.email, 
        validData.password, 
        validData.fullName,
        validData.companyName,
        validData.companyCnpj || ''
      );
      
      if (error) {
        if (error.message.includes('already registered')) {
          toast.error('Este email já está cadastrado');
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
            Sistema de Controle de Ponto Eletrônico Multi-Empresas
          </h1>
          <p className="text-primary-foreground/80 text-lg">
            Conforme Portarias 1510 e 671 do Ministério do Trabalho
          </p>
          
          <div className="grid grid-cols-2 gap-6 pt-8">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary-foreground/20 rounded-lg">
                <Building2 className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-primary-foreground">Multi-Empresas</h3>
                <p className="text-sm text-primary-foreground/70">Cada empresa isolada</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary-foreground/20 rounded-lg">
                <Clock className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-primary-foreground">Registro em Tempo Real</h3>
                <p className="text-sm text-primary-foreground/70">Geolocalização GPS</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary-foreground/20 rounded-lg">
                <Shield className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-primary-foreground">Conformidade Legal</h3>
                <p className="text-sm text-primary-foreground/70">Relatórios AFD/AFDT</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary-foreground/20 rounded-lg">
                <Users className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-primary-foreground">Gestão de Equipes</h3>
                <p className="text-sm text-primary-foreground/70">Jornadas flexíveis</p>
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
                  <TabsTrigger value="signup">Nova Empresa</TabsTrigger>
                </TabsList>
              </CardHeader>

              <TabsContent value="login">
                <form onSubmit={handleLogin}>
                  <CardContent className="space-y-4">
                    <CardTitle>Bem-vindo de volta</CardTitle>
                    <CardDescription>
                      Informe o código da empresa e suas credenciais
                    </CardDescription>
                    
                    <div className="space-y-2">
                      <Label htmlFor="login-company">Código da Empresa</Label>
                      <Input
                        id="login-company"
                        type="text"
                        placeholder="Ex: EMPRESA123"
                        value={loginData.companyCode}
                        onChange={(e) => setLoginData({ ...loginData, companyCode: e.target.value.toUpperCase() })}
                        className="uppercase"
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email</Label>
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="seu@email.com"
                        value={loginData.email}
                        onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
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
                      disabled={isLoading}
                    >
                      {isLoading ? 'Entrando...' : 'Entrar'}
                    </Button>
                  </CardFooter>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignup}>
                  <CardContent className="space-y-4">
                    <CardTitle>Cadastrar Empresa</CardTitle>
                    <CardDescription>
                      Crie uma conta para sua empresa
                    </CardDescription>
                    
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm font-medium mb-2">Dados da Empresa</p>
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="signup-company-name">Nome da Empresa *</Label>
                          <Input
                            id="signup-company-name"
                            type="text"
                            placeholder="Razão Social"
                            value={signupData.companyName}
                            onChange={(e) => setSignupData({ ...signupData, companyName: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="signup-cnpj">CNPJ</Label>
                          <Input
                            id="signup-cnpj"
                            type="text"
                            placeholder="00.000.000/0000-00"
                            value={signupData.companyCnpj}
                            onChange={(e) => setSignupData({ ...signupData, companyCnpj: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>

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
                          <Label htmlFor="signup-email">Email *</Label>
                          <Input
                            id="signup-email"
                            type="email"
                            placeholder="seu@email.com"
                            value={signupData.email}
                            onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                            required
                          />
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
                      {isLoading ? 'Cadastrando...' : 'Criar Empresa'}
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
