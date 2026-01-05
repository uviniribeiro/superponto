import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { FileText, Clock, TrendingUp, AlertCircle, Users, Wallet, Download, BarChart3 } from 'lucide-react';
import { HelpButton } from '@/components/HelpButton';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';

import { ReportFilters } from '@/components/reports/ReportFilters';
import { MirrorPointReport } from '@/components/reports/MirrorPointReport';
import { OvertimeReport } from '@/components/reports/OvertimeReport';
import { AbsencesReport } from '@/components/reports/AbsencesReport';
import { AttendanceReport } from '@/components/reports/AttendanceReport';
import { TimeBankReport } from '@/components/reports/TimeBankReport';
import { WorkedHoursReport } from '@/components/reports/WorkedHoursReport';
import { MTEExports } from '@/components/reports/MTEExports';

interface TimeRecord {
  id: string;
  profile_id: string;
  record_type: string;
  recorded_at: string;
  nsr: number;
  profiles?: {
    full_name: string;
    pis?: string | null;
    cpf?: string | null;
    registration_number?: string | null;
    department?: string | null;
    position?: string | null;
  };
}

interface Employee {
  id: string;
  full_name: string;
  department?: string | null;
  registration_number?: string | null;
  cpf?: string | null;
  pis?: string | null;
  position?: string | null;
}

interface CompanySettings {
  company_name: string;
  cnpj?: string | null;
  cei?: string | null;
  rep_number?: string | null;
  address?: string | null;
}

