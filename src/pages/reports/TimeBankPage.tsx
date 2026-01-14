import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Wallet } from 'lucide-react';
import { HelpButton } from '@/components/HelpButton';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ReportFilters } from '@/components/reports/ReportFilters';
import { TimeBankReport } from '@/components/reports/TimeBankReport';

interface TimeRecord {
  id: string;
  profile_id: string;
  record_type: string;
  recorded_at: string;
  nsr: number;
  profiles?: {
    full_name: string;
    department?: string | null;
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
}

export default function TimeBankPage() {
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
            department
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
            <Wallet className="h-8 w-8 text-primary" />
            Banco de Horas
          </h1>
          <p className="text-muted-foreground">
            Relatório do banco de horas por funcionário
          </p>
        </div>
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
              <Wallet className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <h3 className="text-lg font-medium mb-2">Selecione os filtros</h3>
              <p>Escolha o período e clique em "Buscar Dados" para gerar o relatório</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <TimeBankReport
          entries={calculateTimeBankData()}
          companySettings={companySettings}
          startDate={filters.startDate}
          endDate={filters.endDate}
        />
      )}

      <HelpButton pageKey="timebank-report" />
    </div>
  );
}
