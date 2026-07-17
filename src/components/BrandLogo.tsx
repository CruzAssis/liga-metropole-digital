import logoAsset from "@/assets/liga-metropole-logo.png.asset.json";
import { cn } from "@/lib/utils";

export function BrandLogo({
  className,
  alt = "Liga Metrópole",
}: {
  className?: string;
  alt?: string;
}) {
  return (
    <img
      src={logoAsset.url}
      alt={alt}
      className={cn("object-contain shrink-0", className)}
      draggable={false}
    />
  );
}
