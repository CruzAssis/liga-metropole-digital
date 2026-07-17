import { MapPin } from "lucide-react";
import { FilterPill } from "./FilterPill";

export type ConferenceOption = {
  id: string;
  name: string;
  conference_name?: string | null;
  season?: number | null;
  subprefeitura?: string | null;
  zona?: string | null;
};

const ZONA_LABELS: Record<string, string> = {
  norte: "Zona Norte",
  sul: "Zona Sul",
  leste: "Zona Leste",
  oeste: "Zona Oeste",
  centro: "Centro",
};

/**
 * Shared conference selector used on /agenda, /resultados, /ranking.
 * Renders a pill group + a subtitle line for the active competition.
 */
export function ConferenceFilter({
  competitions,
  selectedId,
  onSelect,
  label = "Conferência",
}: {
  competitions: ConferenceOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  label?: string;
}) {
  if (competitions.length === 0) return null;
  const active = competitions.find((c) => c.id === selectedId);

  return (
    <div className="mb-5 space-y-2.5">
      <label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-semibold flex items-center gap-1.5">
        <MapPin className="h-3 w-3" /> {label}
      </label>
      <div className="flex flex-wrap gap-2">
        {competitions.map((c) => (
          <FilterPill
            key={c.id}
            active={selectedId === c.id}
            onClick={() => onSelect(c.id)}
          >
            {c.conference_name ?? c.name}
            {c.season ? ` ${c.season}` : ""}
          </FilterPill>
        ))}
      </div>
      {active?.subprefeitura && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <MapPin className="h-3 w-3" />
          {active.subprefeitura}
          {active.zona && ` · ${ZONA_LABELS[active.zona] ?? active.zona}`}
        </p>
      )}
    </div>
  );
}
