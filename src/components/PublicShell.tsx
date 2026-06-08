import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft } from "lucide-react";

export function PublicShell({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/", replace: true });
  };

  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const isHome = currentPath === "/";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <BrandLogo className="h-8 w-8" />
            <span className="font-display text-xl tracking-wider">Liga Metrópole</span>
          </Link>
          <nav className="flex flex-wrap items-center gap-1">
            <Button asChild variant="ghost" size="sm"><Link to="/ranking">Ranking</Link></Button>
            <Button asChild variant="ghost" size="sm"><Link to="/resultados">Resultados</Link></Button>
            <Button asChild variant="ghost" size="sm"><Link to="/agenda">Agenda</Link></Button>
            <Button asChild variant="ghost" size="sm"><Link to="/times">Times</Link></Button>
            <Button asChild variant="ghost" size="sm"><Link to="/locais">Locais</Link></Button>
            <Button asChild variant="ghost" size="sm"><Link to="/atletas">Atletas</Link></Button>
            <Button asChild variant="ghost" size="sm"><Link to="/verificar">Verificar ID</Link></Button>
            {!loading && (
              user ? (
                <Button variant="ghost" size="sm" onClick={handleSignOut}>Sair</Button>
              ) : (
                <>
                  <Button asChild variant="ghost" size="sm"><Link to="/login">Entrar</Link></Button>
                  <Button asChild size="sm"><Link to="/signup">Criar conta</Link></Button>
                </>
              )
            )}

            {!isHome && (
              <Link to="/" className="flex items-center gap-1 text-sm text-zinc-400 hover:text-white transition-colors mr-2">
                <ArrowLeft className="h-4 w-4" />
                Início
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
      <footer className="border-t border-border mt-auto">
        <div className="mx-auto flex max-w-6xl items-center justify-between flex-wrap gap-2 px-6 py-4 text-xs text-muted-foreground">
          <span>&copy; {new Date().getFullYear()} Liga Metrópole</span>
          <nav className="flex items-center gap-4">
            <Link to="/privacidade" className="hover:text-foreground transition-colors">Privacidade</Link>
            <Link to="/termos" className="hover:text-foreground transition-colors">Termos de Uso</Link>
            <a href="mailto:shelderdouglasdacruz@gmail.com" className="hover:text-foreground transition-colors">Contato</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
