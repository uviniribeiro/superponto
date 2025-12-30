import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { selfieBase64, registeredPhotoUrl } = await req.json();

    if (!selfieBase64 || !registeredPhotoUrl) {
      console.error("Missing required fields:", { hasSelfie: !!selfieBase64, hasPhoto: !!registeredPhotoUrl });
      return new Response(
        JSON.stringify({ 
          error: "Dados incompletos. É necessário a selfie e a foto cadastrada.",
          isMatch: false,
          confidence: 0
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ 
          error: "Serviço de validação não configurado",
          isMatch: false,
          confidence: 0
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Fetching registered photo from:", registeredPhotoUrl);
    
    // Fetch the registered photo and convert to base64
    let registeredPhotoBase64: string;
    try {
      const photoResponse = await fetch(registeredPhotoUrl);
      if (!photoResponse.ok) {
        throw new Error(`Failed to fetch photo: ${photoResponse.status}`);
      }
      const photoBlob = await photoResponse.arrayBuffer();
      const photoBytes = new Uint8Array(photoBlob);
      registeredPhotoBase64 = btoa(String.fromCharCode(...photoBytes));
    } catch (error) {
      console.error("Error fetching registered photo:", error);
      return new Response(
        JSON.stringify({ 
          error: "Não foi possível obter a foto cadastrada do funcionário",
          isMatch: false,
          confidence: 0
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Sending images to AI for face comparison...");

    // Use Gemini with vision to compare faces
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é um sistema de validação facial para controle de ponto. Sua tarefa é comparar duas fotos e determinar se são da mesma pessoa.

Analise criteriosamente:
1. Estrutura facial (formato do rosto, queixo, testa)
2. Olhos (formato, distância entre eles)
3. Nariz (formato e tamanho)
4. Boca e lábios
5. Orelhas (se visíveis)
6. Sobrancelhas

Responda APENAS em formato JSON válido com a seguinte estrutura:
{
  "isMatch": boolean,
  "confidence": number (0-100),
  "reason": "string com explicação breve"
}

IMPORTANTE: 
- isMatch deve ser true apenas se você tiver pelo menos 75% de certeza de que é a mesma pessoa
- Considere diferenças de iluminação, ângulo e expressão facial
- Se não conseguir detectar um rosto claro em alguma das imagens, retorne isMatch: false com confidence: 0`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Compare as duas fotos abaixo. A primeira é a foto cadastrada do funcionário e a segunda é a selfie tirada agora no registro de ponto. Determine se são da mesma pessoa."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${registeredPhotoBase64}`
                }
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${selfieBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.1
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ 
            error: "Serviço temporariamente indisponível. Tente novamente em alguns segundos.",
            isMatch: false,
            confidence: 0
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ 
            error: "Créditos de IA insuficientes. Contate o administrador.",
            isMatch: false,
            confidence: 0
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ 
          error: "Erro no serviço de validação facial",
          isMatch: false,
          confidence: 0
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();
    console.log("AI response:", JSON.stringify(result));

    const content = result.choices?.[0]?.message?.content;
    if (!content) {
      console.error("No content in AI response");
      return new Response(
        JSON.stringify({ 
          error: "Resposta inválida do serviço de validação",
          isMatch: false,
          confidence: 0
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse the JSON response from the AI
    let validationResult;
    try {
      // Try to extract JSON from the response (it might have markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        validationResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError, "Content:", content);
      return new Response(
        JSON.stringify({ 
          error: "Erro ao processar validação facial",
          isMatch: false,
          confidence: 0
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Face validation result:", validationResult);

    return new Response(
      JSON.stringify({
        isMatch: validationResult.isMatch === true,
        confidence: validationResult.confidence || 0,
        reason: validationResult.reason || ""
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Face validation error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Erro desconhecido",
        isMatch: false,
        confidence: 0
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
