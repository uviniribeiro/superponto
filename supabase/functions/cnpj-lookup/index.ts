import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CNPJData {
  razao_social: string;
  nome_fantasia: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  telefone: string;
  situacao: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cnpj } = await req.json();
    
    if (!cnpj) {
      return new Response(
        JSON.stringify({ error: 'CNPJ é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normaliza mantendo letras (CNPJ alfanumérico — Receita Federal 2026)
    const normalized = String(cnpj).toUpperCase().replace(/[^0-9A-Z]/g, '');

    if (normalized.length !== 14 || !/^[0-9A-Z]{12}\d{2}$/.test(normalized)) {
      return new Response(
        JSON.stringify({ error: 'CNPJ deve ter 14 caracteres (12 alfanuméricos + 2 dígitos)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (/[A-Z]/.test(normalized)) {
      return new Response(
        JSON.stringify({ error: 'CNPJ alfanumérico ainda não é consultável nas bases públicas. Preencha os dados manualmente.' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanCnpj = normalized;

    console.log(`Looking up CNPJ: ${cleanCnpj}`);

    // Call ReceitaWS API
    const response = await fetch(`https://receitaws.com.br/v1/cnpj/${cleanCnpj}`, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('ReceitaWS API error:', response.status);
      return new Response(
        JSON.stringify({ error: 'Erro ao consultar CNPJ. Tente novamente.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();

    if (data.status === 'ERROR') {
      console.error('CNPJ not found:', data.message);
      return new Response(
        JSON.stringify({ error: data.message || 'CNPJ não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format address
    const addressParts = [
      data.logradouro,
      data.numero,
      data.complemento,
      data.bairro
    ].filter(Boolean);
    
    const fullAddress = addressParts.join(', ');

    const result = {
      razao_social: data.nome || '',
      nome_fantasia: data.fantasia || '',
      address: fullAddress,
      city: data.municipio || '',
      state: data.uf || '',
      cep: data.cep || '',
      phone: data.telefone || '',
      situacao: data.situacao || '',
    };

    console.log('CNPJ lookup successful:', result.razao_social);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in cnpj-lookup:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno ao consultar CNPJ' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
