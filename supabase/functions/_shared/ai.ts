// Cliente de IA compatível com a API OpenAI (chat/completions), configurado por variáveis
// de ambiente do servidor. Funciona com Google Gemini, OpenAI ou qualquer provedor compatível.
//
//   AI_API_KEY  chave do provedor (obrigatória para habilitar os recursos de IA)
//   AI_API_URL  endpoint chat/completions (padrão: Google Gemini compatível com OpenAI)
//   AI_MODEL    modelo (padrão: gemini-2.5-flash)

const DEFAULT_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const DEFAULT_MODEL = "gemini-2.5-flash";

export interface AiConfig {
  url: string;
  key: string;
  model: string;
}

export function aiConfig(): AiConfig | null {
  const key = Deno.env.get("AI_API_KEY")?.trim();
  if (!key) return null;
  return {
    url: Deno.env.get("AI_API_URL")?.trim() || DEFAULT_URL,
    key,
    model: Deno.env.get("AI_MODEL")?.trim() || DEFAULT_MODEL,
  };
}

/** Envia uma requisição chat/completions; `body` recebe o modelo configurado automaticamente. */
export function aiChat(config: AiConfig, body: Record<string, unknown>): Promise<Response> {
  return fetch(config.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, model: config.model }),
  });
}
