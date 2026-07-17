import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: {
  title: string;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "mb-10 pb-6 border-b border-border/60 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && <div className="kicker mb-3">{eyebrow}</div>}
        <h1 className="display-title text-foreground">{title}</h1>
        {description && (
          <p className="mt-4 text-sm sm:text-base text-muted-foreground max-w-2xl leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
    </header>
  );
}
