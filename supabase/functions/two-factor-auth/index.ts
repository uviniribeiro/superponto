import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Constantes TOTP
const TOTP_DIGITS = 6;
const TOTP_PERIOD = 30;
const BACKUP_CODES_COUNT = 10;

// Função para gerar secret TOTP em base32
function generateBase32Secret(length = 32): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % 32]).join("");
}

// Função para converter base32 para bytes
function base32ToBytes(base32: string): Uint8Array {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of base32.toUpperCase()) {
    const val = chars.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.slice(i * 8, (i + 1) * 8), 2);
  }
  return bytes;
}

// HMAC-SHA1
async function hmacSha1(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  const keyBuffer = key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer;
  const msgBuffer = message.buffer.slice(message.byteOffset, message.byteOffset + message.byteLength) as ArrayBuffer;
  
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, msgBuffer);
  return new Uint8Array(signature);
}

// Gerar TOTP
async function generateTOTP(secret: string, time?: number): Promise<string> {
  const counter = Math.floor((time || Date.now() / 1000) / TOTP_PERIOD);
  const counterBytes = new Uint8Array(8);
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = counter & 0xff;
    // @ts-ignore - counter é number
    counter >>= 8;
  }
  
  const key = base32ToBytes(secret);
  const hmac = await hmacSha1(key, counterBytes);
  
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  
  const otp = binary % Math.pow(10, TOTP_DIGITS);
  return otp.toString().padStart(TOTP_DIGITS, "0");
}

// Verificar TOTP (com janela de tolerância)
async function verifyTOTP(secret: string, token: string, window = 1): Promise<boolean> {
  const currentTime = Math.floor(Date.now() / 1000);
  
  for (let i = -window; i <= window; i++) {
    const time = currentTime + i * TOTP_PERIOD;
    const expectedToken = await generateTOTP(secret, time);
    if (token === expectedToken) {
      return true;
    }
  }
  return false;
}

// Gerar backup codes
function generateBackupCodes(count = BACKUP_CODES_COUNT): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const array = new Uint8Array(4);
    crypto.getRandomValues(array);
    const code = Array.from(array, (b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }
  return codes;
}

