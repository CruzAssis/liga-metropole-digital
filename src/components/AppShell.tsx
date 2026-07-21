import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { BrandLogo } from "./BrandLogo";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();

  return (
    <SidebarProvider>
      {/* Skip to main content — first tab stop for keyboard users. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-lg focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
      >
        Ir para o conteúdo
      </a>
      <div className="min-h-dvh flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header
            role="banner"
            className="sticky top-0 z-40 h-14 flex items-center justify-between gap-2 border-b border-border/60 bg-background/80 px-3 sm:px-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/60"
          >
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <SidebarTrigger
                className="shrink-0 h-10 w-10 sm:h-9 sm:w-9"
                aria-label="Abrir/fechar menu lateral"
              />
              <Link
                to="/"
                className="flex items-center gap-2 min-w-0 rounded-md focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label="Liga Metrópole — Início"
              >
                <BrandLogo className="h-8 w-auto shrink-0" />
                <span className="font-black tracking-tight text-sm sm:text-base truncate">
                  <span className="text-white">LIGA</span>{" "}
                  <span className="text-[#1565F5]">METRÓPOLE</span>
                </span>
              </Link>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {isAdmin && (
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-primary/40 text-primary hover:bg-primary/10 hover:text-primary min-h-10 sm:min-h-9"
                >
                  <Link to="/admin/triagem" aria-label="Painel administrativo">
                    <Shield className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden sm:inline">Admin</span>
                  </Link>
                </Button>
              )}
              <span className="text-xs sm:text-sm text-muted-foreground hidden md:inline truncate max-w-[220px]">
                {user?.email}
              </span>
            </div>
          </header>
          <main
            id="main-content"
            tabIndex={-1}
            className="flex-1 p-4 sm:p-6 lg:p-8 focus:outline-hidden"
          >
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
