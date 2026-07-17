// Edge Function: notify-sumula-disponivel
// Triggered after a match ends (or is manually triggered by admin)
// Notifies both directors that the sumula is ready to be filled
// Directors have 72h from match time to complete it

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SumulaDisponivelPayload {
  partida_id: string;
  time_casa_id: string;
  time_visitante_id: string;
  data_hora_partida: string;
  prazo_iso: string; // ISO string of 72h deadline
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
    const payload: SumulaDisponivelPayload = await req.json();
    const { partida_id, time_casa_id, time_visitante_id, data_hora_partida, prazo_iso } = payload;

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

    const sumulaLink = `https://liga-metropole-digital.vercel.app/sumula/${partida_id}`;
    const prazoFormatado = new Date(prazo_iso).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      dateStyle: "full",
      timeStyle: "short",
    });
    const dataPartidaFormatada = new Date(data_hora_partida).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      dateStyle: "short",
      timeStyle: "short",
    });

    const timeCasa = teams.find((t) => t.id === time_casa_id);
    const timeVisitante = teams.find((t) => t.id === time_visitante_id);

    const logIds: string[] = [];

    for (const team of [timeCasa, timeVisitante]) {
      if (!team) continue;
      const director = (team as any).profiles;
      if (!director?.email) continue;

      const adversario = team.id === time_casa_id ? timeVisitante : timeCasa;

      const assunto = `📋 Súmula Disponível — ${team.name} x ${adversario?.name} (${dataPartidaFormatada})`;
      const corpo = `
Olá, ${director.full_name}!

A súmula da partida **${team.name} x ${adversario?.name}** está disponível para preenchimento.

⚠️ **Prazo para preenchimento: ${prazoFormatado}**

O que você precisa preencher:
1. 📊 Placar final (apenas Visitante — Etapa 1)
2. ⚽ Autores dos gols e destaque do seu time (Etapa 2)
3. ⭐ Nota para o destaque do time adversário (Etapa 3)

Atenção: Times que não preencherem dentro do prazo receberão W.O. automaticamente.

👉 Preencher agora: ${sumulaLink}

Liga Metrópole Digital
      `.trim();

      const { data: logEntry } = await supabaseAdmin
        .from("notificacoes_log")
        .insert({
          tipo: "sumula_disponivel",
          canal: "email",
          destinatario_id: director.id,
          destinatario_email: director.email,
          destinatario_nome: director.full_name,
          assunto,
          corpo_preview: corpo.substring(0, 200),
          status: "pendente",
          payload: { partida_id, time_casa_id, time_visitante_id, prazo_iso },
          whatsapp_template: "sumula_disponivel_v1",
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
            notification_type: "sumula_disponivel",
            partida_id,
            sumula_link: sumulaLink,
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
      JSON.stringify({ success: true, log_ids: logIds }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("notify-sumula-disponivel error:", msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
