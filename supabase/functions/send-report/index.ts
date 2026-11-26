// Envia um relatório gerado no navegador por e-mail (anexo). Só para administradores e gestores.
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { guardRoles } from "../_shared/auth.ts";

const MAX = 8 * 1024 * 1024;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const denied = await guardRoles(req, ["admin", "manager", "super_admin"], cors);
  if (denied) return denied;
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return json({ error: "Envio de e-mail não configurado (RESEND_API_KEY)." }, 503);
  const b = await req.json().catch(() => null);
  const to: string[] = Array.isArray(b?.to) ? b.to.filter((e: unknown) => typeof e === "string" && /^\S+@\S+\.\S+$/.test(e)).slice(0, 20) : [];
  if (!to.length || typeof b?.content !== "string" || typeof b?.filename !== "string") return json({ error: "Dados inválidos" }, 400);
  if (b.content.length * 0.75 > MAX) return json({ error: "Arquivo grande demais" }, 413);
  const filename = String(b.filename).replace(/[^\w.\-]/g, "_").slice(0, 120);
  const title = String(b.title ?? "Relatório").slice(0, 150);
  const r = await new Resend(key).emails.send({
    from: Deno.env.get("MAIL_FROM") ?? "Ponto Max <onboarding@resend.dev>",
    to, subject: `${title}${b.period ? ` — ${String(b.period).slice(0, 40)}` : ""}`,
    html: `<p>Segue em anexo o relatório <b>${esc(title)}</b>${b.period ? ` (${esc(String(b.period))})` : ""}.</p><p style="color:#888">Enviado pelo SuperPonto.</p>`,
    attachments: [{ filename, content: b.content }],
  });
  if ((r as any)?.error) return json({ error: (r as any).error.message ?? "Falha no envio" }, 502);
  return json({ ok: true });
});
