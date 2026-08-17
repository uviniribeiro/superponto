import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


import { getCorsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify the requesting user is a super admin
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { data: roleData } = await supabaseUser
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!roleData) {
      throw new Error("Apenas super administradores podem gerenciar outros super admins");
    }

    // Get request body
    const { action, email, password, fullName, userId } = await req.json();

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    if (action === "create") {
      // Validate inputs
      if (!email || !password || !fullName) {
        throw new Error("Email, senha e nome são obrigatórios");
      }

      if (password.length < 6) {
        throw new Error("Senha deve ter pelo menos 6 caracteres");
      }

      // Check if email already exists
      const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
      const userExists = existingUser?.users?.find(u => u.email === email);
      
      if (userExists) {
        throw new Error("Este email já está cadastrado no sistema");
      }

      // Create the user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (createError) {
        throw createError;
      }

      if (!newUser.user) {
        throw new Error("Erro ao criar usuário");
      }

      // Create profile (without company_id for super admins)
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .insert({
          user_id: newUser.user.id,
          email,
          full_name: fullName,
          is_active: true,
        });

      if (profileError) {
        console.error("Profile error:", profileError);
        // Rollback user creation
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
        throw new Error("Erro ao criar perfil do usuário");
      }

      // Assign super_admin role
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({
          user_id: newUser.user.id,
          role: "super_admin",
        });

      if (roleError) {
        console.error("Role error:", roleError);
        throw new Error("Erro ao atribuir permissão de super admin");
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Super admin criado com sucesso",
          user: { id: newUser.user.id, email }
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200 
        }
      );

    } else if (action === "remove") {
      // Remove super admin role (but keep user)
      if (!userId) {
        throw new Error("ID do usuário é obrigatório");
      }

      // Cannot remove yourself
      if (userId === user.id) {
        throw new Error("Você não pode remover sua própria permissão de super admin");
      }

      const { error: removeError } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "super_admin");

      if (removeError) {
        throw removeError;
      }

      return new Response(
        JSON.stringify({ success: true, message: "Permissão de super admin removida" }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200 
        }
      );

    } else if (action === "list") {
      // List all super admins
      const { data: superAdmins, error: listError } = await supabaseAdmin
        .from("user_roles")
        .select(`
          user_id,
          profiles!inner(id, full_name, email, is_active, created_at)
        `)
        .eq("role", "super_admin");

      if (listError) {
        throw listError;
      }

      const formattedAdmins = superAdmins?.map((sa: any) => ({
        user_id: sa.user_id,
        profile_id: sa.profiles.id,
        full_name: sa.profiles.full_name,
        email: sa.profiles.email,
        is_active: sa.profiles.is_active,
        created_at: sa.profiles.created_at,
      })) || [];

      return new Response(
        JSON.stringify({ success: true, data: formattedAdmins }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200 
        }
      );

    } else {
      throw new Error("Ação inválida. Use 'create', 'remove' ou 'list'");
    }

  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      }
    );
  }
});
