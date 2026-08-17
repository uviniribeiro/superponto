import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


import { getCorsHeaders } from "../_shared/cors.ts";
import { requireRole, authErrorResponse, generateSecurePassword } from "../_shared/auth.ts";

interface SetupRequest {
  action: 'add-default-sectors' | 'recreate-all-users' | 'full-setup';
  cityHallId?: string;
}

// Default sectors for city halls
const DEFAULT_SECTORS = [
  { name: 'Administração', sector: 'administration' },
  { name: 'Educação', sector: 'education' },
  { name: 'Saúde', sector: 'health' }
];

// Senhas são geradas aleatoriamente por conta (nunca fixas no código)

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Setup em nível de plataforma: exclusivo para super administradores
    await requireRole(req, ['super_admin']);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    const body: SetupRequest = await req.json();
    const { action, cityHallId } = body;

    console.log('Setup request:', { action, cityHallId });

    // Helper function to generate internal email
    const generateInternalEmail = (username: string, companyId: string) => {
      const sanitizedUsername = username.toLowerCase().replace(/[^a-z0-9]/g, '');
      return `${sanitizedUsername}@${companyId.slice(0, 8)}.pontomax.local`;
    };

    // Create or reset user for company
    const createOrResetUser = async (
      company: { id: string; name: string; company_code: string },
      userType: 'suporte' | 'admin'
    ): Promise<{ success: boolean; action: 'created' | 'reset' | 'error'; error?: string }> => {
      const email = generateInternalEmail(userType, company.id);
      const fullName = userType === 'suporte' ? 'Usuário Suporte' : 'Administrador';
      const fixedPassword = generateSecurePassword();

      console.log(`Processing ${userType} user for company ${company.name}`);

      // Check if user already exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, user_id')
        .eq('company_id', company.id)
        .ilike('email', `${userType}@%`)
        .maybeSingle();

      if (existingProfile) {
        // Reset password for existing user
        const { error: updateError } = await supabase.auth.admin.updateUserById(
          existingProfile.user_id,
          { password: fixedPassword }
        );

        if (updateError) {
          console.error(`Error resetting password for ${userType}:`, updateError);
          return { success: false, action: 'error', error: updateError.message };
        }

        // Ensure correct roles
        const role = userType === 'admin' ? 'admin' : 'employee';
        
        // Delete existing roles for this user
        await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', existingProfile.user_id);

        // Add correct roles
        await supabase
          .from('user_roles')
          .insert({ user_id: existingProfile.user_id, role });

        // Support users also get admin role
        if (userType === 'suporte') {
          await supabase
            .from('user_roles')
            .insert({ user_id: existingProfile.user_id, role: 'admin' });
        }

        console.log(`Reset password for ${userType} at ${company.name}`);
        return { success: true, action: 'reset' };
      }

      // Create new user
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
        console.error(`Error creating ${userType}:`, authError);
        return { success: false, action: 'error', error: authError.message };
      }

      const userId = authData.user.id;

      // Create profile
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
        console.error(`Error creating profile:`, profileError);
        await supabase.auth.admin.deleteUser(userId);
        return { success: false, action: 'error', error: profileError.message };
      }

      // Assign roles
      const role = userType === 'admin' ? 'admin' : 'employee';
      await supabase.from('user_roles').insert({ user_id: userId, role });

      if (userType === 'suporte') {
        await supabase.from('user_roles').insert({ user_id: userId, role: 'admin' });
      }

      console.log(`Created ${userType} for ${company.name}`);
      return { success: true, action: 'created' };
    };

    // Add default sectors to a city hall
    const addDefaultSectors = async (cityHall: { id: string; name: string; company_code: string; cnpj: string | null }) => {
      const results = [];

      for (const sectorConfig of DEFAULT_SECTORS) {
        const sectorCompanyCode = `${cityHall.company_code}-${sectorConfig.sector.toUpperCase().slice(0, 3)}`;
        
        // Check if sector already exists
        const { data: existingSector } = await supabase
          .from('companies')
          .select('id')
          .eq('parent_organization_id', cityHall.id)
          .eq('sector', sectorConfig.sector)
          .maybeSingle();

        if (existingSector) {
          results.push({ sector: sectorConfig.name, action: 'exists', companyId: existingSector.id });
          continue;
        }

        // Create sector
        const { data: newSector, error: sectorError } = await supabase
          .from('companies')
          .insert({
            name: sectorConfig.name,
            company_code: sectorCompanyCode,
            organization_type: 'city_hall',
            parent_organization_id: cityHall.id,
            sector: sectorConfig.sector,
            cnpj: cityHall.cnpj,
            is_active: true
          })
          .select()
          .single();

        if (sectorError) {
          console.error(`Error creating sector ${sectorConfig.name}:`, sectorError);
          results.push({ sector: sectorConfig.name, action: 'error', error: sectorError.message });
          continue;
        }

        // Create company_settings for the new sector
        await supabase
          .from('company_settings')
          .insert({
            company_id: newSector.id,
            company_name: sectorConfig.name,
            cnpj: cityHall.cnpj
          });

        // Create users for the sector
        const suporteResult = await createOrResetUser(
          { id: newSector.id, name: sectorConfig.name, company_code: sectorCompanyCode },
          'suporte'
        );
        const adminResult = await createOrResetUser(
          { id: newSector.id, name: sectorConfig.name, company_code: sectorCompanyCode },
          'admin'
        );

        results.push({
          sector: sectorConfig.name,
          action: 'created',
          companyId: newSector.id,
          users: { suporte: suporteResult.action, admin: adminResult.action }
        });
      }

      return results;
    };

    if (action === 'add-default-sectors') {
      // Add default sectors to all city halls or a specific one
      let cityHalls;

      if (cityHallId) {
        const { data } = await supabase
          .from('companies')
          .select('id, name, company_code, cnpj')
          .eq('id', cityHallId)
          .eq('organization_type', 'city_hall')
          .is('parent_organization_id', null)
          .single();
        
        cityHalls = data ? [data] : [];
      } else {
        const { data } = await supabase
          .from('companies')
          .select('id, name, company_code, cnpj')
          .eq('organization_type', 'city_hall')
          .is('parent_organization_id', null)
          .eq('is_active', true);
        
        cityHalls = data || [];
      }

      const results = [];
      for (const cityHall of cityHalls) {
        const sectorResults = await addDefaultSectors(cityHall);
        results.push({
          cityHall: cityHall.name,
          cityHallId: cityHall.id,
          sectors: sectorResults
        });
      }

      return new Response(
        JSON.stringify({ success: true, results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'recreate-all-users') {
      // Recreate users for all companies
      const { data: companies } = await supabase
        .from('companies')
        .select('id, name, company_code')
        .eq('is_active', true);

      const results = [];
      for (const company of companies || []) {
        const suporteResult = await createOrResetUser(company, 'suporte');
        const adminResult = await createOrResetUser(company, 'admin');
        
        results.push({
          company: company.name,
          companyId: company.id,
          suporte: suporteResult,
          admin: adminResult
        });
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          results,
          note: 'Senhas aleatórias geradas por conta. Use a redefinição de senha para entregá-las com segurança.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'full-setup') {
      // Full setup: add sectors to city halls + recreate all users
      const { data: cityHalls } = await supabase
        .from('companies')
        .select('id, name, company_code, cnpj')
        .eq('organization_type', 'city_hall')
        .is('parent_organization_id', null)
        .eq('is_active', true);

      const sectorResults = [];
      for (const cityHall of cityHalls || []) {
        const sectors = await addDefaultSectors(cityHall);
        sectorResults.push({
          cityHall: cityHall.name,
          sectors
        });
      }

      // Recreate users for all companies (including new sectors)
      const { data: allCompanies } = await supabase
        .from('companies')
        .select('id, name, company_code')
        .eq('is_active', true);

      const userResults = [];
      for (const company of allCompanies || []) {
        const suporteResult = await createOrResetUser(company, 'suporte');
        const adminResult = await createOrResetUser(company, 'admin');
        
        userResults.push({
          company: company.name,
          suporte: suporteResult.action,
          admin: adminResult.action
        });
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          sectorResults,
          userResults,
          note: 'Senhas aleatórias geradas por conta. Use a redefinição de senha para entregá-las com segurança.'
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
    console.error('Error in setup-default-data:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
