import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


interface CreateUsersRequest {
  action: 'create-for-company' | 'create-for-all' | 'list-company-users' | 'reset-passwords';
  companyId?: string;
}

// Fixed passwords as requested
const FIXED_PASSWORDS = {
  suporte: 'Super@26',
  admin: 'Admin@26'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    const body: CreateUsersRequest = await req.json();
    const { action, companyId } = body;

    console.log('Received request:', { action, companyId });

    // Helper function to generate internal email
    const generateInternalEmail = (username: string, companyId: string) => {
      const sanitizedUsername = username.toLowerCase().replace(/[^a-z0-9]/g, '');
      return `${sanitizedUsername}@${companyId.slice(0, 8)}.pontomax.local`;
    };

    // Helper function to create a user for a company
    const createUserForCompany = async (
      company: { id: string; name: string; company_code: string },
      userType: 'suporte' | 'admin'
    ): Promise<{ success: boolean; exists?: boolean; userId?: string; error?: string; password?: string }> => {
      const username = userType;
      const email = generateInternalEmail(username, company.id);
      const fullName = userType === 'suporte' ? 'Usuário Suporte' : 'Administrador';
      const fixedPassword = FIXED_PASSWORDS[userType];

      console.log(`Creating ${userType} user for company ${company.name} with email ${email}`);

      // Check if user already exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, email, user_id')
        .eq('company_id', company.id)
        .ilike('email', `${username}@%`)
        .maybeSingle();

      if (existingProfile) {
        console.log(`User ${userType} already exists for company ${company.name}`);
        return { success: true, exists: true, userId: existingProfile.user_id };
      }

      // Create auth user with fixed password
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password: fixedPassword,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          company_id: company.id,
          must_change_password: true
        }
      });

      if (authError) {
        console.error(`Error creating auth user ${userType}:`, authError);
        return { success: false, error: authError.message };
      }

      const userId = authData.user.id;

      // Create profile with must_change_password = true
      // IMPORTANT: These are ACCESS USERS ONLY, not employees
      // They should NOT have employee-related fields like registration_number, hire_date, etc.
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: userId,
          email,
          full_name: fullName,
          company_id: company.id,
          is_active: true,
          must_change_password: true,
          // Mark as system user - NOT an employee
          is_system_user: true
        });

      if (profileError) {
        console.error(`Error creating profile for ${userType}:`, profileError);
        // Try to delete the auth user
        await supabase.auth.admin.deleteUser(userId);
        return { success: false, error: profileError.message };
      }

      // Assign role
      const role = userType === 'admin' ? 'admin' : 'employee';
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role
        });

      if (roleError) {
        console.error(`Error assigning role for ${userType}:`, roleError);
      }

      // For support, also add admin role so they can help
      if (userType === 'suporte') {
        const { error: adminRoleError } = await supabase
          .from('user_roles')
          .insert({
            user_id: userId,
            role: 'admin'
          });

        if (adminRoleError && !adminRoleError.message.includes('duplicate')) {
          console.error('Error assigning admin role to support:', adminRoleError);
        }
      }

      console.log(`Successfully created ${userType} user for company ${company.name}`);
      return { success: true, exists: false, userId, password: fixedPassword };
    };

    if (action === 'reset-passwords' && companyId) {
      // Reset passwords for existing users
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, email')
        .eq('company_id', companyId)
        .or('email.ilike.suporte@%,email.ilike.admin@%');

      if (profilesError) {
        throw profilesError;
      }

      const results = [];
      for (const profile of profiles || []) {
        const userType = profile.email.startsWith('suporte') ? 'suporte' : 'admin';
        const fixedPassword = FIXED_PASSWORDS[userType as keyof typeof FIXED_PASSWORDS];
        
        const { error: updateError } = await supabase.auth.admin.updateUserById(
          profile.user_id,
          { password: fixedPassword }
        );

        if (updateError) {
          results.push({ email: profile.email, success: false, error: updateError.message });
        } else {
          results.push({ email: profile.email, success: true, newPassword: fixedPassword });
        }
      }

      return new Response(
        JSON.stringify({ success: true, results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'list-company-users' && companyId) {
      // List all users for a specific company
      const { data: users, error } = await supabase
        .from('profiles')
        .select(`
          id,
          user_id,
          full_name,
          email,
          is_active,
          position,
          department,
          must_change_password,
          created_at
        `)
        .eq('company_id', companyId)
        .order('full_name');

      if (error) {
        throw error;
      }

      // Get roles for each user
      const usersWithRoles = await Promise.all(users.map(async (user) => {
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.user_id);

        return {
          ...user,
          roles: roles?.map(r => r.role) || []
        };
      }));

      return new Response(
        JSON.stringify({ success: true, data: usersWithRoles }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'create-for-company' && companyId) {
      // Create support and admin for a specific company
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('id, name, company_code')
        .eq('id', companyId)
        .single();

      if (companyError || !company) {
        return new Response(
          JSON.stringify({ success: false, error: 'Empresa não encontrada' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const supportResult = await createUserForCompany(company, 'suporte');
      const adminResult = await createUserForCompany(company, 'admin');

      // Build credentials object only for new users
      const credentials: {
        support?: { username: string; password: string };
        admin?: { username: string; password: string };
      } = {};

      if (!supportResult.exists && supportResult.password) {
        credentials.support = {
          username: 'suporte',
          password: supportResult.password
        };
      }

      if (!adminResult.exists && adminResult.password) {
        credentials.admin = {
          username: 'admin',
          password: adminResult.password
        };
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          support: { success: supportResult.success, exists: supportResult.exists, userId: supportResult.userId },
          admin: { success: adminResult.success, exists: adminResult.exists, userId: adminResult.userId },
          credentials,
          note: 'Senhas padrão: Suporte=Super@26, Admin=Admin@26'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'create-for-all') {
      // Create support and admin for ALL companies that don't have them
      const { data: companies, error: companiesError } = await supabase
        .from('companies')
        .select('id, name, company_code')
        .eq('is_active', true);

      if (companiesError) {
        throw companiesError;
      }

      const results = [];

      for (const company of companies || []) {
        const supportResult = await createUserForCompany(company, 'suporte');
        const adminResult = await createUserForCompany(company, 'admin');

        const companyResult: {
          company: string;
          companyId: string;
          support: { success: boolean; exists?: boolean };
          admin: { success: boolean; exists?: boolean };
          newCredentials?: {
            support?: { username: string; password: string };
            admin?: { username: string; password: string };
          };
        } = {
          company: company.name,
          companyId: company.id,
          support: { success: supportResult.success, exists: supportResult.exists },
          admin: { success: adminResult.success, exists: adminResult.exists }
        };

        if (!supportResult.exists || !adminResult.exists) {
          companyResult.newCredentials = {};
          if (!supportResult.exists && supportResult.password) {
            companyResult.newCredentials.support = {
              username: 'suporte',
              password: supportResult.password
            };
          }
          if (!adminResult.exists && adminResult.password) {
            companyResult.newCredentials.admin = {
              username: 'admin',
              password: adminResult.password
            };
          }
        }

        results.push(companyResult);
      }

      console.log(`Created users for ${results.length} companies`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          results,
          note: 'Senhas padrão: Suporte=Super@26, Admin=Admin@26'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in create-company-users:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
