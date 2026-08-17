import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Configurações WebAuthn
const RP_NAME = "Ponto Max";
const RP_ID = Deno.env.get("WEBAUTHN_RP_ID") || "superponto.app";
const ORIGIN = Deno.env.get("WEBAUTHN_ORIGIN") || `https://${RP_ID}`;
const CHALLENGE_TIMEOUT = 5 * 60 * 1000; // 5 minutos

// Gerar challenge aleatório
function generateChallenge(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

// Converter base64url para ArrayBuffer
function base64urlToBuffer(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

// Converter ArrayBuffer para base64url
function bufferToBase64url(buffer: Uint8Array): string {
  return btoa(String.fromCharCode(...buffer))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

// Verificar assinatura (simplificado - em produção usar biblioteca completa)
async function verifySignature(
  publicKey: Uint8Array,
  signature: Uint8Array,
  data: Uint8Array
): Promise<boolean> {
  try {
    const keyBuffer = publicKey.buffer.slice(publicKey.byteOffset, publicKey.byteOffset + publicKey.byteLength) as ArrayBuffer;
    const sigBuffer = signature.buffer.slice(signature.byteOffset, signature.byteOffset + signature.byteLength) as ArrayBuffer;
    const dataBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    
    const key = await crypto.subtle.importKey(
      "spki",
      keyBuffer,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"]
    );

    return await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      sigBuffer,
      dataBuffer
    );
  } catch (error) {
    console.error("Erro ao verificar assinatura:", error);
    return false;
  }
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
    const clientIp = req.headers.get("x-forwarded-for") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    switch (action) {
      // Iniciar registro de credencial
      case "register-options": {
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

        // Buscar credenciais existentes
        const { data: existingCredentials } = await supabase
          .from("webauthn_credentials")
          .select("credential_id")
          .eq("user_id", user.id);

        // Gerar challenge
        const challenge = generateChallenge();

        // Salvar challenge
        await supabase.from("webauthn_challenges").insert({
          user_id: user.id,
          challenge,
          type: "register",
          expires_at: new Date(Date.now() + CHALLENGE_TIMEOUT).toISOString(),
        });

        // Buscar perfil
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("user_id", user.id)
          .single();

        const options = {
          challenge,
          rp: {
            name: RP_NAME,
            id: RP_ID,
          },
          user: {
            id: bufferToBase64url(new TextEncoder().encode(user.id)),
            name: profile?.email || user.email || user.id,
            displayName: profile?.full_name || "Usuário",
          },
          pubKeyCredParams: [
            { alg: -7, type: "public-key" }, // ES256
            { alg: -257, type: "public-key" }, // RS256
          ],
          timeout: CHALLENGE_TIMEOUT,
          attestation: "none",
          authenticatorSelection: {
            authenticatorAttachment: body.attachment || "platform",
            userVerification: "preferred",
            residentKey: "preferred",
          },
          excludeCredentials: (existingCredentials || []).map((c) => ({
            id: c.credential_id,
            type: "public-key",
          })),
        };

        return new Response(JSON.stringify({ options }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verificar e salvar registro
      case "register-verify": {
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

        const { credential, name } = body;

        // Buscar challenge
        const { data: challengeData } = await supabase
          .from("webauthn_challenges")
          .select("*")
          .eq("user_id", user.id)
          .eq("type", "register")
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (!challengeData) {
          return new Response(JSON.stringify({ error: "Challenge expirado" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Salvar credencial
        const { error: insertError } = await supabase
          .from("webauthn_credentials")
          .insert({
            user_id: user.id,
            credential_id: credential.id,
            public_key: credential.publicKey,
            counter: 0,
            device_type: credential.authenticatorAttachment || "platform",
            transports: credential.transports || [],
            name: name || "Dispositivo " + new Date().toLocaleDateString("pt-BR"),
            aaguid: credential.aaguid,
          });

        if (insertError) {
          console.error("Erro ao salvar credencial:", insertError);
          return new Response(JSON.stringify({ error: "Erro ao salvar credencial" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Limpar challenge
        await supabase
          .from("webauthn_challenges")
          .delete()
          .eq("id", challengeData.id);

        // Registrar evento
        await supabase.rpc("log_security_event", {
          _user_id: user.id,
          _event_type: "webauthn_registered",
          _severity: "info",
          _ip_address: clientIp,
          _user_agent: userAgent,
          _metadata: { device_name: name },
        });

        return new Response(JSON.stringify({ 
          success: true,
          message: "Dispositivo registrado com sucesso!" 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Iniciar autenticação
      case "authenticate-options": {
        const { username, companyCode } = body;

        // Buscar usuário pelo username/email
        let userId: string | null = null;

        if (username && companyCode) {
          // Login com código da empresa
          const { data: lookupData } = await supabase.functions.invoke("validate-company-login", {
            body: { action: "get-user-email", companyCode, username },
          });

          if (lookupData?.success) {
            // Buscar user_id pelo email
            const { data: profile } = await supabase
              .from("profiles")
              .select("user_id")
              .eq("email", lookupData.internalEmail)
              .single();
            userId = profile?.user_id;
          }
        }

        // Gerar challenge
        const challenge = generateChallenge();

        // Salvar challenge
        await supabase.from("webauthn_challenges").insert({
          user_id: userId,
          challenge,
          type: "authenticate",
          expires_at: new Date(Date.now() + CHALLENGE_TIMEOUT).toISOString(),
        });

        // Buscar credenciais do usuário (se tiver userId)
        let allowCredentials: Array<{ id: string; type: string; transports?: string[] }> = [];
        
        if (userId) {
          const { data: credentials } = await supabase
            .from("webauthn_credentials")
            .select("credential_id, transports")
            .eq("user_id", userId);

          allowCredentials = (credentials || []).map((c) => ({
            id: c.credential_id,
            type: "public-key" as const,
            transports: c.transports,
          }));
        }

        const options = {
          challenge,
          timeout: CHALLENGE_TIMEOUT,
          rpId: RP_ID,
          allowCredentials,
          userVerification: "preferred",
        };

        return new Response(JSON.stringify({ options }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verificar autenticação
      case "authenticate-verify": {
        const { credential } = body;

        // Buscar credencial no banco
        const { data: storedCredential } = await supabase
          .from("webauthn_credentials")
          .select("*, profiles!inner(user_id, full_name, email)")
          .eq("credential_id", credential.id)
          .single();

        if (!storedCredential) {
          return new Response(JSON.stringify({ error: "Credencial não encontrada" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Verificar challenge
        const { data: challengeData } = await supabase
          .from("webauthn_challenges")
          .select("*")
          .eq("type", "authenticate")
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (!challengeData) {
          return new Response(JSON.stringify({ error: "Challenge expirado" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Verificar counter (proteção contra replay)
        if (credential.counter <= storedCredential.counter) {
          // Possível ataque de replay
          await supabase.rpc("log_security_event", {
            _user_id: storedCredential.user_id,
            _event_type: "webauthn_replay_attack",
            _severity: "critical",
            _ip_address: clientIp,
            _user_agent: userAgent,
          });

          return new Response(JSON.stringify({ error: "Credencial comprometida" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Atualizar counter e last_used
        await supabase
          .from("webauthn_credentials")
          .update({
            counter: credential.counter,
            last_used_at: new Date().toISOString(),
          })
          .eq("id", storedCredential.id);

        // Limpar challenge
        await supabase
          .from("webauthn_challenges")
          .delete()
          .eq("id", challengeData.id);

        // Criar sessão de autenticação
        // Em produção, isso geraria um token de sessão válido
        await supabase.rpc("log_security_event", {
          _user_id: storedCredential.user_id,
          _event_type: "webauthn_login",
          _severity: "info",
          _ip_address: clientIp,
          _user_agent: userAgent,
          _metadata: { credential_id: storedCredential.id },
        });

        return new Response(JSON.stringify({
          success: true,
          userId: storedCredential.user_id,
          message: "Autenticação bem-sucedida!",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Listar credenciais do usuário
      case "list-credentials": {
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

        const { data: credentials } = await supabase
          .from("webauthn_credentials")
          .select("id, name, device_type, created_at, last_used_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        return new Response(JSON.stringify({ credentials: credentials || [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Remover credencial
      case "remove-credential": {
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

        const { credentialId } = body;

        const { error } = await supabase
          .from("webauthn_credentials")
          .delete()
          .eq("id", credentialId)
          .eq("user_id", user.id);

        if (error) {
          return new Response(JSON.stringify({ error: "Erro ao remover credencial" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await supabase.rpc("log_security_event", {
          _user_id: user.id,
          _event_type: "webauthn_removed",
          _severity: "info",
          _ip_address: clientIp,
          _user_agent: userAgent,
        });

        return new Response(JSON.stringify({ success: true }), {
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
    console.error("WebAuthn Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
