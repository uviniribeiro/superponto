import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));


interface OvertimeData {
  employee: string;
  department: string;
  overtimeHours: number;
}

interface DepartmentSummary {
  name: string;
  totalOvertime: number;
  employeeCount: number;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Weekly overtime report function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get company settings for email
    const { data: companySettings } = await supabase
      .from('company_settings')
      .select('overtime_alert_email, company_name')
      .limit(1)
      .maybeSingle();

    if (!companySettings?.overtime_alert_email) {
      console.log("No overtime alert email configured");
      return new Response(
        JSON.stringify({ message: "No email configured for reports" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get managers and admins emails
    const { data: adminUsers } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['admin', 'manager']);

    const adminIds = adminUsers?.map(u => u.user_id) || [];

    const { data: adminProfiles } = await supabase
      .from('profiles')
      .select('email, full_name')
      .in('user_id', adminIds)
      .eq('is_active', true);

    // Calculate date range (last 7 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    // Fetch profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, department')
      .eq('is_active', true);

    // Fetch time records
    const { data: timeRecords } = await supabase
      .from('time_records')
      .select('*')
      .gte('recorded_at', startDate.toISOString())
      .lte('recorded_at', endDate.toISOString())
      .order('recorded_at');

    // Fetch schedules
    const { data: employeeSchedules } = await supabase
      .from('employee_schedules')
      .select('profile_id, schedule_id');

    const { data: workSchedules } = await supabase
      .from('work_schedules')
      .select('*');

    // Calculate overtime
    const overtimeData: OvertimeData[] = [];
    const departmentMap: Record<string, { total: number; count: number }> = {};

    profiles?.forEach(profile => {
      const schedule = employeeSchedules?.find(es => es.profile_id === profile.id);
      const workSchedule = schedule ? workSchedules?.find(ws => ws.id === schedule.schedule_id) : null;
      
      const employeeRecords = timeRecords?.filter(tr => tr.profile_id === profile.id) || [];
      
      // Group by date
      const recordsByDate: Record<string, typeof employeeRecords> = {};
      employeeRecords.forEach(record => {
        const date = new Date(record.recorded_at).toISOString().split('T')[0];
        if (!recordsByDate[date]) recordsByDate[date] = [];
        recordsByDate[date].push(record);
      });

      let totalWorked = 0;
      let expectedHours = 0;

      Object.entries(recordsByDate).forEach(([date, records]) => {
        const dayOfWeek = new Date(date).getDay();
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayName = dayNames[dayOfWeek];
        
        const startKey = `${dayName}_start`;
        const endKey = `${dayName}_end`;

        if (workSchedule && (workSchedule as any)[startKey] && (workSchedule as any)[endKey]) {
          const [startH, startM] = ((workSchedule as any)[startKey] as string).split(':').map(Number);
          const [endH, endM] = ((workSchedule as any)[endKey] as string).split(':').map(Number);
          const expectedMinutes = (endH * 60 + endM) - (startH * 60 + startM) - (workSchedule.break_duration_minutes || 60);
          expectedHours += expectedMinutes / 60;
        }

        // Calculate worked hours
        const sortedRecords = records.sort((a, b) => 
          new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
        );

        for (let i = 0; i < sortedRecords.length - 1; i += 2) {
          if (sortedRecords[i + 1]) {
            const minutes = (new Date(sortedRecords[i + 1].recorded_at).getTime() - 
                           new Date(sortedRecords[i].recorded_at).getTime()) / 60000;
            totalWorked += minutes / 60;
          }
        }
      });

      const overtime = Math.max(0, totalWorked - expectedHours);
      const dept = profile.department || 'Sem departamento';

      if (overtime > 0) {
        overtimeData.push({
          employee: profile.full_name,
          department: dept,
          overtimeHours: Math.round(overtime * 10) / 10
        });
      }

      if (!departmentMap[dept]) {
        departmentMap[dept] = { total: 0, count: 0 };
      }
      departmentMap[dept].total += overtime;
      departmentMap[dept].count++;
    });

    // Sort by overtime hours
    overtimeData.sort((a, b) => b.overtimeHours - a.overtimeHours);

    // Format department summary
    const departmentSummary: DepartmentSummary[] = Object.entries(departmentMap)
      .map(([name, data]) => ({
        name,
        totalOvertime: Math.round(data.total * 10) / 10,
        employeeCount: data.count
      }))
      .filter(d => d.totalOvertime > 0)
      .sort((a, b) => b.totalOvertime - a.totalOvertime);

    const totalOvertimeHours = overtimeData.reduce((sum, d) => sum + d.overtimeHours, 0);
    const companyName = companySettings.company_name || 'Ponto Max';

    // Format dates for display
    const formatDate = (date: Date) => {
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    // Build email HTML
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
        <div style="max-width: 700px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Relatório Semanal de Horas Extras</h1>
            <p style="color: #e0e7ff; margin: 10px 0 0 0; font-size: 14px;">${companyName}</p>
          </div>
          
          <div style="padding: 30px;">
            <p style="color: #4b5563; margin: 0 0 20px 0;">
              Período: <strong>${formatDate(startDate)}</strong> a <strong>${formatDate(endDate)}</strong>
            </p>
            
            <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #1f2937; margin: 0 0 15px 0;">Resumo</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Total de Horas Extras:</td>
                  <td style="padding: 8px 0; color: #1f2937; font-weight: 600; text-align: right;">${Math.round(totalOvertimeHours * 10) / 10}h</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Funcionários com HE:</td>
                  <td style="padding: 8px 0; color: #1f2937; font-weight: 600; text-align: right;">${overtimeData.length}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #6b7280;">Departamentos:</td>
                  <td style="padding: 8px 0; color: #1f2937; font-weight: 600; text-align: right;">${departmentSummary.length}</td>
                </tr>
              </table>
            </div>

            ${departmentSummary.length > 0 ? `
            <h3 style="color: #1f2937; margin: 25px 0 15px 0;">Por Departamento</h3>
            <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px;">
              <thead>
                <tr style="background-color: #f9fafb;">
                  <th style="padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; color: #374151;">Departamento</th>
                  <th style="padding: 12px; text-align: right; border-bottom: 1px solid #e5e7eb; color: #374151;">Funcionários</th>
                  <th style="padding: 12px; text-align: right; border-bottom: 1px solid #e5e7eb; color: #374151;">Total HE</th>
                </tr>
              </thead>
              <tbody>
                ${departmentSummary.map(dept => `
                  <tr>
                    <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${dept.name}</td>
                    <td style="padding: 12px; text-align: right; border-bottom: 1px solid #e5e7eb;">${dept.employeeCount}</td>
                    <td style="padding: 12px; text-align: right; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${dept.totalOvertime}h</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            ` : ''}

            ${overtimeData.length > 0 ? `
            <h3 style="color: #1f2937; margin: 25px 0 15px 0;">Top 10 Funcionários</h3>
            <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px;">
              <thead>
                <tr style="background-color: #f9fafb;">
                  <th style="padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; color: #374151;">Funcionário</th>
                  <th style="padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; color: #374151;">Departamento</th>
                  <th style="padding: 12px; text-align: right; border-bottom: 1px solid #e5e7eb; color: #374151;">Horas Extras</th>
                </tr>
              </thead>
              <tbody>
                ${overtimeData.slice(0, 10).map(emp => `
                  <tr>
                    <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${emp.employee}</td>
                    <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${emp.department}</td>
                    <td style="padding: 12px; text-align: right; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${emp.overtimeHours}h</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            ` : '<p style="color: #6b7280; text-align: center; padding: 20px;">Nenhuma hora extra registrada no período.</p>'}
          </div>
          
          <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
              Este é um relatório automático do sistema Ponto Max. Gerado em ${formatDate(new Date())}.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Collect all recipient emails
    const recipientEmails = new Set<string>();
    recipientEmails.add(companySettings.overtime_alert_email);
    adminProfiles?.forEach(p => {
      if (p.email) recipientEmails.add(p.email);
    });

    console.log(`Sending weekly report to ${recipientEmails.size} recipients`);

    // Send email
    const emailResponse = await resend.emails.send({
      from: "Ponto Max <onboarding@resend.dev>",
      to: Array.from(recipientEmails),
      subject: `Relatório Semanal de Horas Extras - ${formatDate(startDate)} a ${formatDate(endDate)}`,
      html: emailHtml,
    });

    console.log("Weekly report sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, recipients: recipientEmails.size, ...emailResponse }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error sending weekly report:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
