import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Shield, Lock } from 'lucide-react';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

export default function SuperAdminAuth() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  useEffect(() => {
    // Check if already logged in as super admin
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .eq('role', 'super_admin')
          .maybeSingle();

        if (roleData) {
          navigate('/super-admin');
        }
      }
    };
    checkAuth();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validData = loginSchema.parse(formData);

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: validData.email,
        password: validData.password
      });

      if (authError) {
        toast.error('Credenciais inválidas');
        return;
      }

      if (authData.user) {
        // Check if user is super_admin
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', authData.user.id)
          .eq('role', 'super_admin')
          .maybeSingle();

        if (!roleData) {
          await supabase.auth.signOut();
          toast.error('Acesso negado. Você não é um Super Administrador.');
          return;
        }

        toast.success('Login realizado com sucesso!');
        navigate('/super-admin');
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        console.error('Login error:', error);
        toast.error('Erro ao fazer login');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-primary/20">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Super Admin</CardTitle>
          <CardDescription>
            Acesso exclusivo para administradores do sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@sistema.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
            </div>
            <Button 
              type="submit" 
              className="w-full gradient-primary" 
              disabled={isLoading}
            >
              {isLoading ? (
                'Entrando...'
              ) : (
                <>
                  <Lock className="h-4 w-4 mr-2" />
                  Acessar Painel
                </>
              )}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <Button
              variant="link"
              className="text-sm text-muted-foreground"
              onClick={() => navigate('/auth')}
            >
              Voltar para login normal
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
