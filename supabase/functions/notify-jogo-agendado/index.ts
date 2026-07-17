// Edge Function: notify-jogo-agendado
// Triggered when a match is scheduled
// Sends email to both directors with match details

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface JogoAgendadoPayload {
  partida_id: string;
  time_casa_id: string;
  time_visitante_id: string;
  data_hora: string;
  local: string;
  rodada?: string;
  competicao_nome?: string;
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
    const payload: JogoAgendadoPayload = await req.json();
    const { partida_id, time_casa_id, time_visitante_id, data_hora, local, rodada, competicao_nome } = payload;

    // Fetch both teams with their directors
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

    if (teamsError || !teams || teams.length < 2) {
      throw new Error(`Teams not found: ${teamsError?.message}`);
    }

    const timeCasa = teams.find((t) => t.id === time_casa_id);
    const timeVisitante = teams.find((t) => t.id === time_visitante_id);

    if (!timeCasa || !timeVisitante) {
      throw new Error("Could not identify home/away teams");
    }

    const dataFormatada = new Date(data_hora).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      dateStyle: "full",
      timeStyle: "short",
    });

    const partidaLink = `https://liga-metropole-digital.vercel.app/partidas/${partida_id}`;
    const sumulaLink = `https://liga-metropole-digital.vercel.app/sumula/${partida_id}`;

    const directorsToNotify = [
      { team: timeCasa, adversario: timeVisitante, mando: "Casa" },
      { team: timeVisitante, adversario: timeCasa, mando: "Visitante" },
    ];

    const logIds: string[] = [];

    for (const { team, adversario, mando } of directorsToNotify) {
      const director = (team as any).profiles;
      if (!director?.email) continue;

      const assunto = `📅 Jogo Agendado — ${team.name} x ${adversario.name}`;
      const corpo = `
Olá, ${director.full_name}!

Um novo jogo foi agendado para o seu time **${team.name}**.

🏟️ **Detalhes da Partida:**
- 🆚 Adversário: ${adversario.name}
- 📍 Local: ${local}
- 📅 Data e Hora: ${dataFormatada}
- 🎯 Mando: ${mando}
${rodada ? `- 🔢 Rodada: ${rodada}` : ""}
${competicao_nome ? `- 🏆 Competição: ${competicao_nome}` : ""}

📋 Após a partida, você terá 72h para preencher a súmula digital:
${sumulaLink}

Ver detalhes completos: ${partidaLink}

Liga Metrópole Digital
      `.trim();

      const { data: logEntry } = await supabaseAdmin
        .from("notificacoes_log")
        .insert({
          tipo: "jogo_agendado",
          canal: "email",
          destinatario_id: director.id,
          destinatario_email: director.email,
          destinatario_nome: director.full_name,
          assunto,
          corpo_preview: corpo.substring(0, 200),
          status: "pendente",
          payload: { partida_id, time_casa_id, time_visitante_id, data_hora, local, mando },
          whatsapp_template: "jogo_agendado_v1",
        })
        .select("id")
        .single();

      const logId = logEntry?.id;
      if (logId) logIds.push(logId);

      // Send email via Supabase (using admin generateLink as notification trigger)
      // In production, replace with custom SMTP for full HTML email
      const { error: emailError } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: director.email,
        options: {
          data: {
            notification_type: "jogo_agendado",
            partida_id,
            assunto,
            corpo_preview: corpo.substring(0, 500),
          },
          redirectTo: partidaLink,
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
      JSON.stringify({ success: true, log_ids: logIds }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("notify-jogo-agendado error:", msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
