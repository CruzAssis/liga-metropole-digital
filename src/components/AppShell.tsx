import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Logo } from "./Logo";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center justify-between border-b border-border px-4">
            <Link to="/" className="flex items-center gap-3">
              <SidebarTrigger />
              <BrandLogo className="h-7 w-7" />
              <span className="font-display text-xl tracking-wider">Liga Metrópole</span>
            </Link>
            <div className="flex items-center gap-3">
              {isAdmin && (
                <Button asChild size="sm" variant="outline">
                  <Link to="/admin/triagem">
                    <Shield className="h-4 w-4 mr-1" /> Admin
                  </Link>
                </Button>
              )}
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {user?.email}
              </span>
            </div>
          </header>
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
