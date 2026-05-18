import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Selo Verificado (ID Metropole) — círculo azul com check branco,
 * sobreposto ao avatar quando o atleta está verificado.
 */
export function VerifiedSeal({
  className,
  size = 20,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <span
      className={cn(
        "absolute -bottom-1 -right-1 inline-flex items-center justify-center rounded-full bg-primary border-2 border-card shadow",
        className,
      )}
      style={{ width: size, height: size }}
      aria-label="ID Metrópole verificado"
      title="ID Metrópole verificado"
    >
      <Check className="text-primary-foreground" style={{ width: size * 0.6, height: size * 0.6 }} strokeWidth={3} />
    </span>
  );
}
