// Perfil publico do jogador com QR Code - feat: public player profile with QR code
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react"
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/AppSkeletons";
import { PublicShell } from "@/components/PublicShell";
import { getAtletaPublicProfile } from "@/lib/atleta-profile.functions";
import {
  CheckCircle,
  Goal,
  Star,
  Trophy,
  Users,
  Calendar,
  CalendarX,
  Instagram,
  QrCode,
  ChevronLeft,
  Copy,
  Check,
} from "lucide-react";

const APP_BASE_URL = "https://ligametropole.app";

export const Route = createFileRoute("/atletas/$id")({
  component: AtletaPerfilPage,
  head: () => ({
    meta: [
      { title: "Perfil do Atleta · Liga Metrópole" },
      { name: "description", content: "Perfil público e ID Metrópole do atleta." },
    ],
  }),
});


function useAtletaProfile(id: string) {
  const fn = useServerFn(getAtletaPublicProfile);
  return useQuery({
    queryKey: ["atleta-profile", id],
    queryFn: () => fn({ data: { athleteId: id } }),
    retry: false,
  });
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col items-center gap-1 text-center">
      <div className="text-primary">{icon}</div>
      <div className="text-2xl font-display font-bold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function AtletaPerfilPage() {
  const { id } = Route.useParams();
  const { data, isLoading, isError } = useAtletaProfile(id);
  const [partidasVisible, setPartidasVisible] = useState(5);

  if (isLoading) {
    return (
      <PublicShell>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1 flex flex-col gap-4">
            <div className="rounded-2xl border border-border bg-card p-6 flex flex-col items-center gap-4">
              <Skeleton className="h-28 w-28 rounded-full" />
              <Skeleton className="h-6 w-40 rounded" />
              <Skeleton className="h-5 w-32 rounded" />
              <Skeleton className="h-4 w-24 rounded" />
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 flex flex-col items-center gap-3">
              <Skeleton className="h-4 w-32 rounded" />
              <Skeleton className="h-40 w-40 rounded-xl" />
            </div>
          </div>
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div>
              <Skeleton className="h-6 w-32 rounded mb-3" />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-xl" />
                ))}
              </div>
            </div>
            <div>
              <Skeleton className="h-6 w-40 rounded mb-3" />
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 rounded-xl" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </PublicShell>
    );
  }

  if (isError || !data || !data.profile) {
    return (
      <PublicShell>
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
          <p className="text-muted-foreground">Atleta nao encontrado.</p>
          <Link to="/atletas" className="text-primary hover:underline text-sm flex items-center gap-1">
            <ChevronLeft className="h-4 w-4" /> Voltar para atletas
          </Link>
        </div>
      </PublicShell>
    );
  }


  const { profile, partidas } = data;
  const displayName = profile.nickname || profile.full_name || "Atleta";
  const profileUrl = `${APP_BASE_URL}/atletas/${profile.id}`;

  return (
    <PublicShell>
      {/* Back link */}
      <div className="mb-4">
        <Link
          to="/atletas"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Todos os atletas
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── LEFT: ID Card ──────────────────────────────────── */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          {/* ID Metropole Card */}
          <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-card p-6 flex flex-col items-center gap-4 text-center shadow-lg">
            {/* Watermark */}
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none opacity-[0.04] text-[6rem] font-display tracking-widest flex items-center justify-center text-primary select-none"
            >
              ID
            </div>

            {/* Photo */}
            <div className="relative">
              <Avatar className="h-28 w-28 ring-4 ring-primary/20">
                <AvatarImage src={profile.photo_url ?? undefined} alt={displayName} />
                <AvatarFallback className="text-3xl font-display bg-zinc-800">
                  {displayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {profile.verified && (
                <div className="absolute -bottom-1 -right-1 bg-primary rounded-full p-0.5">
                  <CheckCircle className="h-5 w-5 text-white" />
                </div>
              )}
            </div>

            {/* Name */}
            <div>
              <div className="font-display text-3xl tracking-wide">{displayName}</div>
              {profile.nickname && profile.full_name && (
                <div className="text-sm text-muted-foreground mt-0.5">{profile.full_name}</div>
              )}
              {profile.position && (
                <div className="text-xs text-muted-foreground mt-1">{profile.position}</div>
              )}
            </div>

            {/* Verified badge */}
            <Badge
              variant={profile.verified ? "default" : "secondary"}
              className="gap-1"
            >
              {profile.verified ? (
                <>
                  <CheckCircle className="h-3.5 w-3.5" /> ID Metropole Verificado
                </>
              ) : (
                "Cadastro Pendente"
              )}
            </Badge>

            {/* Current team */}
            {profile.team_name && (
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                {profile.team_slug ? (
                  <Link
                    to="/times/$slug"
                    params={{ slug: profile.team_slug }}
                    className="hover:underline font-medium"
                  >
                    {profile.team_name}
                  </Link>
                ) : (
                  <span className="font-medium">{profile.team_name}</span>
                )}
              </div>
            )}

            {/* Instagram */}
            {profile.instagram_handle && (
              <a
                href={`https://instagram.com/${profile.instagram_handle.replace(/^@/, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Instagram className="h-3.5 w-3.5" />@{profile.instagram_handle.replace(/^@/, "")}
              </a>
            )}
          </div>

          {/* QR Code card */}
          <div className="rounded-2xl border border-border bg-card p-5 flex flex-col items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <QrCode className="h-4 w-4" />
              Carteira Digital
            </div>
            <div className="bg-white p-3 rounded-xl">
              <QRCodeSVG
                value={profileUrl}
                size={160}
                level="M"
                includeMargin={false}
                imageSettings={{
                  src: "/icons/icon-192.png",
                  height: 28,
                  width: 28,
                  excavate: true,
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              Mostre este QR Code no jogo para que o adversario confirme sua identidade.
            </p>
          </div>
        </div>

        {/* ── RIGHT: Stats + History ──────────────────────────── */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Stats grid */}
          <div>
            <h2 className="font-display text-xl tracking-wide mb-3">Estatisticas</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatCard
                icon={<Goal className="h-5 w-5" />}
                label="Jogos"
                value={profile.jogos}
              />
              <StatCard
                icon={<Goal className="h-5 w-5" />}
                label="Gols"
                value={profile.gols}
              />
              <StatCard
                icon={<Goal className="h-5 w-5" />}
                label="Assistencias"
                value={profile.assistencias}
              />
              <StatCard
                icon={<Trophy className="h-5 w-5" />}
                label="Vezes Destaque"
                value={profile.vezes_destaque}
              />
              <StatCard
                icon={<Star className="h-5 w-5" />}
                label="Media de Nota"
                value={profile.media_nota !== null ? profile.media_nota.toFixed(2) : "—"}
              />
            </div>
          </div>

          {/* Recent matches */}
          <div>
            <h2 className="font-display text-xl tracking-wide mb-3">Partidas Recentes</h2>
            {(!partidas || partidas.length === 0) ? (
              <EmptyState
                icon={<CalendarX className="h-7 w-7" />}
                title="Nenhuma partida ainda"
                description="As partidas aparecem aqui após a homologação da súmula."
              />
            ) : (
              <>
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <ul className="divide-y divide-border">
                    {partidas.slice(0, partidasVisible).map((p) => (
                      <li key={p.match_id} className="px-4 py-3 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {p.host_team_name} × {p.visitor_team_name}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                            <Calendar className="h-3 w-3" />
                            {p.scheduled_at
                              ? new Date(p.scheduled_at).toLocaleDateString("pt-BR", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "Data a definir"}
                            <span>· Rodada {p.round}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {p.host_score !== null && p.visitor_score !== null && (
                            <Badge variant="outline" className="font-mono text-sm">
                              {p.host_score}–{p.visitor_score}
                            </Badge>
                          )}
                          {p.gols_na_partida > 0 && (
                            <Badge className="gap-1 font-mono">
                              <Goal className="h-3 w-3" />
                              {p.gols_na_partida}
                            </Badge>
                          )}
                          {p.foi_destaque && (
                            <Badge variant="secondary" className="gap-1">
                              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                              Destaque
                            </Badge>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                {partidasVisible < partidas.length && (
                  <div className="mt-4 flex justify-center">
                    <Button variant="outline" size="sm" onClick={() => setPartidasVisible((v) => v + 5)}>
                      Ver mais ({partidas.length - partidasVisible})
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>

        </div>
      </div>
    </PublicShell>
  );
}
