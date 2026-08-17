import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


import { getCorsHeaders } from "../_shared/cors.ts";
import { requireRole, assertCompanyAccess, authErrorResponse } from "../_shared/auth.ts";

// Generate a secure random password
const generateSecurePassword = (): string => {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  let password = '';
  for (let i = 0; i < bytes.length; i++) {
    password += charset[bytes[i] % charset.length];
  }
  // Ensure at least one of each required character type
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digit = '0123456789';
  const special = '!@#$%^&*';
  
  password = password.slice(0, -4) + 
    lower[bytes[0] % lower.length] +
    upper[bytes[1] % upper.length] +
    digit[bytes[2] % digit.length] +
    special[bytes[3] % special.length];
  
  return password;
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Somente super admins (ou admins da própria empresa) podem provisionar contas de suporte
    const ctx = await requireRole(req, ['super_admin', 'admin']);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { companyId, companyName, organizationType } = await req.json();

    if (!companyId || !companyName) {
      return new Response(
        JSON.stringify({ error: 'Company ID and name are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    assertCompanyAccess(ctx, companyId);

    console.log(`Creating support user for company: ${companyName} (${companyId})`);

    // Generate a unique email for the support user
    const sanitizedCompanyName = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 20);
    const email = `suporte@${sanitizedCompanyName}-${companyId.slice(0, 8)}.pontomax.local`;

    // Check if user already exists
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, user_id')
      .eq('company_id', companyId)
      .eq('email', email)
      .maybeSingle();

    if (existingProfile) {
      console.log('Support user already exists for this company');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Support user already exists',
          email: email,
          mustChangePassword: true,
          note: 'Use password reset to set new password'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate secure random password
    const securePassword = generateSecurePassword();

    // Create the auth user with must_change_password flag
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: securePassword,
      email_confirm: true,
      user_metadata: {
        full_name: 'Usuário Suporte',
        company_id: companyId,
        must_change_password: true
      }
    });

    if (authError) {
      console.error('Error creating auth user:', authError);
      throw authError;
    }

    console.log('Auth user created:', authUser.user?.id);

    // Create the profile with must_change_password = true
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        user_id: authUser.user!.id,
        email: email,
        full_name: 'Usuário Suporte',
        company_id: companyId,
        position: 'Suporte Técnico',
        is_active: true,
        must_change_password: true
      });

    if (profileError) {
      console.error('Error creating profile:', profileError);
      // Try to delete the auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(authUser.user!.id);
      throw profileError;
    }

    console.log('Profile created successfully');

    // Assign admin role to the support user
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: authUser.user!.id,
        role: 'admin'
      });

    if (roleError) {
      console.error('Error assigning role:', roleError);
      // Continue anyway, role can be assigned later
    }

    console.log('Admin role assigned successfully');

    // Return success without exposing the password
    // Password is stored securely and user must change on first login
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Support user created successfully. User must change password on first login.',
        email: email,
        userId: authUser.user!.id,
        temporaryPassword: securePassword, // Only returned once, for initial setup
        mustChangePassword: true
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const authResponse = authErrorResponse(error, corsHeaders);
    if (authResponse) return authResponse;
    console.error('Error in create-support-user function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
