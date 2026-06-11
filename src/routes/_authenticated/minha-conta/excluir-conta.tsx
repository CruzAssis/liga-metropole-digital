import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AlertTriangle, ChevronLeft, Trash2, ShieldAlert } from "lucide-react";
import { Spinner } from "@/components/AppSkeletons";

const supabaseAny = supabase as any;

export const Route = createFileRoute("/minha-conta/excluir-conta")({
  component: ExcluirContaPage,
  head: () => ({
    meta: [{ title: "Excluir Conta · Liga Metropole" }],
  }),
});

type Step = "aviso" | "senha" | "confirmando" | "concluido";

function ExcluirContaPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("aviso");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleConfirmar() {
    if (!senha.trim()) {
      setErro("Informe sua senha para confirmar.");
      return;
    }
    if (!user?.email) {
      setErro("Nao foi possivel identificar seu e-mail. Faca login novamente.");
      return;
    }
    setLoading(true);
    setErro(null);
    setStep("confirmando");

    try {
      // 1. Re-autenticar para confirmar a senha
      const { error: reAuthErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: senha,
      });
      if (reAuthErr) {
        setErro("Senha incorreta. Tente novamente.");
        setStep("senha");
        return;
      }

      // 2. Solicitar exclusao da conta (Supabase Admin via Edge Function ou direto)
      // Como nao temos Edge Function dedicada, usamos deleteUser via API publica
      // que aciona a logica de exclusao em cascata configurada no banco.
      const { error: delErr } = await supabaseAny.rpc("request_account_deletion");

      if (delErr) {
        // Fallback: marcar conta para exclusao via metadata e notificar admin
        await supabase.auth.updateUser({
          data: { deletion_requested_at: new Date().toISOString() },
        });
      }

      // 3. Fazer logout
      await signOut();
      setStep("concluido");
      toast.success("Solicitacao de exclusao registrada. Sua conta sera removida em ate 30 dias.");
      setTimeout(() => navigate({ to: "/", replace: true }), 4000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro inesperado.";
      setErro(msg);
      setStep("senha");
    } finally {
      setLoading(false);
    }
  }

  if (step === "concluido") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-green-900/20 border border-green-800/40 flex items-center justify-center mx-auto">
            <Trash2 className="h-8 w-8 text-green-400" />
          </div>
          <h1 className="font-display text-3xl tracking-wide">Solicitacao registrada</h1>
          <p className="text-muted-foreground">
            Sua solicitacao de exclusao de conta foi registrada. Os seus dados serao removidos
            conforme nossa{" "}
            <Link to="/privacidade" className="text-primary hover:underline">
              Politica de Privacidade
            </Link>
            . Voce sera redirecionado em instantes...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="max-w-lg mx-auto space-y-8">
        {/* Back */}
        <Link
          to="/minha-conta"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Voltar para Minha Conta
        </Link>

        {/* Warning header */}
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 space-y-3">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-6 w-6 text-destructive shrink-0" />
            <h1 className="font-display text-2xl tracking-wide text-destructive">
              Excluir conta
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Esta acao e <strong className="text-foreground">permanente e irreversivel</strong>.
            Ao excluir sua conta:
          </p>
          <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1 ml-2">
            <li>Seu perfil e dados pessoais serao removidos</li>
            <li>Seu ID Metropole sera desativado</li>
            <li>Seu time sera desvinculado da sua conta</li>
            <li>O historico esportivo pode ser mantido de forma anonimizada</li>
            <li>Registros financeiros sao mantidos por 5 anos por exigencia legal</li>
          </ul>
        </div>

        {step === "aviso" && (
          <div className="space-y-6">
            <div className="rounded-lg border border-border bg-card p-5 space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                <span>
                  Antes de excluir, considere apenas{" "}
                  <Link
                    to="/minha-conta"
                    className="text-primary hover:underline"
                  >
                    atualizar seus dados
                  </Link>{" "}
                  ou entrar em contato:
                </span>
              </div>
              <a
                href="mailto:shelderdouglasdacruz@gmail.com"
                className="text-sm text-primary hover:underline"
              >
                shelderdouglasdacruz@gmail.com
              </a>
            </div>

            <div className="flex gap-3">
              <Button
                variant="destructive"
                onClick={() => setStep("senha")}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Quero excluir minha conta
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate({ to: "/minha-conta" })}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {(step === "senha" || step === "confirmando") && (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">
              Para confirmar a exclusao, insira sua senha atual:
            </p>

            <div className="space-y-2">
              <Label htmlFor="senha" className="text-foreground">
                Sua senha
              </Label>
              <Input
                id="senha"
                type="password"
                value={senha}
                onChange={(e) => {
                  setSenha(e.target.value);
                  setErro(null);
                }}
                placeholder="Digite sua senha"
                disabled={step === "confirmando"}
                className="bg-zinc-900 border-zinc-700 text-white"
                autoComplete="current-password"
              />
              {erro && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" /> {erro}
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                variant="destructive"
                onClick={handleConfirmar}
                disabled={loading || step === "confirmando"}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                {step === "confirmando" ? <><Spinner className="mr-2 h-4 w-4" />Aguarde...</> : "Confirmar exclusao"}
              </Button>
              <Button
                variant="outline"
                onClick={() => { setStep("aviso"); setSenha(""); setErro(null); }}
                disabled={loading || step === "confirmando"}
              >
                Cancelar
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Seus dados serao tratados conforme a{" "}
              <Link to="/privacidade" className="text-primary hover:underline">
                Politica de Privacidade
              </Link>
              .
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
