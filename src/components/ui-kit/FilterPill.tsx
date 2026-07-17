import type { ReactNode, ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type FilterPillProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  children: ReactNode;
  count?: number | string;
};

/**
 * Canonical pill filter used across public pages
 * (conference filter, rodada picker, lado tabs).
 */
export function FilterPill({
  active = false,
  children,
  count,
  className,
  type = "button",
  ...rest
}: FilterPillProps) {
  return (
    <button
      type={type}
      data-active={active ? "true" : "false"}
      className={cn("filter-pill", className)}
      {...rest}
    >
      <span>{children}</span>
      {count !== undefined && (
        <span className="opacity-70 tabular-nums">({count})</span>
      )}
    </button>
  );
}
