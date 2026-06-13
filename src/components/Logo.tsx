type LogoVariant = "symbol" | "horizontal" | "full";

interface LogoProps {
  variant?: LogoVariant;
  size?: number;
  color?: string;
  className?: string;
}

function Symbol({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        d="M 4,34 L 4,14 L 14,24 L 20,8 L 26,24 L 36,14 L 36,34"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M 4,34 L 36,34"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="20" cy="8" r="2.5" fill="#1565F5" />
    </svg>
  );
}

export function Logo({
  variant = "horizontal",
  size = 32,
  color = "#1565F5",
  className,
}: LogoProps) {
  if (variant === "symbol") {
    return (
      <span className={className} style={{ display: "inline-flex" }}>
        <Symbol size={size} color={color} />
      </span>
    );
  }

  if (variant === "full") {
    return (
      <span
        className={className}
        style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: size * 0.15 }}
      >
        <Symbol size={size} color={color} />
        <span style={{ display: "inline-flex", lineHeight: 1, fontFamily: "var(--font-display, 'Bebas Neue', sans-serif)" }}>
          <span style={{ color: "#FFFFFF", fontWeight: 900, letterSpacing: "-0.02em", fontSize: size * 0.5 }}>LIGA</span>
          <span style={{ width: size * 0.15 }} />
          <span style={{ color: "#1565F5", fontWeight: 900, letterSpacing: "-0.02em", fontSize: size * 0.5 }}>METRÓPOLE</span>
        </span>
      </span>
    );
  }

  return (
    <span
      className={className}
      style={{ display: "inline-flex", alignItems: "center", gap: size * 0.25 }}
    >
      <Symbol size={size} color={color} />
      <span style={{ display: "inline-flex", lineHeight: 1, fontFamily: "var(--font-display, 'Bebas Neue', sans-serif)" }}>
        <span style={{ color: "#FFFFFF", fontWeight: 900, letterSpacing: "-0.02em", fontSize: size * 0.65 }}>LIGA</span>
        <span style={{ width: size * 0.18 }} />
        <span style={{ color: "#1565F5", fontWeight: 900, letterSpacing: "-0.02em", fontSize: size * 0.65 }}>METRÓPOLE</span>
      </span>
    </span>
  );
}

export default Logo;
