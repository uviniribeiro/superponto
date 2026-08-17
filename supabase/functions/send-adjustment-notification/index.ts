import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

import { getCorsHeaders } from "../_shared/cors.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");


interface NotificationRequest {
  to: string;
  employeeName: string;
  status: "approved" | "rejected";
  requestType: string;
  requestedTime: string;
  reviewNotes?: string;
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, employeeName, status, requestType, requestedTime, reviewNotes }: NotificationRequest = await req.json();

    console.log(`Sending adjustment notification to ${to}`);

    const statusLabel = status === "approved" ? "Aprovada" : "Rejeitada";
    const statusColor = status === "approved" ? "#22c55e" : "#ef4444";
    const statusEmoji = status === "approved" ? "✅" : "❌";

    const requestTypeLabels: Record<string, string> = {
      correction: "Correção",
      addition: "Adição",
      deletion: "Exclusão"
    };

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Ponto Max</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 10px 0 0 0;">Sistema de Controle de Ponto</p>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div style="text-align: center; margin-bottom: 20px;">
              <span style="font-size: 48px;">${statusEmoji}</span>
            </div>
            
            <h2 style="color: #1f2937; text-align: center; margin: 0 0 20px 0;">
              Solicitação de Ajuste ${statusLabel}
            </h2>
            
            <p style="color: #6b7280; font-size: 16px; line-height: 1.6;">
              Olá <strong>${employeeName}</strong>,
            </p>
            
            <p style="color: #6b7280; font-size: 16px; line-height: 1.6;">
              Sua solicitação de ajuste de ponto foi analisada e o resultado é:
            </p>
            
            <div style="background: ${statusColor}15; border-left: 4px solid ${statusColor}; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; color: ${statusColor}; font-weight: bold; font-size: 18px;">
                ${statusLabel}
              </p>
            </div>
            
            <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #374151; margin: 0 0 15px 0; font-size: 14px; text-transform: uppercase;">Detalhes da Solicitação</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #6b7280; padding: 8px 0;">Tipo:</td>
                  <td style="color: #1f2937; font-weight: 500; padding: 8px 0; text-align: right;">${requestTypeLabels[requestType] || requestType}</td>
                </tr>
                <tr>
                  <td style="color: #6b7280; padding: 8px 0;">Data/Hora:</td>
                  <td style="color: #1f2937; font-weight: 500; padding: 8px 0; text-align: right;">${requestedTime}</td>
                </tr>
              </table>
            </div>
            
            ${reviewNotes ? `
            <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h4 style="color: #92400e; margin: 0 0 8px 0; font-size: 14px;">Observações do Revisor:</h4>
              <p style="color: #78350f; margin: 0; font-size: 14px;">${reviewNotes}</p>
            </div>
            ` : ''}
            
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 30px;">
              Este é um email automático do sistema Ponto Max. Por favor, não responda.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Ponto Max <onboarding@resend.dev>",
        to: [to],
        subject: `${statusEmoji} Solicitação de Ajuste ${statusLabel} - Ponto Max`,
        html,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Resend API error:", errorText);
      throw new Error(`Failed to send email: ${errorText}`);
    }

    const data = await res.json();
    console.log("Email sent successfully:", data);

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-adjustment-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);