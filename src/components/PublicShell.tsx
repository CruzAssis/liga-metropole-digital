import { Link } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <Trophy className="h-6 w-6 text-primary" />
            <span className="font-display text-xl tracking-wider">Liga Metrópole Várzea</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/atletas">Atletas</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/verificar">Verificar ID</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">Entrar</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/signup">Criar conta</Link>
            </Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
