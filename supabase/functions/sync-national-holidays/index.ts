import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Brazilian national holidays - fixed dates
const getFixedHolidays = (year: number) => [
  { name: 'Confraternização Universal', date: `${year}-01-01`, is_recurring: true, holiday_type: 'full', is_partial: false },
  { name: 'Tiradentes', date: `${year}-04-21`, is_recurring: true, holiday_type: 'full', is_partial: false },
  { name: 'Dia do Trabalho', date: `${year}-05-01`, is_recurring: true, holiday_type: 'full', is_partial: false },
  { name: 'Independência do Brasil', date: `${year}-09-07`, is_recurring: true, holiday_type: 'full', is_partial: false },
  { name: 'Nossa Senhora Aparecida', date: `${year}-10-12`, is_recurring: true, holiday_type: 'full', is_partial: false },
  { name: 'Finados', date: `${year}-11-02`, is_recurring: true, holiday_type: 'full', is_partial: false },
  { name: 'Proclamação da República', date: `${year}-11-15`, is_recurring: true, holiday_type: 'full', is_partial: false },
  { name: 'Natal', date: `${year}-12-25`, is_recurring: true, holiday_type: 'full', is_partial: false },
];

// Calculate Easter Sunday using Anonymous Gregorian algorithm
const calculateEaster = (year: number): Date => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  
  return new Date(year, month - 1, day);
};

// Get mobile holidays based on Easter
const getMobileHolidays = (year: number) => {
  const easter = calculateEaster(year);
  
  const addDays = (date: Date, days: number): Date => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  };

  const formatDate = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const carnival = addDays(easter, -47); // Carnival Tuesday (47 days before Easter)
  const carnivalMonday = addDays(easter, -48);
  const goodFriday = addDays(easter, -2);
  const corpusChristi = addDays(easter, 60);

  return [
    { 
      name: 'Carnaval', 
      date: formatDate(carnivalMonday), 
      end_date: formatDate(carnival),
      is_recurring: false, 
      holiday_type: 'extended', 
      is_partial: false 
    },
    { 
      name: 'Quarta-feira de Cinzas', 
      date: formatDate(addDays(easter, -46)), 
      is_recurring: false, 
      holiday_type: 'partial', 
      is_partial: true,
      partial_end_time: '12:00'
    },
    { 
      name: 'Sexta-feira Santa', 
      date: formatDate(goodFriday), 
      is_recurring: false, 
      holiday_type: 'full', 
      is_partial: false 
    },
    { 
      name: 'Páscoa', 
      date: formatDate(easter), 
      is_recurring: false, 
      holiday_type: 'full', 
      is_partial: false 
    },
    { 
      name: 'Corpus Christi', 
      date: formatDate(corpusChristi), 
      is_recurring: false, 
      holiday_type: 'full', 
      is_partial: false 
    },
  ];
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Determine which year to sync
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();
    
    // On Dec 31 or Jan 1, sync next year's holidays
    // Otherwise sync current year (for manual triggers)
    let targetYear = now.getFullYear();
    if (currentMonth === 12 && currentDay === 31) {
      targetYear = now.getFullYear() + 1;
    } else if (currentMonth === 1 && currentDay === 1) {
      targetYear = now.getFullYear();
    }

    // Allow override via request body
    let body: { year?: number; company_id?: string } = {};
    try {
      body = await req.json();
      if (body.year) {
        targetYear = body.year;
      }
    } catch {
      // No body provided, use default
    }

    console.log(`Syncing national holidays for year: ${targetYear}`);

    // Get all holidays for the target year
    const fixedHolidays = getFixedHolidays(targetYear);
    const mobileHolidays = getMobileHolidays(targetYear);
    const allHolidays = [...fixedHolidays, ...mobileHolidays];

    // Get existing holidays for the year
    const startOfYear = `${targetYear}-01-01`;
    const endOfYear = `${targetYear}-12-31`;
    
    const { data: existingHolidays, error: fetchError } = await supabase
      .from('holidays')
      .select('date, name')
      .gte('date', startOfYear)
      .lte('date', endOfYear);

    if (fetchError) {
      throw fetchError;
    }

    const existingDates = new Set((existingHolidays || []).map(h => h.date));
    const existingNames = new Set((existingHolidays || []).map(h => h.name));

    // Filter out holidays that already exist (by date or name)
    const newHolidays = allHolidays.filter(h => 
      !existingDates.has(h.date) && !existingNames.has(h.name)
    );

    if (newHolidays.length === 0) {
      console.log('All national holidays already registered for this year');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Todos os feriados nacionais já estão cadastrados',
          year: targetYear,
          inserted: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare holidays for insertion
    const holidaysToInsert = newHolidays.map(h => ({
      ...h,
      company_id: body.company_id || null,
    }));

    // Insert new holidays
    const { error: insertError } = await supabase
      .from('holidays')
      .insert(holidaysToInsert);

    if (insertError) {
      throw insertError;
    }

    console.log(`Successfully inserted ${newHolidays.length} national holidays for ${targetYear}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${newHolidays.length} feriados nacionais cadastrados para ${targetYear}`,
        year: targetYear,
        inserted: newHolidays.length,
        holidays: newHolidays.map(h => h.name)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error syncing national holidays:', errorMessage);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
