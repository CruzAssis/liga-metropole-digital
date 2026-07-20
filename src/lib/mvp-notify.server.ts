// Fecha janelas de votação expiradas e enfileira notificações do craque (MVP).
import { supabaseAdmin } from "@/integrations/supabase/client.server";

interface MvpRow {
  athlete_id: string;
  full_name: string | null;
  nickname: string | null;
  team_id: string | null;
  avg_rating: number | string;
  total_votes: number;
}

export async function closeExpiredVotingAndNotify(): Promise<{
  processed: number;
  notified: number;
}> {
  const nowIso = new Date().toISOString();

  // Partidas com votação ainda aberta cujo prazo expirou
  const { data: expired, error } = await supabaseAdmin
    .from("matches")
    .select("id,host_team_id,visitor_team_id,scheduled_at,voting_closes_at")
    .eq("voting_open", true)
    .not("voting_closes_at", "is", null)
    .lte("voting_closes_at", nowIso);

  if (error) throw new Error(error.message);
  const matches = expired ?? [];
  if (!matches.length) return { processed: 0, notified: 0 };

  let totalNotified = 0;

  for (const m of matches) {
    // Ranking agregado da partida (todos com voto)
    const { data: mvpRows } = await supabaseAdmin.rpc("get_supporter_mvp", {
      _match_id: m.id,
    });
    const allRanking = ((mvpRows ?? []) as MvpRow[]);
    const finalists = allRanking.slice(0, 10);

    // Fecha a votação
    await (supabaseAdmin as any)
      .from("matches")
      .update({ voting_open: false })
      .eq("id", m.id);

    // Se ninguém votou, apenas fecha e segue.
    if (!finalists.length) continue;

    // Distribuição de estrelas por atleta finalista (1..5)
    const finalistIds = finalists.map((f) => f.athlete_id);
    const { data: votes } = await supabaseAdmin
      .from("supporter_votes")
      .select("athlete_id,rating")
      .eq("match_id", m.id)
      .in("athlete_id", finalistIds);
    const distMap = new Map<string, Record<1 | 2 | 3 | 4 | 5, number>>();
    for (const id of finalistIds) {
      distMap.set(id, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
    }
    for (const v of votes ?? []) {
      const bucket = distMap.get(v.athlete_id as string);
      const r = v.rating as 1 | 2 | 3 | 4 | 5;
      if (bucket && r >= 1 && r <= 5) bucket[r] += 1;
    }

    // Hidrata nomes de times para o corpo da mensagem
    const teamIds = [m.host_team_id, m.visitor_team_id].filter(Boolean) as string[];
    const { data: teams } = await supabaseAdmin
      .from("teams")
      .select("id,name,short_name")
      .in("id", teamIds);
    const teamMap = new Map((teams ?? []).map((t) => [t.id, t]));
    const hostName = teamMap.get(m.host_team_id)?.short_name ?? teamMap.get(m.host_team_id)?.name ?? "Time A";
    const visitorName = teamMap.get(m.visitor_team_id)?.short_name ?? teamMap.get(m.visitor_team_id)?.name ?? "Time B";

    // Nome curto por atleta finalista
    const { data: athletesInfo } = await supabaseAdmin
      .from("athletes")
      .select("id,full_name,nickname,photo_url,team_id")
      .in("id", finalistIds);
    const athleteMap = new Map((athletesInfo ?? []).map((a) => [a.id, a]));

    const mvp = finalists[0];
    const mvpName = mvp.nickname || mvp.full_name || "Craque";
    const avg = Number(mvp.avg_rating).toFixed(1);
    const mvpTeamName =
      teamMap.get(mvp.team_id ?? "")?.short_name ??
      teamMap.get(mvp.team_id ?? "")?.name ??
      "";

    const rankingText = finalists
      .map((r, i) => {
        const name = r.nickname || r.full_name;
        const votes = r.total_votes;
        return `${i + 1}º ${name} — ${Number(r.avg_rating).toFixed(1)}⭐ (${votes} voto${votes === 1 ? "" : "s"})`;
      })
      .join("\n");

    const assunto = `⭐ Craque definido: ${hostName} x ${visitorName}`;
    const mensagem =
      `A votação de ${hostName} x ${visitorName} foi encerrada!\n\n` +
      `🏆 Craque: ${mvpName}${mvpTeamName ? ` (${mvpTeamName})` : ""} — ${avg}⭐ / ${mvp.total_votes} voto${mvp.total_votes === 1 ? "" : "s"}\n\n` +
      `Finalistas:\n${rankingText}`;

    // Destinatários: torcedores dos dois times
    if (!teamIds.length) continue;
    const { data: supporters } = await supabaseAdmin
      .from("team_supporters")
      .select("user_id")
      .in("team_id", teamIds);
    const userIds = Array.from(new Set((supporters ?? []).map((s) => s.user_id).filter(Boolean)));
    if (!userIds.length) continue;

    // Evita duplicar se já existe log app deste tipo para essa partida/usuário
    const { data: already } = await supabaseAdmin
      .from("notificacoes_log")
      .select("destinatario_id")
      .eq("tipo", "mvp_definido")
      .eq("canal", "app")
      .contains("payload", { match_id: m.id });
    const alreadySet = new Set((already ?? []).map((r) => r.destinatario_id));

    const buildFinalistPayload = (r: MvpRow) => {
      const dist = distMap.get(r.athlete_id) ?? { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      const info = athleteMap.get(r.athlete_id);
      return {
        athlete_id: r.athlete_id,
        name: r.nickname || r.full_name,
        photo_url: info?.photo_url ?? null,
        team_id: r.team_id,
        team_name:
          teamMap.get(r.team_id ?? "")?.short_name ??
          teamMap.get(r.team_id ?? "")?.name ??
          null,
        avg_rating: Number(Number(r.avg_rating).toFixed(1)),
        total_votes: r.total_votes,
        distribution: dist,
      };
    };

    const rows = userIds
      .filter((uid) => !alreadySet.has(uid))
      .map((uid) => ({
        tipo: "mvp_definido",
        canal: "app",
        destinatario_id: uid,
        assunto,
        corpo_preview: mensagem.slice(0, 500),
        status: "enviado",
        enviado_em: new Date().toISOString(),
        payload: {
          match_id: m.id,
          host_team_id: m.host_team_id,
          visitor_team_id: m.visitor_team_id,
          host_team_name: hostName,
          visitor_team_name: visitorName,
          mvp: buildFinalistPayload(mvp),
          finalists: finalists.map(buildFinalistPayload),
          total_voters: finalists.reduce((s, r) => s + r.total_votes, 0),
        },
      }));



    if (rows.length) {
      const { error: insErr } = await supabaseAdmin
        .from("notificacoes_log")
        .insert(rows as never);
      if (!insErr) totalNotified += rows.length;
    }
  }

  return { processed: matches.length, notified: totalNotified };
}
