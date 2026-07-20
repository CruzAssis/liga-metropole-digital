import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listPublicVenues, type VenueRow } from "@/lib/venues.functions";
import { PublicShell } from "@/components/PublicShell";
import { PageHeader } from "@/components/PageHeader";
import { MapPin, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/locais")({
  component: LocaisPage,
  head: () => ({
    meta: [
      { title: "Locais · Liga Metrópole" },
      { name: "description", content: "Campos e locais oficiais dos jogos da Liga Metrópole." },
    ],
  }),
});

function LocaisPage() {
  const [venues, setVenues] = useState<VenueRow[] | null>(null);
  const list = useServerFn(listPublicVenues);

  useEffect(() => {
    list()
      .then(setVenues)
      .catch(() => setVenues([]));
  }, [list]);

  return (
    <PublicShell>
      <PageHeader
        eyebrow="Onde a bola rola"
        title="Locais"
        description="Campos oficiais utilizados nas partidas da liga."
      />

      {!venues && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-32 rounded-xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      )}

      {venues && venues.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <MapPin className="mx-auto h-8 w-8 text-muted-foreground/60 mb-3" />
          <p className="font-semibold">Nenhum local cadastrado ainda</p>
          <p className="text-sm text-muted-foreground mt-1">
            Os campos aparecem aqui assim que forem cadastrados pela administração.
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {venues?.map((v) => (
          <div
            key={v.id}
            className="card-hover group relative rounded-xl border border-border bg-card overflow-hidden"
          >
            {v.photo_url && (
              <div className="h-32 w-full overflow-hidden bg-muted">
                <img src={v.photo_url} alt={v.name} className="h-full w-full object-cover" loading="lazy" />
              </div>
            )}
            <div className="p-5 flex items-start gap-4">
              {!v.photo_url && (
                <div className="h-12 w-12 rounded-lg bg-primary/10 grid place-items-center text-primary shrink-0 ring-1 ring-primary/20">
                  <MapPin className="h-5 w-5" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="font-display text-lg tracking-wide uppercase leading-tight truncate">
                  {v.name}
                </div>
                <div className="text-xs text-muted-foreground mt-1 truncate">
                  {[v.subprefeitura, v.bairro].filter(Boolean).join(" · ") || v.address || "—"}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {v.lado && (
                    <span className="text-[10px] uppercase tracking-widest font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                      Lado {v.lado}
                    </span>
                  )}
                  {v.maps_link && (
                    <a
                      href={v.maps_link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                    >
                      Ver no mapa <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </PublicShell>
  );
}
