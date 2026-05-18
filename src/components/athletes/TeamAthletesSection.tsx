import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listMyTeamAthletes,
  preRegisterAthletes,
} from "@/lib/athletes.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle2, Clock, UserPlus, Users } from "lucide-react";

export function TeamAthletesSection() {
  const list = useServerFn(listMyTeamAthletes);
  const pre = useServerFn(preRegisterAthletes);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["my-team-athletes"],
    queryFn: () => list(),
  });

  const [raw, setRaw] = useState("");

  const mutation = useMutation({
    mutationFn: async (cpfs: string[]) => pre({ data: { cpfs } }),
    onSuccess: (res) => {
      const parts: string[] = [];
      if (res.created) parts.push(`${res.created} criado(s)`);
      if (res.duplicates) parts.push(`${res.duplicates} já existente(s)`);
      if (res.invalid) parts.push(`${res.invalid} inválido(s)`);
      toast.success(parts.join(" · ") || "Nada a fazer");
      setRaw("");
      qc.invalidateQueries({ queryKey: ["my-team-athletes"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return <div className="text-muted-foreground">Carregando atletas...</div>;
  }

  const athletes = data?.athletes ?? [];

  const handleSubmit = () => {
    const cpfs = raw
      .split(/[\s,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (cpfs.length === 0) {
      toast.error("Cole pelo menos um CPF");
      return;
    }
    if (cpfs.length > 200) {
      toast.error("Máximo 200 CPFs por vez");
      return;
    }
    mutation.mutate(cpfs);
  };

  const verifiedCount = athletes.filter((a) => a.verified).length;

  return (
    <div className="mt-8 space-y-6">
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-1">
          <UserPlus className="h-5 w-5 text-primary" />
          <h2 className="font-display text-2xl tracking-wide">Pré-cadastro de atletas</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Cole os CPFs do seu elenco (um por linha ou separados por vírgula). Cada
          atleta depois completa o cadastro em <span className="font-mono">/verificar</span>.
        </p>

        <div className="mt-4 space-y-2">
          <Label htmlFor="cpfs">CPFs</Label>
          <Textarea
            id="cpfs"
            rows={6}
            placeholder={"123.456.789-09\n987.654.321-00"}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            className="font-mono text-sm"
          />
          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={mutation.isPending}>
              {mutation.isPending ? "Enviando..." : "Pré-cadastrar"}
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="font-display text-2xl tracking-wide">Elenco</h2>
          </div>
          <span className="text-sm text-muted-foreground">
            {verifiedCount}/{athletes.length} verificado(s)
          </span>
        </div>

        {athletes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum atleta pré-cadastrado ainda.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {athletes.map((a) => (
              <li key={a.id} className="py-3 flex items-center gap-3">
                {a.photo_url ? (
                  <img
                    src={a.photo_url}
                    alt={a.nickname ?? "Atleta"}
                    className="h-10 w-10 rounded-full object-cover border border-border"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full border border-border bg-background/50 flex items-center justify-center text-xs text-muted-foreground">
                    ?
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">
                    {a.nickname || a.full_name || (
                      <span className="text-muted-foreground italic">
                        Pendente — CPF ***.{a.cpf_last4}
                      </span>
                    )}
                  </div>
                  {a.full_name && a.nickname && (
                    <div className="text-xs text-muted-foreground truncate">
                      {a.full_name}
                      {a.position ? ` · ${a.position}` : ""}
                    </div>
                  )}
                </div>
                {a.verified ? (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Verificado
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1">
                    <Clock className="h-3 w-3" /> Pendente
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
