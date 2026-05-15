import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Check, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/triagem")({
  component: TriagemPage,
});

type Team = {
  id: string;
  name: string;
  short_name: string;
  registration_type: "host" | "visitor";
  status: "pending" | "approved" | "rejected" | "waitlist";
  created_at: string;
  approved_at: string | null;
  rejected_reason: string | null;
  logo_url: string | null;
  manager_id: string;
};

type Profile = { id: string; full_name: string; phone: string | null };

const STATUS_TABS = [
  { value: "pending", label: "Pendentes" },
  { value: "waitlist", label: "Sala de Espera" },
  { value: "approved", label: "Aprovados" },
  { value: "rejected", label: "Rejeitados" },
  { value: "all", label: "Todos" },
] as const;

function TriagemPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [statusTab, setStatusTab] = useState<(typeof STATUS_TABS)[number]["value"]>("pending");
  const [typeFilter, setTypeFilter] = useState<"all" | "host" | "visitor">("all");
  const [search, setSearch] = useState("");
  const [rejectTarget, setRejectTarget] = useState<Team | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approveTarget, setApproveTarget] = useState<Team | null>(null);
  const [busy, setBusy] = useState(false);

  const loadTeams = async () => {
    const { data } = await supabase
      .from("teams")
      .select("*")
      .order("created_at", { ascending: true });
    const list = (data as Team[]) ?? [];
    setTeams(list);

    const ids = Array.from(new Set(list.map((t) => t.manager_id)));
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,full_name,phone")
        .in("id", ids);
      const map: Record<string, Profile> = {};
      (profs ?? []).forEach((p: any) => (map[p.id] = p));
      setProfiles(map);
    }
  };

  useEffect(() => {
    loadTeams();
    const channel = supabase
      .channel("teams-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, () => {
        loadTeams();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const counts = useMemo(() => {
    const host = teams.filter((t) => t.registration_type === "host" && t.status === "approved").length;
    const visitor = teams.filter((t) => t.registration_type === "visitor" && t.status === "approved").length;
    return { host, visitor };
  }, [teams]);

  const filtered = useMemo(() => {
    return teams.filter((t) => {
      if (statusTab !== "all" && t.status !== statusTab) return false;
      if (typeFilter !== "all" && t.registration_type !== typeFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!t.name.toLowerCase().includes(s) && !t.short_name.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [teams, statusTab, typeFilter, search]);

  const slotFull = (type: "host" | "visitor") => counts[type] >= 40;

  const confirmApprove = async () => {
    if (!approveTarget) return;
    setBusy(true);
    const { error } = await supabase
      .from("teams")
      .update({ status: "approved", approved_at: new Date().toISOString(), rejected_reason: null })
      .eq("id", approveTarget.id);
    setBusy(false);
    if (error) {
      toast.error("Erro ao aprovar", { description: error.message });
    } else {
      toast.success("Time aprovado");
    }
    setApproveTarget(null);
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    if (rejectReason.trim().length < 3) {
      toast.error("Informe um motivo");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("teams")
      .update({ status: "rejected", rejected_reason: rejectReason.trim() })
      .eq("id", rejectTarget.id);
    setBusy(false);
    if (error) {
      toast.error("Erro ao rejeitar", { description: error.message });
    } else {
      toast.success("Time rejeitado");
    }
    setRejectTarget(null);
    setRejectReason("");
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-4xl tracking-wide">Triagem de Inscrições</h1>
          <p className="text-muted-foreground">Aprove ou rejeite times e gerencie vagas.</p>
        </div>

        {/* Quota cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <QuotaCard label="Mandantes Aprovados" count={counts.host} />
          <QuotaCard label="Visitantes Aprovados" count={counts.visitor} />
        </div>

        {/* Filters */}
        <Card className="p-4 bg-card border-border space-y-4">
          <Tabs value={statusTab} onValueChange={(v) => setStatusTab(v as any)}>
            <TabsList>
              {STATUS_TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-md border border-border bg-background overflow-hidden">
              {(["all", "host", "visitor"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setTypeFilter(v)}
                  className={`px-3 py-1.5 text-sm ${typeFilter === v ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                >
                  {v === "all" ? "Todos" : v === "host" ? "Mandantes" : "Visitantes"}
                </button>
              ))}
            </div>
            <Input
              placeholder="Buscar nome ou sigla..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <span className="text-sm text-muted-foreground ml-auto">{filtered.length} time(s)</span>
          </div>
        </Card>

        {/* List */}
        <div className="space-y-3">
          {filtered.length === 0 && (
            <Card className="p-10 text-center text-muted-foreground bg-card border-border">
              Nenhum time encontrado com esses filtros.
            </Card>
          )}
          {filtered.map((t) => {
            const profile = profiles[t.manager_id];
            const isFull = slotFull(t.registration_type);
            const canApprove = t.status !== "approved" && !isFull;
            return (
              <Card key={t.id} className="p-4 bg-card border-border">
                <div className="flex flex-wrap items-center gap-4">
                  {t.logo_url ? (
                    <img src={t.logo_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-muted shrink-0" />
                  )}
                  <div className="min-w-[180px]">
                    <div className="font-semibold">
                      {t.name} <span className="text-muted-foreground font-normal">· {t.short_name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {profile?.full_name ?? "—"} · {profile?.phone ?? "sem tel."}
                    </div>
                  </div>
                  <TypeBadge type={t.registration_type} />
                  <div className="text-xs text-muted-foreground">
                    {new Date(t.created_at).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).replace(",", " —")}
                  </div>
                  <StatusBadge status={t.status} />
                  <div className="ml-auto flex gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Button
                            size="sm"
                            disabled={!canApprove}
                            onClick={() => setApproveTarget(t)}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50"
                          >
                            <Check className="h-4 w-4 mr-1" /> Aprovar
                          </Button>
                        </span>
                      </TooltipTrigger>
                      {!canApprove && (
                        <TooltipContent>
                          {t.status === "approved" ? "Já aprovado" : "Vagas esgotadas"}
                        </TooltipContent>
                      )}
                    </Tooltip>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={t.status === "rejected"}
                      onClick={() => {
                        setRejectTarget(t);
                        setRejectReason("");
                      }}
                    >
                      <X className="h-4 w-4 mr-1" /> Rejeitar
                    </Button>
                  </div>
                </div>
                {t.status === "rejected" && t.rejected_reason && (
                  <div className="mt-2 text-xs text-muted-foreground italic">
                    Motivo: {t.rejected_reason}
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        {/* Approve dialog */}
        <Dialog open={!!approveTarget} onOpenChange={(o) => !o && setApproveTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Aprovar inscrição?</DialogTitle>
              <DialogDescription>
                Confirme a aprovação do time <strong>{approveTarget?.name}</strong> ({approveTarget?.short_name}).
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setApproveTarget(null)}>Cancelar</Button>
              <Button
                onClick={confirmApprove}
                disabled={busy}
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                Confirmar aprovação
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reject dialog */}
        <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rejeitar inscrição</DialogTitle>
              <DialogDescription>
                Informe o motivo da rejeição de <strong>{rejectTarget?.name}</strong>.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Motivo da rejeição..."
              rows={4}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={confirmReject} disabled={busy}>
                Confirmar rejeição
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

function QuotaCard({ label, count }: { label: string; count: number }) {
  const full = count >= 40;
  return (
    <Card
      className={`p-6 bg-card border-2 ${full ? "border-emerald-500" : "border-border"}`}
    >
      <div className="flex items-start justify-between">
        <div className="text-sm uppercase tracking-wider text-muted-foreground">{label}</div>
        {full && (
          <span className="text-[10px] font-semibold px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
            VAGAS PREENCHIDAS
          </span>
        )}
      </div>
      <div className="font-display text-7xl mt-3">
        {count} <span className="text-muted-foreground text-4xl">/ 40</span>
      </div>
    </Card>
  );
}

function TypeBadge({ type }: { type: "host" | "visitor" }) {
  return type === "host" ? (
    <span className="text-[10px] font-semibold px-2 py-1 rounded bg-primary text-primary-foreground">
      MANDANTE
    </span>
  ) : (
    <span className="text-[10px] font-semibold px-2 py-1 rounded bg-muted text-muted-foreground">
      VISITANTE
    </span>
  );
}

function StatusBadge({ status }: { status: Team["status"] }) {
  const map = {
    pending: { label: "Em análise", cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
    approved: { label: "Aprovado", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
    rejected: { label: "Rejeitado", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
    waitlist: { label: "Sala de espera", cls: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  } as const;
  const m = map[status];
  return <span className={`text-xs px-2 py-1 rounded border ${m.cls}`}>{m.label}</span>;
}
