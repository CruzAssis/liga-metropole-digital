import { Link } from "@tanstack/react-router";
import { Trophy, Users, ShieldCheck, Megaphone, ArrowRight } from "lucide-react";

const PILLARS = [
  {
    icon: ShieldCheck,
    title: "Integridade em campo",
    text: "Súmulas digitais, ID Metrópole verificado e triagem de atletas. Cada partida com o mesmo rigor de uma liga profissional.",
  },
  {
    icon: Trophy,
    title: "Legado esportivo",
    text: "Rankings, estatísticas e destaques que transformam o futebol amador em história — do primeiro apito ao título de campeão.",
  },
  {
    icon: Users,
    title: "Comunidade primeiro",
    text: "Times, diretores, atletas e torcedores no mesmo ecossistema. Um lugar para pertencer, competir e crescer juntos.",
  },
];

const OPPORTUNITIES = [
  {
    tag: "Para times",
    title: "Clube Fundador",
    text: "Vagas limitadas para os 20 primeiros clubes. Acesso vitalício, voz no regulamento e destaque permanente na vitrine da liga.",
    cta: "Cadastrar meu time",
    to: "/signup" as const,
    search: { perfil: "diretor" as const },
  },
  {
    tag: "Para atletas",
    title: "ID Metrópole",
    text: "Crie seu perfil de atleta verificado, acumule estatísticas por temporada e seja descoberto pelos clubes da região.",
    cta: "Criar meu ID",
    to: "/signup" as const,
    search: { perfil: "jogador" as const },
  },
  {
    tag: "Para a torcida",
    title: "Acompanhe tudo",
    text: "Resultados, agenda, ranking e destaques da rodada. Torça pelo seu time e siga cada jogo em tempo real.",
    cta: "Explorar a liga",
    to: "/ranking" as const,
    search: undefined,
  },
];

export function AnimatedStats() {
  return (
    <>
      {/* Ideais da Liga */}
      <section
        className="relative border-y overflow-hidden"
        style={{ background: "#0B0B0D", borderColor: "#27272A" }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(ellipse at 50% 0%, rgba(21,101,245,0.18) 0%, transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 py-14 sm:py-20">
          <div className="max-w-2xl mb-10 sm:mb-14">
            <span
              className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest"
              style={{ color: "#4C9BFF" }}
            >
              <span
                className="h-px w-8"
                style={{ background: "#4C9BFF" }}
                aria-hidden
              />
              Nossos ideais
            </span>
            <h2
              className="mt-4 font-black text-white"
              style={{
                fontSize: "clamp(28px, 4.6vw, 44px)",
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
              }}
            >
              Feita para elevar o <span style={{ color: "#4C9BFF" }}>futebol de base</span> da nossa região.
            </h2>
            <p className="mt-4 text-sm sm:text-base text-zinc-400 leading-relaxed max-w-xl">
              A Liga Metrópole nasce para dar estrutura, transparência e reconhecimento
              ao futebol amador — com o padrão de uma competição séria e o coração da várzea.
            </p>
          </div>

          <div className="grid gap-4 sm:gap-6 md:grid-cols-3">
            {PILLARS.map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="rounded-xl p-5 sm:p-6 h-full"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid #27272A",
                }}
              >
                <div
                  className="inline-flex items-center justify-center h-10 w-10 rounded-lg mb-4"
                  style={{
                    background: "rgba(21,101,245,0.14)",
                    border: "1px solid rgba(21,101,245,0.35)",
                  }}
                >
                  <Icon className="h-5 w-5" style={{ color: "#4C9BFF" }} />
                </div>
                <h3 className="text-white font-bold text-lg mb-2 tracking-tight">
                  {title}
                </h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Oportunidades */}
      <section
        className="relative border-b"
        style={{ background: "#09090B", borderColor: "#27272A" }}
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-14 sm:py-20">
          <div className="flex items-end justify-between flex-wrap gap-4 mb-8 sm:mb-12">
            <div>
              <span
                className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest"
                style={{ color: "#4C9BFF" }}
              >
                <Megaphone className="h-3.5 w-3.5" />
                Oportunidades
              </span>
              <h2
                className="mt-3 font-black text-white"
                style={{
                  fontSize: "clamp(26px, 4vw, 38px)",
                  lineHeight: 1.1,
                  letterSpacing: "-0.02em",
                }}
              >
                Seu lugar na liga.
              </h2>
            </div>
          </div>

          <div className="grid gap-4 sm:gap-5 md:grid-cols-3">
            {OPPORTUNITIES.map((o) => (
              <Link
                key={o.title}
                to={o.to}
                search={o.search as any}
                className="group rounded-xl p-5 sm:p-6 flex flex-col transition-all hover:-translate-y-0.5"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(21,101,245,0.06) 0%, rgba(255,255,255,0.02) 100%)",
                  border: "1px solid #27272A",
                }}
              >
                <span
                  className="text-[10px] font-bold uppercase tracking-widest mb-3"
                  style={{ color: "#4C9BFF" }}
                >
                  {o.tag}
                </span>
                <h3 className="text-white font-black text-xl mb-2 tracking-tight">
                  {o.title}
                </h3>
                <p className="text-sm text-zinc-400 leading-relaxed flex-1">
                  {o.text}
                </p>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-white group-hover:gap-2.5 transition-all">
                  {o.cta}
                  <ArrowRight className="h-4 w-4" style={{ color: "#4C9BFF" }} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

export default AnimatedStats;
