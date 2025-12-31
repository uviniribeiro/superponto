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

// Parse records from different manufacturer formats
const parseRecords = (manufacturer: string, data: any): Array<{ identifier: string; recordedAt: Date; recordType?: string }> => {
  const records: Array<{ identifier: string; recordedAt: Date; recordType?: string }> = [];
  
  try {
    // Different parsing logic based on manufacturer
    switch (manufacturer.toLowerCase()) {
      case 'henry':
        // Parse SOAP/XML response from Henry
        if (typeof data === 'string' && data.includes('<Record>')) {
          const recordMatches = data.matchAll(/<Record>.*?<PIS>(\d+)<\/PIS>.*?<DateTime>([^<]+)<\/DateTime>.*?<\/Record>/gs);
          for (const match of recordMatches) {
            records.push({
              identifier: match[1],
              recordedAt: new Date(match[2]),
            });
          }
        }
        break;
        
      case 'dimep':
      case 'controlid':
      case 'topdata':
      case 'madis':
      case 'anviz':
      case 'trix':
      case 'rwtech':
      case 'intelbras':
        // Parse JSON response
        if (Array.isArray(data)) {
          for (const record of data) {
            records.push({
              identifier: record.pis || record.cpf || record.employee_id || record.user_id || '',
              recordedAt: new Date(record.datetime || record.timestamp || record.time),
              recordType: record.type,
            });
          }
        } else if (data?.records && Array.isArray(data.records)) {
          for (const record of data.records) {
            records.push({
              identifier: record.pis || record.cpf || record.employee_id || record.user_id || '',
              recordedAt: new Date(record.datetime || record.timestamp || record.time),
              recordType: record.type,
            });
          }
        }
        break;
        
      case 'secullum':
        // Parse SOAP/XML response from Secullum
        if (typeof data === 'string' && data.includes('<Marcacao>')) {
          const recordMatches = data.matchAll(/<Marcacao>.*?<PIS>(\d+)<\/PIS>.*?<DataHora>([^<]+)<\/DataHora>.*?<\/Marcacao>/gs);
          for (const match of recordMatches) {
            records.push({
              identifier: match[1],
              recordedAt: new Date(match[2]),
            });
          }
        }
        break;
        
      case 'zkteco':
        // Parse text response from ZKTeco PUSH protocol
        if (typeof data === 'string') {
          const lines = data.split('\n');
          for (const line of lines) {
            // Format: USER\tTIMESTAMP\tSTATUS\tVERIFY
            const parts = line.split('\t');
            if (parts.length >= 2) {
              records.push({
                identifier: parts[0].trim(),
                recordedAt: new Date(parts[1].trim()),
              });
            }
          }
        }
        break;
        
      case 'suprema':
        // Parse BioStar 2 API response
        if (data?.EventCollection?.rows && Array.isArray(data.EventCollection.rows)) {
          for (const event of data.EventCollection.rows) {
            if (event.user_id) {
              records.push({
                identifier: event.user_id.user_id || '',
                recordedAt: new Date(event.datetime),
              });
            }
          }
        }
        break;
        
      case 'hikvision':
        // Parse ISAPI response
        if (data?.AcsEvent && Array.isArray(data.AcsEvent)) {
          for (const event of data.AcsEvent) {
            records.push({
              identifier: event.employeeNoString || '',
              recordedAt: new Date(event.time),
            });
          }
        }
        break;
        
      default:
        // Generic JSON parsing
        if (Array.isArray(data)) {
          for (const record of data) {
            const id = record.pis || record.cpf || record.employee_id || record.user_id || record.id || '';
            const time = record.datetime || record.timestamp || record.time || record.date;
            if (id && time) {
              records.push({
                identifier: String(id),
                recordedAt: new Date(time),
              });
            }
          }
        }
    }
  } catch (e) {
    console.error('Error parsing records:', getErrorMessage(e));
  }
  
  return records;
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
      const data = await response.text();
      return { online: response.ok, data, records: parseRecords('henry', data) };
    } catch (error) {
      return { online: false, error: getErrorMessage(error), records: [] };
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
      const data = await response.json();
      return { online: response.ok, data, records: parseRecords('dimep', data) };
    } catch (error) {
      return { online: false, error: getErrorMessage(error), records: [] };
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
      const data = await response.json();
      return { online: response.ok, data, records: parseRecords('controlid', data) };
    } catch (error) {
      return { online: false, error: getErrorMessage(error), records: [] };
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
      const data = await response.json();
      return { online: response.ok, data, records: parseRecords('topdata', data) };
    } catch (error) {
      return { online: false, error: getErrorMessage(error), records: [] };
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
      const data = await response.json();
      return { online: response.ok, data, records: parseRecords('madis', data) };
    } catch (error) {
      return { online: false, error: getErrorMessage(error), records: [] };
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
      const data = await response.text();
      return { online: response.ok, data, records: parseRecords('secullum', data) };
    } catch (error) {
      return { online: false, error: getErrorMessage(error), records: [] };
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
      const data = await response.text();
      return { online: response.ok, data, records: parseRecords('zkteco', data) };
    } catch (error) {
      return { online: false, error: getErrorMessage(error), records: [] };
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
      const data = await response.json();
      return { online: response.ok, data, records: parseRecords('anviz', data) };
    } catch (error) {
      return { online: false, error: getErrorMessage(error), records: [] };
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
      const data = await response.json();
      return { online: response.ok, data, records: parseRecords('suprema', data) };
    } catch (error) {
      return { online: false, error: getErrorMessage(error), records: [] };
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
      const data = await response.json();
      return { online: response.ok, data, records: parseRecords('trix', data) };
    } catch (error) {
      return { online: false, error: getErrorMessage(error), records: [] };
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
      const data = await response.text();
      let parsedData;
      try {
        parsedData = JSON.parse(data);
      } catch {
        parsedData = data;
      }
      return { online: response.ok, data: parsedData, records: parseRecords('generic', parsedData) };
    } catch (error) {
      return { online: false, error: getErrorMessage(error), records: [] };
    }
  },
};

