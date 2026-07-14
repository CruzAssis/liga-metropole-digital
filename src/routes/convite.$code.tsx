import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/AppSkeletons";
import { toast } from "sonner";
import { Users, Shield, LogIn } from "lucide-react";
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

function InvitePage() {
  const { code } = useParams({ from: "/convite/$code" });
  const navigate = useNavigate();
  const doLookup = useServerFn(lookupInvite);
  const doJoin = useServerFn(joinTeamByInvite);

  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState<Team | null>(null);
  const [isAuthed, setIsAuthed] = useState(false);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [res, { data }] = await Promise.all([
          doLookup({ data: { invite_code: code } }),
          supabase.auth.getUser(),
        ]);
        setIsAuthed(!!data.user);
        if (res.found) setTeam(res.team as Team);
      } catch {
        setTeam(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [code]);

  async function handleJoin() {
    setJoining(true);
    try {
      const res = await doJoin({ data: { invite_code: code } });
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

  const redirectSearch = { redirect: `/convite/${code}` } as const;

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
          ) : !team ? (
            <>
              <Shield className="mx-auto h-10 w-10 text-red-400 mb-3" />
              <h1 className="font-display text-2xl text-white mb-2">Convite inválido</h1>
              <p className="text-sm text-zinc-400 mb-6">
                Não encontramos nenhum time com o código <span className="font-mono text-white">{code}</span>.
                Confirme com o diretor se o link está correto.
              </p>
              <Button asChild className="w-full">
                <Link to="/">Ir para o início</Link>
              </Button>
            </>
          ) : (
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
                    <Link to="/signup" search={{ perfil: "jogador" } as never}>
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
          )}
        </div>
      </div>
    </div>
  );
}
