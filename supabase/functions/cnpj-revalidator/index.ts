import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { revalidate } from "../_shared/cnpjRevalidate.ts";


import { getCorsHeaders } from "../_shared/cors.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    let dryRun = false;
    try { dryRun = Boolean((await req.json())?.dryRun); } catch { /* sem corpo */ }

    const outcomes = await revalidate(supabase, dryRun);

    return json({
      success: true,
      dryRun,
      total: outcomes.length,
      corrected: outcomes.filter(o => o.action === 'corrected').length,
      normalized: outcomes.filter(o => o.action === 'normalized').length,
      flagged: outcomes.filter(o => o.action === 'flagged').length,
      outcomes,
    });
  } catch (e) {
    console.error('cnpj-revalidator error', e);
    return json({ success: false, error: 'Falha ao revalidar CNPJs.' }, 500);
  }
});
