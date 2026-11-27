// Comparação facial 1:1 para servidores internos (API da v2): recebe a foto tirada no terminal e a foto
// do cadastro e responde se são a mesma pessoa. Protegida por segredo compartilhado (FACE_VERIFY_SECRET).
import { aiChat, aiConfig } from "../_shared/ai.ts";
import { checkLiveness, livenessVerdict } from "../_shared/liveness.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function safeEqual(a: string, b: string) {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const asDataUrl = (v: string) => (v.startsWith('data:') || v.startsWith('https://') ? v : `data:image/jpeg;base64,${v}`);

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const secret = Deno.env.get('FACE_VERIFY_SECRET') ?? '';
  if (!secret || !safeEqual(req.headers.get('x-face-secret') ?? '', secret)) return json({ error: 'unauthorized' }, 401);
  try {
    const payload = await req.json();
    const { selfie, reference } = payload;
    // Prova de vida em paralelo (segunda foto após um desafio aleatório)
    const livenessP = typeof selfie === 'string' && typeof payload.selfie2 === 'string'
      ? checkLiveness(selfie, payload.selfie2, payload.challenge).then(livenessVerdict)
      : Promise.resolve('ok' as const);
    // Modo 1:N: { selfie, references: [{ id, image }] } → qual cadastro é a pessoa (ou nenhum).
    if (Array.isArray(payload.references)) {
      const refs = (payload.references as Array<{ id: string; image: string }>).filter((r) => typeof r?.image === 'string' && r.image.length < 2_000_000).slice(0, 40);
      if (typeof selfie !== 'string' || !refs.length) return json({ error: 'imagens inválidas' }, 400);
      const ai1 = aiConfig();
      if (!ai1) return json({ error: 'verificação facial indisponível' }, 503);
      const content: unknown[] = [
        { type: 'text', text: `Identificação 1:N. A PRIMEIRA imagem é a pessoa diante do terminal; as ${refs.length} seguintes são fotos de cadastro numeradas a partir de 1. Qual delas é a mesma pessoa? Considere apenas traços faciais. Se não houver rosto nítido na primeira imagem, responda face=false. Responda apenas com JSON: {"face": true|false, "index": <número da foto ou 0 se nenhuma>, "confidence": <0 a 100>}` },
        { type: 'image_url', image_url: { url: asDataUrl(selfie) } },
        ...refs.map((r) => ({ type: 'image_url', image_url: { url: asDataUrl(r.image) } })),
      ];
      const res1 = await aiChat(ai1, { messages: [{ role: 'user', content }] });
      if (!res1.ok) {
        console.error('face-verify 1:N ai error', res1.status, await res1.text());
        return json({ error: 'falha na verificação' }, 502);
      }
      const t1 = (await res1.json())?.choices?.[0]?.message?.content ?? '';
      const m1 = /\{[\s\S]*\}/.exec(t1);
      let q: { face?: boolean; index?: number; confidence?: number } = {};
      try { q = m1 ? JSON.parse(m1[0]) : {}; } catch { q = {}; }
      const i = Number(q.index || 0);
      return json({ face: q.face !== false, id: i >= 1 && i <= refs.length ? refs[i - 1].id : null, confidence: Number(q.confidence || 0), liveness: await livenessP });
    }
    if (typeof selfie !== 'string' || typeof reference !== 'string' || selfie.length > 2_000_000 || reference.length > 2_000_000) {
      return json({ error: 'imagens inválidas' }, 400);
    }
    const ai = aiConfig();
    if (!ai) return json({ error: 'verificação facial indisponível' }, 503);
    const res = await aiChat(ai, {
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'Verificação de identidade 1:1. A PRIMEIRA imagem é a pessoa diante do terminal agora; a SEGUNDA é a foto do cadastro. São a mesma pessoa? Considere apenas traços faciais (ignore iluminação, óculos, barba e fundo). Se não houver rosto nítido na primeira imagem, responda face=false. Responda apenas com JSON: {"face": true|false, "same": true|false, "confidence": <0 a 100>}' },
          { type: 'image_url', image_url: { url: asDataUrl(selfie) } },
          { type: 'image_url', image_url: { url: asDataUrl(reference) } },
        ],
      }],
    });
    if (!res.ok) {
      console.error('face-verify ai error', res.status, await res.text());
      return json({ error: 'falha na verificação' }, 502);
    }
    const text = (await res.json())?.choices?.[0]?.message?.content ?? '';
    const m = /\{[\s\S]*\}/.exec(text);
    let p: { face?: boolean; same?: boolean; confidence?: number } = {};
    try { p = m ? JSON.parse(m[0]) : {}; } catch { p = {}; }
    return json({ face: p.face !== false, same: !!p.same, confidence: Number(p.confidence || 0), liveness: await livenessP });
  } catch (e) {
    console.error('face-verify error', e);
    return json({ error: 'erro interno' }, 500);
  }
});