export default function Reports() {
  const { company } = useAuth();
  const [activeTab, setActiveTab] = useState('espelho');
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [holidays, setHolidays] = useState<Date[]>([]);
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [filters, setFilters] = useState({
    startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    selectedEmployee: 'all',
    selectedDepartment: 'all',
  });
  const [selectedEmployeeData, setSelectedEmployeeData] = useState<Employee | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    fetchEmployees();
    fetchCompanySettings();
    fetchHolidays();
  }, []);

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, department, registration_number, cpf, pis, position')
      .eq('is_active', true)
      .order('full_name');
    setEmployees((data || []) as Employee[]);
  };

  const fetchCompanySettings = async () => {
    const { data } = await supabase
      .from('company_settings')
      .select('*')
      .limit(1)
      .maybeSingle();
    setCompanySettings(data);
  };

  const fetchHolidays = async () => {
    const currentYear = new Date().getFullYear();
    const { data } = await supabase
      .from('holidays')
      .select('date')
      .gte('date', `${currentYear}-01-01`)
      .lte('date', `${currentYear}-12-31`);
    
    setHolidays((data || []).map(h => parseISO(h.date)));
  };

  const handleFilter = async (newFilters: typeof filters) => {
    setFilters(newFilters);
    setLoading(true);
    setDataLoaded(false);

    try {
      let query = supabase
        .from('time_records')
        .select(`
          *,
          profiles!time_records_profile_id_fkey (
            full_name, 
            pis, 
            cpf, 
            registration_number, 
            department, 
            position
          )
        `)
        .gte('recorded_at', `${newFilters.startDate}T00:00:00`)
        .lte('recorded_at', `${newFilters.endDate}T23:59:59`)
        .order('recorded_at', { ascending: true });

      if (newFilters.selectedEmployee !== 'all') {
        query = query.eq('profile_id', newFilters.selectedEmployee);
        const emp = employees.find(e => e.id === newFilters.selectedEmployee);
        setSelectedEmployeeData(emp || null);
      } else {
        setSelectedEmployeeData(null);
      }

      const { data, error } = await query;
      if (error) throw error;
      setRecords(data || []);
      setDataLoaded(true);

      if (data && data.length > 0) {
        toast.success(`${data.length} registros carregados`);
      } else {
        toast.info('Nenhum registro encontrado no período');
      }
    } catch (error) {
      console.error('Error fetching records:', error);
      toast.error('Erro ao carregar registros');
    } finally {
      setLoading(false);
    }
  };

  const reportCategories = [
    { id: 'espelho', label: 'Espelho de Ponto', icon: FileText, color: 'text-blue-500' },
    { id: 'horas', label: 'Horas Trabalhadas', icon: Clock, color: 'text-green-500' },
    { id: 'extras', label: 'Horas Extras', icon: TrendingUp, color: 'text-orange-500' },
    { id: 'faltas', label: 'Faltas/Atrasos', icon: AlertCircle, color: 'text-red-500' },
    { id: 'frequencia', label: 'Frequência', icon: Users, color: 'text-purple-500' },
    { id: 'banco', label: 'Banco de Horas', icon: Wallet, color: 'text-indigo-500' },
    { id: 'mte', label: 'Arquivos MTE', icon: Download, color: 'text-teal-500' },
  ];

  // Calculate time bank data from records
  const calculateTimeBankData = () => {
    const employeeBalances = new Map<string, { credit: number; debit: number; profile: any }>();

    employees.forEach(emp => {
      const empRecords = records.filter(r => r.profile_id === emp.id);
      let credit = 0;
      let debit = 0;

      // Group by date and calculate
      const dateGroups = new Map<string, TimeRecord[]>();
      empRecords.forEach(r => {
        const dateKey = format(parseISO(r.recorded_at), 'yyyy-MM-dd');
        if (!dateGroups.has(dateKey)) {
          dateGroups.set(dateKey, []);
        }
        dateGroups.get(dateKey)!.push(r);
      });

      dateGroups.forEach((dayRecords) => {
        const entry = dayRecords.find(r => r.record_type === 'entry');
        const exit = dayRecords.find(r => r.record_type === 'exit');

        if (entry && exit) {
          const entryTime = parseISO(entry.recorded_at);
          const exitTime = parseISO(exit.recorded_at);
          const workedMinutes = Math.floor((exitTime.getTime() - entryTime.getTime()) / 60000) - 60;
          const expectedMinutes = 480; // 8 hours
          const diff = workedMinutes - expectedMinutes;

          if (diff > 0) {
            credit += diff;
          } else {
            debit += Math.abs(diff);
          }
        }
      });

      if (credit > 0 || debit > 0) {
        employeeBalances.set(emp.id, {
          credit,
          debit,
          profile: emp,
        });
      }
    });

    return Array.from(employeeBalances.entries()).map(([id, data]) => ({
      profile_id: id,
      profiles: {
        full_name: data.profile.full_name,
        department: data.profile.department,
      },
      credit_minutes: data.credit,
      debit_minutes: data.debit,
      balance_minutes: data.credit - data.debit,
    }));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-primary" />
            Relatórios
          </h1>
          <p className="text-muted-foreground">
            Relatórios completos conforme Secullum, ControliD, Atomo e Velti Ponto
          </p>
        </div>
      </div>

      {/* Filters */}
      <ReportFilters 
        employees={employees} 
        onFilter={handleFilter} 
        loading={loading}
      />

      {/* Report Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1 p-1">
          {reportCategories.map((cat) => (
            <TabsTrigger 
              key={cat.id} 
              value={cat.id}
              className="flex items-center gap-1.5 text-xs md:text-sm"
            >
              <cat.icon className={`h-4 w-4 ${cat.color}`} />
              <span className="hidden sm:inline">{cat.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {!dataLoaded ? (
          <Card className="mt-6">
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <FileText className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <h3 className="text-lg font-medium mb-2">Selecione os filtros</h3>
                <p>Escolha o período e clique em "Buscar Dados" para gerar os relatórios</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <TabsContent value="espelho" className="mt-6 space-y-4">
              {filters.selectedEmployee !== 'all' && selectedEmployeeData ? (
                <MirrorPointReport
                  employee={selectedEmployeeData}
                  records={records}
                  holidays={holidays}
                  companySettings={companySettings}
                  startDate={filters.startDate}
                  endDate={filters.endDate}
                />
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Espelho de Ponto</CardTitle>
                    <CardDescription>
                      Selecione um funcionário específico para gerar o espelho de ponto
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-center text-muted-foreground py-8">
                      O espelho de ponto é um relatório individual. 
                      Selecione um funcionário no filtro acima.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="horas" className="mt-6">
              <WorkedHoursReport
                records={records}
                companySettings={companySettings}
                startDate={filters.startDate}
                endDate={filters.endDate}
              />
            </TabsContent>

            <TabsContent value="extras" className="mt-6">
              <OvertimeReport
                records={records}
                companySettings={companySettings}
                startDate={filters.startDate}
                endDate={filters.endDate}
              />
            </TabsContent>

            <TabsContent value="faltas" className="mt-6">
              <AbsencesReport
                records={records}
                employees={employees}
                holidays={holidays}
                companySettings={companySettings}
                startDate={filters.startDate}
                endDate={filters.endDate}
              />
            </TabsContent>

            <TabsContent value="frequencia" className="mt-6">
              <AttendanceReport
                records={records}
                employees={employees}
                holidays={holidays}
                companySettings={companySettings}
                startDate={filters.startDate}
                endDate={filters.endDate}
              />
            </TabsContent>

            <TabsContent value="banco" className="mt-6">
              <TimeBankReport
                entries={calculateTimeBankData()}
                companySettings={companySettings}
                startDate={filters.startDate}
                endDate={filters.endDate}
              />
            </TabsContent>

            <TabsContent value="mte" className="mt-6 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5 text-primary" />
                    Exportação para o MTE
                  </CardTitle>
                  <CardDescription>
                    Arquivos conforme Portaria 671/2021 do Ministério do Trabalho
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-6">
                    Gere os arquivos exigidos pelo MTE para fiscalização e conformidade legal.
                    Todos os arquivos seguem o padrão estabelecido pela Portaria 671/2021.
                  </p>
                </CardContent>
              </Card>

              <MTEExports
                records={records}
                companySettings={companySettings}
                startDate={filters.startDate}
                endDate={filters.endDate}
              />
            </TabsContent>
          </>
        )}
      </Tabs>

      <HelpButton pageKey="reports" />
    </div>
  );
}
