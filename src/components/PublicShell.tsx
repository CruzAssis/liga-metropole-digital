import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLeagueConfig } from "@/hooks/use-league-config";


const NAV = [
  { to: "/ranking", label: "Ranking" },
  { to: "/resultados", label: "Resultados" },
  { to: "/agenda", label: "Agenda" },
  { to: "/times", label: "Times" },
  { to: "/atletas", label: "Atletas" },
  { to: "/locais", label: "Locais" },
  { to: "/verificar", label: "Verificar ID" },
] as const;

export function PublicShell({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const cfg = useLeagueConfig();
  const leagueName = cfg?.league_name || "Liga Metrópole";
  const contactEmail = cfg?.contact_email || "shelderdouglasdacruz@gmail.com";


  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/", replace: true });
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header
        className="sticky top-0 z-50 border-b border-border/80 backdrop-blur-xl"
        style={{ background: "rgba(9, 9, 11, 0.85)" }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 h-16">
          <Link to="/" className="flex items-center gap-2 shrink-0" aria-label="Liga Metrópole">
            <BrandLogo className="h-9 w-auto" />
            <span className="font-black tracking-tight text-sm hidden sm:inline">
              <span className="text-white">LIGA</span>{" "}
              <span className="text-[#1565F5]">METRÓPOLE</span>
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-0.5">
            {NAV.map((item) => {
              const active = pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "relative px-3 py-2 text-sm font-semibold rounded-md transition-colors",
                    active
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.label}
                  {active && (
                    <span
                      className="absolute left-3 right-3 -bottom-[13px] h-[2px] rounded-full"
                      style={{ background: "var(--brand-primary)" }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            {!loading && (
              user ? (
                <>
                  <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                    <Link to="/minha-conta">Minha conta</Link>
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleSignOut} className="hidden sm:inline-flex">
                    Sair
                  </Button>
                </>
              ) : (
                <>
                  <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                    <Link to="/login">Entrar</Link>
                  </Button>
                  <Button asChild size="sm" className="hidden sm:inline-flex font-bold">
                    <Link to="/signup">Criar conta</Link>
                  </Button>
                </>
              )
            )}
            <button
              onClick={() => setOpen((v) => !v)}
              className="lg:hidden inline-flex items-center justify-center h-10 w-10 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
              aria-label="Abrir menu"
              aria-expanded={open}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {open && (
          <div className="lg:hidden border-t border-border bg-background/95 backdrop-blur-xl">
            <nav className="mx-auto max-w-6xl px-4 sm:px-6 py-3 flex flex-col">
              {NAV.map((item) => {
                const active = pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "px-3 py-2.5 text-sm font-semibold rounded-md",
                      active
                        ? "bg-primary/10 text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
              <div className="mt-2 pt-3 border-t border-border flex flex-col gap-2 sm:hidden">
                {!loading && (
                  user ? (
                    <>
                      <Button asChild variant="ghost" size="sm" className="justify-start">
                        <Link to="/minha-conta" onClick={() => setOpen(false)}>Minha conta</Link>
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => { setOpen(false); handleSignOut(); }}>
                        Sair
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button asChild variant="outline" size="sm">
                        <Link to="/login" onClick={() => setOpen(false)}>Entrar</Link>
                      </Button>
                      <Button asChild size="sm" className="font-bold">
                        <Link to="/signup" onClick={() => setOpen(false)}>Criar conta</Link>
                      </Button>
                    </>
                  )
                )}
              </div>
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-8 sm:py-12">
        {children}
      </main>

      <footer className="border-t border-border mt-auto">
        <div className="mx-auto flex max-w-6xl items-center justify-between flex-wrap gap-3 px-4 sm:px-6 py-6 text-xs text-muted-foreground">
          <span className="font-medium">© {new Date().getFullYear()} Liga Metrópole</span>
          <nav className="flex items-center gap-5">
            <Link to="/privacidade" className="hover:text-foreground transition-colors">Privacidade</Link>
            <Link to="/termos" className="hover:text-foreground transition-colors">Termos de Uso</Link>
            <a href="mailto:shelderdouglasdacruz@gmail.com" className="hover:text-foreground transition-colors">Contato</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
