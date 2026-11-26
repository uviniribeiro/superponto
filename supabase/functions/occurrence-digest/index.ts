// E-mails agendados com as ocorrências do dia anterior (tabela notification_schedules). Chamada de hora
// em hora pelo agendador; envia os agendamentos ativos do dia da semana e da hora atuais (Brasília) que
// ainda não foram enviados hoje.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { guardRoles } from "../_shared/auth.ts";

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return (h || 0) * 60 + (m || 0); };
const brt = (d: Date) => new Date(d.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const denied = await guardRoles(req, ["super_admin"], cors);
  if (denied) return denied;

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const now = brt(new Date());
  const today = now.toLocaleDateString("sv-SE");
  const yest = new Date(now.getTime() - 86_400_000);
  const day = yest.toLocaleDateString("sv-SE");
  const { data: schedules } = await db.from("notification_schedules").select("*").eq("is_active", true).eq("send_hour", now.getHours());
  const due = (schedules ?? []).filter((s: any) => s.weekdays.includes(now.getDay()) && (!s.last_sent_at || brt(new Date(s.last_sent_at)).toLocaleDateString("sv-SE") !== today));
  let sent = 0;

  for (const s of due) {
    const { data: people } = await db.from("profiles").select("id, full_name, registration_number").eq("company_id", s.company_id).eq("is_active", true);
    const ids = (people ?? []).map((p: any) => p.id);
    if (!ids.length) continue;
    const start = new Date(`${day}T00:00:00-03:00`).toISOString(), end = new Date(`${day}T23:59:59-03:00`).toISOString();
    const [{ data: recs }, { data: sch }, { data: abs }] = await Promise.all([
      db.from("time_records").select("profile_id, record_type, recorded_at").in("profile_id", ids).gte("recorded_at", start).lte("recorded_at", end).order("recorded_at"),
      db.from("employee_schedules").select("profile_id, start_date, end_date, work_schedules(*)").in("profile_id", ids),
      db.from("employee_absences").select("profile_id").in("profile_id", ids).eq("status", "approved").lte("start_date", day).gte("end_date", day),
    ]);
    const lines: string[] = [];
    for (const p of people ?? []) {
      const ws: any = (sch ?? []).find((x: any) => x.profile_id === p.id && x.start_date <= day && (!x.end_date || x.end_date >= day))?.work_schedules;
      const dow = DAYS[yest.getDay()];
      const startT = ws?.[`${dow}_start`], endT = ws?.[`${dow}_end`];
      const mine = (recs ?? []).filter((r: any) => r.profile_id === p.id);
      const who = `${esc(p.full_name)}${p.registration_number ? ` (${esc(p.registration_number)})` : ""}`;
      if ((abs ?? []).some((a: any) => a.profile_id === p.id)) continue;
      if (startT && endT && !mine.length) { if (s.occurrences.includes("absence")) lines.push(`<li><b>Falta</b> — ${who}</li>`); continue; }
      const entry = mine.find((r: any) => r.record_type === "entry");
      const exit = [...mine].reverse().find((r: any) => r.record_type === "exit");
      if (s.occurrences.includes("late") && startT && entry) {
        const t = brt(new Date(entry.recorded_at)); const late = t.getHours() * 60 + t.getMinutes() - toMin(startT) - Number(ws?.tolerance_minutes ?? 10);
        if (late > 0) lines.push(`<li><b>Atraso</b> de ${late} min — ${who}</li>`);
      }
      if (s.occurrences.includes("incomplete") && !!entry !== !!exit) lines.push(`<li><b>Marcação incompleta</b> — ${who}</li>`);
      if (s.occurrences.includes("break")) {
        const bs = mine.find((r: any) => r.record_type === "break_start"), be = mine.find((r: any) => r.record_type === "break_end");
        const min = Number(ws?.intrajornada_minutes ?? 60);
        if (bs && be) { const b = (Date.parse(be.recorded_at) - Date.parse(bs.recorded_at)) / 60000; if (b < min) lines.push(`<li><b>Intervalo curto</b> (${Math.round(b)} de ${min} min) — ${who}</li>`); }
      }
    }
    const html = `<h2>Ocorrências de ${day.split("-").reverse().join("/")}</h2>${lines.length ? `<ul>${lines.join("")}</ul>` : "<p>Nenhuma ocorrência. 🎉</p>"}<p style="color:#888">${esc(s.name)} — SuperPonto</p>`;
    if (resendKey) {
      await new Resend(resendKey).emails.send({ from: Deno.env.get("MAIL_FROM") ?? "Ponto Max <onboarding@resend.dev>", to: s.emails, subject: `Ocorrências de ${day.split("-").reverse().join("/")} — ${s.name}`, html });
      sent++;
    }
    await db.from("notification_schedules").update({ last_sent_at: new Date().toISOString() }).eq("id", s.id);
  }
  return new Response(JSON.stringify({ due: due.length, sent, emailConfigured: !!resendKey }), { headers: { ...cors, "Content-Type": "application/json" } });
});
