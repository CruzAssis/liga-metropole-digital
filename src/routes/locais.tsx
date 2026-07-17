import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PublicShell } from "@/components/PublicShell";
import { PageHeader } from "@/components/PageHeader";
import { MapPin } from "lucide-react";

type Venue = { name: string; matches: number };

export const Route = createFileRoute("/locais")({
  component: LocaisPage,
  head: () => ({
    meta: [
      { title: "Locais · Liga Metrópole" },
      { name: "description", content: "Campos e locais dos jogos da Liga Metrópole." },
    ],
  }),
});

function LocaisPage() {
  const [venues, setVenues] = useState<Venue[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("matches")
        .select("venue")
        .not("venue", "is", null);

      const counts = new Map<string, number>();
      for (const m of data ?? []) {
        const v = (m.venue ?? "").trim();
        if (!v) continue;
        counts.set(v, (counts.get(v) ?? 0) + 1);
      }
      setVenues(
        Array.from(counts.entries())
          .map(([name, matches]) => ({ name, matches }))
          .sort((a, b) => b.matches - a.matches),
      );
    })();
  }, []);

  return (
    <PublicShell>
      <PageHeader
        eyebrow="Onde a bola rola"
        title="Locais"
        description="Campos utilizados nas partidas da liga."
      />

      {!venues && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-24 rounded-xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      )}

      {venues && venues.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <MapPin className="mx-auto h-8 w-8 text-muted-foreground/60 mb-3" />
          <p className="font-semibold">Nenhum local cadastrado ainda</p>
          <p className="text-sm text-muted-foreground mt-1">
            Locais aparecem aqui assim que partidas são agendadas com um campo.
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {venues?.map((v) => (
          <div
            key={v.name}
            className="card-hover group relative rounded-xl border border-border bg-card p-5 flex items-center gap-4 overflow-hidden"
          >
            <div className="h-12 w-12 rounded-lg bg-primary/10 grid place-items-center text-primary shrink-0 ring-1 ring-primary/20">
              <MapPin className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-display text-lg tracking-wide uppercase leading-tight truncate">
                {v.name}
              </div>
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground mt-1 font-semibold">
                {v.matches === 1 ? "partida" : "partidas"}
              </div>
            </div>
            <div className="stat-number text-4xl text-foreground/90 tabular-nums shrink-0 pr-1">
              {v.matches}
            </div>
          </div>
        ))}
      </div>

    </PublicShell>
  );
}
