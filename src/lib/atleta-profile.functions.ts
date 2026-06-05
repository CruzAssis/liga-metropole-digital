import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const adminDb = supabaseAdmin as any;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AtletaPublicProfile {
  id: string;
  full_name: string | null;
  nickname: string | null;
  position: string | null;
  photo_url: string | null;
  verified: boolean;
  verified_at: string | null;
  instagram_handle: string | null;
  // current team
  team_id: string | null;
  team_name: string | null;
  team_short_name: string | null;
  team_logo_url: string | null;
  team_slug: string | null;
  // stats
  jogos: number;
  gols: number;
  assistencias: number;
  vezes_destaque: number;
  media_nota: number | null;
}

export interface PartidaRecente {
  match_id: string;
  scheduled_at: string | null;
  host_team_name: string;
  visitor_team_name: string;
  host_score: number | null;
  visitor_score: number | null;
  stage: string;
  round: number;
  gols_na_partida: number;
  foi_destaque: boolean;
}

// ─── Server Functions ──────────────────────────────────────────────────────────

/**
 * Public profile for a single athlete — no auth required
 */
export const getAtletaPublicProfile = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ athleteId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    // 1. Base athlete data
    const { data: athlete, error: athErr } = await supabaseAdmin
      .from("athletes")
      .select(
        "id, full_name, nickname, position, photo_url, verified, verified_at, instagram_handle, team_id"
      )
      .eq("id", data.athleteId)
      .maybeSingle();

    if (athErr) throw new Error(athErr.message);
    if (!athlete) return null;

    // 2. Current team info
    let team_name: string | null = null;
    let team_short_name: string | null = null;
    let team_logo_url: string | null = null;
    let team_slug: string | null = null;

    if (athlete.team_id) {
      const { data: team } = await supabaseAdmin
        .from("teams")
        .select("name, short_name, logo_url, slug")
        .eq("id", athlete.team_id)
        .maybeSingle();
      if (team) {
        team_name = team.name;
        team_short_name = team.short_name;
        team_logo_url = team.logo_url ?? null;
        team_slug = team.slug ?? null;
      }
    }

    // 3. Stats from match_events (confirmed/finished matches)
    const { data: confirmedMatches } = await supabaseAdmin
      .from("matches")
      .select("id")
      .in("status", ["confirmed", "wo", "finished"])
      .limit(5000);

    const confirmedIds = (confirmedMatches ?? []).map((m) => m.id);

    const { data: events } = await supabaseAdmin
      .from("match_events")
      .select("match_id, kind")
      .eq("athlete_id", data.athleteId)
      .limit(2000);

    const relevantEvents = (events ?? []).filter((e) =>
      confirmedIds.includes(e.match_id)
    );

    const jogos = new Set(relevantEvents.map((e) => e.match_id)).size;
    const gols = relevantEvents.filter((e) => e.kind === "goal").length;
    const assistencias = relevantEvents.filter((e) => e.kind === "assist").length;

    // 4. Destaque stats from match_best_opponent_votes
    const { data: votes } = await supabaseAdmin
      .from("match_best_opponent_votes")
      .select("rating")
      .eq("opponent_athlete_id", data.athleteId)
      .limit(500);

    const vezes_destaque = (votes ?? []).length;
    const media_nota =
      vezes_destaque > 0
        ? Number(
            (
              (votes ?? []).reduce((s, v) => s + Number(v.rating), 0) /
              vezes_destaque
            ).toFixed(2)
          )
        : null;

    // 5. Recent matches (last 10 with events)
    const matchIds = Array.from(new Set(relevantEvents.map((e) => e.match_id))).slice(0, 20);

    let partidas: PartidaRecente[] = [];
    if (matchIds.length > 0) {
      const { data: matches } = await supabaseAdmin
        .from("matches")
        .select(
          "id, scheduled_at, stage, round, host_team_id, visitor_team_id, host_score, visitor_score"
        )
        .in("id", matchIds)
        .order("scheduled_at", { ascending: false })
        .limit(10);

      if (matches && matches.length > 0) {
        const allTeamIds = Array.from(
          new Set([
            ...matches.map((m) => m.host_team_id),
            ...matches.map((m) => m.visitor_team_id),
          ])
        );
        const { data: teams } = await supabaseAdmin
          .from("teams")
          .select("id, name, short_name")
          .in("id", allTeamIds);
        const teamMap = new Map((teams ?? []).map((t) => [t.id, t]));

        // Destaque publicado lookup
        const { data: destaques } = await adminDb
          .from("match_destaques_publicados")
          .select("match_id, jersey_number, identified_name")
          .in("match_id", matchIds)
          .limit(50);

        // Events per match for goal count
        const goalsPerMatch = new Map<string, number>();
        for (const e of relevantEvents) {
          if (e.kind === "goal") {
            goalsPerMatch.set(e.match_id, (goalsPerMatch.get(e.match_id) ?? 0) + 1);
          }
        }

        partidas = matches.map((m) => {
          const hostTeam = teamMap.get(m.host_team_id);
          const visitorTeam = teamMap.get(m.visitor_team_id);
          // Check if destaque by identified_name or jersey_number (best-effort)
          const destaqueRows = (destaques ?? []) as Array<{ match_id: string; identified_name: string | null }>;
          const foiDestaque = destaqueRows.some(
            (d) =>
              d.match_id === m.id &&
              (d.identified_name === athlete.full_name ||
                d.identified_name === athlete.nickname)
          );
          return {
            match_id: m.id,
            scheduled_at: m.scheduled_at,
            host_team_name: hostTeam?.short_name ?? hostTeam?.name ?? "?",
            visitor_team_name: visitorTeam?.short_name ?? visitorTeam?.name ?? "?",
            host_score: m.host_score,
            visitor_score: m.visitor_score,
            stage: m.stage,
            round: m.round,
            gols_na_partida: goalsPerMatch.get(m.id) ?? 0,
            foi_destaque: foiDestaque,
          };
        });
      }
    }

    const profile: AtletaPublicProfile = {
      id: athlete.id,
      full_name: athlete.full_name,
      nickname: athlete.nickname,
      position: athlete.position,
      photo_url: athlete.photo_url,
      verified: athlete.verified,
      verified_at: athlete.verified_at,
      instagram_handle: athlete.instagram_handle,
      team_id: athlete.team_id,
      team_name,
      team_short_name,
      team_logo_url,
      team_slug,
      jogos,
      gols,
      assistencias,
      vezes_destaque,
      media_nota,
    };

    return { profile, partidas };
  });
