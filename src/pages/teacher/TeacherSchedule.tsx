import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import TeacherScheduleBoard from '@/components/teachers/TeacherScheduleBoard';
import useSEO from '@/hooks/useSEO';

interface Profile {
  id: string;
  full_name: string;
  registration_number: string | null;
}

interface TeacherAssignment {
  id: string;
  profile_id: string;
  educator_type: string | null;
  teaching_level: string | null;
  subject: string | null;
  contract_weekly_hours: number | null;
  profile?: {
    full_name: string;
    registration_number: string | null;
  };
}

export default function TeacherSchedule() {
  useSEO({
    title: 'Quadro de Horários Professor | SuperPonto',
    description: 'Quadro de horários dos professores.',
  });

  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [assignmentsRes, employeesRes] = await Promise.all([
        supabase.from('employee_class_hour_assignments').select(`
          id, profile_id, educator_type, teaching_level, subject, contract_weekly_hours,
          profile:profiles(full_name, registration_number)
        `).eq('is_active', true).order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, full_name, registration_number').eq('is_active', true).order('full_name'),
      ]);

      if (assignmentsRes.data) setAssignments(assignmentsRes.data as unknown as TeacherAssignment[]);
      if (employeesRes.data) setEmployees(employeesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Carregando quadro de horários...</p>
        </div>
      </div>
    );
  }

  return <TeacherScheduleBoard assignments={assignments} employees={employees} onRefresh={fetchData} />;
}