// Find employee profile - Priority: registration_number > PIS > CPF
const findEmployeeProfile = async (supabase: any, identifier: string, companyId: string | null) => {
  // Clean up identifier (remove dots, dashes, etc.)
  const cleanIdentifier = identifier.replace(/[^\d]/g, '');
  
  if (!cleanIdentifier) return null;
  
  // First priority: Try to find by registration_number (matrícula)
  let query = supabase
    .from('profiles')
    .select('id, full_name, pis, cpf, registration_number, company_id')
    .eq('registration_number', cleanIdentifier);
  
  if (companyId) {
    query = query.eq('company_id', companyId);
  }
  
  let { data, error } = await query.maybeSingle();
  
  if (error) {
    console.error('Error finding employee by registration_number:', error.message);
  }
  
  // If found by registration_number, return immediately
  if (data) {
    console.log(`Employee found by registration_number: ${data.full_name}`);
    return data;
  }
  
  // Second priority: Try to find by PIS
  query = supabase
    .from('profiles')
    .select('id, full_name, pis, cpf, registration_number, company_id')
    .eq('pis', cleanIdentifier);
  
  if (companyId) {
    query = query.eq('company_id', companyId);
  }
  
  ({ data, error } = await query.maybeSingle());
  
  if (error) {
    console.error('Error finding employee by PIS:', error.message);
  }
  
  // If found by PIS, return
  if (data) {
    console.log(`Employee found by PIS: ${data.full_name}`);
    return data;
  }
  
  // Third priority: Try to find by CPF
  query = supabase
    .from('profiles')
    .select('id, full_name, pis, cpf, registration_number, company_id')
    .eq('cpf', cleanIdentifier);
  
  if (companyId) {
    query = query.eq('company_id', companyId);
  }
  
  ({ data, error } = await query.maybeSingle());
  
  if (error) {
    console.error('Error finding employee by CPF:', error.message);
  }
  
  if (data) {
    console.log(`Employee found by CPF: ${data.full_name}`);
  }
  
  return data;
};

