import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PublicShell } from "@/components/PublicShell";
import { PageHeader } from "@/components/PageHeader";
import { AthleteAvatar } from "@/components/athletes/AthleteAvatar";
import { Badge } from "@/components/ui/badge";
import { Star, Trophy, Target, Crown, Medal } from "lucide-react";

const MIN_EVAL_DEFAULT = 3;
const STAR_MAX = 6;

type RankRow = {
  athlete_id: string;
  full_name: string | null;
  nickname: string | null;
  photo_url: string | null;
  position: string | null;
  team_id: string | null;
  team_name: string | null;
  team_short_name: string | null;
  team_primary_color: string | null;
  avg_rating: number;
  total_evaluations: number;
  goals: number;
};

export const Route = createFileRoute("/ranking-craques")({
  component: RankingCraquesPage,
  head: () => ({
    meta: [
      { title: "Ranking de Craques · Liga Metrópole" },
      {
        name: "description",
        content:
          "Ranking dos jogadores destaque da Liga Metrópole, ordenados pela média de estrelas recebidas em súmulas homologadas.",
      },
      { property: "og:title", content: "Ranking de Craques · Liga Metrópole" },
      {
        property: "og:description",
        content:
          "Média de estrelas, vezes destaque e gols dos atletas da Liga Metrópole.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function RankingCraquesPage() {
  const [rows, setRows] = useState<RankRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [minEval, setMinEval] = useState<number>(MIN_EVAL_DEFAULT);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("get_ranking_craques", {
        _min_evaluations: minEval,
      });
      if (!cancelled) {
        if (error) {
          console.error(error);
          setRows([]);
        } else {
          setRows((data ?? []) as RankRow[]);
        }
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [minEval]);

  return (
    <PublicShell>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <PageHeader
          title="Ranking de Craques"
          description={`Jogadores ordenados pela média de estrelas (mínimo ${minEval} avaliações). O histórico segue o atleta mesmo se trocar de time.`}
        />

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            Mínimo de avaliações:
          </span>
          {[3, 5, 10].map((n) => (
            <button
              key={n}
              onClick={() => setMinEval(n)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${
                minEval === n
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:border-primary/50"
              }`}
            >
              {n}+
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center text-muted-foreground text-sm py-16">
            Carregando ranking...
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center space-y-3">
            <Trophy className="mx-auto h-10 w-10 text-muted-foreground/60" />
            <p className="text-muted-foreground text-sm">
              Ainda não há jogadores com pelo menos {minEval} avaliações homologadas.
            </p>
            <p className="text-muted-foreground text-xs">
              O ranking começa a preencher assim que as primeiras súmulas forem homologadas.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((r, idx) => (
              <RankItem key={r.athlete_id} row={r} position={idx + 1} />
            ))}
          </div>
        )}

        <p className="text-muted-foreground text-xs text-center">
          Escala de estrelas: 1 a {STAR_MAX}. Notas atribuídas pelo time adversário na súmula.
        </p>
      </div>
    </PublicShell>
  );
}

function RankItem({ row, position }: { row: RankRow; position: number }) {
  const name = row.nickname || row.full_name || "Atleta";
  const podium =
    position === 1 ? "text-amber-400" :
    position === 2 ? "text-zinc-300" :
    position === 3 ? "text-orange-400" : "text-muted-foreground";

  return (
    <Link
      to="/atletas/$id"
      params={{ id: row.athlete_id }}
      className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 hover:border-primary/50 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-12px_rgba(21,101,245,0.35)] transition-all"
    >
      <div className={`w-10 text-center font-black text-2xl tabular-nums ${podium}`}>
        {position <= 3 ? (
          position === 1 ? <Crown className="inline h-6 w-6" /> : <Medal className="inline h-6 w-6" />
        ) : null}
        <div className="text-sm">{position}º</div>
      </div>

      <AthleteAvatar
        photoUrl={row.photo_url}
        name={row.full_name}
        nickname={row.nickname}
        verified={false}
        size={56}
      />

      <div className="flex-1 min-w-0">
        <div className="font-display text-xl tracking-wide uppercase leading-none truncate">
          {name}
        </div>
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground mt-1.5 font-semibold truncate">
          {row.team_name ?? "Sem time"}
          {row.position ? ` · ${row.position}` : ""}
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-2">
        <Badge className="bg-amber-500/15 text-amber-300 border border-amber-500/30 gap-1">
          <Trophy className="h-3 w-3" /> {row.total_evaluations}× destaque
        </Badge>
        <Badge className="bg-blue-500/15 text-blue-300 border border-blue-500/30 gap-1">
          <Target className="h-3 w-3" /> {row.goals} gols
        </Badge>
      </div>

      <div className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
          <span className="text-2xl font-black tabular-nums text-white">
            {Number(row.avg_rating).toFixed(1)}
          </span>
          <span className="text-xs text-muted-foreground">/ {STAR_MAX.toFixed(1)}</span>
        </div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1 font-semibold">
          Média
        </div>
        <div className="sm:hidden text-[10px] text-muted-foreground mt-1">
          {row.total_evaluations}× · {row.goals} gols
        </div>
      </div>
    </Link>
  );
}
