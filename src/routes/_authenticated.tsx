import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, loading } = useAuth();

  // Enquanto o estado de auth carrega, nao renderiza nada (evita flash de conteudo protegido)
  if (loading) {
    return null;
  }

  // Se nao autenticado, redireciona para /login substituindo o historico (sem volta)
  if (!user) {
    throw redirect({ to: "/login", replace: true });
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
