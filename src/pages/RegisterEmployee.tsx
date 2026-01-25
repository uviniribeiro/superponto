import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { UserPlus, Shield, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { EmployeeRegistrationForm } from '@/components/employees/EmployeeRegistrationForm';
import { HelpButton } from '@/components/HelpButton';

export default function RegisterEmployee() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

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
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
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

      <EmployeeRegistrationForm
        onSuccess={() => navigate('/employees')}
        onCancel={() => navigate('/employees')}
      />

      <HelpButton pageKey="registeremployee" />
    </div>
  );
}
