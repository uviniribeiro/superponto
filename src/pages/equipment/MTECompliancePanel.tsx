import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  FileText, 
  Users, 
  Clock, 
  Wifi, 
  WifiOff,
  RefreshCw,
  Building2,
  FileCheck
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useEquipmentData, PORTARIA_OPTIONS } from '@/hooks/useEquipmentData';
import { validateCPF, validatePIS } from '@/lib/validators';
import { PageHeader } from '@/components/shared/PageHeader';

interface ComplianceIssue {
  id: string;
  type: 'error' | 'warning' | 'info';
  category: string;
  title: string;
  description: string;
  affectedItems?: string[];
}

interface EmployeeCompliance {
  id: string;
  full_name: string;
  has_pis: boolean;
  pis_valid: boolean;
  has_cpf: boolean;
  cpf_valid: boolean;
  has_registration: boolean;
  has_photo: boolean;
  has_schedule: boolean;
}

export default function MTECompliancePanel() {
  const { profile } = useAuth();
  const { equipments, onlineCount, offlineCount } = useEquipmentData();
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<EmployeeCompliance[]>([]);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [issues, setIssues] = useState<ComplianceIssue[]>([]);
  const [overallScore, setOverallScore] = useState(0);

  useEffect(() => {
    fetchComplianceData();
  }, [profile]);

  const fetchComplianceData = async () => {
    if (!profile?.company_id) return;
    
    setLoading(true);
    try {
      // Fetch employees with schedules
      const { data: employeesData } = await supabase
        .from('profiles')
        .select(`
          id, full_name, pis, cpf, registration_number, photo_url, is_active,
          employee_schedules(schedule_id)
        `)
        .eq('is_active', true);

      // Fetch company settings
      const { data: settings } = await supabase
        .from('company_settings')
        .select('*')
        .maybeSingle();

      setCompanySettings(settings);

      // Analyze employee compliance
      const employeeCompliance: EmployeeCompliance[] = (employeesData || []).map((emp: any) => {
        const pisValidation = emp.pis ? validatePIS(emp.pis) : { valid: false };
        const cpfValidation = emp.cpf ? validateCPF(emp.cpf) : { valid: false };

        return {
          id: emp.id,
          full_name: emp.full_name,
          has_pis: !!emp.pis,
          pis_valid: pisValidation.valid,
          has_cpf: !!emp.cpf,
          cpf_valid: cpfValidation.valid,
          has_registration: !!emp.registration_number,
          has_photo: !!emp.photo_url,
          has_schedule: emp.employee_schedules?.length > 0
        };
      });

      setEmployees(employeeCompliance);

      // Generate compliance issues
      const newIssues: ComplianceIssue[] = [];

      // Check company settings
      if (!settings?.cnpj) {
        newIssues.push({
          id: 'company_cnpj',
          type: 'error',
          category: 'Empresa',
          title: 'CNPJ não cadastrado',
          description: 'O CNPJ da empresa é obrigatório para geração de arquivos AFD/AFDT conforme Portaria 671.'
        });
      }

      if (!settings?.rep_number) {
        newIssues.push({
          id: 'company_rep',
          type: 'warning',
          category: 'Empresa',
          title: 'Número do REP não cadastrado',
          description: 'O número do REP é necessário para identificação do equipamento nos arquivos oficiais.'
        });
      }

      // Check employees without PIS
      const employeesWithoutPIS = employeeCompliance.filter(e => !e.has_pis);
      if (employeesWithoutPIS.length > 0) {
        newIssues.push({
          id: 'employees_pis',
          type: 'error',
          category: 'Funcionários',
          title: `${employeesWithoutPIS.length} funcionário(s) sem PIS`,
          description: 'O número do PIS é obrigatório para identificação nos arquivos AFD/AFDT.',
          affectedItems: employeesWithoutPIS.map(e => e.full_name)
        });
      }

      // Check employees with invalid PIS
      const employeesInvalidPIS = employeeCompliance.filter(e => e.has_pis && !e.pis_valid);
      if (employeesInvalidPIS.length > 0) {
        newIssues.push({
          id: 'employees_pis_invalid',
          type: 'error',
          category: 'Funcionários',
          title: `${employeesInvalidPIS.length} funcionário(s) com PIS inválido`,
          description: 'O dígito verificador do PIS está incorreto.',
          affectedItems: employeesInvalidPIS.map(e => e.full_name)
        });
      }

      // Check employees with invalid CPF
      const employeesInvalidCPF = employeeCompliance.filter(e => e.has_cpf && !e.cpf_valid);
      if (employeesInvalidCPF.length > 0) {
        newIssues.push({
          id: 'employees_cpf_invalid',
          type: 'error',
          category: 'Funcionários',
          title: `${employeesInvalidCPF.length} funcionário(s) com CPF inválido`,
          description: 'O dígito verificador do CPF está incorreto.',
          affectedItems: employeesInvalidCPF.map(e => e.full_name)
        });
      }

      // Check employees without schedule
      const employeesWithoutSchedule = employeeCompliance.filter(e => !e.has_schedule);
      if (employeesWithoutSchedule.length > 0) {
        newIssues.push({
          id: 'employees_schedule',
          type: 'warning',
          category: 'Funcionários',
          title: `${employeesWithoutSchedule.length} funcionário(s) sem jornada`,
          description: 'Funcionários sem jornada atribuída não terão horas extras calculadas.',
          affectedItems: employeesWithoutSchedule.map(e => e.full_name)
        });
      }

      // Check employees without photo
      const employeesWithoutPhoto = employeeCompliance.filter(e => !e.has_photo);
      if (employeesWithoutPhoto.length > 0) {
        newIssues.push({
          id: 'employees_photo',
          type: 'warning',
          category: 'Funcionários',
          title: `${employeesWithoutPhoto.length} funcionário(s) sem foto`,
          description: 'Funcionários sem foto não terão validação facial no registro de ponto.',
          affectedItems: employeesWithoutPhoto.map(e => e.full_name)
        });
      }

      // Check equipment
      if (equipments.length === 0) {
        newIssues.push({
          id: 'no_equipment',
          type: 'warning',
          category: 'Equipamentos',
          title: 'Nenhum equipamento cadastrado',
          description: 'Cadastre pelo menos um relógio de ponto para coleta automática de registros.'
        });
      }

      const offlineEquipments = equipments.filter(e => !e.is_online && e.is_active);
      if (offlineEquipments.length > 0) {
        newIssues.push({
          id: 'offline_equipment',
          type: 'warning',
          category: 'Equipamentos',
          title: `${offlineEquipments.length} equipamento(s) offline`,
          description: 'Equipamentos offline não estão coletando registros de ponto.',
          affectedItems: offlineEquipments.map(e => e.name)
        });
      }

      const equipmentsWithoutPortaria = equipments.filter(e => !(e as any).portaria_compliance);
      if (equipmentsWithoutPortaria.length > 0) {
        newIssues.push({
          id: 'equipment_portaria',
          type: 'info',
          category: 'Equipamentos',
          title: `${equipmentsWithoutPortaria.length} equipamento(s) sem portaria definida`,
          description: 'Defina a portaria de conformidade para cada equipamento.',
          affectedItems: equipmentsWithoutPortaria.map(e => e.name)
        });
      }

      setIssues(newIssues);

      // Calculate overall score
      const totalChecks = 8;
      const errors = newIssues.filter(i => i.type === 'error').length;
      const warnings = newIssues.filter(i => i.type === 'warning').length;
      const score = Math.max(0, Math.round(((totalChecks - errors - warnings * 0.5) / totalChecks) * 100));
      setOverallScore(score);

    } catch (error) {
      console.error('Error fetching compliance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return 'Excelente';
    if (score >= 80) return 'Bom';
    if (score >= 60) return 'Regular';
    if (score >= 40) return 'Atenção';
    return 'Crítico';
  };

  const getPortariaLabel = (value: string | null | undefined) => {
    return PORTARIA_OPTIONS.find(p => p.value === value)?.label || 'Não definida';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Conformidade MTE"
          description="Painel de homologação - Portarias 671, 1510 e 373" icon={Shield}
          className="mb-0 min-w-0 flex-1 border-0 bg-transparent p-0 backdrop-blur-none sm:p-0"
        />
        <Button onClick={fetchComplianceData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Score Card */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5" />
              Índice de Conformidade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className={`text-5xl font-bold ${getScoreColor(overallScore)}`}>
                {overallScore}%
              </div>
              <div className="flex-1">
                <Progress 
                  value={overallScore} 
                  className={`h-3 ${overallScore >= 80 ? '[&>div]:bg-green-500' : overallScore >= 60 ? '[&>div]:bg-yellow-500' : '[&>div]:bg-red-500'}`}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Status: <span className={`font-medium ${getScoreColor(overallScore)}`}>{getScoreLabel(overallScore)}</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4" />
              Funcionários
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{employees.length}</div>
            <p className="text-xs text-muted-foreground">
              {employees.filter(e => e.has_pis && e.pis_valid).length} com PIS válido
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4" />
              Equipamentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Wifi className="h-4 w-4 text-green-500" />
                <span className="text-xl font-bold">{onlineCount}</span>
              </div>
              <span className="text-muted-foreground">/</span>
              <div className="flex items-center gap-1">
                <WifiOff className="h-4 w-4 text-red-500" />
                <span className="text-xl font-bold">{offlineCount}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Online / Offline</p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {issues.filter(i => i.type === 'error').length > 0 && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Pendências Críticas para Homologação</AlertTitle>
          <AlertDescription>
            Existem {issues.filter(i => i.type === 'error').length} problema(s) crítico(s) que precisam ser resolvidos 
            para conformidade com as portarias do MTE.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="issues" className="space-y-4">
        <TabsList>
          <TabsTrigger value="issues">
            Pendências ({issues.length})
          </TabsTrigger>
          <TabsTrigger value="employees">
            Funcionários
          </TabsTrigger>
          <TabsTrigger value="equipment">
            Equipamentos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="issues" className="space-y-4">
          {issues.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-2" />
                <p className="text-lg font-medium">Nenhuma pendência encontrada!</p>
                <p className="text-muted-foreground">O sistema está em conformidade com as portarias do MTE.</p>
              </CardContent>
            </Card>
          ) : (
            issues.map((issue) => (
              <Card key={issue.id} className={`border-l-4 ${
                issue.type === 'error' ? 'border-l-red-500' : 
                issue.type === 'warning' ? 'border-l-yellow-500' : 'border-l-blue-500'
              }`}>
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      {issue.type === 'error' ? <XCircle className="h-5 w-5 text-red-500" /> :
                       issue.type === 'warning' ? <AlertTriangle className="h-5 w-5 text-yellow-500" /> :
                       <FileText className="h-5 w-5 text-blue-500" />}
                      {issue.title}
                    </CardTitle>
                    <Badge variant={issue.type === 'error' ? 'destructive' : issue.type === 'warning' ? 'secondary' : 'outline'}>
                      {issue.category}
                    </Badge>
                  </div>
                  <CardDescription>{issue.description}</CardDescription>
                </CardHeader>
                {issue.affectedItems && issue.affectedItems.length > 0 && (
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-1">
                      {issue.affectedItems.slice(0, 5).map((item, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {item}
                        </Badge>
                      ))}
                      {issue.affectedItems.length > 5 && (
                        <Badge variant="outline" className="text-xs">
                          +{issue.affectedItems.length - 5} mais
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="employees">
          <Card>
            <CardHeader>
              <CardTitle>Status de Conformidade dos Funcionários</CardTitle>
              <CardDescription>Verificação de documentos e cadastro conforme Portaria 671</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead className="text-center">PIS</TableHead>
                    <TableHead className="text-center">CPF</TableHead>
                    <TableHead className="text-center">Matrícula</TableHead>
                    <TableHead className="text-center">Foto</TableHead>
                    <TableHead className="text-center">Jornada</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-medium">{emp.full_name}</TableCell>
                      <TableCell className="text-center">
                        {emp.has_pis ? (
                          emp.pis_valid ? 
                            <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" /> :
                            <span title="Dígito verificador inválido"><XCircle className="h-5 w-5 text-red-500 mx-auto" /></span>
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {emp.has_cpf ? (
                          emp.cpf_valid ? 
                            <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" /> :
                            <span title="Dígito verificador inválido"><XCircle className="h-5 w-5 text-red-500 mx-auto" /></span>
                        ) : (
                          <AlertTriangle className="h-5 w-5 text-yellow-500 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {emp.has_registration ? 
                          <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" /> :
                          <AlertTriangle className="h-5 w-5 text-yellow-500 mx-auto" />
                        }
                      </TableCell>
                      <TableCell className="text-center">
                        {emp.has_photo ? 
                          <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" /> :
                          <AlertTriangle className="h-5 w-5 text-yellow-500 mx-auto" />
                        }
                      </TableCell>
                      <TableCell className="text-center">
                        {emp.has_schedule ? 
                          <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" /> :
                          <AlertTriangle className="h-5 w-5 text-yellow-500 mx-auto" />
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="equipment">
          <Card>
            <CardHeader>
              <CardTitle>Status de Homologação dos Equipamentos</CardTitle>
              <CardDescription>Conformidade com Portarias 671, 1510 e 373</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Equipamento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Portaria</TableHead>
                    <TableHead>Nº REP</TableHead>
                    <TableHead>Última Comunicação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {equipments.map((eq) => (
                    <TableRow key={eq.id}>
                      <TableCell className="font-medium">{eq.name}</TableCell>
                      <TableCell>
                        {eq.is_online ? (
                          <Badge className="bg-green-500">
                            <Wifi className="h-3 w-3 mr-1" />
                            Online
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <WifiOff className="h-3 w-3 mr-1" />
                            Offline
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getPortariaLabel((eq as any).portaria_compliance)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {(eq as any).rep_number || '-'}
                      </TableCell>
                      <TableCell>
                        {eq.last_communication ? 
                          format(new Date(eq.last_communication), "dd/MM/yy HH:mm", { locale: ptBR }) :
                          <span className="text-muted-foreground">Nunca</span>
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                  {equipments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Nenhum equipamento cadastrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
