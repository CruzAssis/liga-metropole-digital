import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listDirectorMatchesWithReferees,
  rateReferee,
  type DirectorMatchAssignment,
} from "@/lib/referees.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, Gavel, Star, Lock, History, ArrowDownAZ } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SortKey = "recent" | "rating_desc" | "rating_asc";
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
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [sortHist, setSortHist] = useState<SortKey>("recent");

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
      setEditingKey(null);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  const { pendentes, historico } = useMemo(() => {
    const pend: DirectorMatchAssignment[] = [];
    const hist: DirectorMatchAssignment[] = [];
    for (const m of rows) {
      const hasUnrated = m.assignments.some((a) => a.my_rating == null);
      const hasRated = m.assignments.some((a) => a.my_rating != null);
      if (hasUnrated && m.assignments[0]?.editable) pend.push(m);
      if (hasRated) hist.push(m);
    }
    return { pendentes: pend, historico: hist };
  }, [rows]);

  const historicoSorted = useMemo(() => {
    const scored = historico.map((m) => {
      const rated = m.assignments.filter((a) => a.my_rating != null);
      const mostRecent = rated.reduce((acc, a) => {
        const t = a.my_rating_at ? new Date(a.my_rating_at).getTime() : 0;
        return t > acc ? t : acc;
      }, 0);
      const ratings = rated.map((a) => a.my_rating as number);
      const maxRating = ratings.length ? Math.max(...ratings) : 0;
      const minRating = ratings.length ? Math.min(...ratings) : 0;
      const avgRating = ratings.length ? ratings.reduce((s, x) => s + x, 0) / ratings.length : 0;
      return { m, mostRecent, maxRating, minRating, avgRating };
    });
    if (sortHist === "rating_desc") {
      scored.sort((a, b) => b.avgRating - a.avgRating || b.mostRecent - a.mostRecent);
    } else if (sortHist === "rating_asc") {
      scored.sort((a, b) => a.avgRating - b.avgRating || b.mostRecent - a.mostRecent);
    } else {
      scored.sort((a, b) => b.mostRecent - a.mostRecent);
    }
    return scored.map((s) => s.m);
  }, [historico, sortHist]);

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
          Avalie os árbitros das partidas do seu time (1 a 5 estrelas). Enquanto a partida estiver aberta você pode editar sua avaliação.
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
        <Tabs defaultValue="pendentes">
          <TabsList className="mb-4">
            <TabsTrigger value="pendentes">Pendentes ({pendentes.length})</TabsTrigger>
            <TabsTrigger value="historico">
              <History className="h-3.5 w-3.5 mr-1" /> Histórico ({historico.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pendentes" className="mt-0">
            {pendentes.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                Nenhuma avaliação pendente.
              </div>
            ) : (
              <MatchList
                items={pendentes}
                mode="pendentes"
                draft={draft}
                setDraft={setDraft}
                editingKey={editingKey}
                setEditingKey={setEditingKey}
                onSubmit={submitRating}
              />
            )}
          </TabsContent>

          <TabsContent value="historico" className="mt-0">
            {historico.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                Você ainda não avaliou árbitros.
              </div>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-end gap-2">
                  <ArrowDownAZ className="h-4 w-4 text-muted-foreground" />
                  <Select value={sortHist} onValueChange={(v) => setSortHist(v as SortKey)}>
                    <SelectTrigger className="h-8 w-full max-w-[220px] sm:w-[200px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recent">Mais recentes</SelectItem>
                      <SelectItem value="rating_desc">Nota: maior → menor</SelectItem>
                      <SelectItem value="rating_asc">Nota: menor → maior</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <MatchList
                  items={historicoSorted}
                  mode="historico"
                  draft={draft}
                  setDraft={setDraft}
                  editingKey={editingKey}
                  setEditingKey={setEditingKey}
                  onSubmit={submitRating}
                />
              </>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

type MatchListProps = {
  items: DirectorMatchAssignment[];
  mode: "pendentes" | "historico";
  draft: Record<string, { rating: number; comment: string }>;
  setDraft: React.Dispatch<React.SetStateAction<Record<string, { rating: number; comment: string }>>>;
  editingKey: string | null;
  setEditingKey: (k: string | null) => void;
  onSubmit: (matchId: string, refereeId: string) => void;
};

function MatchList({ items, mode, draft, setDraft, editingKey, setEditingKey, onSubmit }: MatchListProps) {
  return (
    <ul className="space-y-4">
      {items.map((m) => {
        const assignments =
          mode === "historico"
            ? m.assignments.filter((a) => a.my_rating != null)
            : m.assignments.filter((a) => a.my_rating == null);
        if (assignments.length === 0) return null;
        return (
          <li key={m.match_id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-baseline justify-between mb-3 gap-2">
              <p className="font-semibold truncate">
                {m.host_name} × {m.visitor_name}
              </p>
              <div className="flex items-center gap-2 shrink-0">
                {!m.assignments[0]?.editable && (
                  <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    <Lock className="h-3 w-3" /> encerrada
                  </span>
                )}
                <p className="text-xs text-muted-foreground whitespace-nowrap">
                  {m.scheduled_at ? new Date(m.scheduled_at).toLocaleDateString() : "—"}
                </p>
              </div>
            </div>
            <div className="space-y-3">
              {assignments.map((a) => {
                const key = `${m.match_id}:${a.referee_id}`;
                const isRated = a.my_rating != null;
                const canEdit = a.editable;
                const isEditing = editingKey === key || !isRated;
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
                      {isRated && (
                        <div className="text-right shrink-0">
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <Star
                                key={n}
                                className={`h-3.5 w-3.5 ${
                                  n <= (a.my_rating ?? 0)
                                    ? "fill-amber-400 text-amber-400"
                                    : "text-muted-foreground/30"
                                }`}
                              />
                            ))}
                          </div>
                          {a.my_rating_at && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {new Date(a.my_rating_at).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {isRated && !isEditing && a.my_comment && (
                      <p className="text-xs text-muted-foreground italic mb-2 pl-1">"{a.my_comment}"</p>
                    )}

                    {isEditing && canEdit ? (
                      <>
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
                        <div className="mt-2 flex justify-end gap-2">
                          {isRated && (
                            <Button size="sm" variant="ghost" onClick={() => setEditingKey(null)}>
                              Cancelar
                            </Button>
                          )}
                          <Button size="sm" onClick={() => onSubmit(m.match_id, a.referee_id)}>
                            {isRated ? "Atualizar avaliação" : "Enviar avaliação"}
                          </Button>
                        </div>
                      </>
                    ) : isRated && canEdit ? (
                      <div className="flex justify-end">
                        <Button size="sm" variant="outline" onClick={() => setEditingKey(key)}>
                          Editar
                        </Button>
                      </div>
                    ) : isRated && !canEdit ? (
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Lock className="h-3 w-3" /> Partida encerrada — avaliação bloqueada.
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
