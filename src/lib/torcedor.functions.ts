import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ─── Times seguidos pelo torcedor ────────────────────────────────────────────
export const getSupporterTeams = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: subs } = await context.supabase
      .from("team_supporters")
      .select("team_id")
      .eq("user_id", context.userId);
    const ids = (subs ?? []).map((r) => r.team_id);
    if (!ids.length) return [];
    const { data: teams } = await supabaseAdmin
      .from("teams")
      .select("id,name,short_name,slug,logo_url,primary_color,lado,subprefeitura")
      .in("id", ids);
    return teams ?? [];
  });

// ─── Feed da rodada: partidas dos times seguidos + rodada atual ─────────────
export const getSupporterFeed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: subs } = await context.supabase
      .from("team_supporters")
      .select("team_id")
      .eq("user_id", context.userId);
    const teamIds = (subs ?? []).map((r) => r.team_id);

    // Todas as partidas relevantes: próximas dos times seguidos + últimos resultados
    const now = new Date().toISOString();
    const in30d = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
    const from30d = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

    let upcoming: any[] = [];
    let recent: any[] = [];
    if (teamIds.length) {
      const upQ = await supabaseAdmin
        .from("matches")
        .select("id,host_team_id,visitor_team_id,host_score,visitor_score,status,scheduled_at,venue,round,competition_id")
        .gte("scheduled_at", now)
        .lte("scheduled_at", in30d)
        .or(
          teamIds.map((id) => `host_team_id.eq.${id},visitor_team_id.eq.${id}`).join(","),
        )
        .order("scheduled_at", { ascending: true })
        .limit(20);
      upcoming = upQ.data ?? [];

      const recQ = await supabaseAdmin
        .from("matches")
        .select("id,host_team_id,visitor_team_id,host_score,visitor_score,status,scheduled_at,venue,round,competition_id")
        .in("status", ["confirmed", "closed", "wo"])
        .gte("scheduled_at", from30d)
        .or(
          teamIds.map((id) => `host_team_id.eq.${id},visitor_team_id.eq.${id}`).join(","),
        )
        .order("scheduled_at", { ascending: false })
        .limit(20);
      recent = recQ.data ?? [];
    }

    // Hidrata times
    const allTeamIds = Array.from(
      new Set(
        [...upcoming, ...recent].flatMap((m) => [m.host_team_id, m.visitor_team_id]),
      ),
    );
    const { data: teams } = allTeamIds.length
      ? await supabaseAdmin
          .from("teams")
          .select("id,name,short_name,slug,logo_url,primary_color,lado")
          .in("id", allTeamIds)
      : { data: [] as any[] };
    const teamMap = new Map((teams ?? []).map((t) => [t.id, t]));

    const decorate = (m: any) => ({
      ...m,
      host: teamMap.get(m.host_team_id) ?? null,
      visitor: teamMap.get(m.visitor_team_id) ?? null,
    });

    return {
      followedTeamIds: teamIds,
      upcoming: upcoming.map(decorate),
      recent: recent.map(decorate),
    };
  });

// ─── Notificações do torcedor ───────────────────────────────────────────────
export const getSupporterNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await supabaseAdmin
      .from("notificacoes_log")
      .select("id,tipo,assunto,corpo_preview,created_at,payload")
      .eq("destinatario_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(30);
    return data ?? [];
  });

// ─── Elenco de um time para votação ─────────────────────────────────────────
export const getMatchLineups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ match_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { data: m } = await supabaseAdmin
      .from("matches")
      .select("id,host_team_id,visitor_team_id,status")
      .eq("id", data.match_id)
      .maybeSingle();
    if (!m) throw new Error("Partida não encontrada");
    const { data: athletes } = await supabaseAdmin
      .from("athletes")
      .select("id,full_name,nickname,photo_url,position,team_id")
      .in("team_id", [m.host_team_id, m.visitor_team_id]);
    return {
      match: m,
      host: (athletes ?? []).filter((a) => a.team_id === m.host_team_id),
      visitor: (athletes ?? []).filter((a) => a.team_id === m.visitor_team_id),
    };
  });

// ─── Registrar voto do torcedor ─────────────────────────────────────────────
export const castSupporterVote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        match_id: z.string().uuid(),
        athlete_id: z.string().uuid(),
        rating: z.number().int().min(1).max(5),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    // Só permite votar se torcedor de um dos times envolvidos e partida finalizada
    const { data: m } = await supabaseAdmin
      .from("matches")
      .select("host_team_id,visitor_team_id,status")
      .eq("id", data.match_id)
      .maybeSingle();
    if (!m) throw new Error("Partida não encontrada");
    if (!["confirmed", "closed", "wo"].includes(m.status)) {
      throw new Error("Partida ainda não foi finalizada");
    }
    const { data: sup } = await context.supabase
      .from("team_supporters")
      .select("team_id")
      .eq("user_id", context.userId)
      .in("team_id", [m.host_team_id, m.visitor_team_id]);
    if (!sup || sup.length === 0) {
      throw new Error("Você só pode votar em partidas do seu time");
    }
    const { data: athlete } = await supabaseAdmin
      .from("athletes")
      .select("team_id")
      .eq("id", data.athlete_id)
      .maybeSingle();
    if (!athlete || !athlete.team_id) throw new Error("Jogador não encontrado");
    const athleteTeamId = athlete.team_id;
    if (![m.host_team_id, m.visitor_team_id].includes(athleteTeamId)) {
      throw new Error("Jogador não participou desta partida");
    }

    // Bloqueia voto duplicado: uma vez votado, não permite alterar
    const { data: existing } = await context.supabase
      .from("supporter_votes")
      .select("id")
      .eq("user_id", context.userId)
      .eq("match_id", data.match_id)
      .maybeSingle();
    if (existing) {
      throw new Error("Você já votou nesta partida. Só é permitido um voto por partida.");
    }

    const { error } = await context.supabase
      .from("supporter_votes")
      .insert({
        user_id: context.userId,
        match_id: data.match_id,
        athlete_id: data.athlete_id,
        team_id: athleteTeamId,
        rating: data.rating,
      });
    if (error) {
      if ((error as any).code === "23505") {
        throw new Error("Você já votou nesta partida.");
      }
      throw new Error(error.message);
    }
    return { ok: true };
  });

// ─── MVP agregado por partida (via RPC) ─────────────────────────────────────
export const getSupporterMVP = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ match_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin.rpc("get_supporter_mvp", {
      _match_id: data.match_id,
    });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ─── Meu voto atual ─────────────────────────────────────────────────────────
export const getMySupporterVote = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ match_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: v } = await context.supabase
      .from("supporter_votes")
      .select("athlete_id,rating")
      .eq("user_id", context.userId)
      .eq("match_id", data.match_id)
      .maybeSingle();
    return v ?? null;
  });
