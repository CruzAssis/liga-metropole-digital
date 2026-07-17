import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "lm:welcome_athlete_pending";

export function markAthleteWelcomePending() {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {}
}

export function WelcomeAthleteModal({ name }: { name?: string | null }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") setOpen(true);
    } catch {}
  }, []);

  if (!open) return null;

  const firstName = (name ?? "").trim().split(" ")[0] || "Atleta";

  function dismiss() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setOpen(false);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl border border-[#1565F5]/40 bg-gradient-to-b from-zinc-900 to-black p-8 shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#1565F5]/15 ring-2 ring-[#1565F5]/40">
          <Trophy className="h-8 w-8 text-[#1565F5]" />
        </div>
        <h2 className="font-display text-3xl tracking-wide text-white text-center leading-tight">
          Bem-vindo à Liga Metrópole,{" "}
          <span className="text-[#1565F5]">{firstName}</span>!
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-zinc-300 text-center">
          Você agora faz parte de um movimento que valoriza sua história.
          Prepare-se — seus dados e estatísticas começam a ser contabilizados
          a partir da próxima rodada.
        </p>
        <Button
          onClick={dismiss}
          className="mt-8 w-full bg-[#1565F5] hover:bg-blue-600 text-white font-semibold py-3 text-base"
        >
          Entendido
        </Button>
      </div>
    </div>
  );
}
