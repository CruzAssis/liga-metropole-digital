import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Trophy, Users, Calendar } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Liga Metrópole Várzea — Inscrições abertas" },
      {
        name: "description",
        content: "A maior liga de futebol de várzea da metrópole. Inscreva seu time agora.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Trophy className="h-6 w-6 text-primary" />
            <span className="font-display text-xl tracking-wider">Liga Metrópole Várzea</span>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost">
              <Link to="/login">Entrar</Link>
            </Button>
            <Button asChild>
              <Link to="/signup">Criar conta</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="mx-auto max-w-6xl px-6 py-24 md:py-32">
            <div className="max-w-3xl">
              <p className="text-sm uppercase tracking-[0.3em] text-primary mb-4">
                Temporada 2026
              </p>
              <h1 className="font-display text-6xl md:text-8xl leading-[0.95] tracking-wide">
                Metrópole<br />
                <span className="text-primary">Várzea</span>
              </h1>
              <p className="mt-6 text-lg text-muted-foreground max-w-xl">
                A liga oficial da várzea metropolitana. 80 times, dois grupos —
                Mandantes e Visitantes — uma temporada inteira de futebol de bairro.
              </p>
              <div className="mt-10 flex flex-wrap gap-3">
                <Button asChild size="lg" className="text-base">
                  <Link to="/signup">Inscrever meu time</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="text-base">
                  <Link to="/login">Já tenho conta</Link>
                </Button>
              </div>
            </div>
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute -right-32 top-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-primary/10 blur-3xl"
          />
        </section>

        <section className="border-t border-border bg-card/40">
          <div className="mx-auto grid max-w-6xl gap-6 px-6 py-16 md:grid-cols-3">
            {[
              { icon: Users, title: "40 + 40 vagas", desc: "Mandantes e Visitantes, por ordem de inscrição." },
              { icon: Calendar, title: "Temporada completa", desc: "Turno e returno com mata-mata final." },
              { icon: Trophy, title: "Premiação real", desc: "Troféus, medalhas e o título da metrópole." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-lg border border-border bg-card p-6">
                <Icon className="h-6 w-6 text-primary mb-3" />
                <h3 className="font-display text-2xl tracking-wide">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-8 text-sm text-muted-foreground">
          © {new Date().getFullYear()} Liga Metrópole Várzea
        </div>
      </footer>
    </div>
  );
}
