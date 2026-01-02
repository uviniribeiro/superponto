import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateUsersRequest {
  action: 'create-for-company' | 'create-for-all' | 'list-company-users';
  companyId?: string;
}

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
    ): Promise<{ success: boolean; exists?: boolean; userId?: string; error?: string; temporaryPassword?: string }> => {
      const username = userType;
      const email = generateInternalEmail(username, company.id);
      const fullName = userType === 'suporte' ? 'Usuário Suporte' : 'Administrador';

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

      // Generate secure random password for this user
      const securePassword = generateSecurePassword();

      // Create auth user with must_change_password flag
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password: securePassword,
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
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: userId,
          email,
          full_name: fullName,
          company_id: company.id,
          is_active: true,
          must_change_password: true
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
      return { success: true, exists: false, userId, temporaryPassword: securePassword };
    };

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
        support?: { username: string; temporaryPassword: string; mustChangePassword: boolean };
        admin?: { username: string; temporaryPassword: string; mustChangePassword: boolean };
      } = {};

      if (!supportResult.exists && supportResult.temporaryPassword) {
        credentials.support = {
          username: 'suporte',
          temporaryPassword: supportResult.temporaryPassword,
          mustChangePassword: true
        };
      }

      if (!adminResult.exists && adminResult.temporaryPassword) {
        credentials.admin = {
          username: 'admin',
          temporaryPassword: adminResult.temporaryPassword,
          mustChangePassword: true
        };
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          support: { success: supportResult.success, exists: supportResult.exists, userId: supportResult.userId },
          admin: { success: adminResult.success, exists: adminResult.exists, userId: adminResult.userId },
          credentials,
          note: 'Temporary passwords are shown only once. Users must change password on first login.'
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

        // Only include temporary passwords for newly created users
        const companyResult: {
          company: string;
          companyId: string;
          support: { success: boolean; exists?: boolean };
          admin: { success: boolean; exists?: boolean };
          newCredentials?: {
            support?: { username: string; temporaryPassword: string };
            admin?: { username: string; temporaryPassword: string };
          };
        } = {
          company: company.name,
          companyId: company.id,
          support: { success: supportResult.success, exists: supportResult.exists },
          admin: { success: adminResult.success, exists: adminResult.exists }
        };

        if (!supportResult.exists || !adminResult.exists) {
          companyResult.newCredentials = {};
          if (!supportResult.exists && supportResult.temporaryPassword) {
            companyResult.newCredentials.support = {
              username: 'suporte',
              temporaryPassword: supportResult.temporaryPassword
            };
          }
          if (!adminResult.exists && adminResult.temporaryPassword) {
            companyResult.newCredentials.admin = {
              username: 'admin',
              temporaryPassword: adminResult.temporaryPassword
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
          note: 'Temporary passwords are shown only once. Users must change password on first login.'
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
