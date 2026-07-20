import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { KeyRound, Trash2 } from "lucide-react";
import { useIsAdmin } from "@/hooks/use-is-admin";
import {
  listUsers, setUserRole, sendPasswordReset, deleteUser, type AdminUser,
} from "@/lib/users.functions";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  component: UsuariosPage,
});

function UsuariosPage() {
  const { isAdmin, loading } = useIsAdmin();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [resetting, setResetting] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/" });
  }, [loading, isAdmin, navigate]);

  const fetchUsers = useServerFn(listUsers);
  const updateRole = useServerFn(setUserRole);
  const resetPwdFn = useServerFn(sendPasswordReset);
  const deleteUserFn = useServerFn(deleteUser);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => fetchUsers({}),
    enabled: isAdmin,
  });

  const mutation = useMutation({
    mutationFn: (vars: { user_id: string; role: "admin" | "director"; enabled: boolean }) =>
      updateRole({ data: vars }),
    onSuccess: () => {
      toast.success("Papel atualizado");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetMutation = useMutation({
    mutationFn: (user_id: string) => resetPwdFn({ data: { user_id } }),
    onSuccess: (r) => {
      toast.success(`E-mail de redefinição enviado para ${r.email}`);
      setResetting(null);
    },
    onError: (e: Error) => { toast.error(e.message); setResetting(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (user_id: string) => deleteUserFn({ data: { user_id } }),
    onSuccess: () => {
      toast.success("Usuário excluído");
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const list = data?.users ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (u) =>
        (u.full_name ?? "").toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q),
    );
  }, [data, search]);

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Usuários</h1>
        <p className="text-muted-foreground">Gerencie papéis (Admin / Gestor de time).</p>
      </div>

      <Input
        placeholder="Buscar por nome ou e-mail..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md"
      />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">CPF</th>
                <th className="px-4 py-3">Papéis</th>
                <th className="px-4 py-3 text-center">Admin</th>
                <th className="px-4 py-3 text-center">Gestor</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`sk-${i}`} className="border-b border-zinc-800 last:border-0">
                    <td className="px-4 py-3"><Skeleton className="h-4 w-40 rounded" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-32 rounded" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-28 rounded" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded" /></td>
                    <td className="px-4 py-3 text-center"><Skeleton className="h-5 w-10 rounded mx-auto" /></td>
                    <td className="px-4 py-3 text-center"><Skeleton className="h-5 w-10 rounded mx-auto" /></td>
                    <td className="px-4 py-3 text-right"><Skeleton className="h-8 w-24 rounded ml-auto" /></td>
                  </tr>
                ))}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum usuário encontrado
                  </td>
                </tr>
              )}
              {filtered.map((u: AdminUser) => {
                const isA = u.roles.includes("admin");
                const isM = u.roles.includes("director");
                return (
                  <tr key={u.id} className="border-t border-border">
                    <td className="px-4 py-3">{u.full_name || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.cpf_masked ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {isA && <Badge variant="default">Admin</Badge>}
                        {isM && <Badge variant="secondary">Gestor</Badge>}
                        {!isA && !isM && <span className="text-muted-foreground">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Switch
                        checked={isA}
                        disabled={mutation.isPending}
                        onCheckedChange={(v) =>
                          mutation.mutate({ user_id: u.id, role: "admin", enabled: v })
                        }
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Switch
                        checked={isM}
                        disabled={mutation.isPending}
                        onCheckedChange={(v) =>
                          mutation.mutate({ user_id: u.id, role: "director", enabled: v })
                        }
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline" size="sm"
                          onClick={() => setResetting(u)}
                          title="Enviar redefinição de senha"
                          disabled={!u.email}
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline" size="sm"
                          onClick={() => setDeleting(u)}
                          title="Excluir usuário"
                          className="border-red-700 text-red-400 hover:bg-red-950 hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <AlertDialog open={!!resetting} onOpenChange={(v) => { if (!v) setResetting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enviar redefinição de senha?</AlertDialogTitle>
            <AlertDialogDescription>
              Um e-mail será enviado para <b>{resetting?.email}</b> com o link para criar uma nova senha.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={resetMutation.isPending}
              onClick={(e) => { e.preventDefault(); if (resetting) resetMutation.mutate(resetting.id); }}
            >
              {resetMutation.isPending ? "Enviando..." : "Enviar e-mail"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleting} onOpenChange={(v) => { if (!v) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. <b>{deleting?.full_name ?? deleting?.email}</b> será removido do sistema.
              Times gerenciados por este usuário ficarão sem diretor (transfira antes se necessário).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={(e) => { e.preventDefault(); if (deleting) deleteMutation.mutate(deleting.id); }}
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir definitivamente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
