import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { MapPin, Clock, Lightbulb, Home, Plane } from "lucide-react";

type Props = {
  teamId: string;
  onSaved?: () => void;
};

type RegType = "host" | "visitor";

export function TeamHomeVenueCard({ teamId, onSaved }: Props) {
  const [regType, setRegType] = useState<RegType>("visitor");
  const [venue, setVenue] = useState("");
  const [time, setTime] = useState("");
  const [initial, setInitial] = useState({ regType: "visitor" as RegType, venue: "", time: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("teams")
        .select("home_venue, home_time, registration_type")
        .eq("id", teamId)
        .maybeSingle();
      const v = data as { home_venue: string | null; home_time: string | null; registration_type: RegType | null } | null;
      const venueVal = v?.home_venue ?? "";
      const timeVal = v?.home_time ? v.home_time.slice(0, 5) : "";
      const typeVal: RegType = v?.registration_type === "host" ? "host" : "visitor";
      setRegType(typeVal);
      setVenue(venueVal);
      setTime(timeVal);
      setInitial({ regType: typeVal, venue: venueVal, time: timeVal });
      setLoading(false);
    })();
  }, [teamId]);

  const dirty = regType !== initial.regType || venue !== initial.venue || time !== initial.time;

  const save = async () => {
    if (regType === "host" && !venue.trim()) {
      toast.error("Informe o endereço/estádio do time mandante.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("teams")
        .update({
          registration_type: regType,
          home_venue: regType === "host" ? venue.trim() : venue.trim() || null,
          home_time: regType === "host" ? time || null : null,
        })
        .eq("id", teamId);
      if (error) throw error;
      setInitial({ regType, venue, time });
      toast.success("Configuração de mando atualizada!");
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
          <div className="space-y-2">
            <Label>Tipo de mando</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRegType("host")}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                  regType === "host"
                    ? "border-[#1565F5] bg-[#1565F5]/10 text-white"
                    : "border-zinc-700 bg-transparent text-zinc-300 hover:border-zinc-500"
                }`}
              >
                <Home className={`h-5 w-5 ${regType === "host" ? "text-[#5B9BFF]" : "text-zinc-400"}`} />
                <div>
                  <p className="font-semibold text-sm">Mandante</p>
                  <p className="text-xs text-muted-foreground">Joga em campo próprio</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setRegType("visitor")}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                  regType === "visitor"
                    ? "border-[#1565F5] bg-[#1565F5]/10 text-white"
                    : "border-zinc-700 bg-transparent text-zinc-300 hover:border-zinc-500"
                }`}
              >
                <Plane className={`h-5 w-5 ${regType === "visitor" ? "text-[#5B9BFF]" : "text-zinc-400"}`} />
                <div>
                  <p className="font-semibold text-sm">Visitante</p>
                  <p className="text-xs text-muted-foreground">Joga em campo do adversário</p>
                </div>
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Você pode alterar o tipo de mando a qualquer momento antes do sorteio da liga.
            </p>
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
                do horário limite que você deseja para o pontapé inicial. Esse tempo é
                fundamental para o aquecimento das equipes, organização dos uniformes e
                cobertura da mídia oficial da rodada!
              </p>
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={save} disabled={saving || !dirty}>
              {saving ? "Salvando..." : "Salvar configuração"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