// Hash de backup code para armazenamento seguro
async function hashBackupCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code.replace("-", "").toUpperCase());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verificar autenticação
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, ...body } = await req.json();
    const clientIp = req.headers.get("x-forwarded-for") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    // Buscar perfil do usuário
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, email, two_factor_enabled, two_factor_secret, backup_codes")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "Perfil não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    switch (action) {
      // Iniciar setup do 2FA
      case "setup": {
        // Verificar rate limit
        const { data: canProceed } = await supabase.rpc("check_2fa_rate_limit", {
          _user_id: user.id,
          _attempt_type: "setup",
        });

        if (!canProceed) {
          return new Response(JSON.stringify({ 
            error: "Muitas tentativas. Aguarde 15 minutos." 
          }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (profile.two_factor_enabled) {
          return new Response(JSON.stringify({ 
            error: "2FA já está habilitado" 
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Gerar novo secret
        const secret = generateBase32Secret();
        const backupCodes = generateBackupCodes();
        
        // Hash dos backup codes para armazenamento
        const hashedBackupCodes = await Promise.all(
          backupCodes.map((code) => hashBackupCode(code))
        );

        // Salvar secret temporariamente (não habilitado ainda)
        await supabase
          .from("profiles")
          .update({
            two_factor_secret: secret,
            backup_codes: hashedBackupCodes,
          })
          .eq("user_id", user.id);

        // Gerar URL para QR Code
        const issuer = encodeURIComponent("SuperPonto");
        const account = encodeURIComponent(profile.email || user.email || user.id);
        const otpauthUrl = `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD}`;

        // Registrar tentativa
        await supabase.rpc("log_2fa_attempt", {
          _user_id: user.id,
          _attempt_type: "setup",
          _success: true,
          _ip_address: clientIp,
          _user_agent: userAgent,
        });

        return new Response(JSON.stringify({
          success: true,
          secret,
          otpauthUrl,
          backupCodes, // Mostrar apenas uma vez!
          qrCodeData: otpauthUrl,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verificar e ativar 2FA
      case "verify-setup": {
        const { token: totpToken } = body;

        if (!totpToken || totpToken.length !== 6) {
          return new Response(JSON.stringify({ 
            error: "Código inválido" 
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (!profile.two_factor_secret) {
          return new Response(JSON.stringify({ 
            error: "Configure o 2FA primeiro" 
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const isValid = await verifyTOTP(profile.two_factor_secret, totpToken);

        if (!isValid) {
          await supabase.rpc("log_2fa_attempt", {
            _user_id: user.id,
            _attempt_type: "verify",
            _success: false,
            _ip_address: clientIp,
            _user_agent: userAgent,
          });

          return new Response(JSON.stringify({ 
            error: "Código incorreto" 
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Ativar 2FA
        await supabase
          .from("profiles")
          .update({
            two_factor_enabled: true,
            two_factor_verified_at: new Date().toISOString(),
          })
          .eq("user_id", user.id);

        await supabase.rpc("log_2fa_attempt", {
          _user_id: user.id,
          _attempt_type: "verify",
          _success: true,
          _ip_address: clientIp,
          _user_agent: userAgent,
        });

        return new Response(JSON.stringify({
          success: true,
          message: "2FA ativado com sucesso!",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verificar código durante login
      case "verify": {
        const { token: totpToken } = body;

        if (!profile.two_factor_enabled || !profile.two_factor_secret) {
          return new Response(JSON.stringify({ 
            error: "2FA não está habilitado" 
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Verificar rate limit
        const { data: canProceed } = await supabase.rpc("check_2fa_rate_limit", {
          _user_id: user.id,
          _attempt_type: "verify",
        });

        if (!canProceed) {
          return new Response(JSON.stringify({ 
            error: "Muitas tentativas. Aguarde 15 minutos." 
          }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const isValid = await verifyTOTP(profile.two_factor_secret, totpToken);

        await supabase.rpc("log_2fa_attempt", {
          _user_id: user.id,
          _attempt_type: "verify",
          _success: isValid,
          _ip_address: clientIp,
          _user_agent: userAgent,
        });

        if (!isValid) {
          return new Response(JSON.stringify({ 
            error: "Código incorreto" 
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({
          success: true,
          verified: true,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verificar backup code
      case "verify-backup": {
        const { code } = body;

        if (!code) {
          return new Response(JSON.stringify({ 
            error: "Código de backup obrigatório" 
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Verificar rate limit
        const { data: canProceed } = await supabase.rpc("check_2fa_rate_limit", {
          _user_id: user.id,
          _attempt_type: "backup",
        });

        if (!canProceed) {
          return new Response(JSON.stringify({ 
            error: "Muitas tentativas. Aguarde 15 minutos." 
          }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const hashedCode = await hashBackupCode(code);
        const backupCodes = profile.backup_codes || [];
        const codeIndex = backupCodes.indexOf(hashedCode);

        if (codeIndex === -1) {
          await supabase.rpc("log_2fa_attempt", {
            _user_id: user.id,
            _attempt_type: "backup",
            _success: false,
            _ip_address: clientIp,
            _user_agent: userAgent,
          });

          return new Response(JSON.stringify({ 
            error: "Código de backup inválido" 
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Remover código usado
        backupCodes.splice(codeIndex, 1);
        await supabase
          .from("profiles")
          .update({ backup_codes: backupCodes })
          .eq("user_id", user.id);

        await supabase.rpc("log_2fa_attempt", {
          _user_id: user.id,
          _attempt_type: "backup",
          _success: true,
          _ip_address: clientIp,
          _user_agent: userAgent,
        });

        return new Response(JSON.stringify({
          success: true,
          verified: true,
          remainingCodes: backupCodes.length,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Desabilitar 2FA
      case "disable": {
        const { password, token: totpToken } = body;

        if (!profile.two_factor_enabled) {
          return new Response(JSON.stringify({ 
            error: "2FA não está habilitado" 
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Verificar token TOTP
        if (totpToken && profile.two_factor_secret) {
          const isValid = await verifyTOTP(profile.two_factor_secret, totpToken);
          if (!isValid) {
            return new Response(JSON.stringify({ 
              error: "Código 2FA incorreto" 
            }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        } else {
          return new Response(JSON.stringify({ 
            error: "Código 2FA obrigatório" 
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Desabilitar 2FA
        await supabase
          .from("profiles")
          .update({
            two_factor_enabled: false,
            two_factor_secret: null,
            backup_codes: null,
            two_factor_verified_at: null,
          })
          .eq("user_id", user.id);

        return new Response(JSON.stringify({
          success: true,
          message: "2FA desabilitado com sucesso",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Gerar novos backup codes
      case "regenerate-backup-codes": {
        const { token: totpToken } = body;

        if (!profile.two_factor_enabled || !profile.two_factor_secret) {
          return new Response(JSON.stringify({ 
            error: "2FA não está habilitado" 
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Verificar token TOTP
        const isValid = await verifyTOTP(profile.two_factor_secret, totpToken);
        if (!isValid) {
          return new Response(JSON.stringify({ 
            error: "Código 2FA incorreto" 
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Gerar novos códigos
        const newBackupCodes = generateBackupCodes();
        const hashedBackupCodes = await Promise.all(
          newBackupCodes.map((code) => hashBackupCode(code))
        );

        await supabase
          .from("profiles")
          .update({ backup_codes: hashedBackupCodes })
          .eq("user_id", user.id);

        return new Response(JSON.stringify({
          success: true,
          backupCodes: newBackupCodes,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Status do 2FA
      case "status": {
        return new Response(JSON.stringify({
          enabled: profile.two_factor_enabled || false,
          backupCodesRemaining: (profile.backup_codes || []).length,
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
    console.error("2FA Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ 
      error: "Erro interno do servidor",
      details: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
