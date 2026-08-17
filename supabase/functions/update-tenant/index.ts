import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';


import { getCorsHeaders } from "../_shared/cors.ts";
import { requireRole, assertCompanyAccess, authErrorResponse } from "../_shared/auth.ts";

interface UpdateTenantRequest {
  companyId: string;
  resources?: {
    teacherModule?: boolean;
    doctorModule?: boolean;
    payrollModule?: boolean;
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Alterar módulos/configurações de um tenant exige super admin (ou admin da própria empresa)
    const ctx = await requireRole(req, ['super_admin', 'admin']);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { companyId, resources }: UpdateTenantRequest = await req.json();

    if (!companyId) {
      return new Response(
        JSON.stringify({ error: 'Company ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    assertCompanyAccess(ctx, companyId);

    // Get company data
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single();

    if (companyError || !company) {
      return new Response(
        JSON.stringify({ error: 'Company not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: Record<string, any> = {
      companyId,
      companyName: company.name,
      updates: []
    };

    // Update modules if resources are provided
    if (resources) {
      const updates: Record<string, boolean> = {};
      
      if (resources.teacherModule !== undefined) {
        updates.teacher_module_enabled = resources.teacherModule;
      }
      if (resources.doctorModule !== undefined) {
        updates.doctor_module_enabled = resources.doctorModule;
      }
      if (resources.payrollModule !== undefined) {
        updates.payroll_module_enabled = resources.payrollModule;
      }

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from('companies')
          .update(updates)
          .eq('id', companyId);

        if (updateError) {
          console.error('Error updating company modules:', updateError);
        } else {
          results.updates.push({ type: 'modules', updates });
        }
      }
    }

    // Ensure default data exists for teacher module
    if (company.teacher_module_enabled || resources?.teacherModule) {
      // Check if class hour configurations exist
      const { data: classHourConfigs } = await supabase
        .from('class_hour_configurations')
        .select('id')
        .eq('company_id', companyId)
        .limit(1);

      if (!classHourConfigs || classHourConfigs.length === 0) {
        // Create default class hour configuration
        const { error: insertError } = await supabase
          .from('class_hour_configurations')
          .insert({
            company_id: companyId,
            name: 'Aula Padrão (50 min)',
            duration_minutes: 50,
            is_active: true,
            weekly_class_hours: 20,
            monthly_class_hours: 80
          });

        if (!insertError) {
          results.updates.push({ type: 'class_hour_configurations', action: 'created_default' });
        }
      }
    }

    // Ensure default data exists for doctor module
    if (company.doctor_module_enabled || resources?.doctorModule) {
      // Check if medical shift configurations exist
      const { data: shiftConfigs } = await supabase
        .from('medical_shift_configurations')
        .select('id')
        .eq('company_id', companyId)
        .limit(1);

      if (!shiftConfigs || shiftConfigs.length === 0) {
        // Create default shift configurations
        const defaultShifts = [
          { name: 'Plantão 12h Diurno', duration_hours: 12, shift_type: 'day', is_active: true },
          { name: 'Plantão 12h Noturno', duration_hours: 12, shift_type: 'night', is_active: true },
          { name: 'Plantão 24h', duration_hours: 24, shift_type: 'full', is_active: true },
          { name: 'Consulta (4h)', duration_hours: 4, shift_type: 'clinic', is_active: true },
        ];

        for (const shift of defaultShifts) {
          await supabase
            .from('medical_shift_configurations')
            .insert({
              company_id: companyId,
              ...shift
            });
        }
        results.updates.push({ type: 'medical_shift_configurations', action: 'created_defaults' });
      }
    }

    // Ensure default data exists for payroll module
    if (company.payroll_module_enabled || resources?.payrollModule) {
      // Check if payroll items exist
      const { data: payrollItems } = await supabase
        .from('payroll_items')
        .select('id')
        .eq('company_id', companyId)
        .limit(1);

      if (!payrollItems || payrollItems.length === 0) {
        // Create default payroll items (proventos e descontos)
        const defaultItems = [
          { code: '001', name: 'Salário Base', type: 'earning', calculation_type: 'fixed', is_active: true },
          { code: '002', name: 'Hora Extra 50%', type: 'earning', calculation_type: 'hour_based', percentage: 50, is_active: true },
          { code: '003', name: 'Hora Extra 100%', type: 'earning', calculation_type: 'hour_based', percentage: 100, is_active: true },
          { code: '004', name: 'Adicional Noturno', type: 'earning', calculation_type: 'percentage', percentage: 20, is_active: true },
          { code: '005', name: 'Adicional de Insalubridade', type: 'earning', calculation_type: 'percentage', is_active: true },
          { code: '006', name: 'Adicional de Periculosidade', type: 'earning', calculation_type: 'percentage', percentage: 30, is_active: true },
          { code: '101', name: 'INSS', type: 'deduction', calculation_type: 'inss_table', is_active: true },
          { code: '102', name: 'IRRF', type: 'deduction', calculation_type: 'irrf_table', is_active: true },
          { code: '103', name: 'Vale Transporte', type: 'deduction', calculation_type: 'percentage', percentage: 6, is_active: true },
          { code: '104', name: 'Vale Refeição', type: 'deduction', calculation_type: 'fixed', is_active: true },
          { code: '105', name: 'Faltas', type: 'deduction', calculation_type: 'day_based', is_active: true },
          { code: '106', name: 'Atrasos', type: 'deduction', calculation_type: 'hour_based', is_active: true },
        ];

        for (const item of defaultItems) {
          await supabase
            .from('payroll_items')
            .insert({
              company_id: companyId,
              ...item
            });
        }
        results.updates.push({ type: 'payroll_items', action: 'created_defaults' });
      }

      // Check if INSS brackets exist (for 2024/2025)
      const { data: inssBrackets } = await supabase
        .from('inss_brackets')
        .select('id')
        .eq('company_id', companyId)
        .limit(1);

      if (!inssBrackets || inssBrackets.length === 0) {
        // INSS brackets for 2024
        const defaultInssBrackets = [
          { min_salary: 0, max_salary: 1412.00, rate: 7.5, deduction_value: 0, valid_from: '2024-01-01' },
          { min_salary: 1412.01, max_salary: 2666.68, rate: 9, deduction_value: 21.18, valid_from: '2024-01-01' },
          { min_salary: 2666.69, max_salary: 4000.03, rate: 12, deduction_value: 101.18, valid_from: '2024-01-01' },
          { min_salary: 4000.04, max_salary: 7786.02, rate: 14, deduction_value: 181.18, valid_from: '2024-01-01' },
        ];

        for (const bracket of defaultInssBrackets) {
          await supabase
            .from('inss_brackets')
            .insert({
              company_id: companyId,
              ...bracket,
              is_active: true
            });
        }
        results.updates.push({ type: 'inss_brackets', action: 'created_defaults' });
      }

      // Check if IRRF brackets exist
      const { data: irrfBrackets } = await supabase
        .from('irrf_brackets')
        .select('id')
        .eq('company_id', companyId)
        .limit(1);

      if (!irrfBrackets || irrfBrackets.length === 0) {
        // IRRF brackets for 2024
        const defaultIrrfBrackets = [
          { min_salary: 0, max_salary: 2259.20, rate: 0, deduction_value: 0, valid_from: '2024-01-01' },
          { min_salary: 2259.21, max_salary: 2826.65, rate: 7.5, deduction_value: 169.44, valid_from: '2024-01-01' },
          { min_salary: 2826.66, max_salary: 3751.05, rate: 15, deduction_value: 381.44, valid_from: '2024-01-01' },
          { min_salary: 3751.06, max_salary: 4664.68, rate: 22.5, deduction_value: 662.77, valid_from: '2024-01-01' },
          { min_salary: 4664.69, max_salary: null, rate: 27.5, deduction_value: 896.00, valid_from: '2024-01-01' },
        ];

        for (const bracket of defaultIrrfBrackets) {
          await supabase
            .from('irrf_brackets')
            .insert({
              company_id: companyId,
              ...bracket,
              is_active: true
            });
        }
        results.updates.push({ type: 'irrf_brackets', action: 'created_defaults' });
      }
    }

    // Ensure default positions, departments and schedules exist
    const { data: departments } = await supabase
      .from('departments')
      .select('id')
      .eq('company_id', companyId)
      .limit(1);

    if (!departments || departments.length === 0) {
      await supabase
        .from('departments')
        .insert({
          company_id: companyId,
          name: 'Administrativo',
          is_active: true
        });
      results.updates.push({ type: 'departments', action: 'created_default' });
    }

    const { data: positions } = await supabase
      .from('positions')
      .select('id')
      .eq('company_id', companyId)
      .limit(1);

    if (!positions || positions.length === 0) {
      await supabase
        .from('positions')
        .insert({
          company_id: companyId,
          name: 'Funcionário',
          is_active: true
        });
      results.updates.push({ type: 'positions', action: 'created_default' });
    }

    const { data: schedules } = await supabase
      .from('work_schedules')
      .select('id')
      .eq('company_id', companyId)
      .limit(1);

    if (!schedules || schedules.length === 0) {
      await supabase
        .from('work_schedules')
        .insert({
          company_id: companyId,
          name: 'Horário Comercial',
          entry_time: '08:00',
          exit_time: '18:00',
          break_start: '12:00',
          break_end: '14:00',
          is_active: true
        });
      results.updates.push({ type: 'work_schedules', action: 'created_default' });
    }

    // Check justifications
    const { data: justifications } = await supabase
      .from('justifications')
      .select('id')
      .eq('company_id', companyId)
      .limit(1);

    if (!justifications || justifications.length === 0) {
      const defaultJustifications = [
        { description: 'Atestado Médico', code: 'ATM', justify_type: 'absence', is_active: true },
        { description: 'Falta Justificada', code: 'FTJ', justify_type: 'absence', is_active: true },
        { description: 'Atraso Justificado', code: 'ATJ', justify_type: 'delay', is_active: true },
        { description: 'Saída Antecipada', code: 'SAA', justify_type: 'early_leave', is_active: true },
        { description: 'Folga Compensatória', code: 'FLC', justify_type: 'compensatory', is_active: true },
      ];

      for (const justification of defaultJustifications) {
        await supabase
          .from('justifications')
          .insert({
            company_id: companyId,
            ...justification
          });
      }
      results.updates.push({ type: 'justifications', action: 'created_defaults' });
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Tenant atualizado com sucesso',
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const authResponse = authErrorResponse(error, corsHeaders);
    if (authResponse) return authResponse;
    console.error('Error updating tenant:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
