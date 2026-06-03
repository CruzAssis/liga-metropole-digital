import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useIsAdmin } from "@/hooks/use-is-admin";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { isAdmin, loading } = useIsAdmin();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Redireciona /admin para /admin/dashboard quando usuario e admin confirmado
  useEffect(() => {
    if (!loading && isAdmin && pathname === "/admin") {
      navigate({ to: "/admin/dashboard" });
    }
  }, [isAdmin, loading, pathname, navigate]);

  // Enquanto verifica permissao, nao renderiza nada (sem flash de conteudo protegido)
  if (loading) {
    return null;
  }

  // Se nao for admin, redireciona para minha-conta (sem historico de volta)
  if (!isAdmin) {
    throw redirect({ to: "/minha-conta", replace: true });
  }

  return <Outlet />;
}
