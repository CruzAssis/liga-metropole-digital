import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Upload } from "lucide-react";

const MAX_FILE_BYTES = 2 * 1024 * 1024;

const schema = z.object({
  name: z.string().trim().min(2, "Informe o nome do time").max(80),
  short_name: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3,4}$/, "Sigla deve ter 3 ou 4 letras (A-Z)"),
  cpf: z.string().regex(/^\d{11}$/, "CPF deve ter 11 dígitos"),
  phone: z.string().trim().min(10, "Telefone inválido").max(20),
  registration_type: z.enum(["host", "visitor"]),
  lado: z.enum(["A", "B"]),
  serie: z.enum(["A", "B"]),
});

type FormData = z.infer<typeof schema>;

export const Route = createFileRoute("/_authenticated/inscricao")({
  component: InscricaoPage,
});

function InscricaoPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hasTeam, setHasTeam] = useState<boolean | null>(null);

  const { register, handleSubmit, control, formState: { errors }, setValue } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { registration_type: "host", lado: "A", serie: "A" },
  });


  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("teams")
        .select("id")
        .eq("manager_id", user.id)
        .maybeSingle();
      setHasTeam(!!data);
    })();
  }, [user]);

  const handleFile = (file: File | null) => {
    if (!file) {
      setLogoFile(null);
      setLogoPreview(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast.error("Imagem deve ter no máximo 2 MB");
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const onSubmit = async (data: FormData) => {
    if (!user) return;
    setSubmitting(true);
    try {
      // 1. Upload logo if provided
      let logo_url: string | null = null;
      if (logoFile) {
        const ext = logoFile.name.split(".").pop() || "png";
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("team-logos")
          .upload(path, logoFile, { upsert: true });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("team-logos").getPublicUrl(path);
        logo_url = pub.publicUrl;
      }

      // 2. Update profile (cpf/phone)
      await supabase
        .from("profiles")
        .update({ cpf: data.cpf, phone: data.phone })
        .eq("id", user.id);

      // 3. Count approved teams of same type to decide status
      const { count, error: countErr } = await supabase
        .from("teams")
        .select("id", { count: "exact", head: true })
        .eq("registration_type", data.registration_type)
        .eq("status", "approved");
      if (countErr) throw countErr;

      const isFull = (count ?? 0) >= 40;
      const status = isFull ? "waitlist" : "pending";

      // 4. Insert team
      const { error: insErr } = await supabase.from("teams").insert({
        name: data.name,
        short_name: data.short_name.toUpperCase(),
        logo_url,
        manager_id: user.id,
        registration_type: data.registration_type,
        lado: data.lado,
        serie: data.serie,
        status,
      });
      if (insErr) throw insErr;


      if (isFull) {
        toast.warning(
          `Vagas de ${data.registration_type === "host" ? "Mandante" : "Visitante"} esgotadas — você entrou na sala de espera`,
        );
      } else {
        toast.success("Inscrição enviada para análise!");
      }
      navigate({ to: "/minha-conta" });
    } catch (err: any) {
      toast.error("Erro ao enviar inscrição", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (hasTeam) {
    return (
      <div className="max-w-2xl mx-auto rounded-lg border border-border bg-card p-8 text-center">
        <h2 className="font-display text-3xl tracking-wide">Você já tem um time inscrito</h2>
        <p className="mt-2 text-muted-foreground">
          Cada gestor pode inscrever apenas um time. Acompanhe o status em Minha Conta.
        </p>
        <Button className="mt-6" onClick={() => navigate({ to: "/minha-conta" })}>
          Ir para Minha Conta
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="font-display text-4xl tracking-wide">Inscrição do time</h1>
      <p className="text-muted-foreground mt-1">Preencha os dados para inscrever seu time na liga.</p>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="mt-8 space-y-6 rounded-lg border border-border bg-card p-6"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="name">Nome do time</Label>
            <Input id="name" {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="short_name">Sigla (3-4)</Label>
            <Input
              id="short_name"
              maxLength={4}
              className="uppercase"
              onInput={(e) => {
                e.currentTarget.value = e.currentTarget.value.toUpperCase();
              }}
              {...register("short_name")}
            />
            {errors.short_name && (
              <p className="text-sm text-destructive">{errors.short_name.message}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Escudo do time</Label>
          <div className="flex items-center gap-4">
            <label className="flex-1 cursor-pointer rounded-md border border-dashed border-border bg-background/50 p-4 text-center text-sm text-muted-foreground hover:bg-background">
              <Upload className="mx-auto mb-2 h-5 w-5" />
              {logoFile ? logoFile.name : "Clique para enviar (PNG/JPG até 2MB)"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {logoPreview && (
              <img
                src={logoPreview}
                alt="Pré-visualização do escudo"
                className="h-20 w-20 rounded-md object-cover border border-border"
              />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="cpf">CPF do gestor</Label>
            <Input id="cpf" inputMode="numeric" maxLength={11} {...register("cpf")} />
            {errors.cpf && <p className="text-sm text-destructive">{errors.cpf.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Telefone</Label>
            <Input id="phone" inputMode="tel" {...register("phone")} />
            {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Tipo de inscrição</Label>
          <RadioGroup
            defaultValue="host"
            onValueChange={(v) => setValue("registration_type", v as "host" | "visitor")}
            className="grid grid-cols-2 gap-3"
          >
            <label className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-background/50 p-3">
              <RadioGroupItem value="host" id="host" />
              <div>
                <div className="font-medium">Mandante</div>
                <div className="text-xs text-muted-foreground">Time da casa</div>
              </div>
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-background/50 p-3">
              <RadioGroupItem value="visitor" id="visitor" />
              <div>
                <div className="font-medium">Visitante</div>
                <div className="text-xs text-muted-foreground">Joga fora</div>
              </div>
            </label>
          </RadioGroup>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Lado</Label>
            <RadioGroup
              defaultValue="A"
              onValueChange={(v) => setValue("lado", v as "A" | "B")}
              className="grid grid-cols-2 gap-3"
            >
              <label className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-background/50 p-3">
                <RadioGroupItem value="A" id="lado-a" />
                <div className="font-medium">Lado A</div>
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-background/50 p-3">
                <RadioGroupItem value="B" id="lado-b" />
                <div className="font-medium">Lado B</div>
              </label>
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label>Série</Label>
            <RadioGroup
              defaultValue="A"
              onValueChange={(v) => setValue("serie", v as "A" | "B")}
              className="grid grid-cols-2 gap-3"
            >
              <label className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-background/50 p-3">
                <RadioGroupItem value="A" id="serie-a" />
                <div className="font-medium">Série A</div>
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-background/50 p-3">
                <RadioGroupItem value="B" id="serie-b" />
                <div className="font-medium">Série B</div>
              </label>
            </RadioGroup>
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={submitting}>

          {submitting ? "Enviando..." : "Enviar inscrição"}
        </Button>
      </form>
    </div>
  );
}
