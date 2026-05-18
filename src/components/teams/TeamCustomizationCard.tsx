import { useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Palette, ImageIcon, Shield, Upload } from "lucide-react";

const PRESET_COLORS = [
  "#dc2626", "#ea580c", "#ca8a04", "#16a34a",
  "#0891b2", "#2563eb", "#7c3aed", "#db2777",
  "#0f172a", "#475569",
];

type Props = {
  teamId: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  primaryColor: string | null;
  onSaved?: () => void;
};

export function TeamCustomizationCard({ teamId, logoUrl, bannerUrl, primaryColor, onSaved }: Props) {
  const [logo, setLogo] = useState(logoUrl);
  const [banner, setBanner] = useState(bannerUrl);
  const [color, setColor] = useState(primaryColor ?? "#2563eb");
  const [savingColor, setSavingColor] = useState(false);
  const [uploading, setUploading] = useState<null | "logo" | "banner">(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);

  const upload = async (file: File, kind: "logo" | "banner") => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Arquivo deve ter no máximo 5MB.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Envie um arquivo de imagem.");
      return;
    }
    setUploading(kind);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${kind === "logo" ? "logos" : "banners"}/${teamId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("team-logos")
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("team-logos").getPublicUrl(path);
      const url = pub.publicUrl;
      const field = kind === "logo" ? "logo_url" : "banner_url";
      const { error: updErr } = await supabase.from("teams").update({ [field]: url }).eq("id", teamId);
      if (updErr) throw updErr;
      if (kind === "logo") setLogo(url); else setBanner(url);
      toast.success(kind === "logo" ? "Escudo atualizado!" : "Banner atualizado!");
      onSaved?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(null);
    }
  };

  const saveColor = async () => {
    setSavingColor(true);
    try {
      const { error } = await supabase.from("teams").update({ primary_color: color }).eq("id", teamId);
      if (error) throw error;
      toast.success("Cor primária salva!");
      onSaved?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingColor(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Palette className="h-5 w-5 text-primary" />
        <h2 className="font-display text-2xl tracking-wide">Personalização do clube</h2>
      </div>

      {/* Logo */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2"><Shield className="h-4 w-4" /> Escudo</Label>
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 rounded-md border border-border bg-background/50 overflow-hidden flex items-center justify-center shrink-0">
            {logo ? (
              <img src={logo} alt="Escudo" className="h-full w-full object-cover" />
            ) : (
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1">
            <input
              ref={logoInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], "logo")}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => logoInput.current?.click()}
              disabled={uploading === "logo"}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              {uploading === "logo" ? "Enviando..." : logo ? "Trocar escudo" : "Enviar escudo"}
            </Button>
            <p className="text-xs text-muted-foreground mt-1">PNG ou JPG, até 5MB. Quadrado recomendado.</p>
          </div>
        </div>
      </div>

      {/* Banner */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Banner do perfil</Label>
        <div className="rounded-md border border-border overflow-hidden h-32 bg-background/50 flex items-center justify-center">
          {banner ? (
            <img src={banner} alt="Banner" className="h-full w-full object-cover" />
          ) : (
            <span className="text-sm text-muted-foreground">Sem banner</span>
          )}
        </div>
        <input
          ref={bannerInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], "banner")}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => bannerInput.current?.click()}
          disabled={uploading === "banner"}
          className="gap-2"
        >
          <Upload className="h-4 w-4" />
          {uploading === "banner" ? "Enviando..." : banner ? "Trocar banner" : "Enviar banner"}
        </Button>
        <p className="text-xs text-muted-foreground">Recomendado 1600×400, até 5MB.</p>
      </div>

      {/* Color */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2"><Palette className="h-4 w-4" /> Cor primária</Label>
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`h-8 w-8 rounded-md border-2 transition ${color.toLowerCase() === c.toLowerCase() ? "border-foreground scale-110" : "border-border"}`}
              style={{ backgroundColor: c }}
              aria-label={`Cor ${c}`}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-10 w-16 p-1 cursor-pointer"
          />
          <Input
            value={color}
            onChange={(e) => setColor(e.target.value)}
            placeholder="#2563eb"
            maxLength={7}
            className="font-mono uppercase max-w-[120px]"
          />
          <Button onClick={saveColor} disabled={savingColor || color === primaryColor}>
            {savingColor ? "Salvando..." : "Salvar cor"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Usada como destaque no perfil público do clube.</p>
      </div>
    </div>
  );
}
