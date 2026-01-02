import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
      .select('id')
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
          password: 'V1n1@'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create the auth user
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: 'V1n1@',
      email_confirm: true,
      user_metadata: {
        full_name: 'Usuário Suporte',
        company_id: companyId
      }
    });

    if (authError) {
      console.error('Error creating auth user:', authError);
      throw authError;
    }

    console.log('Auth user created:', authUser.user?.id);

    // Create the profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        user_id: authUser.user!.id,
        email: email,
        full_name: 'Usuário Suporte',
        company_id: companyId,
        position: 'Suporte Técnico',
        is_active: true
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

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Support user created successfully',
        email: email,
        password: 'V1n1@',
        userId: authUser.user!.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in create-support-user function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
