import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";


const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

async function sendEmail(payload: EmailPayload): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY não configurada");
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Ponto Max Segurança <security@superponto.app>",
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
      }),
    });

    if (!response.ok) {
      console.error("Erro ao enviar email:", await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error("Erro ao enviar email:", error);
    return false;
  }
}

function generate2FABackupCodesEmail(name: string, codes: string[]): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { font-size: 28px; font-weight: bold; color: #2563eb; }
        .title { font-size: 24px; color: #1f2937; margin: 20px 0; }
        .codes { background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .code { font-family: monospace; font-size: 16px; padding: 8px; background: white; border-radius: 4px; margin: 4px; display: inline-block; }
        .warning { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 20px 0; }
        .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">🔐 Ponto Max</div>
          <h1 class="title">Códigos de Backup 2FA</h1>
        </div>
        
        <p>Olá ${name},</p>
        
        <p>Você configurou a autenticação de dois fatores (2FA) na sua conta. Abaixo estão seus códigos de backup:</p>
        
        <div class="codes">
          ${codes.map(code => `<span class="code">${code}</span>`).join('')}
        </div>
        
        <div class="warning">
          ⚠️ <strong>Importante:</strong> Guarde estes códigos em um local seguro. Cada código só pode ser usado uma vez. Use-os caso perca acesso ao seu aplicativo autenticador.
        </div>
        
        <p>Se você não configurou o 2FA, entre em contato conosco imediatamente.</p>
        
        <div class="footer">
          <p>Ponto Max - Sistema de Ponto Eletrônico</p>
          <p>Este é um email automático, não responda.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateSuspiciousLoginEmail(name: string, details: {
  ip: string;
  location: string;
  device: string;
  time: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { font-size: 28px; font-weight: bold; color: #dc2626; }
        .title { font-size: 24px; color: #1f2937; margin: 20px 0; }
        .alert { background: #fef2f2; border: 2px solid #dc2626; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .details { background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
        .detail-label { color: #6b7280; }
        .detail-value { font-weight: 500; color: #1f2937; }
        .button { display: inline-block; background: #dc2626; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; }
        .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">⚠️ Alerta de Segurança</div>
          <h1 class="title">Login Suspeito Detectado</h1>
        </div>
        
        <div class="alert">
          <strong>Atenção!</strong> Detectamos uma tentativa de login suspeita na sua conta.
        </div>
        
        <p>Olá ${name},</p>
        
        <p>Uma atividade incomum foi detectada na sua conta Ponto Max:</p>
        
        <div class="details">
          <div class="detail-row">
            <span class="detail-label">📍 Localização:</span>
            <span class="detail-value">${details.location}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">🌐 Endereço IP:</span>
            <span class="detail-value">${details.ip}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">📱 Dispositivo:</span>
            <span class="detail-value">${details.device}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">🕐 Data/Hora:</span>
            <span class="detail-value">${details.time}</span>
          </div>
        </div>
        
        <p><strong>Se foi você:</strong> Ignore este email.</p>
        
        <p><strong>Se NÃO foi você:</strong></p>
        <ul>
          <li>Altere sua senha imediatamente</li>
          <li>Ative a autenticação de dois fatores (2FA)</li>
          <li>Revise os dispositivos conectados</li>
        </ul>
        
        <div class="footer">
          <p>Ponto Max - Sistema de Ponto Eletrônico</p>
          <p>Este é um email automático de segurança.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateNewLoginEmail(name: string, details: {
  ip: string;
  location: string;
  device: string;
  time: string;
}): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { font-size: 28px; font-weight: bold; color: #2563eb; }
        .title { font-size: 24px; color: #1f2937; margin: 20px 0; }
        .info { background: #eff6ff; border: 1px solid #2563eb; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .details { background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 20px 0; }
        .detail-row { padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
        .detail-label { color: #6b7280; font-size: 14px; }
        .detail-value { font-weight: 500; color: #1f2937; }
        .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">🔐 Ponto Max</div>
          <h1 class="title">Novo Login Detectado</h1>
        </div>
        
        <p>Olá ${name},</p>
        
        <div class="info">
          ✓ Um novo login foi realizado na sua conta.
        </div>
        
        <div class="details">
          <div class="detail-row">
            <div class="detail-label">📍 Localização</div>
            <div class="detail-value">${details.location}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">🌐 Endereço IP</div>
            <div class="detail-value">${details.ip}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">📱 Dispositivo</div>
            <div class="detail-value">${details.device}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">🕐 Data/Hora</div>
            <div class="detail-value">${details.time}</div>
          </div>
        </div>
        
        <p>Se não foi você, altere sua senha imediatamente e ative o 2FA.</p>
        
        <div class="footer">
          <p>Ponto Max - Sistema de Ponto Eletrônico</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, ...body } = await req.json();

    switch (action) {
      case "send-backup-codes": {
        const { userId, codes } = body;

        // Buscar dados do usuário
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("user_id", userId)
          .single();

        if (!profile?.email) {
          return new Response(JSON.stringify({ error: "Email não encontrado" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const html = generate2FABackupCodesEmail(profile.full_name || "Usuário", codes);
        const sent = await sendEmail({
          to: profile.email,
          subject: "🔐 Seus Códigos de Backup 2FA - Ponto Max",
          html,
        });

        // Registrar evento
        await supabase.rpc("log_security_event", {
          _user_id: userId,
          _event_type: "2fa_backup_codes_sent",
          _severity: "info",
          _metadata: { email_sent: sent },
        });

        return new Response(JSON.stringify({ success: sent }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "send-suspicious-login": {
        const { userId, details } = body;

        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("user_id", userId)
          .single();

        if (!profile?.email) {
          return new Response(JSON.stringify({ error: "Email não encontrado" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const html = generateSuspiciousLoginEmail(profile.full_name || "Usuário", details);
        const sent = await sendEmail({
          to: profile.email,
          subject: "⚠️ Alerta de Segurança - Login Suspeito Detectado",
          html,
        });

        return new Response(JSON.stringify({ success: sent }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "send-new-login": {
        const { userId, details } = body;

        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("user_id", userId)
          .single();

        if (!profile?.email) {
          return new Response(JSON.stringify({ error: "Email não encontrado" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const html = generateNewLoginEmail(profile.full_name || "Usuário", details);
        const sent = await sendEmail({
          to: profile.email,
          subject: "🔐 Novo Login na sua Conta - Ponto Max",
          html,
        });

        return new Response(JSON.stringify({ success: sent }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "log-security-event": {
        const { userId, eventType, severity, ipAddress, userAgent, location, metadata } = body;

        const { data } = await supabase.rpc("log_security_event", {
          _user_id: userId,
          _event_type: eventType,
          _severity: severity || "info",
          _ip_address: ipAddress,
          _user_agent: userAgent,
          _location: location,
          _metadata: metadata || {},
        });

        // Verificar atividade suspeita
        const { data: suspiciousCheck } = await supabase.rpc("check_suspicious_activity", {
          _user_id: userId,
          _ip_address: ipAddress,
        });

        // Se suspeito, enviar alerta
        if (suspiciousCheck?.is_suspicious) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("user_id", userId)
            .single();

          if (profile?.email) {
            const html = generateSuspiciousLoginEmail(profile.full_name || "Usuário", {
              ip: ipAddress || "Desconhecido",
              location: location || "Desconhecido",
              device: userAgent || "Desconhecido",
              time: new Date().toLocaleString("pt-BR"),
            });

            await sendEmail({
              to: profile.email,
              subject: "⚠️ Alerta de Segurança - Atividade Suspeita Detectada",
              html,
            });
          }
        }

        return new Response(JSON.stringify({ 
          success: true, 
          logId: data,
          suspicious: suspiciousCheck 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Ação inválida" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error: unknown) {
    console.error("Security Alerts Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
