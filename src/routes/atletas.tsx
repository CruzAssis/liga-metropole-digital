import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AthleteCard, type AthleteCardData } from "@/components/athletes/AthleteCard";
import { IDMetropoleCard, type IDMetropoleData } from "@/components/athletes/IDMetropoleCard";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

type Row = AthleteCardData & IDMetropoleData & { team_id: string | null };

export const Route = createFileRoute("/atletas")({
  component: AtletasPage,
  head: () => ({
    meta: [
      { title: "Atletas · Liga Metrópole Várzea" },
      { name: "description", content: "Atletas com ID Metrópole verificado." },
    ],
  }),
});

function AtletasPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [open, setOpen] = useState<Row | null>(null);

  useEffect(() => {
    (async () => {
      const { data: athletes } = await supabase
        .from("athletes")
        .select("id, full_name, nickname, position, photo_url, verified, team_id, whatsapp, instagram_handle")
        .order("verified", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200);

      const teamIds = Array.from(new Set((athletes ?? []).map((a) => a.team_id).filter(Boolean))) as string[];
      const teamsMap = new Map<string, string>();
      if (teamIds.length > 0) {
        const { data: teams } = await supabase.from("teams").select("id, name").in("id", teamIds);
        for (const t of teams ?? []) teamsMap.set(t.id, t.name);
      }

      setRows(
        (athletes ?? []).map((a) => ({
          ...a,
          team_name: a.team_id ? teamsMap.get(a.team_id) ?? null : null,
        })) as Row[],
      );
    })();
  }, []);

  return (
    <div className="max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="font-display text-5xl tracking-wide">Atletas</h1>
        <p className="text-muted-foreground mt-1">
          ID Metrópole — perfil oficial dos atletas da liga.
        </p>
      </header>

      <Tabs defaultValue="todos" className="mb-6">
        <TabsList>
          <TabsTrigger value="todos">Todos</TabsTrigger>
          <TabsTrigger value="artilharia" disabled>
            Artilharia <Badge variant="outline" className="ml-2">em breve</Badge>
          </TabsTrigger>
          <TabsTrigger value="assist" disabled>
            Assistências <Badge variant="outline" className="ml-2">em breve</Badge>
          </TabsTrigger>
          <TabsTrigger value="nota" disabled>
            Nota Metrópole <Badge variant="outline" className="ml-2">em breve</Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {!rows && <div className="text-muted-foreground">Carregando...</div>}
      {rows && rows.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
          Nenhum atleta cadastrado ainda.
        </div>
      )}

      {rows && rows.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((a) => (
            <AthleteCard key={a.id} athlete={a} onClick={() => setOpen(a)} />
          ))}
        </div>
      )}

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-md">
          <DialogTitle className="sr-only">Perfil do atleta</DialogTitle>
          {open && <IDMetropoleCard athlete={open} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
