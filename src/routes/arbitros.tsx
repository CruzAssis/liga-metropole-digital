import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listPublicReferees, type RefereeWithStats } from "@/lib/referees.functions";
import { Gavel, Star, MapPin } from "lucide-react";
import { SkeletonAdminList } from "@/components/AppSkeletons";

export const Route = createFileRoute("/arbitros")({
  component: PublicArbitrosPage,
  head: () => ({
    meta: [
      { title: "Árbitros — Liga Metrópole" },
      { name: "description", content: "Central de árbitros da Liga Metrópole com avaliações dos diretores." },
    ],
  }),
});

function PublicArbitrosPage() {
  const [items, setItems] = useState<RefereeWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const listFn = useServerFn(listPublicReferees);

  useEffect(() => {
    (async () => {
      try {
        setItems(await listFn());
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [listFn]);

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-primary font-semibold">Liga</p>
        <h1 className="text-2xl sm:text-3xl font-black">Central de Árbitros</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Quadro oficial e média de avaliações feitas pelos diretores das equipes.
        </p>
      </div>

      {loading ? (
        <SkeletonAdminList rows={4} />
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <Gavel className="mx-auto h-8 w-8 text-muted-foreground/60 mb-3" />
          <p className="font-semibold">Nenhum árbitro publicado ainda</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {items.map((r) => (
            <li key={r.id} className="rounded-xl border border-border bg-card p-4 flex gap-3">
              {r.photo_url ? (
                <img src={r.photo_url} alt="" className="h-14 w-14 rounded-full object-cover shrink-0" />
              ) : (
                <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <Gavel className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{r.full_name}</p>
                {r.nickname && <p className="text-xs text-muted-foreground">"{r.nickname}"</p>}
                {r.city && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3 w-3" /> {r.city}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-2 text-xs">
                  <span className="flex items-center gap-1 text-amber-500 font-semibold">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    {r.avg_rating > 0 ? r.avg_rating.toFixed(2) : "—"}
                  </span>
                  <span className="text-muted-foreground">
                    {r.total_ratings} avaliação{r.total_ratings === 1 ? "" : "ões"}
                  </span>
                  <span className="text-muted-foreground">· {r.total_matches} partida{r.total_matches === 1 ? "" : "s"}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
