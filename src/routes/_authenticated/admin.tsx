import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useIsAdmin } from "@/hooks/use-is-admin";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { isAdmin, loading } = useIsAdmin();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (loading) return;
    if (!isAdmin) {
      navigate({ to: "/minha-conta" });
      return;
    }
    if (pathname === "/admin") {
      navigate({ to: "/admin/dashboard" });
    }
  }, [isAdmin, loading, pathname, navigate]);

  if (loading || !isAdmin) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Verificando acesso...
      </div>
    );
  }

  return <Outlet />;
}
