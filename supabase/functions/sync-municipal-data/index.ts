import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';


import { getCorsHeaders } from "../_shared/cors.ts";

// Common school types in Brazilian municipalities
const schoolTypes = [
  'EMEI - Escola Municipal de Educação Infantil',
  'EMEF - Escola Municipal de Ensino Fundamental',
  'CMEI - Centro Municipal de Educação Infantil',
  'CEMEI - Centro Municipal de Educação Infantil',
  'EM - Escola Municipal',
  'EE - Escola Estadual',
];

// Common health unit types
const healthUnitTypes = [
  'UBS - Unidade Básica de Saúde',
  'UPA - Unidade de Pronto Atendimento',
  'Hospital Municipal',
  'Hospital Regional',
  'CAPS - Centro de Atenção Psicossocial',
  'CEO - Centro de Especialidades Odontológicas',
  'SAMU',
  'Ambulatório Municipal',
  'ESF - Estratégia Saúde da Família',
];

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { company_id, type } = await req.json();

    if (!company_id || !type) {
      return new Response(
        JSON.stringify({ error: 'company_id e type são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get company info including parent organization
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, name, cnpj, city, state, parent_organization_id, sector, organization_type')
      .eq('id', company_id)
      .single();

    if (companyError || !company) {
      return new Response(
        JSON.stringify({ error: 'Empresa não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine the parent city hall if this is a sector
    let cityHallId = company_id;
    let cityName = company.city || 'Município';
    let stateName = company.state || 'SP';
    
    if (company.parent_organization_id) {
      const { data: parent } = await supabase
        .from('companies')
        .select('id, name, cnpj, city, state')
        .eq('id', company.parent_organization_id)
        .single();
      
      if (parent) {
        cityHallId = parent.id;
        cityName = parent.city || cityName;
        stateName = parent.state || stateName;
      }
    }

    let count = 0;

    if (type === 'schools') {
      // Generate sample schools based on municipality
      const schoolsToInsert = [];
      
      // Get education sector company id
      const { data: educationSector } = await supabase
        .from('companies')
        .select('id')
        .eq('parent_organization_id', cityHallId)
        .eq('sector', 'education')
        .single();

      const targetCompanyId = educationSector?.id || company_id;

      // Check for existing schools
      const { data: existingSchools } = await supabase
        .from('schools')
        .select('name')
        .eq('company_id', targetCompanyId);

      const existingNames = new Set(existingSchools?.map(s => s.name) || []);

      // Generate sample schools for the municipality
      const sampleSchools = [
        { name: `EMEI ${cityName} I`, type: 'EMEI - Escola Municipal de Educação Infantil' },
        { name: `EMEI ${cityName} II`, type: 'EMEI - Escola Municipal de Educação Infantil' },
        { name: `EMEF ${cityName} Central`, type: 'EMEF - Escola Municipal de Ensino Fundamental' },
        { name: `EMEF Professores de ${cityName}`, type: 'EMEF - Escola Municipal de Ensino Fundamental' },
        { name: `CMEI Pequenos Passos`, type: 'CMEI - Centro Municipal de Educação Infantil' },
        { name: `CMEI Cantinho Feliz`, type: 'CMEI - Centro Municipal de Educação Infantil' },
        { name: `EM Vila Nova`, type: 'EM - Escola Municipal' },
        { name: `EM Jardim das Flores`, type: 'EM - Escola Municipal' },
      ];

      for (const school of sampleSchools) {
        if (!existingNames.has(school.name)) {
          schoolsToInsert.push({
            company_id: targetCompanyId,
            name: school.name,
            school_type: school.type,
            city: cityName,
            state: stateName,
            is_active: true,
          });
        }
      }

      if (schoolsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('schools')
          .insert(schoolsToInsert);

        if (insertError) {
          console.error('Error inserting schools:', insertError);
          throw insertError;
        }
        count = schoolsToInsert.length;
      }

      console.log(`Synced ${count} schools for ${cityName}`);
    } 
    else if (type === 'health_units') {
      // Generate sample health units
      const unitsToInsert = [];

      // Get health sector company id
      const { data: healthSector } = await supabase
        .from('companies')
        .select('id')
        .eq('parent_organization_id', cityHallId)
        .eq('sector', 'health')
        .single();

      const targetCompanyId = healthSector?.id || company_id;

      // Check for existing health units
      const { data: existingUnits } = await supabase
        .from('health_units')
        .select('name')
        .eq('company_id', targetCompanyId);

      const existingNames = new Set(existingUnits?.map(u => u.name) || []);

      // Generate sample health units for the municipality
      const sampleUnits = [
        { name: `UBS Central ${cityName}`, type: 'UBS - Unidade Básica de Saúde' },
        { name: `UBS Vila Nova`, type: 'UBS - Unidade Básica de Saúde' },
        { name: `UBS Jardim das Flores`, type: 'UBS - Unidade Básica de Saúde' },
        { name: `UBS Bairro Alto`, type: 'UBS - Unidade Básica de Saúde' },
        { name: `UPA 24h ${cityName}`, type: 'UPA - Unidade de Pronto Atendimento' },
        { name: `Hospital Municipal de ${cityName}`, type: 'Hospital Municipal' },
        { name: `CAPS ${cityName}`, type: 'CAPS - Centro de Atenção Psicossocial' },
        { name: `CEO ${cityName}`, type: 'CEO - Centro de Especialidades Odontológicas' },
        { name: `ESF Centro`, type: 'ESF - Estratégia Saúde da Família' },
        { name: `ESF Vila Nova`, type: 'ESF - Estratégia Saúde da Família' },
      ];

      for (const unit of sampleUnits) {
        if (!existingNames.has(unit.name)) {
          unitsToInsert.push({
            company_id: targetCompanyId,
            name: unit.name,
            unit_type: unit.type,
            city: cityName,
            state: stateName,
            is_active: true,
          });
        }
      }

      if (unitsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('health_units')
          .insert(unitsToInsert);

        if (insertError) {
          console.error('Error inserting health units:', insertError);
          throw insertError;
        }
        count = unitsToInsert.length;
      }

      console.log(`Synced ${count} health units for ${cityName}`);
    }

    return new Response(
      JSON.stringify({ success: true, count, message: `${count} registros sincronizados` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in sync-municipal-data:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
