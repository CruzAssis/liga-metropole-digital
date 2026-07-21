import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/AppSkeletons";
import { toast } from "sonner";
import { Users, Shield, LogIn, AlertTriangle, WifiOff } from "lucide-react";
import { lookupInvite, joinTeamByInvite } from "@/lib/invite.functions";
import { BrandLogo } from "@/components/BrandLogo";

export const Route = createFileRoute("/convite/$code")({
  component: InvitePage,
});

type Team = {
  id: string;
  name: string;
  short_name: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  status: string | null;
};

type InviteError =
  | { kind: "malformed" }
  | { kind: "not_found" }
  | { kind: "inactive"; status: string }
  | { kind: "network" };

const INVITE_CODE_RE = /^[A-Z0-9]{4,16}$/;
// Statuses in which a director's team can still receive players via invite.
const JOINABLE_STATUSES = new Set(["approved", "pending", "waitlist"]);

function InvitePage() {
  const { code } = useParams({ from: "/convite/$code" });
  const navigate = useNavigate();
  const doLookup = useServerFn(lookupInvite);
  const doJoin = useServerFn(joinTeamByInvite);

  const normalizedCode = (code ?? "").trim().toUpperCase();

  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState<Team | null>(null);
  const [error, setError] = useState<InviteError | null>(null);
  const [isAuthed, setIsAuthed] = useState(false);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      setTeam(null);

      // 1. Client-side format validation — catches typos/truncated links early.
      if (!INVITE_CODE_RE.test(normalizedCode)) {
        if (!cancelled) {
          setError({ kind: "malformed" });
          setLoading(false);
        }
        return;
      }

      try {
        const [res, { data }] = await Promise.all([
          doLookup({ data: { invite_code: normalizedCode } }),
          supabase.auth.getUser(),
        ]);
        if (cancelled) return;

        const authed = !!data.user;
        setIsAuthed(authed);

        if (!res.found) {
          setError({ kind: "not_found" });
          return;
        }

        const t = res.team as Team;
        const status = (t.status ?? "").toLowerCase();
        if (status && !JOINABLE_STATUSES.has(status)) {
          setError({ kind: "inactive", status });
          return;
        }

        setTeam(t);

        // Auto-join if user is already authenticated to avoid landing on wrong pages.
        if (authed) {
          try {
            const joinRes = await doJoin({ data: { invite_code: normalizedCode } });
            if (cancelled) return;
            toast.success(
              joinRes.already_member
                ? `Você já fazia parte de ${joinRes.team_name}!`
                : `Bem-vindo(a) ao ${joinRes.team_name}!`,
            );
            navigate({ to: "/minha-conta", replace: true });
            return;
          } catch {
            // Fall through to manual join button if auto-join fails
          }
        }
      } catch {
        if (!cancelled) setError({ kind: "network" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [normalizedCode]);

  async function handleJoin() {
    setJoining(true);
    try {
      const res = await doJoin({ data: { invite_code: normalizedCode } });
      toast.success(
        res.already_member
          ? `Você já fazia parte de ${res.team_name}!`
          : `Bem-vindo(a) ao ${res.team_name}!`,
      );
      navigate({ to: "/minha-conta", replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao entrar no time";
      toast.error(msg);
    } finally {
      setJoining(false);
    }
  }

  const redirectSearch = { redirect: `/convite/${normalizedCode}` } as const;

  const errorView = error
    ? (() => {
        switch (error.kind) {
          case "malformed":
            return {
              icon: <AlertTriangle className="mx-auto h-10 w-10 text-amber-400 mb-3" />,
              title: "Link de convite malformado",
              body: (
                <>
                  O código <span className="font-mono text-white">{code}</span> não está no formato
                  esperado. Verifique se você copiou o link inteiro — às vezes o WhatsApp corta o
                  final da URL.
                </>
              ),
            };
          case "not_found":
            return {
              icon: <Shield className="mx-auto h-10 w-10 text-red-400 mb-3" />,
              title: "Convite inválido ou expirado",
              body: (
                <>
                  Não encontramos nenhum time com o código{" "}
                  <span className="font-mono text-white">{normalizedCode}</span>. O convite pode ter
                  sido revogado pelo diretor. Peça um novo link.
                </>
              ),
            };
          case "inactive":
            return {
              icon: <AlertTriangle className="mx-auto h-10 w-10 text-amber-400 mb-3" />,
              title: "Este time não aceita novos jogadores",
              body: (
                <>
                  A inscrição deste time está atualmente com status{" "}
                  <span className="font-mono text-white">{error.status}</span> e não permite entrada
                  por convite. Fale com o diretor do time.
                </>
              ),
            };
          case "network":
            return {
              icon: <WifiOff className="mx-auto h-10 w-10 text-zinc-400 mb-3" />,
              title: "Não conseguimos validar o convite",
              body: (
                <>
                  Houve um problema de conexão ao verificar o código. Confira sua internet e tente
                  novamente.
                </>
              ),
            };
        }
      })()
    : null;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-black">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 justify-center mb-8">
          <BrandLogo className="h-10 w-10" />
          <span className="font-display text-2xl tracking-wider text-white">Liga Metrópole</span>
        </Link>

        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-8 text-center">
          {loading ? (
            <div className="py-8 flex justify-center">
              <Spinner className="h-6 w-6" />
            </div>
          ) : errorView ? (
            <>
              {errorView.icon}
              <h1 className="font-display text-2xl text-white mb-2">{errorView.title}</h1>
              <p className="text-sm text-zinc-400 mb-6">{errorView.body}</p>
              <div className="space-y-3">
                {error?.kind === "network" && (
                  <Button className="w-full" onClick={() => location.reload()}>
                    Tentar novamente
                  </Button>
                )}
                <Button
                  asChild={error?.kind !== "network"}
                  variant={error?.kind === "network" ? "outline" : "default"}
                  className="w-full"
                >
                  <Link to="/">Ir para o início</Link>
                </Button>
              </div>
            </>
          ) : team ? (
            <>
              <div
                className="mx-auto h-20 w-20 rounded-full border-4 flex items-center justify-center mb-4 overflow-hidden"
                style={{ borderColor: team.primary_color ?? "#1565F5" }}
              >
                {team.logo_url ? (
                  <img src={team.logo_url} alt={team.name} className="h-full w-full object-cover" />
                ) : (
                  <Users className="h-8 w-8 text-white" />
                )}
              </div>
              <p className="text-xs uppercase tracking-widest text-zinc-500">Convite para o time</p>
              <h1 className="font-display text-3xl text-white mt-1 mb-1">{team.name}</h1>
              {team.short_name && (
                <p className="text-sm text-zinc-400 mb-6">{team.short_name}</p>
              )}

              {isAuthed ? (
                <Button className="w-full" onClick={handleJoin} disabled={joining}>
                  {joining ? (
                    <>
                      <Spinner className="mr-2 h-4 w-4" />
                      Entrando...
                    </>
                  ) : (
                    <>
                      <Users className="mr-2 h-4 w-4" /> Entrar no time
                    </>
                  )}
                </Button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-zinc-400">
                    Para entrar no time, crie sua conta ou faça login.
                  </p>
                  <Button asChild className="w-full">
                    <Link to="/signup" search={{ perfil: "jogador", redirect: `/convite/${normalizedCode}` } as never}>
                      Criar minha conta de jogador
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full">
                    <Link to="/login" search={redirectSearch}>
                      <LogIn className="mr-2 h-4 w-4" /> Já tenho conta
                    </Link>
                  </Button>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
