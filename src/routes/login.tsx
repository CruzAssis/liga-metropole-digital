import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "@/components/BrandLogo";
import { Spinner } from "@/components/AppSkeletons";
import { safeInternalPath } from "@/lib/public-url";

const schema = z.object({
  email: z.string().email("Email inválido").max(255),
  password: z.string().min(1, "Informe sua senha").max(72),
});

type FormData = z.infer<typeof schema>;

// Aceita ?redirect=/inscricao para voltar ao destino apos o login
const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/login")({
  validateSearch: searchSchema,
  component: LoginPage,
});

function LoginPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { redirect: redirectTo } = useSearch({ from: "/login" });
  const safeRedirect = safeInternalPath(redirectTo, "/");
  const [submitting, setSubmitting] = useState(false);

  // Se ja esta autenticado, vai para redirect ou home
  useEffect(() => {
    if (!loading && user) {
      navigate({ to: safeRedirect as never, replace: true });
    }
  }, [user, loading, navigate, safeRedirect]);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword(data);
      if (error) {
        const msg = (error.message || "").toLowerCase();
        let friendly = "Não foi possível entrar. Tente novamente.";
        if (msg.includes("invalid login") || msg.includes("invalid credentials")) {
          friendly = "E-mail ou senha incorretos.";
        } else if (msg.includes("email not confirmed")) {
          friendly = "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.";
        } else if (msg.includes("user not found")) {
          friendly = "Usuário não encontrado. Verifique o e-mail ou crie uma conta.";
        } else if (msg.includes("rate") || msg.includes("too many")) {
          friendly = "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
        } else if (msg.includes("network") || msg.includes("fetch")) {
          friendly = "Falha de conexão. Verifique sua internet e tente novamente.";
        }
        toast.error(friendly);
        return;
      }
      toast.success("Bem-vindo de volta!");
      navigate({ to: safeRedirect as never, replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro inesperado ao entrar.";
      toast.error("Não foi possível entrar", { description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 justify-center mb-8">
          <BrandLogo className="h-10 w-10" />
          <span className="font-display text-2xl tracking-wider">Liga Metrópole</span>
        </Link>

        <div className="rounded-lg border border-border bg-card p-8">
          <h1 className="font-display text-3xl tracking-wide mb-1">Entrar</h1>
          <p className="text-sm text-muted-foreground mb-6">
            {safeRedirect === "/inscricao"
              ? "Entre na sua conta para inscrever seu time."
              : "Acesse sua conta de gestor."}
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register("email")} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                  Esqueci minha senha
                </Link>
              </div>
              <Input id="password" type="password" {...register("password")} />
              {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <><Spinner className="mr-2 h-4 w-4" />Aguarde...</> : "Entrar"}
            </Button>
          </form>

          <p className="mt-6 text-sm text-muted-foreground text-center">
            Ainda não tem conta?{" "}
            <Link to="/signup" className="text-primary hover:underline">
              Criar conta
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
