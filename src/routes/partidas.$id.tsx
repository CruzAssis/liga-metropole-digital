import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PublicShell } from "@/components/PublicShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MapPin, Calendar } from "lucide-react";

export const Route = createFileRoute("/partidas/$id")({
  component: PartidaPage,
  head: () => ({
    meta: [
      { title: "Partida · Liga Metrópole Várzea" },
      { name: "description", content: "Detalhes da partida e súmula digital." },
    ],
  }),
});

type Match = {
  id: string;
  stage: string;
  round: number;
  group_label: string | null;
  host_team_id: string;
  visitor_team_id: string;
  host_score: number | null;
  visitor_score: number | null;
  scheduled_at: string | null;
  venue: string | null;
  status: string;
  host_filled_at: string | null;
  visitor_confirmed_at: string | null;
};

type Team = {
  id: string;
  name: string;
  short_name: string;
  slug: string | null;
  logo_url: string | null;
};

type Event = {
  id: string;
  team_id: string;
  athlete_id: string;
  kind: "goal" | "yellow_card" | "red_card";
  minute: number | null;
};

type Vote = {
  id: string;
  voter_team_id: string;
  opponent_team_id: string;
  jersey_number: number;
  rating: number;
  note: string | null;
  identified_name: string | null;
};

const statusLabel: Record<string, { text: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  scheduled: { text: "Agendado", variant: "outline" },
  awaiting_confirmation: { text: "Aguardando confirmação", variant: "secondary" },
  confirmed: { text: "Confirmado", variant: "default" },
  disputed: { text: "Contestado", variant: "destructive" },
  wo: { text: "WO", variant: "destructive" },
  live: { text: "Ao vivo", variant: "default" },
};

