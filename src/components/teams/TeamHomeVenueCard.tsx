import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { updateTeamMando } from "@/lib/team-profile.functions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { MapPin, Clock, Lightbulb, Home, Plane, AlertTriangle } from "lucide-react";

type Props = {
  teamId: string;
  onSaved?: () => void;
};

type RegType = "host" | "visitor";

type CompStats = {
  host_approved: number;
  visitor_approved: number;
  host_slots: number;
  visitor_slots: number;
  competition_name: string | null;
} | null;

export function TeamHomeVenueCard({ teamId, onSaved }: Props) {
  const updateFn = useServerFn(updateTeamMando);
  const [regType, setRegType] = useState<RegType>("visitor");
  const [venue, setVenue] = useState("");
  const [time, setTime] = useState("");
  const [initial, setInitial] = useState({ regType: "visitor" as RegType, venue: "", time: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<CompStats>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("teams")
        .select("home_venue, home_time, registration_type, competition_id")
        .eq("id", teamId)
        .maybeSingle();
      const v = data as {
        home_venue: string | null;
        home_time: string | null;
        registration_type: RegType | null;
        competition_id: string | null;
      } | null;
      const venueVal = v?.home_venue ?? "";
      const timeVal = v?.home_time ? v.home_time.slice(0, 5) : "";
      const typeVal: RegType = v?.registration_type === "host" ? "host" : "visitor";
      setRegType(typeVal);
      setVenue(venueVal);
      setTime(timeVal);
      setInitial({ regType: typeVal, venue: venueVal, time: timeVal });

      if (v?.competition_id) {
        const { data: comp } = await supabase
          .from("competitions")
          .select("name, host_slots, visitor_slots")
          .eq("id", v.competition_id)
          .maybeSingle();
        const c = comp as { name: string; host_slots: number; visitor_slots: number } | null;
        if (c) {
          const [{ count: hostCount }, { count: visitorCount }] = await Promise.all([
            supabase.from("teams").select("id", { count: "exact", head: true })
              .eq("competition_id", v.competition_id).eq("registration_type", "host").eq("status", "approved"),
            supabase.from("teams").select("id", { count: "exact", head: true })
              .eq("competition_id", v.competition_id).eq("registration_type", "visitor").eq("status", "approved"),
          ]);
          setStats({
            host_approved: hostCount ?? 0,
            visitor_approved: visitorCount ?? 0,
            host_slots: c.host_slots,
            visitor_slots: c.visitor_slots,
            competition_name: c.name,
          });
        }
      }
      setLoading(false);
    })();
  }, [teamId]);

  const dirty = regType !== initial.regType || venue !== initial.venue || time !== initial.time;

  const hostFull = stats ? stats.host_approved >= stats.host_slots : false;
  const visitorFull = stats ? stats.visitor_approved >= stats.visitor_slots : false;
  const targetFull =
    regType !== initial.regType &&
    ((regType === "host" && hostFull) || (regType === "visitor" && visitorFull));

  const save = async () => {
    if (regType === "host" && !venue.trim()) {
      toast.error("Informe o endereço/estádio do time mandante.");
      return;
    }
    setSaving(true);
    try {
      const res = await updateFn({
        data: {
          team_id: teamId,
          registration_type: regType,
          home_venue: venue.trim() || null,
          home_time: time || null,
        },
      });
      setInitial({ regType, venue, time });
      if (res.status === "waitlist") {
        toast.warning("Alteração salva — seu time entrou na sala de espera por falta de vagas globais.");
      } else {
        toast.success("Configuração de mando atualizada!");
      }
      onSaved?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-5">
      <div className="flex items-center gap-2">
        <MapPin className="h-5 w-5 text-primary" />
        <h2 className="font-display text-2xl tracking-wide">Configuração de mando de campo</h2>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <>
          {stats && (
            <div className="rounded-md border border-zinc-800 bg-zinc-900/40 p-3 text-xs text-zinc-300">
              <p className="font-medium text-zinc-200 mb-1">Vagas na {stats.competition_name}</p>
              <div className="grid grid-cols-2 gap-2">
                <span>
                  Mandantes: <strong className={hostFull ? "text-red-400" : "text-green-400"}>
                    {stats.host_approved}/{stats.host_slots}
                  </strong>
                </span>
                <span>
                  Visitantes: <strong className={visitorFull ? "text-red-400" : "text-green-400"}>
                    {stats.visitor_approved}/{stats.visitor_slots}
                  </strong>
                </span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Tipo de mando</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRegType("host")}
                disabled={hostFull && initial.regType !== "host"}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  regType === "host"
                    ? "border-[#1565F5] bg-[#1565F5]/10 text-white"
                    : "border-zinc-700 bg-transparent text-zinc-300 hover:border-zinc-500"
                }`}
              >
                <Home className={`h-5 w-5 ${regType === "host" ? "text-[#5B9BFF]" : "text-zinc-400"}`} />
                <div>
                  <p className="font-semibold text-sm">Mandante</p>
                  <p className="text-xs text-muted-foreground">
                    {hostFull && initial.regType !== "host" ? "Sem vagas" : "Joga em campo próprio"}
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setRegType("visitor")}
                disabled={visitorFull && initial.regType !== "visitor"}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  regType === "visitor"
                    ? "border-[#1565F5] bg-[#1565F5]/10 text-white"
                    : "border-zinc-700 bg-transparent text-zinc-300 hover:border-zinc-500"
                }`}
              >
                <Plane className={`h-5 w-5 ${regType === "visitor" ? "text-[#5B9BFF]" : "text-zinc-400"}`} />
                <div>
                  <p className="font-semibold text-sm">Visitante</p>
                  <p className="text-xs text-muted-foreground">
                    {visitorFull && initial.regType !== "visitor" ? "Sem vagas" : "Joga em campo do adversário"}
                  </p>
                </div>
              </button>
            </div>
            {targetFull && (
              <p className="flex items-center gap-2 text-xs text-red-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                Esta liga não tem mais vagas para este tipo de mando.
              </p>
            )}
          </div>

          {regType === "host" && (
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="home_venue" className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" /> Estádio / Arena padrão
                </Label>
                <Input
                  id="home_venue"
                  value={venue}
                  maxLength={120}
                  placeholder="Ex.: Arena Metrópole"
                  onChange={(e) => setVenue(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="home_time" className="flex items-center gap-1">
                  <Clock className="h-4 w-4" /> Horário padrão de jogo
                </Label>
                <Input
                  id="home_time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>
            </div>
          )}

          {regType === "host" && (
            <div className="rounded-md border border-primary/40 bg-primary/10 p-4 flex gap-3">
              <Lightbulb className="h-5 w-5 shrink-0 text-primary mt-0.5" />
              <p className="text-sm leading-relaxed">
                <span className="font-semibold">Recomendação da Liga:</span> defina o
                horário padrão com pelo menos <strong>30 minutos de antecedência</strong>{" "}
                do horário limite que você deseja para o pontapé inicial.
              </p>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={save} disabled={saving || !dirty || targetFull}>
              {saving ? "Salvando..." : "Salvar configuração"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
