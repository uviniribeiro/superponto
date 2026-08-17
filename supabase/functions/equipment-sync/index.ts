import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


import { getCorsHeaders } from "../_shared/cors.ts";

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
      
      case 'biomtech':
        // Parse Biomtech JSON response (faceSchool, faceJus, etc.)
        // Biomtech uses alphanumeric serial numbers and unique person IDs
        if (Array.isArray(data)) {
          for (const record of data) {
            // Biomtech may use: person_id, user_id, employee_id, enrollment_id (alphanumeric)
            const id = record.person_id || record.user_id || record.employee_id || 
                       record.enrollment_id || record.id || '';
            const time = record.timestamp || record.datetime || record.time || 
                         record.created_at || record.recorded_at;
            if (id && time) {
              records.push({
                identifier: String(id), // Keep alphanumeric ID as-is
                recordedAt: new Date(time),
                recordType: record.event_type || record.type,
              });
            }
          }
        } else if (data?.records && Array.isArray(data.records)) {
          for (const record of data.records) {
            const id = record.person_id || record.user_id || record.employee_id || 
                       record.enrollment_id || record.id || '';
            const time = record.timestamp || record.datetime || record.time || 
                         record.created_at || record.recorded_at;
            if (id && time) {
              records.push({
                identifier: String(id),
                recordedAt: new Date(time),
                recordType: record.event_type || record.type,
              });
            }
          }
        } else if (data?.data && Array.isArray(data.data)) {
          for (const record of data.data) {
            const id = record.person_id || record.user_id || record.employee_id || 
                       record.enrollment_id || record.id || '';
            const time = record.timestamp || record.datetime || record.time || 
                         record.created_at || record.recorded_at;
            if (id && time) {
              records.push({
                identifier: String(id),
                recordedAt: new Date(time),
                recordType: record.event_type || record.type,
              });
            }
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

  // Biomtech (faceSchool, faceJus, facePoint, faceCorp, facePass)
  biomtech: async (equipment) => {
    const url = `${equipment.protocol}://${equipment.ip_address}:${equipment.port}${equipment.api_endpoint || '/api/v1/attendance'}`;
    try {
      // Biomtech uses REST API with API Key authentication
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };
      
      // Support multiple auth methods
      if (equipment.password) {
        headers['X-API-Key'] = equipment.password;
        headers['Authorization'] = `Bearer ${equipment.password}`;
      }
      if (equipment.username) {
        headers['X-Device-Serial'] = equipment.username; // Serial number as device identifier
      }
      
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });
      
      const data = await response.json();
      return { online: response.ok, data, records: parseRecords('biomtech', data) };
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
// Now supports alphanumeric identifiers (e.g., Biomtech devices)
const findEmployeeProfile = async (supabase: any, identifier: string, companyId: string | null) => {
  // Preserve original identifier for alphanumeric matching
  const originalIdentifier = identifier.trim();
  // Clean up identifier for numeric-only matching (remove dots, dashes, etc.)
  const numericIdentifier = identifier.replace(/[^\d]/g, '');
  
  if (!originalIdentifier) return null;
  
  // First priority: Try to find by registration_number with ORIGINAL identifier (supports alphanumeric)
  let query = supabase
    .from('profiles')
    .select('id, full_name, pis, cpf, registration_number, company_id')
    .eq('registration_number', originalIdentifier);
  
  if (companyId) {
    query = query.eq('company_id', companyId);
  }
  
  let { data, error } = await query.maybeSingle();
  
  if (error) {
    console.error('Error finding employee by registration_number (original):', error.message);
  }
  
  // If found by original registration_number, return immediately
  if (data) {
    console.log(`Employee found by registration_number (original): ${data.full_name}`);
    return data;
  }
  
  // Try with numeric-only version if different
  if (numericIdentifier && numericIdentifier !== originalIdentifier) {
    query = supabase
      .from('profiles')
      .select('id, full_name, pis, cpf, registration_number, company_id')
      .eq('registration_number', numericIdentifier);
    
    if (companyId) {
      query = query.eq('company_id', companyId);
    }
    
    ({ data, error } = await query.maybeSingle());
    
    if (data) {
      console.log(`Employee found by registration_number (numeric): ${data.full_name}`);
      return data;
    }
  }
  
  // Only continue with PIS/CPF if we have numeric digits
  if (!numericIdentifier) {
    console.log(`No numeric identifier found for: ${originalIdentifier}`);
    return null;
  }
  
  // Second priority: Try to find by PIS
  query = supabase
    .from('profiles')
    .select('id, full_name, pis, cpf, registration_number, company_id')
    .eq('pis', numericIdentifier);
  
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
    .eq('cpf', numericIdentifier);
  
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

// Send employee to device - manufacturer specific implementations
const sendEmployeeToDevice = async (equipment: any, employee: { id: string; name: string; pis: string; registration: string }): Promise<{ success: boolean; error?: string }> => {
  const manufacturer = equipment.manufacturer.toLowerCase();
  const url = `${equipment.protocol}://${equipment.ip_address}:${equipment.port}`;
  
  try {
    switch (manufacturer) {
      case 'henry':
        // Henry SOAP API for employee registration
        const henryResponse = await fetch(`${url}${equipment.api_endpoint || '/iDClass/SyncDataService.svc'}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/soap+xml; charset=utf-8',
            ...(equipment.username && { 'Authorization': `Basic ${btoa(`${equipment.username}:${equipment.password}`)}` }),
          },
          body: `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <SetEmployee xmlns="http://tempuri.org/">
      <employee>
        <PIS>${employee.pis || employee.id}</PIS>
        <Name>${employee.name}</Name>
        <Registration>${employee.registration || employee.id}</Registration>
      </employee>
    </SetEmployee>
  </soap12:Body>
</soap12:Envelope>`,
        });
        return { success: henryResponse.ok };
        
      case 'dimep':
      case 'controlid':
        const controlIdResponse = await fetch(`${url}${equipment.api_endpoint || '/api/v1/users'}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(equipment.password && { 'Authorization': `Bearer ${equipment.password}` }),
          },
          body: JSON.stringify({
            user_id: employee.id,
            name: employee.name,
            registration: employee.registration,
            pis: employee.pis,
          }),
        });
        return { success: controlIdResponse.ok };
        
      case 'zkteco':
        const zktecoResponse = await fetch(`${url}/iclock/api/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pin: employee.id,
            name: employee.name,
            privilege: 0,
          }),
        });
        return { success: zktecoResponse.ok };
        
      case 'hikvision':
        const hikvisionResponse = await fetch(`${url}/ISAPI/AccessControl/UserInfo/Record`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(equipment.username && { 'Authorization': `Basic ${btoa(`${equipment.username}:${equipment.password}`)}` }),
          },
          body: JSON.stringify({
            UserInfo: {
              employeeNo: employee.id,
              name: employee.name,
              userType: 'normal',
              Valid: { enable: true },
            },
          }),
        });
        return { success: hikvisionResponse.ok };
        
      default:
        // Generic REST API
        const genericResponse = await fetch(`${url}/api/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(equipment.username && { 'Authorization': `Basic ${btoa(`${equipment.username}:${equipment.password}`)}` }),
          },
          body: JSON.stringify({
            id: employee.id,
            name: employee.name,
            pis: employee.pis,
            registration: employee.registration,
          }),
        });
        return { success: genericResponse.ok };
    }
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
};