// Process pending records and create time_records
const processPendingRecords = async (supabase: any) => {
  console.log('Processing pending records...');
  
  // Get unprocessed pending records
  const { data: pendingRecords, error: fetchError } = await supabase
    .from('equipment_pending_records')
    .select('*, time_clock_equipment(company_id)')
    .eq('is_processed', false)
    .order('recorded_at', { ascending: true })
    .limit(100);
  
  if (fetchError) {
    console.error('Error fetching pending records:', fetchError.message);
    return { processed: 0, errors: 0 };
  }
  
  let processed = 0;
  let errors = 0;
  
  for (const record of pendingRecords || []) {
    try {
      const companyId = record.time_clock_equipment?.company_id || record.company_id;
      
      // Find employee by PIS or CPF
      const profile = await findEmployeeProfile(supabase, record.employee_identifier, companyId);
      
      if (!profile) {
        console.log(`Employee not found for identifier: ${record.employee_identifier}`);
        // Update as processed but without profile link
        await supabase
          .from('equipment_pending_records')
          .update({
            is_processed: true,
            processed_at: new Date().toISOString(),
          })
          .eq('id', record.id);
        errors++;
        continue;
      }
      
      // Determine record type based on existing records for the day
      const recordDate = new Date(record.recorded_at);
      const startOfDay = new Date(recordDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(recordDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      // Check existing records for this employee on this day
      const { data: existingRecords } = await supabase
        .from('time_records')
        .select('id, record_type, recorded_at')
        .eq('profile_id', profile.id)
        .gte('recorded_at', startOfDay.toISOString())
        .lte('recorded_at', endOfDay.toISOString())
        .order('recorded_at', { ascending: true });
      
      // Determine record type: alternate between entry and exit
      let recordType = 'entry';
      if (existingRecords && existingRecords.length > 0) {
        const lastRecord = existingRecords[existingRecords.length - 1];
        recordType = lastRecord.record_type === 'entry' ? 'exit' : 'entry';
      }
      
      // Check for duplicate (same profile, same time within 1 minute)
      const oneMinuteBefore = new Date(recordDate.getTime() - 60000);
      const oneMinuteAfter = new Date(recordDate.getTime() + 60000);
      
      const { data: duplicateCheck } = await supabase
        .from('time_records')
        .select('id')
        .eq('profile_id', profile.id)
        .gte('recorded_at', oneMinuteBefore.toISOString())
        .lte('recorded_at', oneMinuteAfter.toISOString())
        .limit(1);
      
      if (duplicateCheck && duplicateCheck.length > 0) {
        console.log(`Duplicate record found for ${profile.full_name} at ${record.recorded_at}`);
        // Mark as processed (duplicate)
        await supabase
          .from('equipment_pending_records')
          .update({
            is_processed: true,
            processed_at: new Date().toISOString(),
            profile_id: profile.id,
          })
          .eq('id', record.id);
        continue;
      }
      
      // Create time_record
      const { data: newTimeRecord, error: insertError } = await supabase
        .from('time_records')
        .insert({
          profile_id: profile.id,
          company_id: companyId,
          record_type: recordType,
          recorded_at: record.recorded_at,
          device_info: `REP: ${record.equipment_id}`,
        })
        .select('id')
        .single();
      
      if (insertError) {
        console.error(`Error creating time_record: ${insertError.message}`);
        errors++;
        continue;
      }
      
      // Update pending record as processed
      await supabase
        .from('equipment_pending_records')
        .update({
          is_processed: true,
          processed_at: new Date().toISOString(),
          profile_id: profile.id,
          time_record_id: newTimeRecord.id,
        })
        .eq('id', record.id);
      
      processed++;
      console.log(`Created time_record for ${profile.full_name}: ${recordType} at ${record.recorded_at}`);
      
    } catch (e) {
      console.error(`Error processing record ${record.id}:`, getErrorMessage(e));
      errors++;
    }
  }
  
  console.log(`Processed ${processed} records, ${errors} errors`);
  return { processed, errors };
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

      // Save pending records
      let recordsSynced = 0;
      if (result.records && result.records.length > 0) {
        for (const record of result.records) {
          const { error: insertError } = await supabase
            .from('equipment_pending_records')
            .insert({
              equipment_id: equipmentId,
              company_id: equipment.company_id,
              employee_identifier: record.identifier,
              recorded_at: record.recordedAt.toISOString(),
              record_type: record.recordType,
              raw_data: { original: record },
            });
          
          if (!insertError) recordsSynced++;
        }
      }

      // Log communication
      await supabase
        .from('equipment_communication_logs')
        .insert({
          equipment_id: equipmentId,
          company_id: equipment.company_id,
          status: result.online ? 'success' : 'error',
          message: result.online ? 'Communication successful' : (result.error || 'Communication failed'),
          request_type: 'sync',
          records_synced: recordsSynced,
          response_data: result.data ? { data: typeof result.data === 'string' ? result.data.substring(0, 1000) : result.data } : null,
        });

      // Process pending records
      const processResult = await processPendingRecords(supabase);

      return new Response(
        JSON.stringify({ 
          success: true, 
          online: result.online, 
          recordsSynced,
          recordsProcessed: processResult.processed,
        }),
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
      let totalRecordsSynced = 0;
      
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

        // Save pending records
        let recordsSynced = 0;
        if (result.records && result.records.length > 0) {
          for (const record of result.records) {
            const { error: insertError } = await supabase
              .from('equipment_pending_records')
              .insert({
                equipment_id: equipment.id,
                company_id: equipment.company_id,
                employee_identifier: record.identifier,
                recorded_at: record.recordedAt.toISOString(),
                record_type: record.recordType,
                raw_data: { original: record },
              });
            
            if (!insertError) recordsSynced++;
          }
          totalRecordsSynced += recordsSynced;
        }

        // Log communication
        await supabase
          .from('equipment_communication_logs')
          .insert({
            equipment_id: equipment.id,
            company_id: equipment.company_id,
            status: result.online ? 'success' : 'error',
            message: result.online ? 'Communication successful' : (result.error || 'Communication failed'),
            request_type: 'sync',
            records_synced: recordsSynced,
          });

        results.push({ equipmentId: equipment.id, name: equipment.name, online: result.online, recordsSynced });
      }

      // Process all pending records
      const processResult = await processPendingRecords(supabase);

      return new Response(
        JSON.stringify({ 
          success: true, 
          results,
          totalRecordsSynced,
          recordsProcessed: processResult.processed,
          processingErrors: processResult.errors,
        }),
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

    if (action === 'process_pending') {
      // Manually process pending records
      const processResult = await processPendingRecords(supabase);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          processed: processResult.processed,
          errors: processResult.errors,
        }),
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
