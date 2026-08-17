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
import { PageHeader } from '@/components/shared/PageHeader';

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
        <PageHeader
          title="Cadastrar Funcionário"
          description="Adicione um novo colaborador à empresa" icon={UserPlus}
          className="mb-0 min-w-0 flex-1 border-0 bg-transparent p-0 backdrop-blur-none sm:p-0"
        />
      </div>

      <EmployeeRegistrationForm
        onSuccess={() => navigate('/employees')}
        onCancel={() => navigate('/employees')}
      />

      <HelpButton pageKey="registeremployee" />
    </div>
  );
}
