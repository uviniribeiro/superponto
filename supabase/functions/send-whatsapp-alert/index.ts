import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


import { getCorsHeaders } from "../_shared/cors.ts";

interface WhatsAppRequest {
  type: 'overtime_alert' | 'weekly_report';
  phone?: string;
  employeeName?: string;
  overtimeHours?: number;
  periodStart?: string;
  periodEnd?: string;
  alertType?: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-whatsapp-alert function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ZAPI_INSTANCE_ID = Deno.env.get("ZAPI_INSTANCE_ID");
    const ZAPI_TOKEN = Deno.env.get("ZAPI_TOKEN");

    if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN) {
      console.error("Z-API credentials not configured");
      return new Response(
        JSON.stringify({ error: "Z-API credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: WhatsAppRequest = await req.json();
    console.log("Request body:", body);

    if (body.type === 'overtime_alert' && body.phone) {
      // Send individual overtime alert
      const message = formatOvertimeMessage(
        body.employeeName || 'Funcionário',
        body.overtimeHours || 0,
        body.alertType || 'daily',
        body.periodStart || '',
        body.periodEnd || ''
      );

      await sendWhatsAppMessage(ZAPI_INSTANCE_ID, ZAPI_TOKEN, body.phone, message);
      
      return new Response(
        JSON.stringify({ success: true, message: "WhatsApp alert sent" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else if (body.type === 'weekly_report') {
      // Get company settings for WhatsApp phone
      const { data: companySettings } = await supabase
        .from('company_settings')
        .select('whatsapp_alert_phone, overtime_alert_email')
        .single();

      const alertPhone = (companySettings as any)?.whatsapp_alert_phone;

      if (!alertPhone) {
        console.log("No WhatsApp phone configured in company settings");
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "WhatsApp não configurado nas configurações da empresa" 
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get overtime data for the report
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - 7);

      const { data: alerts } = await supabase
        .from('overtime_alerts')
        .select('profile_id, hours_worked, alert_type')
        .gte('created_at', weekStart.toISOString());

      // Build report message
      let totalAlerts = alerts?.length || 0;
      let totalHours = alerts?.reduce((sum, a) => sum + Number(a.hours_worked), 0) || 0;

      const reportMessage = `📊 *Relatório Semanal de Horas Extras*\n\n` +
        `📅 Período: ${weekStart.toLocaleDateString('pt-BR')} a ${now.toLocaleDateString('pt-BR')}\n\n` +
        `⚠️ Total de Alertas: ${totalAlerts}\n` +
        `⏰ Total de Horas Extras: ${totalHours.toFixed(1)}h\n\n` +
        `_Acesse o sistema para mais detalhes._`;

      // Send WhatsApp message
      await sendWhatsAppMessage(ZAPI_INSTANCE_ID, ZAPI_TOKEN, alertPhone, reportMessage);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Relatório enviado via WhatsApp",
          report: {
            totalAlerts,
            totalHours: totalHours.toFixed(1),
            period: `${weekStart.toLocaleDateString('pt-BR')} a ${now.toLocaleDateString('pt-BR')}`
          }
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid request type" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in send-whatsapp-alert function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

function formatOvertimeMessage(
  employeeName: string,
  hours: number,
  alertType: string,
  periodStart: string,
  periodEnd: string
): string {
  const typeLabels: Record<string, string> = {
    'daily': 'diário',
    'weekly': 'semanal',
    'monthly': 'mensal'
  };

  return `⚠️ *Alerta de Horas Extras*\n\n` +
    `👤 Funcionário: ${employeeName}\n` +
    `⏰ Horas Extras: ${hours.toFixed(1)}h\n` +
    `📋 Tipo: Limite ${typeLabels[alertType] || alertType}\n` +
    `📅 Período: ${periodStart} a ${periodEnd}\n\n` +
    `_O limite de horas extras foi ultrapassado._`;
}

async function sendWhatsAppMessage(
  instanceId: string,
  token: string,
  phone: string,
  message: string
): Promise<void> {
  // Format phone number (remove non-digits and ensure country code)
  let formattedPhone = phone.replace(/\D/g, '');
  if (!formattedPhone.startsWith('55')) {
    formattedPhone = '55' + formattedPhone;
  }

  const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`;
  
  console.log("Sending WhatsApp message to:", formattedPhone);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      phone: formattedPhone,
      message: message,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Z-API error response:", errorText);
    throw new Error(`Failed to send WhatsApp message: ${response.status}`);
  }

  const result = await response.json();
  console.log("Z-API response:", result);
}

serve(handler);
