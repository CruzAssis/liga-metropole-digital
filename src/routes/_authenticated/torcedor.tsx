import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bell, Heart, Star, Trophy, Calendar, MapPin, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  getSupporterTeams,
  getSupporterFeed,
  getSupporterNotifications,
  getMatchLineups,
  castSupporterVote,
  getMySupporterVote,
  getSupporterMVP,
} from "@/lib/torcedor.functions";

export const Route = createFileRoute("/_authenticated/torcedor")({
  component: TorcedorPage,
});

function formatDate(iso: string | null) {
  if (!iso) return "A confirmar";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

function TorcedorPage() {
  const fetchTeams = useServerFn(getSupporterTeams);
  const fetchFeed = useServerFn(getSupporterFeed);
  const fetchNotifs = useServerFn(getSupporterNotifications);

  const teamsQ = useQuery({ queryKey: ["torcedor-teams"], queryFn: () => fetchTeams() });
  const feedQ = useQuery({ queryKey: ["torcedor-feed"], queryFn: () => fetchFeed() });
  const notifsQ = useQuery({ queryKey: ["torcedor-notifs"], queryFn: () => fetchNotifs() });

  const teams = teamsQ.data ?? [];
  const feed = feedQ.data ?? { followedTeamIds: [], upcoming: [], recent: [] };
  const notifs = notifsQ.data ?? [];

  const [voteMatchId, setVoteMatchId] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <header className="flex items-center gap-3">
        <div className="rounded-full bg-red-500/10 p-3">
          <Heart className="h-6 w-6 text-red-400" />
        </div>
        <div>
          <h1 className="font-display text-2xl md:text-3xl tracking-wide">App do Torcedor</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe seus times, receba notificações e vote no craque da partida.
          </p>
        </div>
      </header>

      {/* Times seguidos */}
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Meus Times
          </h2>
        </div>
        {teams.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Você ainda não segue nenhum time.{" "}
            <a href="/onboarding/torcedor" className="text-primary underline">
              Escolher um time
            </a>
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {teams.map((t: any) => (
              <a
                key={t.id}
                href={t.slug ? `/times/${t.slug}` : "#"}
                className="flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1.5 text-sm hover:border-red-500/50 transition"
              >
                {t.logo_url ? (
                  <img src={t.logo_url} alt="" className="h-5 w-5 rounded-full object-contain" />
                ) : (
                  <div className="h-5 w-5 rounded-full bg-muted" />
                )}
                <span className="font-medium">{t.name}</span>
                {t.lado && (
                  <Badge variant="outline" className="text-[10px]">Lado {t.lado}</Badge>
                )}
              </a>
            ))}
          </div>
        )}
      </section>

      <Tabs defaultValue="feed" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="feed">
            <Calendar className="mr-1 h-4 w-4" />
            Feed
          </TabsTrigger>
          <TabsTrigger value="notifs">
            <Bell className="mr-1 h-4 w-4" />
            Notificações
            {notifs.length > 0 && (
              <Badge className="ml-2 h-5 min-w-5 px-1.5 text-[10px]">{notifs.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="vote">
            <Star className="mr-1 h-4 w-4" />
            Votação
          </TabsTrigger>
        </TabsList>

        {/* Feed */}
        <TabsContent value="feed" className="space-y-4 pt-4">
          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Próximos jogos
            </h3>
            {feed.upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem jogos agendados nos próximos 30 dias.</p>
            ) : (
              <div className="space-y-2">
                {feed.upcoming.map((m: any) => <MatchCard key={m.id} m={m} />)}
              </div>
            )}
          </div>
          <div>
            <h3 className="mb-2 mt-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Resultados recentes
            </h3>
            {feed.recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem resultados recentes.</p>
            ) : (
              <div className="space-y-2">
                {feed.recent.map((m: any) => (
                  <MatchCard key={m.id} m={m} onVote={() => setVoteMatchId(m.id)} />
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Notifs */}
        <TabsContent value="notifs" className="space-y-2 pt-4">
          {notifs.length === 0 ? (
            <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              Você ainda não tem notificações.
            </p>
          ) : (
            notifs.map((n: any) => (
              <div key={n.id} className="rounded-xl border border-border bg-card p-4">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <Badge variant="outline" className="text-[10px] uppercase">{n.tipo}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(n.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
                {n.assunto && <p className="text-sm font-medium">{n.assunto}</p>}
                {n.corpo_preview && (
                  <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                    {n.corpo_preview}
                  </p>
                )}
              </div>
            ))
          )}
        </TabsContent>

        {/* Vote */}
        <TabsContent value="vote" className="space-y-2 pt-4">
          <p className="text-sm text-muted-foreground">
            Escolha uma partida finalizada do seu time para votar no craque.
          </p>
          {feed.recent.length === 0 ? (
            <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              Nenhuma partida disponível para votação.
            </p>
          ) : (
            feed.recent.map((m: any) => (
              <MatchCard key={m.id} m={m} onVote={() => setVoteMatchId(m.id)} showVoteBtn />
            ))
          )}
        </TabsContent>
      </Tabs>

      <VoteDialog
        matchId={voteMatchId}
        onClose={() => setVoteMatchId(null)}
      />
    </div>
  );
}

function MatchCard({ m, onVote, showVoteBtn }: { m: any; onVote?: () => void; showVoteBtn?: boolean }) {
  const finished = ["confirmed", "closed", "wo"].includes(m.status);
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>{formatDate(m.scheduled_at)}</span>
        {m.venue && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {m.venue}
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2 min-w-0">
          {m.host?.logo_url ? (
            <img src={m.host.logo_url} alt="" className="h-8 w-8 object-contain" />
          ) : <div className="h-8 w-8 rounded bg-muted" />}
          <span className="truncate text-sm font-medium">{m.host?.short_name ?? "—"}</span>
        </div>
        <div className="text-center">
          {finished ? (
            <span className="font-display text-xl">
              {m.host_score ?? 0} <span className="text-muted-foreground">×</span> {m.visitor_score ?? 0}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">vs</span>
          )}
        </div>
        <div className="flex flex-1 items-center justify-end gap-2 min-w-0">
          <span className="truncate text-sm font-medium">{m.visitor?.short_name ?? "—"}</span>
          {m.visitor?.logo_url ? (
            <img src={m.visitor.logo_url} alt="" className="h-8 w-8 object-contain" />
          ) : <div className="h-8 w-8 rounded bg-muted" />}
        </div>
      </div>
      {finished && (onVote || showVoteBtn) && (
        <div className="mt-3 flex justify-end">
          <Button size="sm" variant="outline" onClick={onVote}>
            <Star className="mr-1 h-3.5 w-3.5" />
            Votar no craque
          </Button>
        </div>
      )}
    </div>
  );
}

function VoteDialog({ matchId, onClose }: { matchId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const fetchLineups = useServerFn(getMatchLineups);
  const fetchMyVote = useServerFn(getMySupporterVote);
  const fetchMVP = useServerFn(getSupporterMVP);
  const submit = useServerFn(castSupporterVote);

  const lineupsQ = useQuery({
    queryKey: ["lineups", matchId],
    queryFn: () => fetchLineups({ data: { match_id: matchId! } }),
    enabled: !!matchId,
  });
  const myVoteQ = useQuery({
    queryKey: ["my-vote", matchId],
    queryFn: () => fetchMyVote({ data: { match_id: matchId! } }),
    enabled: !!matchId,
  });
  const mvpQ = useQuery({
    queryKey: ["mvp", matchId],
    queryFn: () => fetchMVP({ data: { match_id: matchId! } }),
    enabled: !!matchId,
  });

  const [selected, setSelected] = useState<string | null>(null);
  const [rating, setRating] = useState(5);

  const mutation = useMutation({
    mutationFn: (v: { athlete_id: string; rating: number }) =>
      submit({ data: { match_id: matchId!, ...v } }),
    onSuccess: () => {
      toast.success("Voto registrado!");
      qc.invalidateQueries({ queryKey: ["my-vote", matchId] });
      qc.invalidateQueries({ queryKey: ["mvp", matchId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao votar"),
  });

  const lineups = lineupsQ.data;
  const allAthletes = lineups ? [...lineups.host, ...lineups.visitor] : [];
  const mvp = mvpQ.data ?? [];
  const myVote = myVoteQ.data;

  return (
    <Dialog open={!!matchId} onOpenChange={(o) => !o && (onClose(), setSelected(null))}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-400" />
            Vote no craque da partida
          </DialogTitle>
          <DialogDescription>
            Escolha o jogador que mais se destacou e dê uma nota de 1 a 5 estrelas.
          </DialogDescription>
        </DialogHeader>

        {myVote ? (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
            ✅ Seu voto: <strong>{allAthletes.find((a) => a.id === myVote.athlete_id)?.nickname ?? allAthletes.find((a) => a.id === myVote.athlete_id)?.full_name ?? "—"}</strong>
            {" · "}{myVote.rating}⭐
            <p className="mt-1 text-xs text-muted-foreground">
              Só é permitido um voto por partida.
            </p>
          </div>
        ) : (
        <div className="max-h-64 overflow-y-auto space-y-1 rounded-lg border border-border p-2">
          {lineupsQ.isLoading && <p className="p-3 text-sm text-muted-foreground">Carregando...</p>}
          {allAthletes.map((a: any) => (
            <button
              key={a.id}
              onClick={() => setSelected(a.id)}
              className={`flex w-full items-center gap-3 rounded-md p-2 text-left transition ${
                selected === a.id ? "bg-primary/10 border border-primary" : "hover:bg-muted"
              }`}
            >
              {a.photo_url ? (
                <img src={a.photo_url} alt="" className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <div className="h-8 w-8 rounded-full bg-muted" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium">{a.nickname || a.full_name}</p>
                {a.position && <p className="text-xs text-muted-foreground">{a.position}</p>}
              </div>
            </button>
          ))}
        </div>

        {selected && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Sua nota</p>
            <div className="flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setRating(n)}
                  className="p-1 transition"
                >
                  <Star
                    className={`h-8 w-8 ${
                      n <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"
                    }`}
                  />
                </button>
              ))}
            </div>
            <Button
              className="w-full"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate({ athlete_id: selected, rating })}
            >
              {mutation.isPending ? "Enviando..." : "Confirmar voto"}
            </Button>
          </div>
        )}
        </>
        )}

        {mvp.length > 0 && (
          <div className="border-t border-border pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Ranking dos torcedores
            </p>
            <div className="space-y-1">
              {mvp.slice(0, 3).map((r: any, i: number) => (
                <div key={r.athlete_id} className="flex items-center justify-between text-sm">
                  <span>
                    {i + 1}. {r.nickname || r.full_name}
                  </span>
                  <span className="text-muted-foreground">
                    {Number(r.avg_rating).toFixed(1)}⭐ ({r.total_votes})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
