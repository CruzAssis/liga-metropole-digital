import { useEffect, useRef, useState } from "react";

type Stat = { value: number; suffix?: string; label: string };

const STATS: Stat[] = [
  { value: 80, label: "Times" },
  { value: 600, suffix: "+", label: "Jogadores" },
  { value: 40, label: "Campos" },
  { value: 3, label: "Fases" },
];

function easeOut(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function Counter({ stat, start }: { stat: Stat; start: boolean }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!start) return;
    let raf = 0;
    const t0 = performance.now();
    const dur = 1500;
    const tick = (now: number) => {
      const p = Math.min((now - t0) / dur, 1);
      setN(Math.round(easeOut(p) * stat.value));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [start, stat.value]);
  return (
    <span
      className="font-display tabular-nums"
      style={{
        fontSize: "clamp(40px, 6vw, 56px)",
        lineHeight: 1,
        color: "#FAFAFA",
        letterSpacing: "0.01em",
      }}
    >
      {n}
      {stat.suffix ?? ""}
    </span>
  );
}

export function AnimatedStats() {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!ref.current || inView) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [inView]);

  return (
    <section
      ref={ref}
      className="relative border-y overflow-hidden"
      style={{ background: "#0B0B0D", borderColor: "#27272A" }}
    >
      {/* Subtle glow behind grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse at 50% 100%, rgba(21,101,245,0.15) 0%, transparent 60%)",
        }}
      />
      <div className="relative mx-auto grid max-w-5xl grid-cols-2 md:grid-cols-4">
        {STATS.map((s, i) => (
          <div
            key={s.label}
            className="flex flex-col items-center justify-center py-10 md:py-14 px-4"
            style={{
              borderRight: i < STATS.length - 1 ? "1px solid #27272A" : "none",
              borderBottom: i < 2 ? "1px solid #27272A" : "none",
            }}
          >
            <Counter stat={s} start={inView} />
            <span
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                color: "#71717A",
                marginTop: 10,
                fontWeight: 700,
              }}
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>
      <style>{`
        @media (min-width: 768px) {
          section[data-stats] > div > div { border-bottom: none !important; }
        }
      `}</style>
    </section>
  );
}

export default AnimatedStats;
