import { Link } from "@tanstack/react-router";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";

export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <BrandLogo className="h-8 w-8" />
            <span className="font-display text-xl tracking-wider">Liga Metrópole Várzea</span>
          </Link>
          <nav className="flex flex-wrap items-center gap-1">
            <Button asChild variant="ghost" size="sm"><Link to="/ranking">Ranking</Link></Button>
            <Button asChild variant="ghost" size="sm"><Link to="/resultados">Resultados</Link></Button>
            <Button asChild variant="ghost" size="sm"><Link to="/agenda">Agenda</Link></Button>
            <Button asChild variant="ghost" size="sm"><Link to="/times">Times</Link></Button>
            <Button asChild variant="ghost" size="sm"><Link to="/locais">Locais</Link></Button>
            <Button asChild variant="ghost" size="sm"><Link to="/atletas">Atletas</Link></Button>
            <Button asChild variant="ghost" size="sm"><Link to="/verificar">Verificar ID</Link></Button>
            <Button asChild variant="ghost" size="sm"><Link to="/login">Entrar</Link></Button>
            <Button asChild size="sm"><Link to="/signup">Criar conta</Link></Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
