import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import { HelpButton } from '@/components/HelpButton';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { MTEExports } from '@/components/reports/MTEExports';
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
}

interface CompanySettings {
  company_name: string;
  cnpj?: string | null;
  cei?: string | null;
  rep_number?: string | null;
  address?: string | null;
}

export default function MTEExportsPage() {
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [filters, setFilters] = useState({
    startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    selectedEmployee: 'all',
    selectedDepartment: 'all',
  });
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    fetchEmployees();
    fetchCompanySettings();
  }, []);

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, department')
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
      <div className="mb-0 flex flex-col gap-4 rounded-2xl border border-border/60 bg-card/80 p-5 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <PageHeader
          title="Arquivos MTE"
          description="Exportação de arquivos conforme Portaria 671/2021" icon={Download}
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
              <Download className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <h3 className="text-lg font-medium mb-2">Selecione os filtros</h3>
              <p>Escolha o período e clique em "Buscar Dados" para gerar os arquivos</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
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
        </div>
      )}

      <HelpButton pageKey="mte-exports" />
    </div>
  );
}
