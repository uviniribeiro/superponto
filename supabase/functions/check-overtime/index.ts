import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

interface OvertimeCheckResult {
  profileId: string;
  profileName: string;
  alertType: 'daily' | 'weekly' | 'monthly';
  hoursWorked: number;
  hoursLimit: number;
  periodStart: string;
  periodEnd: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting overtime check...");

    // Get company settings
    const { data: companySettings } = await supabase
      .from('company_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (!companySettings) {
      console.log("No company settings found");
      return new Response(JSON.stringify({ message: "No company settings" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dailyLimit = companySettings.daily_overtime_limit_hours || 2;
    const weeklyLimit = companySettings.weekly_overtime_limit_hours || 10;
    const monthlyLimit = companySettings.monthly_overtime_limit_hours || 44;
    const alertEmail = companySettings.overtime_alert_email;

    console.log(`Limits: daily=${dailyLimit}h, weekly=${weeklyLimit}h, monthly=${monthlyLimit}h`);

    // Get all active employees with schedules
    const { data: employees } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        email,
        employee_schedules(
          work_schedules(*)
        )
      `)
      .eq('is_active', true);

    if (!employees || employees.length === 0) {
      console.log("No active employees found");
      return new Response(JSON.stringify({ message: "No employees" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const alerts: OvertimeCheckResult[] = [];

    for (const employee of employees) {
      const schedule = employee.employee_schedules?.[0]?.work_schedules as any;
      if (!schedule) continue;

      // Get expected daily hours from schedule
      const getDayHours = (day: string) => {
        const start = schedule[`${day}_start` as string];
        const end = schedule[`${day}_end` as string];
        if (!start || !end) return 0;
        const [sh, sm] = start.split(':').map(Number);
        const [eh, em] = end.split(':').map(Number);
        const breakMins = (schedule as any).break_duration_minutes || 0;
        return ((eh * 60 + em) - (sh * 60 + sm) - breakMins) / 60;
      };

      const dailyExpected = getDayHours(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][today.getDay()]);

      // Get today's records
      const todayStr = today.toISOString().split('T')[0];
      const { data: todayRecords } = await supabase
        .from('time_records')
        .select('*')
        .eq('profile_id', employee.id)
        .gte('recorded_at', `${todayStr}T00:00:00`)
        .lte('recorded_at', `${todayStr}T23:59:59`)
        .order('recorded_at');

      // Calculate hours worked today
      let todayWorked = 0;
      let entryTime: Date | null = null;
      (todayRecords || []).forEach((record: any) => {
        if (record.record_type === 'entry' || record.record_type === 'break_end') {
          entryTime = new Date(record.recorded_at);
        } else if ((record.record_type === 'exit' || record.record_type === 'break_start') && entryTime) {
          const exitTime = new Date(record.recorded_at);
          todayWorked += (exitTime.getTime() - entryTime.getTime()) / (1000 * 60 * 60);
          entryTime = null;
        }
      });

      const todayOvertime = todayWorked - dailyExpected;

      // Check daily limit
      if (todayOvertime > dailyLimit) {
        const existingAlert = await supabase
          .from('overtime_alerts')
          .select('id')
          .eq('profile_id', employee.id)
          .eq('alert_type', 'daily')
          .eq('period_start', todayStr)
          .maybeSingle();

        if (!existingAlert.data) {
          alerts.push({
            profileId: employee.id,
            profileName: employee.full_name,
            alertType: 'daily',
            hoursWorked: Math.round(todayOvertime * 100) / 100,
            hoursLimit: dailyLimit,
            periodStart: todayStr,
            periodEnd: todayStr
          });
        }
      }

      // Get weekly records and calculate weekly overtime
      const weekStartStr = startOfWeek.toISOString().split('T')[0];
      const { data: weekRecords } = await supabase
        .from('time_records')
        .select('*')
        .eq('profile_id', employee.id)
        .gte('recorded_at', `${weekStartStr}T00:00:00`)
        .lte('recorded_at', `${todayStr}T23:59:59`)
        .order('recorded_at');

      // Group by day and calculate weekly total
      const recordsByDay: { [key: string]: any[] } = {};
      (weekRecords || []).forEach((record: any) => {
        const day = record.recorded_at.split('T')[0];
        if (!recordsByDay[day]) recordsByDay[day] = [];
        recordsByDay[day].push(record);
      });

      let weeklyWorked = 0;
      let weeklyExpected = 0;
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      
      for (let d = new Date(startOfWeek); d <= today; d.setDate(d.getDate() + 1)) {
        const dayStr = d.toISOString().split('T')[0];
        const dayOfWeek = days[d.getDay()];
        weeklyExpected += getDayHours(dayOfWeek);

        const dayRecords = recordsByDay[dayStr] || [];
        let dayWorked = 0;
        let entry: Date | null = null;
        dayRecords.forEach((record: any) => {
          if (record.record_type === 'entry' || record.record_type === 'break_end') {
            entry = new Date(record.recorded_at);
          } else if ((record.record_type === 'exit' || record.record_type === 'break_start') && entry) {
            dayWorked += (new Date(record.recorded_at).getTime() - entry.getTime()) / (1000 * 60 * 60);
            entry = null;
          }
        });
        weeklyWorked += dayWorked;
      }

      const weeklyOvertime = weeklyWorked - weeklyExpected;

      if (weeklyOvertime > weeklyLimit) {
        const existingAlert = await supabase
          .from('overtime_alerts')
          .select('id')
          .eq('profile_id', employee.id)
          .eq('alert_type', 'weekly')
          .eq('period_start', weekStartStr)
          .maybeSingle();

        if (!existingAlert.data) {
          alerts.push({
            profileId: employee.id,
            profileName: employee.full_name,
            alertType: 'weekly',
            hoursWorked: Math.round(weeklyOvertime * 100) / 100,
            hoursLimit: weeklyLimit,
            periodStart: weekStartStr,
            periodEnd: todayStr
          });
        }
      }

      // Monthly check (similar logic, simplified)
      const monthStartStr = startOfMonth.toISOString().split('T')[0];
      const { data: monthRecords } = await supabase
        .from('time_records')
        .select('*')
        .eq('profile_id', employee.id)
        .gte('recorded_at', `${monthStartStr}T00:00:00`)
        .lte('recorded_at', `${todayStr}T23:59:59`);

      let monthlyWorked = 0;
      let monthlyExpected = 0;
      const monthRecordsByDay: { [key: string]: any[] } = {};
      (monthRecords || []).forEach((record: any) => {
        const day = record.recorded_at.split('T')[0];
        if (!monthRecordsByDay[day]) monthRecordsByDay[day] = [];
        monthRecordsByDay[day].push(record);
      });

      for (let d = new Date(startOfMonth); d <= today; d.setDate(d.getDate() + 1)) {
        const dayStr = d.toISOString().split('T')[0];
        const dayOfWeek = days[d.getDay()];
        monthlyExpected += getDayHours(dayOfWeek);

        const dayRecords = monthRecordsByDay[dayStr] || [];
        let dayWorked = 0;
        let entry: Date | null = null;
        dayRecords.forEach((record: any) => {
          if (record.record_type === 'entry' || record.record_type === 'break_end') {
            entry = new Date(record.recorded_at);
          } else if ((record.record_type === 'exit' || record.record_type === 'break_start') && entry) {
            dayWorked += (new Date(record.recorded_at).getTime() - entry.getTime()) / (1000 * 60 * 60);
            entry = null;
          }
        });
        monthlyWorked += dayWorked;
      }

      const monthlyOvertime = monthlyWorked - monthlyExpected;

      if (monthlyOvertime > monthlyLimit) {
        const existingAlert = await supabase
          .from('overtime_alerts')
          .select('id')
          .eq('profile_id', employee.id)
          .eq('alert_type', 'monthly')
          .eq('period_start', monthStartStr)
          .maybeSingle();

        if (!existingAlert.data) {
          alerts.push({
            profileId: employee.id,
            profileName: employee.full_name,
            alertType: 'monthly',
            hoursWorked: Math.round(monthlyOvertime * 100) / 100,
            hoursLimit: monthlyLimit,
            periodStart: monthStartStr,
            periodEnd: todayStr
          });
        }
      }
    }

    console.log(`Found ${alerts.length} new alerts`);

    // Save alerts and send emails
    for (const alert of alerts) {
      await supabase.from('overtime_alerts').insert({
        profile_id: alert.profileId,
        alert_type: alert.alertType,
        period_start: alert.periodStart,
        period_end: alert.periodEnd,
        hours_worked: alert.hoursWorked,
        hours_limit: alert.hoursLimit
      });

      // Send email if configured
      if (RESEND_API_KEY && alertEmail) {
        const typeLabels: Record<string, string> = { daily: 'Diário', weekly: 'Semanal', monthly: 'Mensal' };
        
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "PontoMax <onboarding@resend.dev>",
            to: [alertEmail],
            subject: `⚠️ Alerta de Horas Extras - ${alert.profileName}`,
            html: `
              <h1>Alerta de Limite de Horas Extras</h1>
              <p><strong>Funcionário:</strong> ${alert.profileName}</p>
              <p><strong>Tipo:</strong> Limite ${typeLabels[alert.alertType]}</p>
              <p><strong>Período:</strong> ${alert.periodStart} a ${alert.periodEnd}</p>
              <p><strong>Horas Extras:</strong> ${alert.hoursWorked}h</p>
              <p><strong>Limite Configurado:</strong> ${alert.hoursLimit}h</p>
              <p style="color: red;"><strong>O limite foi ultrapassado!</strong></p>
            `
          }),
        });

        if (res.ok) {
          console.log(`Email sent for ${alert.profileName}`);
        } else {
          console.error(`Failed to send email for ${alert.profileName}:`, await res.text());
        }
      }
    }

    return new Response(JSON.stringify({ 
      message: "Overtime check completed", 
      alertsGenerated: alerts.length 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in overtime check:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
