import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Enquanto o estado de auth carrega, nao renderiza nada (evita flash de conteudo protegido)
  if (loading) {
    return null;
  }

  // Se nao autenticado, redireciona para /login preservando a URL de origem
  // para que apos o login o usuario volte automaticamente para onde queria ir.
  if (!user) {
    throw redirect({
      to: "/login",
      search: { redirect: pathname },
      replace: true,
    });
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
