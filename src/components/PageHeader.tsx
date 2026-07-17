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
        "mb-8 sm:mb-10 pb-4 sm:pb-6 border-b border-border/60",
        "flex flex-col gap-4 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:gap-4",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && <div className="kicker mb-3">{eyebrow}</div>}
        <h1 className="display-title text-foreground">{title}</h1>
        {description && (
          <p className="mt-3 sm:mt-4 text-sm sm:text-base text-muted-foreground max-w-2xl leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>
      )}
    </header>
  );
}

