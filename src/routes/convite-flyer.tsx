import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Upload, QrCode, Check, ImageIcon } from "lucide-react";
import { toPng } from "html-to-image";
import { toast } from "sonner";

export const Route = createFileRoute("/convite-flyer")({
  component: ConviteFlyerPage,
  head: () => ({
    meta: [
      { title: "Convite Personalizado — Liga Metrópole" },
      {
        name: "description",
        content:
          "Crie e baixe seu convite personalizado para o seu clube entrar na Liga Metrópole, a liga amadora mais profissional do Brasil.",
      },
      { property: "og:title", content: "Convite Personalizado — Liga Metrópole" },
      {
        property: "og:description",
        content:
          "Personalize o convite do seu clube: escudo, nome, subprefeitura e representante. Exporte em alta qualidade.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const ELECTRIC = "#1565F5";
const CARD_BG = "#18181B";
const INVITE_URL = "https://liga-metropole-digital.lovable.app";

function ConviteFlyerPage() {
  const [clubName, setClubName] = useState("[NOME DO SEU CLUBE]");
  const [subprefeitura, setSubprefeitura] = useState("[SUBPREFEITURA]");
  const [lado, setLado] = useState("[ESCOLHA O LADO]");
  const [representante, setRepresentante] = useState("[NOME DO REPRESENTANTE]");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const flyerRef = useRef<HTMLDivElement>(null);

  const qrSrc = useMemo(
    () =>
      `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&bgcolor=000000&color=FFFFFF&data=${encodeURIComponent(
        INVITE_URL,
      )}`,
    [],
  );

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error("O arquivo é grande demais (máx 4MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogoUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

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
      const safeName = clubName.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase() || "convite";
      link.download = `convite-liga-metropole-${safeName}.png`;
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

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-6xl px-4 py-8 md:py-12">
        <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
              Ferramenta de Convite
            </p>
            <h1 className="font-display text-3xl md:text-4xl mt-2">
              Monte o convite do seu clube
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Personalize, visualize e baixe em alta resolução.
            </p>
          </div>
          <Button
            size="lg"
            onClick={handleDownload}
            disabled={exporting}
            className="bg-[#1565F5] hover:bg-[#0f52d1] text-white"
          >
            <Download className="mr-2 h-4 w-4" />
            {exporting ? "Exportando..." : "Baixar PNG"}
          </Button>
        </div>

        <div className="grid lg:grid-cols-[360px_1fr] gap-8">
          {/* Editor */}
          <aside className="space-y-5 rounded-xl border border-zinc-800 bg-zinc-950 p-5 h-fit">
            <h2 className="font-display text-lg">Dados do clube</h2>

            <div className="space-y-2">
              <Label>Escudo do clube</Label>
              <label className="flex items-center justify-center gap-2 h-24 rounded-lg border border-dashed border-zinc-700 bg-zinc-900/50 cursor-pointer hover:border-[#1565F5]/60 transition">
                {logoUrl ? (
                  <img src={logoUrl} alt="Escudo" className="h-full w-full object-contain p-2" />
                ) : (
                  <div className="flex flex-col items-center text-zinc-500 text-xs">
                    <Upload className="h-5 w-5 mb-1" />
                    Enviar imagem (PNG/JPG)
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
              </label>
              {logoUrl && (
                <button
                  type="button"
                  className="text-xs text-zinc-500 hover:text-white"
                  onClick={() => setLogoUrl(null)}
                >
                  Remover escudo
                </button>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="club">Nome do clube</Label>
              <Input
                id="club"
                value={clubName}
                onChange={(e) => setClubName(e.target.value.toUpperCase())}
                maxLength={40}
              />
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

            <div className="space-y-2">
              <Label htmlFor="lado">Lado</Label>
              <select
                id="lado"
                value={lado}
                onChange={(e) => setLado(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option>[ESCOLHA O LADO]</option>
                <option>LADO A</option>
                <option>LADO B</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rep">Representante</Label>
              <Input
                id="rep"
                value={representante}
                onChange={(e) => setRepresentante(e.target.value.toUpperCase())}
                maxLength={40}
              />
            </div>
          </aside>

          {/* Flyer preview */}
          <div className="overflow-x-auto">
            <div
              ref={flyerRef}
              className="relative mx-auto w-[720px] max-w-full rounded-2xl overflow-hidden"
              style={{
                background: "#000000",
                aspectRatio: "3 / 4",
              }}
            >
              {/* Textured map overlay */}
              <div
                aria-hidden
                className="absolute inset-0 opacity-[0.09] pointer-events-none"
                style={{
                  backgroundImage: `
                    radial-gradient(circle at 20% 30%, rgba(255,255,255,0.5) 0.5px, transparent 1px),
                    radial-gradient(circle at 70% 60%, rgba(255,255,255,0.4) 0.5px, transparent 1px),
                    radial-gradient(circle at 40% 80%, rgba(255,255,255,0.35) 0.5px, transparent 1px),
                    linear-gradient(115deg, transparent 48%, rgba(255,255,255,0.08) 49%, transparent 51%),
                    linear-gradient(65deg, transparent 48%, rgba(255,255,255,0.06) 49%, transparent 51%)
                  `,
                  backgroundSize:
                    "18px 18px, 22px 22px, 26px 26px, 60px 60px, 80px 80px",
                }}
              />
              {/* subtle vignette */}
              <div
                aria-hidden
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.85) 100%)",
                }}
              />

              <div className="relative flex flex-col h-full p-8 md:p-10">
                {/* Header */}
                <div className="flex flex-col items-center gap-3">
                  <span className="text-[10px] tracking-[0.4em] text-zinc-400 border border-zinc-700 px-3 py-1 rounded-full uppercase">
                    Convite Exclusivo
                  </span>
                  <BrandLogo className="h-14 w-14" />
                </div>

                {/* Title */}
                <div className="text-center mt-6">
                  <h2 className="font-display text-3xl md:text-[2.6rem] leading-tight font-bold tracking-tight">
                    VENHA MOSTRAR<br />O SEU TERRITÓRIO
                  </h2>
                  <p className="text-[11px] md:text-xs tracking-[0.35em] text-zinc-300 mt-3 uppercase">
                    A liga amadora mais profissional do Brasil
                  </p>
                </div>

                {/* Club Card */}
                <div
                  className="relative mt-6 rounded-xl p-5 border border-zinc-800"
                  style={{ background: CARD_BG }}
                >
                  {/* Verified badge */}
                  <div
                    className="absolute -top-3 right-4 flex items-center gap-1.5 rounded-full px-3 py-1 text-[9px] font-bold uppercase tracking-widest"
                    style={{
                      background: ELECTRIC,
                      color: "#fff",
                      boxShadow: `0 0 18px ${ELECTRIC}80`,
                    }}
                  >
                    <Check className="h-3 w-3" strokeWidth={3} />
                    ID Metrópole Verificado
                  </div>

                  <div className="flex items-center gap-4">
                    <div
                      className="shrink-0 h-24 w-24 rounded-lg border-2 flex items-center justify-center overflow-hidden bg-black"
                      style={{ borderColor: ELECTRIC }}
                    >
                      {logoUrl ? (
                        <img
                          src={logoUrl}
                          alt="Escudo do clube"
                          className="h-full w-full object-contain p-1"
                          crossOrigin="anonymous"
                        />
                      ) : (
                        <div className="text-center text-[8px] text-zinc-500 px-1 leading-tight">
                          <ImageIcon className="h-5 w-5 mx-auto mb-1 opacity-60" />
                          [INSIRA O LOGO DO CLUBE AQUI]
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="font-display text-2xl md:text-[1.7rem] font-bold leading-tight break-words">
                        {clubName || "[NOME DO SEU CLUBE]"}
                      </div>
                      <div className="mt-3 space-y-1 text-[11px] md:text-xs text-zinc-300">
                        <div>
                          <span className="text-zinc-500">SUBPREFEITURA:</span>{" "}
                          <span className="text-white font-semibold">{subprefeitura}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500">LADO A/B:</span>{" "}
                          <span className="font-semibold" style={{ color: ELECTRIC }}>
                            {lado}
                          </span>
                        </div>
                        <div>
                          <span className="text-zinc-500">REPRESENTANTE:</span>{" "}
                          <span className="text-white font-semibold">{representante}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="mt-6 grid grid-cols-3 gap-3">
                  {[
                    { top: "PONTOS CORRIDOS", bottom: "32 SUBPREFEITURAS" },
                    { top: "MATA-MATA FINAL", bottom: "02 CONFERÊNCIAS" },
                    { top: "RIVALIDADE HISTÓRICA", bottom: "02 CONFERÊNCIAS" },
                  ].map((s) => (
                    <div key={s.top} className="text-center">
                      <div className="text-[9px] md:text-[10px] tracking-[0.15em] text-zinc-300 font-semibold uppercase mb-2 h-8 flex items-center justify-center">
                        {s.top}
                      </div>
                      <div
                        className="h-1.5 rounded-full mb-2"
                        style={{
                          background: `linear-gradient(90deg, ${ELECTRIC}, ${ELECTRIC}40)`,
                          boxShadow: `0 0 10px ${ELECTRIC}90`,
                        }}
                      />
                      <div className="text-xs md:text-sm font-display font-bold">{s.bottom}</div>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <div className="mt-auto pt-6 flex items-end gap-4">
                  <div className="flex-1">
                    <div
                      className="font-display text-xl md:text-2xl font-black leading-tight"
                      style={{
                        color: ELECTRIC,
                        textShadow: `0 0 20px ${ELECTRIC}70`,
                      }}
                    >
                      CONFIRME SUA<br />PARTICIPAÇÃO
                    </div>
                    <div className="text-[11px] md:text-xs text-white mt-2 font-mono">
                      liga-metropole-digital.lovable.app
                    </div>
                  </div>
                  <div
                    className="shrink-0 h-24 w-24 rounded-md border-2 bg-black flex items-center justify-center overflow-hidden"
                    style={{ borderColor: ELECTRIC }}
                  >
                    {qrSrc ? (
                      <img
                        src={qrSrc}
                        alt="QR Code"
                        className="h-full w-full object-contain"
                        crossOrigin="anonymous"
                      />
                    ) : (
                      <div className="flex flex-col items-center text-[9px] text-zinc-500">
                        <QrCode className="h-6 w-6 mb-1" />
                        QR CODE
                      </div>
                    )}
                  </div>
                </div>

                {/* Tagline */}
                <div className="mt-6 pt-4 border-t border-zinc-800 text-center text-[10px] md:text-[11px] tracking-[0.3em] text-zinc-400 uppercase">
                  Metrópole · Território · Pertencimento · Modernidade
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
