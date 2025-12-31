import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to safely get error message
const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return String(error);
};

// Manufacturer-specific communication handlers
const manufacturerHandlers: Record<string, (equipment: any) => Promise<any>> = {
  // Henry (REP-C Protocol)
  henry: async (equipment) => {
    const url = `${equipment.protocol}://${equipment.ip_address}:${equipment.port}${equipment.api_endpoint || '/iDClass/SyncDataService.svc'}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8',
          'Authorization': equipment.username ? `Basic ${btoa(`${equipment.username}:${equipment.password}`)}` : '',
        },
        body: `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <GetRecords xmlns="http://tempuri.org/">
      <lastNSR>0</lastNSR>
    </GetRecords>
  </soap12:Body>
</soap12:Envelope>`,
      });
      return { online: response.ok, data: await response.text() };
    } catch (error) {
      return { online: false, error: getErrorMessage(error) };
    }
  },

  // Dimep (REST API)
  dimep: async (equipment) => {
    const url = `${equipment.protocol}://${equipment.ip_address}:${equipment.port}${equipment.api_endpoint || '/api/v1/records'}`;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': equipment.username ? `Bearer ${equipment.password}` : '',
        },
      });
      return { online: response.ok, data: await response.json() };
    } catch (error) {
      return { online: false, error: getErrorMessage(error) };
    }
  },

  // Control iD (REST API)
  controlid: async (equipment) => {
    const url = `${equipment.protocol}://${equipment.ip_address}:${equipment.port}${equipment.api_endpoint || '/api/v1/afd'}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          login: equipment.username,
          password: equipment.password,
        }),
      });
      return { online: response.ok, data: await response.json() };
    } catch (error) {
      return { online: false, error: getErrorMessage(error) };
    }
  },

  // Topdata (Inner REP Protocol)
  topdata: async (equipment) => {
    const url = `${equipment.protocol}://${equipment.ip_address}:${equipment.port}${equipment.api_endpoint || '/inner/api'}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${btoa(`${equipment.username}:${equipment.password}`)}`,
        },
        body: JSON.stringify({ command: 'get_records' }),
      });
      return { online: response.ok, data: await response.json() };
    } catch (error) {
      return { online: false, error: getErrorMessage(error) };
    }
  },

  // Madis
  madis: async (equipment) => {
    const url = `${equipment.protocol}://${equipment.ip_address}:${equipment.port}${equipment.api_endpoint || '/api/records'}`;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': equipment.password || '',
        },
      });
      return { online: response.ok, data: await response.json() };
    } catch (error) {
      return { online: false, error: getErrorMessage(error) };
    }
  },

  // Secullum
  secullum: async (equipment) => {
    const url = `${equipment.protocol}://${equipment.ip_address}:${equipment.port}${equipment.api_endpoint || '/webservice/ponto'}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8',
        },
        body: `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <BuscarMarcacoes xmlns="http://secullum.com.br/">
      <usuario>${equipment.username}</usuario>
      <senha>${equipment.password}</senha>
    </BuscarMarcacoes>
  </soap:Body>
</soap:Envelope>`,
      });
      return { online: response.ok, data: await response.text() };
    } catch (error) {
      return { online: false, error: getErrorMessage(error) };
    }
  },

  // ZKTeco (PUSH Protocol)
  zkteco: async (equipment) => {
    const url = `${equipment.protocol}://${equipment.ip_address}:${equipment.port}${equipment.api_endpoint || '/iclock/cdata'}`;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'text/plain',
        },
      });
      return { online: response.ok, data: await response.text() };
    } catch (error) {
      return { online: false, error: getErrorMessage(error) };
    }
  },

  // Anviz
  anviz: async (equipment) => {
    const url = `${equipment.protocol}://${equipment.ip_address}:${equipment.port}${equipment.api_endpoint || '/api/transaction'}`;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${equipment.password}`,
        },
      });
      return { online: response.ok, data: await response.json() };
    } catch (error) {
      return { online: false, error: getErrorMessage(error) };
    }
  },

  // Suprema (BioStar 2 API)
  suprema: async (equipment) => {
    const url = `${equipment.protocol}://${equipment.ip_address}:${equipment.port}${equipment.api_endpoint || '/api/v2/events'}`;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'bs-session-id': equipment.password || '',
        },
      });
      return { online: response.ok, data: await response.json() };
    } catch (error) {
      return { online: false, error: getErrorMessage(error) };
    }
  },

  // Trix
  trix: async (equipment) => {
    const url = `${equipment.protocol}://${equipment.ip_address}:${equipment.port}${equipment.api_endpoint || '/api/v1/marcacoes'}`;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${btoa(`${equipment.username}:${equipment.password}`)}`,
        },
      });
      return { online: response.ok, data: await response.json() };
    } catch (error) {
      return { online: false, error: getErrorMessage(error) };
    }
  },

  // Generic HTTP/REST
  generic: async (equipment) => {
    const url = `${equipment.protocol}://${equipment.ip_address}:${equipment.port}${equipment.api_endpoint || '/'}`;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(equipment.username && { 'Authorization': `Basic ${btoa(`${equipment.username}:${equipment.password}`)}` }),
        },
      });
      return { online: response.ok, data: await response.text() };
    } catch (error) {
      return { online: false, error: getErrorMessage(error) };
    }
  },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, equipmentId, companyId } = await req.json();
    console.log(`Equipment sync action: ${action}, equipmentId: ${equipmentId}, companyId: ${companyId}`);

    if (action === 'sync_single') {
      // Sync a single equipment
      const { data: equipment, error: fetchError } = await supabase
        .from('time_clock_equipment')
        .select('*')
        .eq('id', equipmentId)
        .single();

      if (fetchError || !equipment) {
        throw new Error(`Equipment not found: ${fetchError?.message}`);
      }

      const handler = manufacturerHandlers[equipment.manufacturer.toLowerCase()] || manufacturerHandlers.generic;
      const result = await handler(equipment);

      // Update equipment status
      await supabase
        .from('time_clock_equipment')
        .update({
          is_online: result.online,
          last_communication: new Date().toISOString(),
          ...(result.online && { last_sync: new Date().toISOString() }),
        })
        .eq('id', equipmentId);

      // Log communication
      await supabase
        .from('equipment_communication_logs')
        .insert({
          equipment_id: equipmentId,
          company_id: equipment.company_id,
          status: result.online ? 'success' : 'error',
          message: result.online ? 'Communication successful' : (result.error || 'Communication failed'),
          request_type: 'sync',
          response_data: result.data ? { data: typeof result.data === 'string' ? result.data.substring(0, 1000) : result.data } : null,
        });

      return new Response(
        JSON.stringify({ success: true, online: result.online, result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'sync_all') {
      // Sync all active equipment for a company
      let query = supabase
        .from('time_clock_equipment')
        .select('*')
        .eq('is_active', true);

      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      const { data: equipments, error: fetchError } = await query;

      if (fetchError) {
        throw new Error(`Failed to fetch equipment: ${fetchError.message}`);
      }

      const results = [];
      for (const equipment of equipments || []) {
        const handler = manufacturerHandlers[equipment.manufacturer.toLowerCase()] || manufacturerHandlers.generic;
        const result = await handler(equipment);

        // Update equipment status
        await supabase
          .from('time_clock_equipment')
          .update({
            is_online: result.online,
            last_communication: new Date().toISOString(),
            ...(result.online && { last_sync: new Date().toISOString() }),
          })
          .eq('id', equipment.id);

        // Log communication
        await supabase
          .from('equipment_communication_logs')
          .insert({
            equipment_id: equipment.id,
            company_id: equipment.company_id,
            status: result.online ? 'success' : 'error',
            message: result.online ? 'Communication successful' : (result.error || 'Communication failed'),
            request_type: 'sync',
          });

        results.push({ equipmentId: equipment.id, name: equipment.name, online: result.online });
      }

      return new Response(
        JSON.stringify({ success: true, results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'test_connection') {
      // Test connection to a single equipment
      const { data: equipment, error: fetchError } = await supabase
        .from('time_clock_equipment')
        .select('*')
        .eq('id', equipmentId)
        .single();

      if (fetchError || !equipment) {
        throw new Error(`Equipment not found: ${fetchError?.message}`);
      }

      const handler = manufacturerHandlers[equipment.manufacturer.toLowerCase()] || manufacturerHandlers.generic;
      const result = await handler(equipment);

      // Update equipment status
      await supabase
        .from('time_clock_equipment')
        .update({
          is_online: result.online,
          last_communication: new Date().toISOString(),
        })
        .eq('id', equipmentId);

      // Log communication
      await supabase
        .from('equipment_communication_logs')
        .insert({
          equipment_id: equipmentId,
          company_id: equipment.company_id,
          status: result.online ? 'success' : 'error',
          message: result.online ? 'Connection test successful' : (result.error || 'Connection test failed'),
          request_type: 'test',
        });

      return new Response(
        JSON.stringify({ success: true, online: result.online, message: result.online ? 'Conexão estabelecida com sucesso' : `Falha na conexão: ${result.error}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Equipment sync error:', error);
    return new Response(
      JSON.stringify({ error: getErrorMessage(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
