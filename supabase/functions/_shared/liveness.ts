// Prova de vida (antifraude): duas fotos tiradas com ~1 s de intervalo, a segunda depois de um desafio
// aleatório pedido na tela (virar o rosto, aproximar…). Detecta foto impressa, tela de celular e vídeo
// parado. Roda em paralelo à comparação do rosto, sem atrasar o registro.
import { aiChat, aiConfig } from "./ai.ts";

export const CHALLENGES: Record<string, string> = {
  left: 'virar levemente o rosto para a ESQUERDA da pessoa',
  right: 'virar levemente o rosto para a DIREITA da pessoa',
  closer: 'aproximar o rosto da câmera (rosto maior na segunda foto)',
  up: 'levantar levemente o queixo',
};

const asUrl = (v: string) => (v.startsWith('data:') ? v : `data:image/jpeg;base64,${v}`);

export interface LivenessResult { checked: boolean; live: boolean; spoof: boolean; performed: boolean; confidence: number }

export async function checkLiveness(first: string, second: string | undefined, challenge: string | undefined): Promise<LivenessResult> {
  const ai = aiConfig();
  if (!second || !ai) return { checked: false, live: true, spoof: false, performed: true, confidence: 0 };
  const task = CHALLENGES[challenge ?? ''] ?? 'mexer levemente o rosto';
  const res = await aiChat(ai, {
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: `Prova de vida em terminal de ponto. A PRIMEIRA foto foi tirada e, cerca de 1 segundo depois, foi pedido à pessoa para ${task}; a SEGUNDA foto foi tirada em seguida. Avalie: (1) é a mesma pessoa real nas duas fotos; (2) há sinais de fraude — foto impressa, tela de celular/monitor, moldura, reflexo de tela, imagem idêntica nas duas fotos, máscara; (3) a pessoa realizou o pedido. Responda apenas com JSON: {"live": true|false, "spoof": true|false, "performed": true|false, "confidence": <0 a 100>}` },
        { type: 'image_url', image_url: { url: asUrl(first) } },
        { type: 'image_url', image_url: { url: asUrl(second) } },
      ],
    }],
  });
  if (!res.ok) return { checked: false, live: true, spoof: false, performed: true, confidence: 0 }; // falha do serviço não bloqueia o ponto
  const text = (await res.json())?.choices?.[0]?.message?.content ?? '';
  const m = /\{[\s\S]*\}/.exec(text);
  let p: Partial<LivenessResult> = {};
  try { p = m ? JSON.parse(m[0]) : {}; } catch { p = {}; }
  return { checked: true, live: p.live !== false, spoof: p.spoof === true, performed: p.performed !== false, confidence: Number(p.confidence || 0) };
}

/** Recusa só com fraude clara (evita barrar quem é real); desafio não feito pede nova tentativa. */
export function livenessVerdict(r: LivenessResult): 'ok' | 'spoof' | 'retry' {
  if (!r.checked) return 'ok';
  if ((r.spoof || !r.live) && r.confidence >= 70) return 'spoof';
  if (!r.performed && r.confidence >= 70) return 'retry';
  return 'ok';
}
