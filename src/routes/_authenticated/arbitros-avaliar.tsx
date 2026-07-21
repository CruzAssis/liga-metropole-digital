import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listDirectorMatchesWithReferees,
  rateReferee,
  type DirectorMatchAssignment,
} from "@/lib/referees.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Gavel, Star } from "lucide-react";
import { SkeletonAdminList } from "@/components/AppSkeletons";

export const Route = createFileRoute("/_authenticated/arbitros-avaliar")({
  component: DirectorRateRefereesPage,
});

const ROLE_LABEL: Record<string, string> = {
  principal: "Principal",
  assistente_1: "Assistente 1",
  assistente_2: "Assistente 2",
  mesa: "Mesa",
  reserva: "Reserva",
};

function DirectorRateRefereesPage() {
  const [rows, setRows] = useState<DirectorMatchAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const listFn = useServerFn(listDirectorMatchesWithReferees);
  const rateFn = useServerFn(rateReferee);
  const [draft, setDraft] = useState<Record<string, { rating: number; comment: string }>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listFn());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, [listFn]);
  useEffect(() => {
    refresh();
  }, [refresh]);

  async function submitRating(matchId: string, refereeId: string) {
    const key = `${matchId}:${refereeId}`;
    const d = draft[key];
    if (!d || !d.rating) {
      toast.error("Escolha uma nota de 1 a 5");
      return;
    }
    try {
      await rateFn({ data: { match_id: matchId, referee_id: refereeId, rating: d.rating, comment: d.comment || null } });
      toast.success("Avaliação registrada");
      setDraft((s) => ({ ...s, [key]: { rating: 0, comment: "" } }));
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/minha-conta">
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Link>
      </Button>
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-primary font-semibold">Diretor</p>
        <h1 className="text-2xl sm:text-3xl font-black">Avaliar árbitros</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Avalie os árbitros das partidas do seu time (1 a 5 estrelas).
        </p>
      </div>

      {loading ? (
        <SkeletonAdminList rows={4} />
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <Gavel className="mx-auto h-8 w-8 text-muted-foreground/60 mb-3" />
          <p className="font-semibold">Nenhuma partida com árbitros escalados</p>
          <p className="text-sm text-muted-foreground mt-1">
            Assim que o admin escalar árbitros para uma partida do seu time, ela aparecerá aqui.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {rows.map((m) => (
            <li key={m.match_id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-baseline justify-between mb-3">
                <p className="font-semibold">
                  {m.host_name} × {m.visitor_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {m.scheduled_at ? new Date(m.scheduled_at).toLocaleString() : "—"}
                </p>
              </div>
              <div className="space-y-3">
                {m.assignments.map((a) => {
                  const key = `${m.match_id}:${a.referee_id}`;
                  const d = draft[key] ?? { rating: a.my_rating ?? 0, comment: a.my_comment ?? "" };
                  return (
                    <div key={a.referee_id} className="rounded-lg border border-border/60 bg-background/40 p-3">
                      <div className="flex items-center gap-3 mb-2">
                        {a.photo_url ? (
                          <img src={a.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                            <Gavel className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{a.full_name}</p>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {ROLE_LABEL[a.role] ?? a.role}
                          </p>
                        </div>
                        {a.my_rating != null && (
                          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500">
                            avaliado
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mb-2">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setDraft((s) => ({ ...s, [key]: { ...d, rating: n } }))}
                            aria-label={`${n} estrelas`}
                            className="p-1"
                          >
                            <Star
                              className={`h-6 w-6 ${
                                n <= (d.rating || 0)
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-muted-foreground/40"
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                      <Textarea
                        rows={2}
                        placeholder="Comentário (opcional)"
                        value={d.comment}
                        onChange={(e) => setDraft((s) => ({ ...s, [key]: { ...d, comment: e.target.value } }))}
                      />
                      <div className="mt-2 flex justify-end">
                        <Button size="sm" onClick={() => submitRating(m.match_id, a.referee_id)}>
                          {a.my_rating != null ? "Atualizar avaliação" : "Enviar avaliação"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
