import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { ClipboardList } from 'lucide-react';
import { HelpButton } from '@/components/HelpButton';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { MirrorPointReport } from '@/components/reports/MirrorPointReport';
import { PageHeader } from '@/components/shared/PageHeader';

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

export default function MirrorPointPage() {
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <PageHeader
          title="Espelho de Ponto"
          description="Relatório individual detalhado de marcações" icon={ClipboardList}
          className="mb-0 min-w-0 flex-1 border-0 bg-transparent p-0 backdrop-blur-none sm:p-0"
        />
      </div>

      <ReportFilters 
        employees={employees} 
        onFilter={handleFilter} 
        loading={loading}
      />

      {!dataLoaded ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <ClipboardList className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <h3 className="text-lg font-medium mb-2">Selecione os filtros</h3>
              <p>Escolha o período e um funcionário para gerar o espelho de ponto</p>
            </div>
          </CardContent>
        </Card>
      ) : filters.selectedEmployee !== 'all' && selectedEmployeeData ? (
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

      <HelpButton pageKey="mirror-point-report" />
    </div>
  );
}
