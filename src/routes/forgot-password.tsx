import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Spinner } from "@/components/AppSkeletons";
import { BrandLogo } from "@/components/BrandLogo";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    });
    setSending(false);
    if (error) {
      toast.error("Não foi possível enviar", { description: error.message });
      return;
    }
    setSent(true);
    toast.success("E-mail de recuperação enviado!");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 justify-center mb-8">
          <BrandLogo className="h-10 w-10" />
          <span className="font-display text-2xl tracking-wider">Liga Metrópole</span>
        </Link>

        <div className="rounded-lg border border-border bg-card p-8">
          <h1 className="font-display text-3xl tracking-wide mb-1">Recuperar senha</h1>
          <p className="text-sm text-muted-foreground mb-6">
            {sent
              ? "Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha em instantes."
              : "Digite o e-mail da sua conta. Enviaremos um link para você criar uma nova senha."}
          </p>

          {!sent ? (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={sending}>
                {sending ? (
                  <>
                    <Spinner className="mr-2 h-4 w-4" />
                    Enviando...
                  </>
                ) : (
                  "Enviar link de recuperação"
                )}
              </Button>
            </form>
          ) : (
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>Não recebeu? Confira a caixa de spam ou tente novamente em alguns minutos.</p>
              <Button variant="outline" className="w-full" onClick={() => setSent(false)}>
                Enviar de novo
              </Button>
            </div>
          )}

          <p className="mt-6 text-sm text-muted-foreground text-center">
            Lembrou a senha?{" "}
            <Link to="/login" className="text-primary hover:underline">
              Voltar ao login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
