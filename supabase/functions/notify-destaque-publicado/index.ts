// Edge Function: notify-destaque-publicado
// Triggered when the "Destaque da Partida" is published after sumula completion
// Notifies: the highlighted player AND both directors

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DestaquePublicadoPayload {
  partida_id: string;
  jogador_destaque_id: string;
  time_destaque_id: string;
  time_casa_id: string;
  time_visitante_id: string;
  nota_media: number; // average rating given by the opposing team
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
    const payload: DestaquePublicadoPayload = await req.json();
    const {
      partida_id,
      jogador_destaque_id,
      time_destaque_id,
      time_casa_id,
      time_visitante_id,
      nota_media,
    } = payload;

    // Fetch destaque player profile
    const { data: jogador, error: jogadorError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", jogador_destaque_id)
      .single();

    if (jogadorError || !jogador) {
      throw new Error(`Player not found: ${jogadorError?.message}`);
    }

    // Fetch both teams + directors
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

    const timeCasa = teams.find((t) => t.id === time_casa_id);
    const timeVisitante = teams.find((t) => t.id === time_visitante_id);
    const timeDestaque = teams.find((t) => t.id === time_destaque_id);
    const adversarioDoDestaque = teams.find((t) => t.id !== time_destaque_id);

    const partidaLink = `https://liga-metropole-digital.vercel.app/partidas/${partida_id}`;
    const logIds: string[] = [];

    // 1. Notify the highlighted PLAYER
    if (jogador.email) {
      const assunto = `⭐ Parabéns! Você foi o Destaque da Partida!`;
      const corpo = `
Olá, ${jogador.full_name}!

Parabéns! 🎉 Você foi eleito o **Destaque da Partida** pelo time adversário!

🏆 Nota recebida: **${nota_media.toFixed(1)}/10**
👥 Time: ${timeDestaque?.name}
🆚 Adversário: ${adversarioDoDestaque?.name}

Seu destaque já está publicado na página da partida:
${partidaLink}

Continue se superando! ⭐

Liga Metrópole Digital
      `.trim();

      const { data: logEntry } = await supabaseAdmin
        .from("notificacoes_log")
        .insert({
          tipo: "destaque_publicado",
          canal: "email",
          destinatario_id: jogador.id,
          destinatario_email: jogador.email,
          destinatario_nome: jogador.full_name,
          assunto,
          corpo_preview: corpo.substring(0, 200),
          status: "pendente",
          payload: { partida_id, jogador_destaque_id, time_destaque_id, nota_media },
          whatsapp_template: "destaque_publicado_jogador_v1",
        })
        .select("id")
        .single();

      const logId = logEntry?.id;
      if (logId) logIds.push(logId);

      const { error: emailError } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: jogador.email,
        options: {
          data: {
            notification_type: "destaque_publicado",
            role: "jogador",
            nota_media,
            partida_id,
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

    // 2. Notify BOTH directors
    for (const team of [timeCasa, timeVisitante]) {
      if (!team) continue;
      const director = (team as any).profiles;
      if (!director?.email) continue;

      const adversario = team.id === time_casa_id ? timeVisitante : timeCasa;
      const assunto = `⭐ Destaque da Partida Publicado — ${team.name} x ${adversario?.name}`;
      const corpo = `
Olá, ${director.full_name}!

O destaque da partida **${team.name} x ${adversario?.name}** foi publicado!

⭐ **Destaque:** ${jogador.full_name}
👥 **Time:** ${timeDestaque?.name}
📊 **Nota:** ${nota_media.toFixed(1)}/10

Ver partida completa: ${partidaLink}

Liga Metrópole Digital
      `.trim();

      const { data: logEntry } = await supabaseAdmin
        .from("notificacoes_log")
        .insert({
          tipo: "destaque_publicado",
          canal: "email",
          destinatario_id: director.id,
          destinatario_email: director.email,
          destinatario_nome: director.full_name,
          assunto,
          corpo_preview: corpo.substring(0, 200),
          status: "pendente",
          payload: { partida_id, jogador_destaque_id, time_destaque_id, nota_media },
          whatsapp_template: "destaque_publicado_diretor_v1",
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
            notification_type: "destaque_publicado",
            role: "diretor",
            jogador_nome: jogador.full_name,
            nota_media,
            partida_id,
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
      JSON.stringify({ success: true, log_ids: logIds, notifications_sent: logIds.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("notify-destaque-publicado error:", msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
