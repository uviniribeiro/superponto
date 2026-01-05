import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Filter, Search } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';

interface Employee {
  id: string;
  full_name: string;
  department?: string | null;
  registration_number?: string | null;
}

interface ReportFiltersProps {
  employees: Employee[];
  onFilter: (filters: {
    startDate: string;
    endDate: string;
    selectedEmployee: string;
    selectedDepartment: string;
  }) => void;
  loading?: boolean;
  showDepartmentFilter?: boolean;
}

export function ReportFilters({ employees, onFilter, loading, showDepartmentFilter = true }: ReportFiltersProps) {
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const departments = useMemo(() => {
    const depts = new Set(employees.map(e => e.department).filter(Boolean));
    return Array.from(depts) as string[];
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    let filtered = employees;
    
    if (selectedDepartment !== 'all') {
      filtered = filtered.filter(e => e.department === selectedDepartment);
    }
    
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(e => 
        e.full_name.toLowerCase().includes(term) ||
        (e.registration_number && e.registration_number.toLowerCase().includes(term))
      );
    }
    
    return filtered;
  }, [employees, selectedDepartment, searchTerm]);

  const handleFilter = () => {
    onFilter({
      startDate,
      endDate,
      selectedEmployee,
      selectedDepartment
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Filtros
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-2">
            <Label>Data Inicial</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Data Final</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          {showDepartmentFilter && (
            <div className="space-y-2">
              <Label>Departamento</Label>
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>Funcionário</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Selecionar</Label>
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos ({filteredEmployees.length})</SelectItem>
                {filteredEmployees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <Button onClick={handleFilter} className="gradient-primary" disabled={loading}>
            <Calendar className="mr-2 h-4 w-4" />
            {loading ? 'Buscando...' : 'Buscar Dados'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
