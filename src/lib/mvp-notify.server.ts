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
    // Ranking agregado da partida
    const { data: mvpRows } = await supabaseAdmin.rpc("get_supporter_mvp", {
      _match_id: m.id,
    });
    const ranking = ((mvpRows ?? []) as MvpRow[]).slice(0, 3);

    // Fecha a votação
    await (supabaseAdmin as any)
      .from("matches")
      .update({ voting_open: false })
      .eq("id", m.id);

    // Se ninguém votou, apenas fecha e segue.
    if (!ranking.length) continue;

    // Hidrata nomes de times para o corpo da mensagem
    const teamIds = [m.host_team_id, m.visitor_team_id].filter(Boolean) as string[];
    const { data: teams } = await supabaseAdmin
      .from("teams")
      .select("id,name,short_name")
      .in("id", teamIds);
    const teamMap = new Map((teams ?? []).map((t) => [t.id, t]));
    const hostName = teamMap.get(m.host_team_id)?.short_name ?? teamMap.get(m.host_team_id)?.name ?? "Time A";
    const visitorName = teamMap.get(m.visitor_team_id)?.short_name ?? teamMap.get(m.visitor_team_id)?.name ?? "Time B";

    const mvp = ranking[0];
    const mvpName = mvp.nickname || mvp.full_name || "Craque";
    const avg = Number(mvp.avg_rating).toFixed(1);

    const rankingText = ranking
      .map((r, i) => `${i + 1}º ${r.nickname || r.full_name} — ${Number(r.avg_rating).toFixed(1)}⭐ (${r.total_votes})`)
      .join("\n");

    const assunto = `⭐ Craque definido: ${hostName} x ${visitorName}`;
    const mensagem =
      `A votação de ${hostName} x ${visitorName} foi encerrada!\n\n` +
      `🏆 Craque da partida: ${mvpName} (${avg}⭐, ${mvp.total_votes} votos)\n\n` +
      `Ranking dos torcedores:\n${rankingText}`;

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
          mvp: {
            athlete_id: mvp.athlete_id,
            name: mvpName,
            avg_rating: Number(avg),
            total_votes: mvp.total_votes,
            team_id: mvp.team_id,
          },
          ranking: ranking.map((r) => ({
            athlete_id: r.athlete_id,
            name: r.nickname || r.full_name,
            avg_rating: Number(Number(r.avg_rating).toFixed(1)),
            total_votes: r.total_votes,
          })),
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
