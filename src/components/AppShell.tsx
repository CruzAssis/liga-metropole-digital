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
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-40 h-14 flex items-center justify-between border-b border-border/60 bg-background/80 px-3 sm:px-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center gap-3 min-w-0">
              <SidebarTrigger className="shrink-0" />
              <Link to="/" className="flex items-center gap-2 min-w-0">
                <BrandLogo className="h-8 w-auto" />
                <span className="font-black tracking-tight text-sm sm:text-base">
                  <span className="text-white">LIGA</span>{" "}
                  <span className="text-[#1565F5]">METRÓPOLE</span>
                </span>
              </Link>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              {isAdmin && (
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
                >
                  <Link to="/admin/triagem">
                    <Shield className="h-4 w-4" />
                    <span className="hidden sm:inline">Admin</span>
                  </Link>
                </Button>
              )}
              <span className="text-xs sm:text-sm text-muted-foreground hidden md:inline truncate max-w-[220px]">
                {user?.email}
              </span>
            </div>
          </header>
          <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>

        </div>
      </div>
    </SidebarProvider>
  );
}
