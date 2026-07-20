import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { listPublicMedia, type MediaItem } from "@/lib/media.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Image as ImageIcon, Video, Sparkles, ExternalLink, Play } from "lucide-react";

export const Route = createFileRoute("/midia")({
  component: PublicMediaPage,
  head: () => ({
    meta: [
      { title: "Mídia & Conteúdo • Liga Metrópole" },
      {
        name: "description",
        content: "Fotos, vídeos e destaques das rodadas da Liga Metrópole.",
      },
      { property: "og:title", content: "Mídia & Conteúdo • Liga Metrópole" },
      {
        property: "og:description",
        content: "Fotos, vídeos e destaques das rodadas da Liga Metrópole.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Filter = "all" | "photo" | "video" | "embed";

function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1) || null;
    if (u.hostname.includes("youtube.com")) return u.searchParams.get("v");
  } catch {}
  return null;
}

function MediaCard({ item }: { item: MediaItem }) {
  const [expanded, setExpanded] = useState(false);
  const yt = item.platform === "youtube" ? youtubeId(item.url) : null;
  const isInstagram = item.platform === "instagram";
  const cover =
    item.thumbnail_url ||
    (item.kind === "photo" ? item.url : null) ||
    (yt ? `https://img.youtube.com/vi/${yt}/hqdefault.jpg` : null);

  return (
    <Card className="overflow-hidden group">
      <div className="relative aspect-video bg-muted">
        {expanded && yt ? (
          <iframe
            className="absolute inset-0 h-full w-full"
            src={`https://www.youtube.com/embed/${yt}?autoplay=1`}
            title={item.title ?? "Vídeo"}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : cover ? (
          <>
            <img
              src={cover}
              alt={item.title ?? ""}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
              loading="lazy"
            />
            {(item.kind === "video" || item.kind === "embed") && (
              <button
                type="button"
                onClick={() => (yt ? setExpanded(true) : window.open(item.url, "_blank"))}
                className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors"
                aria-label="Reproduzir"
              >
                <span className="rounded-full bg-white/95 p-4 shadow-lg">
                  <Play className="h-6 w-6 text-black fill-black" />
                </span>
              </button>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            {item.kind === "video" ? <Video className="h-8 w-8" /> : <Sparkles className="h-8 w-8" />}
          </div>
        )}
        {item.is_featured && (
          <Badge className="absolute left-2 top-2 bg-primary text-primary-foreground">Destaque</Badge>
        )}
      </div>
      <CardContent className="p-3 space-y-1">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
          {item.kind === "video" ? <Video className="h-3 w-3" /> : item.kind === "embed" ? <Sparkles className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
          <span>{item.platform ?? item.kind}</span>
          {item.round_number != null && <span>· Rodada {item.round_number}</span>}
          {item.team && <span className="truncate">· {item.team.short_name ?? item.team.name}</span>}
        </div>
        {item.title && <p className="font-semibold leading-snug line-clamp-2">{item.title}</p>}
        {item.caption && <p className="text-sm text-muted-foreground line-clamp-2">{item.caption}</p>}
        {(item.credit || isInstagram) && (
          <div className="flex items-center justify-between pt-1">
            {item.credit && <p className="text-[11px] text-muted-foreground">📸 {item.credit}</p>}
            {isInstagram && (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="ml-auto inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Ver no Instagram <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PublicMediaPage() {
  const fn = useServerFn(listPublicMedia);
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["public-media"],
    queryFn: () => fn(),
  });
  const [filter, setFilter] = useState<Filter>("all");

  const featured = useMemo(() => items.filter((i) => i.is_featured).slice(0, 3), [items]);
  const filtered = useMemo(
    () => (filter === "all" ? items : items.filter((i) => i.kind === filter)),
    [items, filter],
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-primary font-semibold">Liga Metrópole</p>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Mídia & Conteúdo</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          Reviva os melhores momentos: fotos das partidas, vídeos, gols e publicações das rodadas.
        </p>
      </header>

      {featured.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Destaques da rodada
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {featured.map((m) => (
              <MediaCard key={m.id} item={m} />
            ))}
          </div>
        </section>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {(["all", "photo", "video", "embed"] as const).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "Tudo" : f === "photo" ? "Fotos" : f === "video" ? "Vídeos" : "Posts"}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Nenhuma mídia publicada ainda. Volte em breve!
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((m) => (
            <MediaCard key={m.id} item={m} />
          ))}
        </div>
      )}
    </div>
  );
}
