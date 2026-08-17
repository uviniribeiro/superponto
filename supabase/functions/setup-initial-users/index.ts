import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    console.log('Starting initial user setup...');

    // Check if super admin role already exists
    const { data: existingRoles } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('role', 'super_admin')
      .limit(1);

    if (existingRoles && existingRoles.length > 0) {
      console.log('Super admin already exists, skipping setup');
      return new Response(
        JSON.stringify({ success: false, message: 'Super admin já existe no sistema' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: any = { superAdmin: null };

    // Try to get existing user first
    console.log('Looking for existing user...');
    const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
    let superAdminUser = usersData?.users?.find(u => u.email === 'viniciusacacio1@gmail.com');

    if (superAdminUser) {
      console.log('User already exists, updating password...');
      // Update the password
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        superAdminUser.id,
        { password: 'Vini19!@#', email_confirm: true }
      );
      if (updateError) {
        console.error('Error updating user:', updateError);
      }
    } else {
      // Create new user
      console.log('Creating new super admin user...');
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: 'viniciusacacio1@gmail.com',
        password: 'Vini19!@#',
        email_confirm: true,
        user_metadata: { full_name: 'Super Administrador' }
      });

      if (createError) {
        throw new Error(`Erro ao criar super admin: ${createError.message}`);
      }
      superAdminUser = newUser.user;
    }

    console.log('Super admin user ID:', superAdminUser.id);

    // Create or update super admin profile
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('user_id', superAdminUser.id)
      .maybeSingle();

    if (!existingProfile) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert({
          user_id: superAdminUser.id,
          email: 'viniciusacacio1@gmail.com',
          full_name: 'Super Administrador',
          is_active: true
        });

      if (profileError) {
        console.error('Error creating super admin profile:', profileError);
      } else {
        console.log('Profile created');
      }
    } else {
      console.log('Profile already exists');
    }

    // Assign super_admin role (if not exists)
    const { data: existingRole } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('user_id', superAdminUser.id)
      .eq('role', 'super_admin')
      .maybeSingle();

    if (!existingRole) {
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: superAdminUser.id,
          role: 'super_admin'
        });

      if (roleError) {
        console.error('Error assigning super admin role:', roleError);
        throw new Error(`Erro ao atribuir role de super admin: ${roleError.message}`);
      }
      console.log('Super admin role assigned');
    } else {
      console.log('Super admin role already exists');
    }

    results.superAdmin = { 
      email: 'viniciusacacio1@gmail.com', 
      password: 'Vini19!@#',
      created: true 
    };

    console.log('Super admin setup complete!');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Super admin configurado com sucesso!',
        users: results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Setup error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
