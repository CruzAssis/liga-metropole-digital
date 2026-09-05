import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { findAthleteByCpf, verifyAthlete } from "@/lib/athletes.functions";
import { maskCpf, isValidCpf, onlyDigits } from "@/lib/cpf";
import { PublicShell } from "@/components/PublicShell";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, BadgeCheck } from "lucide-react";

export const Route = createFileRoute("/verificar")({
  component: VerificarPage,
  head: () => ({
    meta: [
      { title: "Verificar ID Metrópole" },
      { name: "description", content: "Ative seu ID Metrópole com CPF." },
    ],
  }),
});

type FoundAthlete = {
  id: string;
  masked_name: string;
  team_name: string | null;
  verified: boolean;
};

function VerificarPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const findFn = useServerFn(findAthleteByCpf);
  const verifyFn = useServerFn(verifyAthlete);

  const [cpf, setCpf] = useState("");
  const [searching, setSearching] = useState(false);
  const [athlete, setAthlete] = useState<FoundAthlete | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [position, setPosition] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [instagram, setInstagram] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSearch = async () => {
    if (!isValidCpf(cpf)) {
      toast.error("CPF inválido");
      return;
    }
    setSearching(true);
    setNotFound(false);
    setAthlete(null);
    try {
      const res = await findFn({ data: { cpf: onlyDigits(cpf) } });
      if (res.found) {
        // A busca publica devolve so o nome mascarado — o bastante para o
        // atleta reconhecer o proprio pre-cadastro. Todo o resto ele preenche
        // abaixo, ja logado, e so entao vira dado nosso.
        setAthlete(res.athlete as FoundAthlete);
      } else {
        setNotFound(true);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao buscar CPF");
    } finally {
      setSearching(false);
    }
  };

  const handlePhoto = (file: File | null) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Foto deve ter no máximo 2MB");
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleActivate = async () => {
    if (!user) {
      toast.error("Faça login para ativar seu ID Metrópole");
      navigate({ to: "/login" });
      return;
    }
    if (!athlete) return;
    if (!fullName.trim() || !nickname.trim()) {
      toast.error("Informe nome completo e apelido");
      return;
    }
    setSubmitting(true);
    try {
      let photoUrl: string | undefined;
      if (photoFile) {
        const ext = photoFile.name.split(".").pop() ?? "jpg";
        const path = `${athlete.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("athlete-photos")
          .upload(path, photoFile, { upsert: true, contentType: photoFile.type });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("athlete-photos").getPublicUrl(path);
        photoUrl = pub.publicUrl;
      }

      await verifyFn({
        data: {
          cpf: onlyDigits(cpf),
          full_name: fullName.trim(),
          nickname: nickname.trim(),
          position: position.trim() || undefined,
          photo_url: photoUrl,
          whatsapp: whatsapp.trim() || undefined,
          instagram_handle: instagram.trim().replace(/^@/, "") || undefined,
        },
      });
      toast.success("ID Metrópole ativado!");
      navigate({ to: "/atletas" });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao ativar");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PublicShell>
      <div className="max-w-xl mx-auto">
        <PageHeader
          eyebrow={<><BadgeCheck className="h-3.5 w-3.5" /> ID Metrópole</>}
          title="Verificar meu cadastro"
          description="Digite seu CPF para encontrar seu pré-cadastro feito pelo seu time e ativar seu ID oficial."
        />


        <div className="mt-8 rounded-lg border border-border bg-card p-6 space-y-4">
          <div>
            <Label htmlFor="cpf">CPF</Label>
            <Input
              id="cpf"
              inputMode="numeric"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => setCpf(maskCpf(e.target.value))}
              maxLength={14}
            />
          </div>
          <Button onClick={handleSearch} disabled={searching} className="w-full">
            {searching ? "Buscando..." : "Buscar meu CPF"}
          </Button>

          {notFound && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm">
              CPF não encontrado. Peça ao gestor do seu time para pré-cadastrar seu CPF.
            </div>
          )}
        </div>

        {athlete && (
          <div className="mt-6 rounded-lg border border-border bg-card p-6 space-y-4">
            <div className="rounded-md border border-primary/30 bg-primary/5 p-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
                Pré-cadastro encontrado
              </p>
              <p className="mt-1 font-display text-xl tracking-wide">{athlete.masked_name}</p>
              {athlete.team_name && (
                <p className="text-sm text-muted-foreground mt-0.5">{athlete.team_name}</p>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Mostramos o nome parcial de propósito. Complete os campos abaixo com seus
                dados para ativar seu ID.
              </p>
            </div>

            {athlete.verified && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
                Este pré-cadastro já foi ativado por uma conta. Se não foi você, fale com o
                diretor do seu time antes de continuar.
              </div>
            )}

            <h2 className="font-display text-2xl tracking-wide">Preencha seus dados</h2>

            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-full border border-border bg-background/50 overflow-hidden flex items-center justify-center">
                {photoPreview ? (
                  <img src={photoPreview} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Upload className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <label className="text-sm">
                <span className="cursor-pointer rounded-md border border-input bg-background px-3 py-2 hover:bg-accent">
                  Escolher foto
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handlePhoto(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="full_name">Nome completo</Label>
                <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="nickname">Apelido</Label>
                <Input id="nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="position">Posição</Label>
                <Input
                  id="position"
                  placeholder="Atacante, Goleiro..."
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input id="whatsapp" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="instagram">Instagram</Label>
                <Input
                  id="instagram"
                  placeholder="@usuario"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                />
              </div>
            </div>

            <Button onClick={handleActivate} disabled={submitting} className="w-full">
              {submitting ? "Ativando..." : "Ativar meu ID Metrópole"}
            </Button>

            {!user && (
              <p className="text-xs text-muted-foreground text-center">
                Você precisa estar logado para vincular este atleta à sua conta.
              </p>
            )}
          </div>
        )}
      </div>
    </PublicShell>
  );
}