// Receive employees from device
const receiveEmployeesFromDevice = async (equipment: any): Promise<{ success: boolean; employees?: any[]; error?: string }> => {
  const manufacturer = equipment.manufacturer.toLowerCase();
  const url = `${equipment.protocol}://${equipment.ip_address}:${equipment.port}`;
  
  try {
    switch (manufacturer) {
      case 'henry':
        const henryResponse = await fetch(`${url}${equipment.api_endpoint || '/iDClass/SyncDataService.svc'}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/soap+xml; charset=utf-8',
            ...(equipment.username && { 'Authorization': `Basic ${btoa(`${equipment.username}:${equipment.password}`)}` }),
          },
          body: `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <GetEmployees xmlns="http://tempuri.org/" />
  </soap12:Body>
</soap12:Envelope>`,
        });
        const henryData = await henryResponse.text();
        // Parse SOAP response
        const employees: any[] = [];
        const matches = henryData.matchAll(/<Employee>.*?<PIS>(\d+)<\/PIS>.*?<Name>([^<]+)<\/Name>.*?<\/Employee>/gs);
        for (const match of matches) {
          employees.push({ identifier: match[1], name: match[2] });
        }
        return { success: true, employees };
        
      case 'dimep':
      case 'controlid':
        const controlIdResponse = await fetch(`${url}${equipment.api_endpoint || '/api/v1/users'}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(equipment.password && { 'Authorization': `Bearer ${equipment.password}` }),
          },
        });
        const controlIdData = await controlIdResponse.json();
        return { 
          success: true, 
          employees: (controlIdData.users || controlIdData || []).map((u: any) => ({
            identifier: u.user_id || u.id || u.pis,
            name: u.name,
            registration: u.registration,
            pis: u.pis,
          })),
        };
        
      case 'zkteco':
        const zktecoResponse = await fetch(`${url}/iclock/api/users`, {
          method: 'GET',
        });
        const zktecoData = await zktecoResponse.json();
        return { 
          success: true, 
          employees: (zktecoData.data || zktecoData || []).map((u: any) => ({
            identifier: u.pin || u.id,
            name: u.name,
          })),
        };
        
      case 'hikvision':
        const hikvisionResponse = await fetch(`${url}/ISAPI/AccessControl/UserInfo/Search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(equipment.username && { 'Authorization': `Basic ${btoa(`${equipment.username}:${equipment.password}`)}` }),
          },
          body: JSON.stringify({
            UserInfoSearchCond: {
              searchID: '1',
              maxResults: 1000,
              searchResultPosition: 0,
            },
          }),
        });
        const hikvisionData = await hikvisionResponse.json();
        return { 
          success: true, 
          employees: (hikvisionData.UserInfoSearch?.UserInfo || []).map((u: any) => ({
            identifier: u.employeeNo,
            name: u.name,
          })),
        };
        
      default:
        const genericResponse = await fetch(`${url}/api/users`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(equipment.username && { 'Authorization': `Basic ${btoa(`${equipment.username}:${equipment.password}`)}` }),
          },
        });
        const genericData = await genericResponse.json();
        return { 
          success: true, 
          employees: (genericData.users || genericData || []).map((u: any) => ({
            identifier: u.id || u.user_id || u.pis,
            name: u.name,
          })),
        };
    }
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
};

// Delete employee from device
const deleteEmployeeFromDevice = async (equipment: any, identifier: string): Promise<{ success: boolean; error?: string }> => {
  const manufacturer = equipment.manufacturer.toLowerCase();
  const url = `${equipment.protocol}://${equipment.ip_address}:${equipment.port}`;
  
  try {
    switch (manufacturer) {
      case 'henry':
        const henryResponse = await fetch(`${url}${equipment.api_endpoint || '/iDClass/SyncDataService.svc'}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/soap+xml; charset=utf-8',
            ...(equipment.username && { 'Authorization': `Basic ${btoa(`${equipment.username}:${equipment.password}`)}` }),
          },
          body: `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <DeleteEmployee xmlns="http://tempuri.org/">
      <pis>${identifier}</pis>
    </DeleteEmployee>
  </soap12:Body>
</soap12:Envelope>`,
        });
        return { success: henryResponse.ok };
        
      case 'dimep':
      case 'controlid':
        const controlIdResponse = await fetch(`${url}${equipment.api_endpoint || '/api/v1/users'}/${identifier}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...(equipment.password && { 'Authorization': `Bearer ${equipment.password}` }),
          },
        });
        return { success: controlIdResponse.ok };
        
      case 'zkteco':
        const zktecoResponse = await fetch(`${url}/iclock/api/users?pin=${identifier}`, {
          method: 'DELETE',
        });
        return { success: zktecoResponse.ok };
        
      case 'hikvision':
        const hikvisionResponse = await fetch(`${url}/ISAPI/AccessControl/UserInfo/Delete`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(equipment.username && { 'Authorization': `Basic ${btoa(`${equipment.username}:${equipment.password}`)}` }),
          },
          body: JSON.stringify({
            UserInfoDelCond: {
              EmployeeNoList: [{ employeeNo: identifier }],
            },
          }),
        });
        return { success: hikvisionResponse.ok };
        
      default:
        const genericResponse = await fetch(`${url}/api/users/${identifier}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...(equipment.username && { 'Authorization': `Basic ${btoa(`${equipment.username}:${equipment.password}`)}` }),
          },
        });
        return { success: genericResponse.ok };
    }
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

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
      // Sync a single equipment using the secure function that decrypts passwords
      const { data: equipmentData, error: fetchError } = await supabase
        .rpc('get_equipment_for_sync', { equipment_id: equipmentId });

      if (fetchError || !equipmentData || equipmentData.length === 0) {
        throw new Error(`Equipment not found: ${fetchError?.message}`);
      }
      
      const equipment = equipmentData[0];

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
      // First get all equipment IDs
      let query = supabase
        .from('time_clock_equipment')
        .select('id')
        .eq('is_active', true);

      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      const { data: equipmentIds, error: fetchError } = await query;

      if (fetchError) {
        throw new Error(`Failed to fetch equipment: ${fetchError.message}`);
      }

      const results = [];
      let totalRecordsSynced = 0;
      
      for (const eq of equipmentIds || []) {
        // Use the secure function to get equipment with decrypted password
        const { data: equipmentData } = await supabase.rpc('get_equipment_for_sync', { equipment_id: eq.id });
        const equipment = equipmentData?.[0];
        
        if (!equipment) continue;
        
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
      // Test connection to a single equipment using secure function
      const { data: equipmentData, error: fetchError } = await supabase
        .rpc('get_equipment_for_sync', { equipment_id: equipmentId });

      if (fetchError || !equipmentData || equipmentData.length === 0) {
        throw new Error(`Equipment not found: ${fetchError?.message}`);
      }
      
      const equipment = equipmentData[0];

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

    if (action === 'send_employees') {
      // Send employees to a time clock equipment
      const { data: reqBody } = await req.json().catch(() => ({ data: null }));
      const { profileIds } = reqBody || (await req.json());
      
      const { data: equipment, error: fetchError } = await supabase
        .from('time_clock_equipment')
        .select('*')
        .eq('id', equipmentId)
        .single();

      if (fetchError || !equipment) {
        throw new Error(`Equipment not found: ${fetchError?.message}`);
      }

      // Get employees to send
      let query = supabase
        .from('profiles')
        .select('id, full_name, registration_number, pis, cpf, photo_url')
        .eq('is_active', true);
      
      if (profileIds && profileIds.length > 0) {
        query = query.in('id', profileIds);
      } else if (equipment.company_id) {
        query = query.eq('company_id', equipment.company_id);
      }

      const { data: employees, error: empError } = await query;

      if (empError) {
        throw new Error(`Failed to fetch employees: ${empError.message}`);
      }

      let sent = 0;
      let errors = 0;
      const results: any[] = [];

      for (const employee of employees || []) {
        try {
          const identifier = employee.registration_number || employee.pis || employee.cpf || '';
          if (!identifier) {
            console.log(`Skipping employee ${employee.full_name}: no identifier`);
            errors++;
            results.push({ id: employee.id, name: employee.full_name, success: false, error: 'No identifier' });
            continue;
          }

          // Build employee data based on manufacturer
          const employeeData = {
            id: identifier,
            name: employee.full_name,
            pis: employee.pis || '',
            registration: employee.registration_number || '',
          };

          // Try to send employee to the device
          const sendResult = await sendEmployeeToDevice(equipment, employeeData);
          
          if (sendResult.success) {
            sent++;
            results.push({ id: employee.id, name: employee.full_name, success: true });
          } else {
            errors++;
            results.push({ id: employee.id, name: employee.full_name, success: false, error: sendResult.error });
          }
        } catch (e) {
          errors++;
          results.push({ id: employee.id, name: employee.full_name, success: false, error: getErrorMessage(e) });
        }
      }

      // Log communication
      await supabase
        .from('equipment_communication_logs')
        .insert({
          equipment_id: equipmentId,
          company_id: equipment.company_id,
          status: sent > 0 ? 'success' : 'error',
          message: `Sent ${sent} employees, ${errors} errors`,
          request_type: 'send_employees',
          records_synced: sent,
        });

      return new Response(
        JSON.stringify({ success: true, sent, errors, results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'receive_employees') {
      // Receive employees from a time clock equipment
      const { data: equipment, error: fetchError } = await supabase
        .from('time_clock_equipment')
        .select('*')
        .eq('id', equipmentId)
        .single();

      if (fetchError || !equipment) {
        throw new Error(`Equipment not found: ${fetchError?.message}`);
      }

      // Try to get employees from the device
      const receiveResult = await receiveEmployeesFromDevice(equipment);

      // Log communication
      await supabase
        .from('equipment_communication_logs')
        .insert({
          equipment_id: equipmentId,
          company_id: equipment.company_id,
          status: receiveResult.success ? 'success' : 'error',
          message: receiveResult.success ? `Received ${receiveResult.employees?.length || 0} employees` : receiveResult.error,
          request_type: 'receive_employees',
          records_synced: receiveResult.employees?.length || 0,
        });

      return new Response(
        JSON.stringify({ 
          success: receiveResult.success, 
          employees: receiveResult.employees || [],
          error: receiveResult.error,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'delete_employee') {
      // Delete an employee from a time clock equipment
      const { data: reqBody } = await req.json().catch(() => ({ data: null }));
      const { identifier } = reqBody || (await req.json());

      const { data: equipment, error: fetchError } = await supabase
        .from('time_clock_equipment')
        .select('*')
        .eq('id', equipmentId)
        .single();

      if (fetchError || !equipment) {
        throw new Error(`Equipment not found: ${fetchError?.message}`);
      }

      if (!identifier) {
        throw new Error('Employee identifier is required');
      }

      // Try to delete employee from the device
      const deleteResult = await deleteEmployeeFromDevice(equipment, identifier);

      // Log communication
      await supabase
        .from('equipment_communication_logs')
        .insert({
          equipment_id: equipmentId,
          company_id: equipment.company_id,
          status: deleteResult.success ? 'success' : 'error',
          message: deleteResult.success ? `Deleted employee ${identifier}` : deleteResult.error,
          request_type: 'delete_employee',
        });

      return new Response(
        JSON.stringify({ success: deleteResult.success, error: deleteResult.error }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ═══════════════════════════════════════════════════════════
    // CLOUD COMMUNICATOR ACTIONS (used by superponto-communicator.py)
    // ═══════════════════════════════════════════════════════════

    if (action === 'list_equipment') {
      // List all equipment for a company (used by agent to know what to sync)
      const { data: equipment, error: fetchError } = await supabase
        .from('time_clock_equipment')
        .select('id, name, manufacturer, model, ip_address, port, protocol, api_endpoint, username, is_active, sync_interval_seconds, serial_number, location')
        .eq('is_active', true)
        .order('name');

      if (fetchError) throw new Error(`Failed to list equipment: ${fetchError.message}`);

      return new Response(
        JSON.stringify({ success: true, equipment: equipment || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'agent_heartbeat') {
      // Agent heartbeat - update last communication and online status
      const { serverIp, agentVersion, equipmentStatuses } = body;
      
      // Update equipment statuses based on agent report
      if (equipmentStatuses && typeof equipmentStatuses === 'object') {
        for (const [eqId, status] of Object.entries(equipmentStatuses)) {
          const eqStatus = status as any;
          await supabase
            .from('time_clock_equipment')
            .update({
              is_online: eqStatus?.online || false,
              last_communication: new Date().toISOString(),
            })
            .eq('id', eqId);
        }
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Heartbeat received', serverTime: new Date().toISOString() }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'update_status') {
      // Update equipment online/offline status
      const { online, message: statusMessage } = body;
      
      if (equipmentId) {
        await supabase
          .from('time_clock_equipment')
          .update({
            is_online: online,
            last_communication: new Date().toISOString(),
          })
          .eq('id', equipmentId);

        await supabase
          .from('equipment_communication_logs')
          .insert({
            equipment_id: equipmentId,
            status: online ? 'success' : 'error',
            message: statusMessage || (online ? 'Online' : 'Offline'),
            request_type: 'agent_status_update',
          });
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'receive_records') {
      // Receive records sent by the cloud communicator agent
      const { records: rawRecords } = body;
      
      if (!equipmentId) {
        throw new Error('equipmentId is required for receive_records');
      }

      // Get equipment info
      const { data: equipment } = await supabase
        .from('time_clock_equipment')
        .select('id, manufacturer, company_id')
        .eq('id', equipmentId)
        .single();

      if (!equipment) throw new Error('Equipment not found');

      let recordsSynced = 0;
      
      // Parse and insert records
      const parsedRecords = typeof rawRecords === 'string' 
        ? parseRecords(equipment.manufacturer, rawRecords)
        : (Array.isArray(rawRecords) ? rawRecords : []);

      for (const record of parsedRecords) {
        const identifier = record.identifier || record.employee_id || record.pis || '';
        const recordedAt = record.recordedAt || record.recorded_at || record.timestamp;
        
        if (!identifier || !recordedAt) continue;

        const { error: insertError } = await supabase
          .from('equipment_pending_records')
          .insert({
            equipment_id: equipmentId,
            employee_identifier: String(identifier),
            recorded_at: new Date(recordedAt).toISOString(),
            record_type: record.recordType || record.type || null,
            company_id: equipment.company_id,
          });

        if (!insertError) recordsSynced++;
      }

      // Update equipment last_sync
      await supabase
        .from('time_clock_equipment')
        .update({
          is_online: true,
          last_sync: new Date().toISOString(),
          last_communication: new Date().toISOString(),
        })
        .eq('id', equipmentId);

      // Log
      await supabase
        .from('equipment_communication_logs')
        .insert({
          equipment_id: equipmentId,
          company_id: equipment.company_id,
          status: 'success',
          message: `Agent sent ${recordsSynced} records`,
          request_type: 'agent_receive_records',
          records_synced: recordsSynced,
        });

      // Process pending records
      const processResult = await processPendingRecords(supabase);

      return new Response(
        JSON.stringify({ 
          success: true, 
          records_synced: recordsSynced,
          records_processed: processResult.processed,
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