function PartidaPage() {
  const { id } = Route.useParams();
  const [match, setMatch] = useState<Match | null>(null);
  const [teams, setTeams] = useState<Record<string, Team>>({});
  const [athletes, setAthletes] = useState<Record<string, { full_name: string; nickname: string | null }>>({});
  const [events, setEvents] = useState<Event[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: m } = await supabase
        .from("matches")
        .select(
          "id, stage, round, group_label, host_team_id, visitor_team_id, host_score, visitor_score, scheduled_at, venue, status, host_filled_at, visitor_confirmed_at",
        )
        .eq("id", id)
        .maybeSingle();
      if (!m) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setMatch(m as Match);

      const [{ data: tdata }, { data: edata }, { data: vdata }] = await Promise.all([
        supabase
          .from("teams")
          .select("id, name, short_name, slug, logo_url")
          .in("id", [m.host_team_id, m.visitor_team_id]),
        supabase
          .from("match_events")
          .select("id, team_id, athlete_id, kind, minute")
          .eq("match_id", id)
          .order("minute", { ascending: true, nullsFirst: false }),
        supabase
          .from("match_best_opponent_votes")
          .select("id, voter_team_id, opponent_team_id, jersey_number, rating, note, identified_name")
          .eq("match_id", id),
      ]);

      const tmap: Record<string, Team> = {};
      for (const t of (tdata ?? []) as Team[]) tmap[t.id] = t;
      setTeams(tmap);
      setEvents((edata ?? []) as Event[]);
      setVotes((vdata ?? []) as Vote[]);

      const athleteIds = Array.from(new Set((edata ?? []).map((e: any) => e.athlete_id)));
      if (athleteIds.length > 0) {
        const { data: adata } = await supabase
          .from("athletes")
          .select("id, full_name, nickname")
          .in("id", athleteIds);
        const amap: Record<string, { full_name: string; nickname: string | null }> = {};
        for (const a of adata ?? []) amap[a.id] = { full_name: a.full_name ?? "—", nickname: a.nickname };
        setAthletes(amap);
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <PublicShell>
        <div className="text-muted-foreground">Carregando partida...</div>
      </PublicShell>
    );
  }

  if (notFound || !match) {
    return (
      <PublicShell>
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground mb-4">Partida não encontrada.</p>
          <Button asChild variant="outline">
            <Link to="/resultados">Ver resultados</Link>
          </Button>
        </div>
      </PublicShell>
    );
  }

  const host = teams[match.host_team_id];
  const visitor = teams[match.visitor_team_id];
  const status = statusLabel[match.status] ?? { text: match.status, variant: "outline" as const };
  const hostEvents = events.filter((e) => e.team_id === match.host_team_id);
  const visitorEvents = events.filter((e) => e.team_id === match.visitor_team_id);
  const finished = ["confirmed", "wo"].includes(match.status);

  const athleteName = (athleteId: string) => {
    const a = athletes[athleteId];
    if (!a) return "—";
    return a.nickname || a.full_name;
  };

  return (
    <PublicShell>
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/resultados">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </Button>
      </div>

      {/* Header */}
      <div className="rounded-lg border border-border bg-card p-6 mb-6">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Badge variant="outline">
            {match.stage === "group" ? `Rodada ${match.round}` : match.stage}
            {match.group_label ? ` · ${match.group_label}` : ""}
          </Badge>
          <Badge variant={status.variant}>{status.text}</Badge>
        </div>

        <div className="grid grid-cols-3 items-center gap-4">
          <TeamSide team={host} align="right" />
          <div className="text-center">
            <div className="font-display text-5xl md:text-6xl tracking-wide">
              {match.host_score ?? "—"}
              <span className="text-muted-foreground mx-2">×</span>
              {match.visitor_score ?? "—"}
            </div>
          </div>
          <TeamSide team={visitor} align="left" />
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground mt-6 pt-4 border-t border-border">
          {match.scheduled_at && (
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {new Date(match.scheduled_at).toLocaleString("pt-BR", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </span>
          )}
          {match.venue && (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4" />
              {match.venue}
            </span>
          )}
        </div>
      </div>

      {/* Súmula */}
      {finished ? (
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="font-display text-2xl tracking-wide mb-4">Súmula</h2>

          {match.status === "wo" && (
            <p className="text-sm text-muted-foreground mb-4">
              Partida encerrada por WO. Não há eventos registrados.
            </p>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            <TeamEvents
              teamName={host?.short_name ?? "Mandante"}
              events={hostEvents}
              athleteName={athleteName}
            />
            <TeamEvents
              teamName={visitor?.short_name ?? "Visitante"}
              events={visitorEvents}
              athleteName={athleteName}
            />
          </div>

          {votes.length > 0 && (
            <div className="mt-6 pt-6 border-t border-border">
              <h3 className="font-display text-lg tracking-wide mb-3">Melhor jogador adversário</h3>
              <div className="grid md:grid-cols-2 gap-3">
                {votes.map((v) => {
                  const fromTeam = teams[v.voter_team_id];
                  const aboutTeam = teams[v.opponent_team_id];
                  return (
                    <div key={v.id} className="rounded-md border border-border p-3 text-sm">
                      <div className="text-xs text-muted-foreground mb-1">
                        {fromTeam?.short_name ?? "—"} votou em {aboutTeam?.short_name ?? "—"}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium truncate">
                          {v.identified_name ?? `Camisa #${v.jersey_number}`}
                        </div>
                        <Badge variant="secondary" className="font-mono">
                          {v.rating.toFixed(1)}
                        </Badge>
                      </div>
                      {v.note && <p className="text-xs text-muted-foreground mt-2">{v.note}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
          A súmula estará disponível após a confirmação da partida.
        </div>
      )}
    </PublicShell>
  );
}

function TeamSide({ team, align }: { team: Team | undefined; align: "left" | "right" }) {
  if (!team) return <div />;
  const inner = (
    <div className={`flex items-center gap-3 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
      <div className="h-14 w-14 rounded-md bg-muted overflow-hidden flex items-center justify-center shrink-0">
        {team.logo_url ? (
          <img src={team.logo_url} alt={team.name} className="h-full w-full object-cover" />
        ) : (
          <span className="font-display text-xl">{team.short_name?.[0] ?? "?"}</span>
        )}
      </div>
      <div className="min-w-0">
        <div className="font-medium truncate">{team.name}</div>
        <div className="text-xs text-muted-foreground">{team.short_name}</div>
      </div>
    </div>
  );
  return team.slug ? (
    <Link to="/times/$slug" params={{ slug: team.slug }} className="hover:underline">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function TeamEvents({
  teamName,
  events,
  athleteName,
}: {
  teamName: string;
  events: Event[];
  athleteName: (id: string) => string;
}) {
  const goals = events.filter((e) => e.kind === "goal");
  const yellows = events.filter((e) => e.kind === "yellow_card");
  const reds = events.filter((e) => e.kind === "red_card");

  return (
    <div>
      <h3 className="font-display text-lg tracking-wide mb-3">{teamName}</h3>
      <EventGroup label="Gols" icon="⚽" items={goals} athleteName={athleteName} />
      <EventGroup label="Cartões amarelos" icon="🟨" items={yellows} athleteName={athleteName} />
      <EventGroup label="Cartões vermelhos" icon="🟥" items={reds} athleteName={athleteName} />
      {events.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p>
      )}
    </div>
  );
}

function EventGroup({
  label,
  icon,
  items,
  athleteName,
}: {
  label: string;
  icon: string;
  items: Event[];
  athleteName: (id: string) => string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mb-3">
      <div className="text-xs font-medium text-muted-foreground mb-1">
        {label} ({items.length})
      </div>
      <ul className="space-y-1">
        {items.map((e) => (
          <li key={e.id} className="text-sm flex items-center gap-2">
            <span>{icon}</span>
            <span className="font-medium">{athleteName(e.athlete_id)}</span>
            {e.minute != null && (
              <span className="text-xs text-muted-foreground font-mono">{e.minute}'</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
