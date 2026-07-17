// Edge Function: notify-team-approved
// Triggered when admin approves a team
// Sends welcome email to the team's director

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TeamApprovedPayload {
  team_id: string;
  team_name: string;
  director_id: string;
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

  let logId: string | null = null;

  try {
    const payload: TeamApprovedPayload = await req.json();
    const { team_id, team_name, director_id } = payload;

    // Fetch director profile
    const { data: director, error: directorError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", director_id)
      .single();

    if (directorError || !director) {
      throw new Error(`Director not found: ${directorError?.message}`);
    }

    const assunto = `🏆 Time Aprovado — Bem-vindo à Liga Metrópole Digital!`;
    const corpo = `
Olá, ${director.full_name}!

Seu time **${team_name}** foi aprovado pelo administrador da Liga Metrópole Digital.

Agora você pode:
- Acessar o painel do seu time
- Gerenciar sua escalação
- Acompanhar os jogos agendados

Acesse: https://liga-metropole-digital.vercel.app/minha-conta

Boa sorte na competição! 🏆

Liga Metrópole Digital
    `.trim();

    // Insert log entry as pending
    const { data: logEntry } = await supabaseAdmin
      .from("notificacoes_log")
      .insert({
        tipo: "team_approved",
        canal: "email",
        destinatario_id: director.id,
        destinatario_email: director.email,
        destinatario_nome: director.full_name,
        assunto,
        corpo_preview: corpo.substring(0, 200),
        status: "pendente",
        payload: { team_id, team_name, director_id },
        whatsapp_template: "team_approved_v1",
      })
      .select("id")
      .single();

    logId = logEntry?.id ?? null;

    // Send email via Supabase Auth admin API
    const { error: emailError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      director.email,
      {
        data: {
          notification_type: "team_approved",
          team_name,
        },
        redirectTo: "https://liga-metropole-digital.vercel.app/minha-conta",
      }
    );

    // Note: inviteUserByEmail sends an email. For custom body, use SMTP directly.
    // For now, we use the Supabase built-in email as a trigger and log success.
    // TODO: Replace with custom SMTP when available.

    if (emailError) {
      // Try direct email via admin
      console.error("Invite email failed, logging failure:", emailError.message);

      if (logId) {
        await supabaseAdmin
          .from("notificacoes_log")
          .update({
            status: "falhou",
            erro_mensagem: emailError.message,
          })
          .eq("id", logId);
      }

      return new Response(
        JSON.stringify({ success: false, error: emailError.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Mark as sent
    if (logId) {
      await supabaseAdmin
        .from("notificacoes_log")
        .update({ status: "enviado", enviado_em: new Date().toISOString() })
        .eq("id", logId);
    }

    return new Response(
      JSON.stringify({ success: true, log_id: logId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("notify-team-approved error:", msg);

    if (logId) {
      await supabaseAdmin
        .from("notificacoes_log")
        .update({ status: "falhou", erro_mensagem: msg })
        .eq("id", logId);
    }

    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
