import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PublicShell } from "@/components/PublicShell";
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
      <header className="mb-6">
        <h1 className="font-display text-5xl tracking-wide">Locais</h1>
        <p className="text-muted-foreground mt-1">Campos utilizados nas partidas.</p>
      </header>

      {!venues && <div className="text-muted-foreground">Carregando...</div>}
      {venues && venues.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
          Nenhum local cadastrado ainda. Locais aparecem aqui assim que partidas são agendadas com um campo.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {venues?.map((v) => (
          <div key={v.name} className="rounded-lg border border-border bg-card p-4 flex items-start gap-3">
            <MapPin className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <div className="font-medium">{v.name}</div>
              <div className="text-xs text-muted-foreground">{v.matches} partida(s)</div>
            </div>
          </div>
        ))}
      </div>
    </PublicShell>
  );
}
