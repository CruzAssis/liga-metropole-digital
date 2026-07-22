import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Download,
  Upload,
  QrCode,
  Check,
  ShieldCheck,
  MapPin,
  Image as ImageIcon,
} from "lucide-react";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import lmShield from "@/assets/lm-shield.png.asset.json";


const NEON = "#00E5FF";
const CARD_BG = "#121214";
const INVITE_URL = "https://liga-metropole-digital.lovable.app";

type UploadState = string | null;
function useImageUpload(setter: (v: UploadState) => void) {
  return (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Arquivo grande demais (máx 4MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setter(reader.result as string);
    reader.readAsDataURL(file);
  };
}

export function ConviteFlyerPage() {
  const [clubName, setClubName] = useState("[NOME DO SEU CLUBE]");
  const [clubSystem, setClubSystem] = useState("[CLUB_NAME_SYSTEM]");
  const [mando, setMando] = useState<"MANDANTE" | "VISITANTE" | "">("");
  const [subprefeitura, setSubprefeitura] = useState("[SUBPREFEITURA DO CLUBE]");
  const [teamLogo, setTeamLogo] = useState<UploadState>(null);
  const [ligaLogo, setLigaLogo] = useState<UploadState>(null);
  const [mapBg, setMapBg] = useState<UploadState>(null);
  const [exporting, setExporting] = useState(false);
  const flyerRef = useRef<HTMLDivElement>(null);

  const onTeamLogo = useImageUpload(setTeamLogo);
  const onLigaLogo = useImageUpload(setLigaLogo);
  const onMapBg = useImageUpload(setMapBg);

  const qrSrc = useMemo(
    () =>
      `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&bgcolor=000000&color=FFFFFF&data=${encodeURIComponent(
        INVITE_URL,
      )}`,
    [],
  );

  const ligaLogoSrc = ligaLogo ?? lmShield.url;

  async function handleDownload() {
    if (!flyerRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(flyerRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#000000",
      });
      const link = document.createElement("a");
      const safe = clubName.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase() || "convite";
      link.download = `convite-liga-metropole-${safe}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Convite exportado!");
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível exportar o convite.");
    } finally {
      setExporting(false);
    }
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(INVITE_URL);
      toast.success("Link de confirmação copiado!");
    } catch {
      toast.error("Falha ao copiar link.");
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Top bar */}
      <header className="border-b border-zinc-900 bg-black/80 backdrop-blur sticky top-0 z-20">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img src={lmShield.url} alt="Liga Metrópole" className="h-8 w-8 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">
                Ferramenta oficial
              </p>
              <h1 className="font-display text-sm md:text-base truncate">
                Customizador de Convites — Liga Metrópole
              </h1>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleCopyLink}
              className="border-zinc-800 text-white hover:bg-zinc-900"
            >
              Copiar Link
            </Button>
            <Button
              onClick={handleDownload}
              disabled={exporting}
              style={{ background: NEON, color: "#000" }}
              className="hover:opacity-90 font-semibold"
            >
              <Download className="mr-2 h-4 w-4" />
              {exporting ? "Exportando..." : "Baixar PNG"}
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 md:py-10 grid lg:grid-cols-[360px_1fr] gap-6 lg:gap-8">
        {/* Control Panel */}
        <aside className="space-y-5 rounded-xl border border-zinc-800 bg-zinc-950 p-5 h-fit lg:sticky lg:top-24">
          <div>
            <h2 className="font-display text-lg">Painel de Controle</h2>
            <p className="text-xs text-zinc-500 mt-1">Atualização em tempo real no canvas.</p>
          </div>

          {/* Uploads */}
          <div className="space-y-3">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-500 font-semibold">
              Imagens
            </h3>

            <UploadField
              label="Logo da Liga"
              icon={<ShieldCheck className="h-4 w-4" />}
              preview={ligaLogo}
              onChange={onLigaLogo}
              onClear={() => setLigaLogo(null)}
              hint="Padrão: escudo LM"
            />
            <UploadField
              label="Logo da Equipe Convidada"
              icon={<Upload className="h-4 w-4" />}
              preview={teamLogo}
              onChange={onTeamLogo}
              onClear={() => setTeamLogo(null)}
            />
            <UploadField
              label="Mapa de Fundo (Subprefeituras)"
              icon={<MapPin className="h-4 w-4" />}
              preview={mapBg}
              onChange={onMapBg}
              onClear={() => setMapBg(null)}
              hint="Aplicado com filtro azul neon"
            />
          </div>

          {/* Texts */}
          <div className="space-y-3 pt-2">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-zinc-500 font-semibold">
              Dados do Clube
            </h3>

            <div className="space-y-2">
              <Label htmlFor="club">Nome do Clube</Label>
              <Input
                id="club"
                value={clubName}
                onChange={(e) => setClubName(e.target.value.toUpperCase())}
                maxLength={40}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="clubsys">Club Name (sistema)</Label>
              <Input
                id="clubsys"
                value={clubSystem}
                onChange={(e) => setClubSystem(e.target.value.toUpperCase())}
                maxLength={40}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mando">Mando de Campo</Label>
              <Select value={mando} onValueChange={(v) => setMando(v as "MANDANTE" | "VISITANTE")}>
                <SelectTrigger id="mando">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANDANTE">MANDANTE</SelectItem>
                  <SelectItem value="VISITANTE">VISITANTE</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sub">Subprefeitura</Label>
              <Input
                id="sub"
                value={subprefeitura}
                onChange={(e) => setSubprefeitura(e.target.value.toUpperCase())}
                maxLength={30}
              />
            </div>
          </div>

          <div className="flex sm:hidden flex-col gap-2 pt-2">
            <Button
              onClick={handleDownload}
              disabled={exporting}
              style={{ background: NEON, color: "#000" }}
              className="hover:opacity-90 font-semibold"
            >
              <Download className="mr-2 h-4 w-4" />
              {exporting ? "Exportando..." : "Baixar PNG"}
            </Button>
            <Button
              variant="outline"
              onClick={handleCopyLink}
              className="border-zinc-800 text-white hover:bg-zinc-900"
            >
              Copiar Link
            </Button>
          </div>
        </aside>

        {/* Flyer Canvas */}
        <div className="overflow-x-auto">
          <div
            ref={flyerRef}
            className="relative mx-auto w-[760px] max-w-full rounded-2xl overflow-hidden"
            style={{ background: "#000", aspectRatio: "3 / 4" }}
          >
            {/* Concrete texture */}
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none opacity-[0.12]"
              style={{
                backgroundImage: `
                  radial-gradient(circle at 15% 20%, rgba(255,255,255,0.5) 0.5px, transparent 1px),
                  radial-gradient(circle at 75% 45%, rgba(255,255,255,0.4) 0.5px, transparent 1px),
                  radial-gradient(circle at 35% 85%, rgba(255,255,255,0.35) 0.5px, transparent 1px)
                `,
                backgroundSize: "20px 20px, 26px 26px, 32px 32px",
              }}
            />

            {/* Map background (if uploaded) with neon blue trace filter */}
            {mapBg && (
              <div
                aria-hidden
                className="absolute inset-0 pointer-events-none opacity-30 mix-blend-screen"
                style={{
                  backgroundImage: `url(${mapBg})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  filter:
                    "grayscale(1) contrast(1.4) brightness(0.6) sepia(1) hue-rotate(160deg) saturate(6)",
                }}
              />
            )}

            {/* Neon grid overlay */}
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none opacity-[0.10]"
              style={{
                backgroundImage: `
                  linear-gradient(to right, ${NEON} 1px, transparent 1px),
                  linear-gradient(to bottom, ${NEON} 1px, transparent 1px)
                `,
                backgroundSize: "48px 48px",
              }}
            />
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.9) 100%)",
              }}
            />

            <div className="relative flex flex-col h-full p-8 md:p-10">
              {/* Header — cleaned: single integrated logo above headline */}
              <div className="flex flex-col items-center gap-3">
                <img
                  src={ligaLogoSrc}
                  alt="Liga Metrópole"
                  crossOrigin="anonymous"
                  className="h-20 w-20 object-contain"
                  style={{
                    filter: `drop-shadow(0 0 12px ${NEON}80)`,
                  }}
                />
                <span
                  className="text-[10px] tracking-[0.4em] px-3 py-1 rounded-full uppercase font-semibold"
                  style={{
                    color: NEON,
                    border: `1px solid ${NEON}80`,
                    boxShadow: `0 0 12px ${NEON}40`,
                  }}
                >
                  Convite Exclusivo
                </span>
              </div>

              {/* Title */}
              <div className="text-center mt-5">
                <h2 className="font-display text-3xl md:text-[2.6rem] leading-tight font-bold tracking-tight">
                  VENHA MOSTRAR<br />O SEU TERRITÓRIO
                </h2>
                <p className="text-[11px] md:text-xs tracking-[0.35em] text-zinc-300 mt-3 uppercase">
                  A liga amadora mais profissional do Brasil
                </p>
              </div>

              {/* Central Card */}
              <div
                className="relative mt-6 rounded-xl p-5 border border-zinc-800 backdrop-blur"
                style={{ background: `${CARD_BG}CC` }}
              >
                <div
                  className="absolute -top-3 right-4 flex items-center gap-1.5 rounded-full px-3 py-1 text-[9px] font-bold uppercase tracking-widest"
                  style={{
                    background: NEON,
                    color: "#000",
                    boxShadow: `0 0 18px ${NEON}90`,
                  }}
                >
                  <Check className="h-3 w-3" strokeWidth={3} />
                  Metrópole Verificado
                </div>

                <div className="flex items-center gap-4">
                  <div
                    className="shrink-0 h-24 w-24 rounded-lg border-2 flex items-center justify-center overflow-hidden bg-black"
                    style={{ borderColor: NEON, boxShadow: `0 0 14px ${NEON}50` }}
                  >
                    {teamLogo ? (
                      <img
                        src={teamLogo}
                        alt="Escudo do clube"
                        crossOrigin="anonymous"
                        className="h-full w-full object-contain p-1"
                      />
                    ) : (
                      <div className="text-center text-[8px] text-zinc-500 px-1 leading-tight">
                        <ImageIcon className="h-5 w-5 mx-auto mb-1 opacity-60" />
                        LOGO EQUIPE
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="font-display text-2xl md:text-[1.7rem] font-bold leading-tight break-words">
                      {clubName}
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-0.5 font-mono">
                      {clubSystem}
                    </div>
                    <div className="mt-3 space-y-1 text-[11px] md:text-xs text-zinc-300">
                      <div>
                        <span className="text-zinc-500">MANDO:</span>{" "}
                        <span className="font-semibold" style={{ color: NEON }}>
                          {mando || "[MANDANTE / VISITANTE]"}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500">SUBPREFEITURA:</span>{" "}
                        <span className="text-white font-semibold">{subprefeitura}</span>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <LadoIcon label="A" active={mando === "MANDANTE"} />
                        <LadoIcon label="B" active={mando === "VISITANTE"} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Invitation body */}
              <p className="text-[11px] md:text-xs text-zinc-400 mt-5 leading-relaxed text-center italic px-2">
                "Nós Diretores da Liga Metrópole em respeito a história e tradição do seu time na
                comunidade, formalizamos o convite para participação na 1ª Edição."
              </p>

              {/* Stats */}
              <div className="mt-5 grid grid-cols-2 gap-3">
                {[
                  { label: "32 SUBPREFEITURAS", sub: "PONTOS CORRIDOS" },
                  { label: "1ª EDIÇÃO", sub: "MATA-MATA FINAL" },
                ].map((s) => (
                  <div key={s.label} className="text-center">
                    <div className="text-[9px] tracking-[0.2em] text-zinc-400 uppercase mb-2">
                      {s.sub}
                    </div>
                    <div
                      className="h-1 rounded-full mb-2"
                      style={{
                        background: `linear-gradient(90deg, ${NEON}, ${NEON}30)`,
                        boxShadow: `0 0 10px ${NEON}90`,
                      }}
                    />
                    <div className="text-sm font-display font-bold">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div className="mt-auto pt-6 flex items-end gap-4">
                <div className="flex-1">
                  <div
                    className="font-display text-xl md:text-2xl font-black leading-tight"
                    style={{ color: NEON, textShadow: `0 0 20px ${NEON}80` }}
                  >
                    CONFIRME SUA<br />PARTICIPAÇÃO
                  </div>
                  <div className="text-[11px] md:text-xs text-white mt-2 font-mono">
                    liga-metropole-digital.lovable.app
                  </div>
                </div>
                <div
                  className="shrink-0 h-24 w-24 rounded-md border-2 bg-black flex items-center justify-center overflow-hidden"
                  style={{ borderColor: NEON, boxShadow: `0 0 14px ${NEON}60` }}
                >
                  <img
                    src={qrSrc}
                    alt="QR Code"
                    crossOrigin="anonymous"
                    className="h-full w-full object-contain"
                  />
                </div>
              </div>

              {/* Signatures + tagline */}
              <div className="mt-5 pt-4 border-t border-zinc-800 flex items-center justify-between text-[10px] text-zinc-500 uppercase tracking-widest">
                <span>Indio / Kabelo</span>
                <span>Shelder</span>
              </div>
              <div className="mt-2 text-center text-[10px] md:text-[11px] tracking-[0.3em] text-zinc-400 uppercase">
                Metrópole · Território · Pertencimento · Modernidade
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function UploadField({
  label,
  icon,
  preview,
  onChange,
  onClear,
  hint,
}: {
  label: string;
  icon: React.ReactNode;
  preview: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5">
        {icon}
        {label}
      </Label>
      <label className="flex items-center justify-center gap-2 h-20 rounded-lg border border-dashed border-zinc-700 bg-zinc-900/50 cursor-pointer hover:border-[#00E5FF]/60 transition">
        {preview ? (
          <img src={preview} alt={label} className="h-full w-full object-contain p-2" />
        ) : (
          <div className="flex flex-col items-center text-zinc-500 text-[11px]">
            <Upload className="h-4 w-4 mb-1" />
            Enviar imagem
          </div>
        )}
        <input type="file" accept="image/*" className="hidden" onChange={onChange} />
      </label>
      <div className="flex items-center justify-between">
        {hint ? <span className="text-[10px] text-zinc-600">{hint}</span> : <span />}
        {preview && (
          <button
            type="button"
            className="text-[10px] text-zinc-500 hover:text-white"
            onClick={onClear}
          >
            Remover
          </button>
        )}
      </div>
    </div>
  );
}

function LadoIcon({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className="inline-flex items-center justify-center h-5 w-5 rounded-full text-[9px] font-bold border"
      style={{
        borderColor: active ? NEON : "#3f3f46",
        background: active ? NEON : "transparent",
        color: active ? "#000" : "#a1a1aa",
        boxShadow: active ? `0 0 8px ${NEON}80` : undefined,
      }}
    >
      {label}
    </span>
  );
}
