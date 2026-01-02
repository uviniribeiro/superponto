import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CityHall {
  id: string;
  name: string;
  code: string;
}

interface Sector {
  id: string;
  name: string;
  sector: string;
  code: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const body = await req.json();
    const { action, cityHallId, companyCode } = body;

    console.log('Received request:', { action, cityHallId, companyCode: companyCode ? '[REDACTED]' : undefined });

    if (action === 'list-city-halls') {
      // Return only active city halls with minimal data (just name and ID)
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, company_code')
        .eq('organization_type', 'city_hall')
        .is('parent_organization_id', null)
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Error fetching city halls:', error);
        throw error;
      }

      const cityHalls: CityHall[] = (data || []).map(ch => ({
        id: ch.id,
        name: ch.name,
        code: ch.company_code
      }));

      console.log(`Returning ${cityHalls.length} city halls`);

      return new Response(
        JSON.stringify({ success: true, data: cityHalls }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'list-sectors' && cityHallId) {
      // Return sectors for a specific city hall
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, sector, company_code')
        .eq('parent_organization_id', cityHallId)
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Error fetching sectors:', error);
        throw error;
      }

      const sectors: Sector[] = (data || []).map(s => ({
        id: s.id,
        name: s.name,
        sector: s.sector || 'other',
        code: s.company_code
      }));

      console.log(`Returning ${sectors.length} sectors for city hall ${cityHallId}`);

      return new Response(
        JSON.stringify({ success: true, data: sectors }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'validate-company' && companyCode) {
      // Validate company code exists and is active (without exposing CNPJ or other sensitive data)
      const { data, error } = await supabase
        .from('companies')
        .select('id')
        .eq('company_code', companyCode)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('Error validating company:', error);
        throw error;
      }

      console.log('Company validation result:', data ? 'found' : 'not found');

      return new Response(
        JSON.stringify({ success: true, valid: !!data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in validate-company-login:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
