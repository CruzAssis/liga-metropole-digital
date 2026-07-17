// Edge Function: notify-sumula-prazo-alerta
// Triggered ~24h before the 72h sumula deadline expires
// Alerts directors who have NOT yet filled in their part of the sumula
// This function should be called by a scheduled cron or database trigger

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PrazoAlertaPayload {
  partida_id: string;
  time_casa_id: string;
  time_visitante_id: string;
  prazo_iso: string;
  // Which teams have NOT yet filled (can be one or both)
  times_pendentes: string[]; // array of team_ids
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const provided = req.headers.get("x-notify-secret") ?? "";
  const expected = Deno.env.get("NOTIFY_SECRET") ?? "";
  if (!expected || provided.length !== expected.length || provided !== expected) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const payload: PrazoAlertaPayload = await req.json();
    const { partida_id, time_casa_id, time_visitante_id, prazo_iso, times_pendentes } = payload;

    if (!times_pendentes || times_pendentes.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No pending teams, no alerts needed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: teams, error: teamsError } = await supabaseAdmin
      .from("teams")
      .select(`
        id,
        name,
        profiles!teams_director_id_fkey (
          id,
          full_name,
          email
        )
      `)
      .in("id", [time_casa_id, time_visitante_id]);

    if (teamsError || !teams) {
      throw new Error(`Teams not found: ${teamsError?.message}`);
    }

    const sumulaLink = `https://liga-metropole-digital.vercel.app/sumula/${partida_id}`;
    const prazoDate = new Date(prazo_iso);
    const prazoFormatado = prazoDate.toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      dateStyle: "full",
      timeStyle: "short",
    });

    const horasRestantes = Math.max(
      0,
      Math.round((prazoDate.getTime() - Date.now()) / (1000 * 60 * 60))
    );

    const timeCasa = teams.find((t) => t.id === time_casa_id);
    const timeVisitante = teams.find((t) => t.id === time_visitante_id);

    const logIds: string[] = [];

    for (const teamId of times_pendentes) {
      const team = teams.find((t) => t.id === teamId);
      if (!team) continue;

      const director = (team as any).profiles;
      if (!director?.email) continue;

      const adversario = team.id === time_casa_id ? timeVisitante : timeCasa;

      const assunto = `⚠️ URGENTE — Prazo da Súmula expira em ${horasRestantes}h!`;
      const corpo = `
Olá, ${director.full_name}!

⚠️ ATENÇÃO: O prazo para preencher a súmula da partida **${team.name} x ${adversario?.name}** está se esgotando!

⏰ Tempo restante: aproximadamente ${horasRestantes} horas
📅 Prazo final: ${prazoFormatado}

Se a súmula não for preenchida pelo seu time até o prazo, o resultado será registrado como W.O. automaticamente.

👉 Preencher agora: ${sumulaLink}

Não deixe para a última hora! 🚨

Liga Metrópole Digital
      `.trim();

      const { data: logEntry } = await supabaseAdmin
        .from("notificacoes_log")
        .insert({
          tipo: "sumula_prazo_alerta",
          canal: "email",
          destinatario_id: director.id,
          destinatario_email: director.email,
          destinatario_nome: director.full_name,
          assunto,
          corpo_preview: corpo.substring(0, 200),
          status: "pendente",
          payload: { partida_id, time_id: teamId, prazo_iso, horas_restantes: horasRestantes },
          whatsapp_template: "sumula_prazo_alerta_v1",
        })
        .select("id")
        .single();

      const logId = logEntry?.id;
      if (logId) logIds.push(logId);

      const { error: emailError } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: director.email,
        options: {
          data: {
            notification_type: "sumula_prazo_alerta",
            partida_id,
            horas_restantes: horasRestantes,
            prazo: prazoFormatado,
          },
          redirectTo: sumulaLink,
        },
      });

      await supabaseAdmin
        .from("notificacoes_log")
        .update(
          emailError
            ? { status: "falhou", erro_mensagem: emailError.message }
            : { status: "enviado", enviado_em: new Date().toISOString() }
        )
        .eq("id", logId);
    }

    return new Response(
      JSON.stringify({ success: true, log_ids: logIds, alerts_sent: logIds.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("notify-sumula-prazo-alerta error:", msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
