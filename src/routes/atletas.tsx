import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AthleteCard, type AthleteCardData } from "@/components/athletes/AthleteCard";
import { IDMetropoleCard, type IDMetropoleData } from "@/components/athletes/IDMetropoleCard";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PublicShell } from "@/components/PublicShell";
import { getAthleteRankings } from "@/lib/stats.functions";
import { Goal, Square, Star } from "lucide-react";

type Row = AthleteCardData & IDMetropoleData & { team_id: string | null };

export const Route = createFileRoute("/atletas")({
  component: AtletasPage,
  head: () => ({
    meta: [
      { title: "Atletas · Liga Metrópole Várzea" },
      { name: "description", content: "Atletas, artilharia e ranking da Liga Metrópole Várzea." },
    ],
  }),
});

function AtletasPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [open, setOpen] = useState<Row | null>(null);

  useEffect(() => {
    (async () => {
      const { data: athletes } = await supabase
        .from("athletes")
        .select("id, full_name, nickname, position, photo_url, verified, team_id")
        .order("verified", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200);

      const teamIds = Array.from(new Set((athletes ?? []).map((a) => a.team_id).filter(Boolean))) as string[];
      const teamsMap = new Map<string, string>();
      if (teamIds.length > 0) {
        const { data: teams } = await supabase.from("teams").select("id, name").in("id", teamIds);
        for (const t of teams ?? []) teamsMap.set(t.id, t.name);
      }

      setRows(
        (athletes ?? []).map((a) => ({
          ...a,
          team_name: a.team_id ? teamsMap.get(a.team_id) ?? null : null,
        })) as Row[],
      );
    })();
  }, []);

  return (
    <PublicShell>
      <header className="mb-6">
        <h1 className="font-display text-5xl tracking-wide">Atletas</h1>
        <p className="text-muted-foreground mt-1">
          ID Metrópole — perfil oficial e estatísticas dos atletas da liga.
        </p>
      </header>

      <Tabs defaultValue="todos" className="mb-6">
        <TabsList>
          <TabsTrigger value="todos">Todos</TabsTrigger>
          <TabsTrigger value="artilharia">Artilharia</TabsTrigger>
          <TabsTrigger value="nota">Nota Metrópole</TabsTrigger>
          <TabsTrigger value="disciplina">Disciplina</TabsTrigger>
        </TabsList>

        <TabsContent value="todos" className="mt-6">
          {!rows && <div className="text-muted-foreground">Carregando...</div>}
          {rows && rows.length === 0 && (
            <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
              Nenhum atleta cadastrado ainda.
            </div>
          )}
          {rows && rows.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((a) => (
                <AthleteCard key={a.id} athlete={a} onClick={() => setOpen(a)} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="artilharia" className="mt-6">
          <ScorersRanking />
        </TabsContent>
        <TabsContent value="nota" className="mt-6">
          <RatingsRanking />
        </TabsContent>
        <TabsContent value="disciplina" className="mt-6">
          <DisciplineRanking />
        </TabsContent>
      </Tabs>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-md">
          <DialogTitle className="sr-only">Perfil do atleta</DialogTitle>
          {open && (
            <>
              <IDMetropoleCard athlete={open} />
              <div className="mt-4 text-center">
                <Link
                  to="/atletas/$id"
                  params={{ id: open.id }}
                  className="text-sm text-primary hover:underline"
                  onClick={() => setOpen(null)}
                >
                  Ver perfil completo →
                </Link>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </PublicShell>
  );
}

function useRankings() {
  const fn = useServerFn(getAthleteRankings);
  return useQuery({
    queryKey: ["athlete-rankings"],
    queryFn: () => fn(),
  });
}

type RankAthlete = {
  id: string;
  name: string;
  photo_url: string | null;
  team_name: string | null;
  team_slug: string | null;
  team_logo: string | null;
} | null;

function AthleteCell({ athlete, position }: { athlete: RankAthlete; position: number }) {
  if (!athlete) return null;
  return (
    <div className="flex items-center gap-3 min-w-0">
      <span className="w-6 text-right font-mono text-muted-foreground text-sm tabular-nums">
        {position}
      </span>
      <Avatar className="h-9 w-9 shrink-0">
        <AvatarImage src={athlete.photo_url ?? undefined} alt={athlete.name} />
        <AvatarFallback>{athlete.name.charAt(0)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="font-medium truncate">{athlete.name}</div>
        <div className="text-xs text-muted-foreground truncate">
          {athlete.team_slug ? (
            <Link to="/times/$slug" params={{ slug: athlete.team_slug }} className="hover:underline">
              {athlete.team_name ?? "—"}
            </Link>
          ) : (
            athlete.team_name ?? "—"
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyRanking({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground text-sm">
      Sem dados de {label} ainda. As estatísticas aparecem após súmulas confirmadas.
    </div>
  );
}

function ScorersRanking() {
  const { data, isLoading } = useRankings();
  if (isLoading) return <div className="text-muted-foreground">Carregando...</div>;
  const rows = data?.topScorers ?? [];
  if (rows.length === 0) return <EmptyRanking label="artilharia" />;
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Goal className="h-4 w-4 text-primary" />
        <h2 className="font-display tracking-wide">Artilharia</h2>
      </div>
      <ul className="divide-y divide-border">
        {rows.map((r, i) => (
          <li key={r.athlete!.id} className="px-4 py-2 flex items-center justify-between gap-3">
            <AthleteCell athlete={r.athlete} position={i + 1} />
            <div className="flex items-center gap-3 shrink-0">
              <Badge variant="outline" className="font-mono">
                {r.games} {r.games === 1 ? "jogo" : "jogos"}
              </Badge>
              <Badge className="font-mono text-base">{r.goals}</Badge>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RatingsRanking() {
  const { data, isLoading } = useRankings();
  if (isLoading) return <div className="text-muted-foreground">Carregando...</div>;
  const rows = data?.topRated ?? [];
  if (rows.length === 0) return <EmptyRanking label="Nota Metrópole" />;
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Star className="h-4 w-4 text-primary" />
        <h2 className="font-display tracking-wide">Nota Metrópole</h2>
        <span className="text-xs text-muted-foreground ml-auto">
          Média das notas recebidas dos adversários
        </span>
      </div>
      <ul className="divide-y divide-border">
        {rows.map((r, i) => (
          <li key={r.athlete!.id} className="px-4 py-2 flex items-center justify-between gap-3">
            <AthleteCell athlete={r.athlete} position={i + 1} />
            <div className="flex items-center gap-3 shrink-0">
              <Badge variant="outline" className="font-mono">
                {r.votes} {r.votes === 1 ? "voto" : "votos"}
              </Badge>
              <Badge className="font-mono text-base">{r.avg.toFixed(2)}</Badge>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DisciplineRanking() {
  const { data, isLoading } = useRankings();
  if (isLoading) return <div className="text-muted-foreground">Carregando...</div>;
  const rows = data?.discipline ?? [];
  if (rows.length === 0) return <EmptyRanking label="disciplina" />;
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Square className="h-4 w-4 text-primary" />
        <h2 className="font-display tracking-wide">Disciplina</h2>
        <span className="text-xs text-muted-foreground ml-auto">
          Mais cartões em partidas confirmadas
        </span>
      </div>
      <ul className="divide-y divide-border">
        {rows.map((r, i) => (
          <li key={r.athlete!.id} className="px-4 py-2 flex items-center justify-between gap-3">
            <AthleteCell athlete={r.athlete} position={i + 1} />
            <div className="flex items-center gap-3 shrink-0">
              <Badge variant="outline" className="font-mono gap-1">
                <Square className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                {r.yellow}
              </Badge>
              <Badge variant="outline" className="font-mono gap-1">
                <Square className="h-3 w-3 fill-destructive text-destructive" />
                {r.red}
              </Badge>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
