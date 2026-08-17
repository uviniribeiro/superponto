import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

import { getCorsHeaders } from "../_shared/cors.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));


interface RoleChangeNotificationRequest {
  userEmail: string;
  userName: string;
  previousRole: string;
  newRole: string;
  changedByName: string;
}

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  manager: 'Gerente',
  employee: 'Funcionário'
};

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);

  console.log("Role change notification function called");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userEmail, userName, previousRole, newRole, changedByName }: RoleChangeNotificationRequest = await req.json();

    console.log(`Sending role change notification to ${userEmail}`);
    console.log(`Role changed from ${previousRole} to ${newRole} by ${changedByName}`);

    const emailResponse = await resend.emails.send({
      from: "Ponto Max <onboarding@resend.dev>",
      to: [userEmail],
      subject: "Alteração de Função no Sistema Ponto Max",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Ponto Max</h1>
              <p style="color: #e0e7ff; margin: 10px 0 0 0; font-size: 14px;">Controle de Ponto Eletrônico</p>
            </div>
            
            <div style="padding: 30px;">
              <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 20px;">Olá, ${userName}!</h2>
              
              <p style="color: #4b5563; line-height: 1.6; margin: 0 0 20px 0;">
                Informamos que sua função no sistema Ponto Max foi alterada.
              </p>
              
              <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">Função anterior:</td>
                    <td style="padding: 10px 0; color: #1f2937; font-weight: 600; text-align: right;">
                      <span style="background-color: #e5e7eb; padding: 4px 12px; border-radius: 4px;">${roleLabels[previousRole] || previousRole}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">Nova função:</td>
                    <td style="padding: 10px 0; color: #1f2937; font-weight: 600; text-align: right;">
                      <span style="background-color: #3b82f6; color: #ffffff; padding: 4px 12px; border-radius: 4px;">${roleLabels[newRole] || newRole}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; color: #6b7280; font-size: 14px;">Alterado por:</td>
                    <td style="padding: 10px 0; color: #1f2937; font-weight: 600; text-align: right;">${changedByName}</td>
                  </tr>
                </table>
              </div>
              
              <p style="color: #4b5563; line-height: 1.6; margin: 20px 0 0 0;">
                As novas permissões já estão ativas. Faça login novamente para que as alterações tenham efeito.
              </p>
              
              <p style="color: #4b5563; line-height: 1.6; margin: 20px 0 0 0;">
                Em caso de dúvidas, entre em contato com o administrador do sistema.
              </p>
            </div>
            
            <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                Este é um email automático do sistema Ponto Max. Por favor, não responda.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, ...emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending role change notification:", error);
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
