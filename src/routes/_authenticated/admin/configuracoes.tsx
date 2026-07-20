import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminGetLeagueConfig, adminSaveLeagueConfig } from "@/lib/league-config.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { SkeletonAdminPage } from "@/components/AppSkeletons";

export const Route = createFileRoute("/_authenticated/admin/configuracoes")({
  component: AdminConfiguracoesPage,
});

type Config = {
  public_league_name: string;
  public_tagline: string;
  public_season: string;
  public_whatsapp: string;
  public_rules_url: string;
  public_format_description: string;
  public_instagram: string;
  public_contact_email: string;
};

const empty: Config = {
  public_league_name: "",
  public_tagline: "",
  public_season: "",
  public_whatsapp: "",
  public_rules_url: "",
  public_format_description: "",
  public_instagram: "",
  public_contact_email: "",
};

function AdminConfiguracoesPage() {
  const [cfg, setCfg] = useState<Config>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const get = useServerFn(adminGetLeagueConfig);
  const save = useServerFn(adminSaveLeagueConfig);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = (await get()) as Partial<Config>;
      setCfg({ ...empty, ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v ?? ""])) } as Config);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, [get]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    setSaving(true);
    try {
      await save({ data: cfg as any });
      toast.success("Configurações salvas");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <SkeletonAdminPage />;

  const set = (k: keyof Config) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setCfg({ ...cfg, [k]: e.target.value });

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-primary font-semibold">Admin</p>
        <h1 className="text-2xl sm:text-3xl font-black">Configurações Públicas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Informações exibidas no site público (home, rodapé, página de regras).
        </p>
      </div>

      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>Nome da liga</Label>
            <Input value={cfg.public_league_name} onChange={set("public_league_name")} placeholder="Liga Metrópole" />
          </div>
          <div>
            <Label>Temporada</Label>
            <Input value={cfg.public_season} onChange={set("public_season")} placeholder="2026" />
          </div>
        </div>
        <div>
          <Label>Tagline / subtítulo</Label>
          <Input
            value={cfg.public_tagline}
            onChange={set("public_tagline")}
            placeholder="A liga amadora de São Paulo"
          />
        </div>
        <div>
          <Label>Descrição do formato</Label>
          <Textarea
            value={cfg.public_format_description}
            onChange={set("public_format_description")}
            rows={4}
            placeholder="32 subprefeituras, todas por pontos corridos e mata-mata no final."
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>WhatsApp de contato</Label>
            <Input value={cfg.public_whatsapp} onChange={set("public_whatsapp")} placeholder="11 90000-0000" />
          </div>
          <div>
            <Label>Email de contato</Label>
            <Input value={cfg.public_contact_email} onChange={set("public_contact_email")} placeholder="contato@..." />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>Instagram (@usuario)</Label>
            <Input value={cfg.public_instagram} onChange={set("public_instagram")} placeholder="@ligametropole" />
          </div>
          <div>
            <Label>Link das regras / regulamento</Label>
            <Input
              value={cfg.public_rules_url}
              onChange={set("public_rules_url")}
              placeholder="https://..."
            />
          </div>
        </div>

        <div className="pt-2">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-1" />
            {saving ? "Salvando…" : "Salvar configurações"}
          </Button>
        </div>
      </div>
    </div>
  );
}
