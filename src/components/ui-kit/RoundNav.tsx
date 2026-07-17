import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterPill } from "./FilterPill";

/**
 * Rodada picker used on /agenda and /resultados.
 * Horizontally scrollable pill row + prev/next arrows.
 */
export function RoundNav({
  total,
  value,
  onChange,
}: {
  total: number;
  value: number;
  onChange: (r: number) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scrollerRef.current) return;
    const active = scrollerRef.current.querySelector(
      '[data-active="true"]',
    ) as HTMLElement | null;
    active?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [value]);

  const prev = () => onChange(Math.max(1, value - 1));
  const next = () => onChange(Math.min(total, value + 1));

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={prev}
          disabled={value === 1}
          className="shrink-0 h-9 w-9"
          aria-label="Rodada anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div
          ref={scrollerRef}
          className="flex-1 overflow-x-auto scrollbar-none flex gap-1.5 py-1"
        >
          {Array.from({ length: total }, (_, i) => i + 1).map((r) => (
            <FilterPill
              key={r}
              active={value === r}
              onClick={() => onChange(r)}
              className="shrink-0"
            >
              Rod. {r}
            </FilterPill>
          ))}
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={next}
          disabled={value === total}
          className="shrink-0 h-9 w-9"
          aria-label="Próxima rodada"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-2 text-center font-medium tabular-nums">
        Rodada {value} de {total}
      </p>
    </div>
  );
}
