import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listMyTeamAthletes,
  createDirectorAthlete,
  updateDirectorAthlete,
  deleteDirectorAthlete,
} from "@/lib/athletes.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Pencil, Plus, Trash2, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/elenco")({
  component: ElencoPage,
});

const POSITION_GROUPS = [
  { key: "all", label: "Todos", match: null as string[] | null },
  { key: "goleiro", label: "Goleiros", match: ["Goleiro"] },
  { key: "zagueiro", label: "Zagueiros", match: ["Zagueiro"] },
  { key: "lateral", label: "Laterais", match: ["Lateral", "Lateral Direito", "Lateral Esquerdo"] },
  { key: "volante", label: "Volantes", match: ["Volante"] },
  { key: "meia", label: "Meias", match: ["Meia", "Meio-Campo"] },
  { key: "atacante", label: "Atacantes", match: ["Atacante"] },
] as const;

const POSITION_OPTIONS = [
  "Goleiro",
  "Zagueiro",
  "Lateral Direito",
  "Lateral Esquerdo",
  "Volante",
  "Meia",
  "Atacante",
];

type AthleteRow = {
  id: string;
  full_name: string | null;
  nickname: string | null;
  position: string | null;
  photo_url: string | null;
  verified: boolean;
  whatsapp: string | null;
};

type FormState = {
  id: string | null;
  full_name: string;
  nickname: string;
  position: string;
  whatsapp: string;
};

const emptyForm: FormState = {
  id: null,
  full_name: "",
  nickname: "",
  position: "",
  whatsapp: "",
};

function ElencoPage() {
  const listFn = useServerFn(listMyTeamAthletes);
  const createFn = useServerFn(createDirectorAthlete);
  const updateFn = useServerFn(updateDirectorAthlete);
  const deleteFn = useServerFn(deleteDirectorAthlete);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["my-team-athletes"],
    queryFn: () => listFn(),
  });

  const [filter, setFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState<AthleteRow | null>(null);

  const athletes = (data?.athletes ?? []) as AthleteRow[];
  const teamName = data?.team?.name;

  const filtered = useMemo(() => {
    const group = POSITION_GROUPS.find((g) => g.key === filter);
    if (!group || !group.match) return athletes;
    const set = new Set(group.match.map((p) => p.toLowerCase()));
    return athletes.filter((a) => a.position && set.has(a.position.toLowerCase()));
  }, [athletes, filter]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: athletes.length };
    for (const g of POSITION_GROUPS) {
      if (!g.match) continue;
      const set = new Set(g.match.map((p) => p.toLowerCase()));
      map[g.key] = athletes.filter((a) => a.position && set.has(a.position.toLowerCase())).length;
    }
    return map;
  }, [athletes]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        full_name: form.full_name.trim(),
        nickname: form.nickname.trim(),
        position: form.position,
        whatsapp: form.whatsapp.replace(/\D/g, "") || null,
      };
      if (form.id) {
        return updateFn({ data: { id: form.id, ...payload } });
      }
      return createFn({ data: payload });
    },
    onSuccess: () => {
      toast.success(form.id ? "Jogador atualizado!" : "Jogador cadastrado!");
      setDialogOpen(false);
      setForm(emptyForm);
      qc.invalidateQueries({ queryKey: ["my-team-athletes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Jogador removido");
      setConfirmDelete(null);
      qc.invalidateQueries({ queryKey: ["my-team-athletes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openCreate() {
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(a: AthleteRow) {
    setForm({
      id: a.id,
      full_name: a.full_name ?? "",
      nickname: a.nickname ?? "",
      position: a.position ?? "",
      whatsapp: a.whatsapp ?? "",
    });
    setDialogOpen(true);
  }

  function submit() {
    if (form.full_name.trim().length < 2) return toast.error("Informe o nome completo");
    if (form.nickname.trim().length < 1) return toast.error("Informe o apelido");
    if (!form.position) return toast.error("Selecione a posição");
    saveMut.mutate();
  }

  return (
    <div className="min-h-screen text-white">
      <div className="max-w-4xl mx-auto space-y-6 pb-32">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button asChild size="icon" variant="ghost" className="text-zinc-400 hover:text-white hover:bg-white/5">
            <Link to="/minha-conta"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Meus Jogadores</h1>
            <p className="text-sm text-zinc-400 truncate">
              {teamName ? teamName : "Gestão do elenco"}
            </p>
          </div>
        </div>

        {/* Position filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin">
          {POSITION_GROUPS.map((g) => {
            const active = filter === g.key;
            return (
              <button
                key={g.key}
                onClick={() => setFilter(g.key)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors border ${
                  active
                    ? "bg-[#1565F5] text-white border-[#1565F5]"
                    : "bg-transparent text-zinc-300 border-zinc-700 hover:border-zinc-500 hover:text-white"
                }`}
              >
                {g.label}
                <span className={`ml-2 text-xs ${active ? "opacity-90" : "text-zinc-500"}`}>
                  {counts[g.key] ?? 0}
                </span>
              </button>
            );
          })}
        </div>

        {/* Athletes list */}
        {isLoading ? (
          <div className="text-zinc-500">Carregando elenco...</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-10 text-center">
            <Users className="h-10 w-10 mx-auto mb-3 text-zinc-600" />
            <p className="text-zinc-300 font-medium">Nenhum jogador nesta categoria.</p>
            <p className="text-sm text-zinc-500 mt-1">Toque no botão + para cadastrar.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 hover:border-zinc-700 transition-colors"
              >
                {a.photo_url ? (
                  <img
                    src={a.photo_url}
                    alt={a.nickname ?? "Atleta"}
                    className="h-11 w-11 rounded-full object-cover border border-zinc-700"
                  />
                ) : (
                  <div className="h-11 w-11 rounded-full bg-[#1565F5]/20 border border-[#1565F5]/40 flex items-center justify-center text-sm font-bold text-[#5B9BFF]">
                    {(a.nickname || a.full_name || "?").charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate text-white">
                    {a.nickname || a.full_name || "Sem nome"}
                  </p>
                  <p className="text-xs text-zinc-400 truncate">
                    {a.position ?? "—"}
                    {a.full_name && a.nickname ? ` · ${a.full_name}` : ""}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => openEdit(a)}
                    className="text-zinc-400 hover:text-white hover:bg-white/5"
                    aria-label="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setConfirmDelete(a)}
                    className="text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
                    aria-label="Remover"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Floating action button */}
      <button
        onClick={openCreate}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-[#1565F5] hover:bg-[#0f4fc6] active:bg-[#0d44a8] text-white font-semibold px-5 py-4 shadow-xl shadow-[#1565F5]/30 transition-colors"
      >
        <Plus className="h-5 w-5" />
        <span className="pr-1">Cadastrar Novo</span>
      </button>

      {/* Form dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">
              {form.id ? "Editar jogador" : "Cadastrar novo jogador"}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Apenas 4 campos. Sem CPF, sem burocracia.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="full_name" className="text-zinc-300">Nome Completo</Label>
              <Input
                id="full_name"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className="mt-1 bg-zinc-900 border-zinc-700 text-white"
                placeholder="Ex: João da Silva Santos"
              />
            </div>
            <div>
              <Label htmlFor="nickname" className="text-zinc-300">Apelido (Nome na Camisa)</Label>
              <Input
                id="nickname"
                value={form.nickname}
                onChange={(e) => setForm({ ...form, nickname: e.target.value })}
                className="mt-1 bg-zinc-900 border-zinc-700 text-white"
                placeholder="Ex: JOÃO"
              />
            </div>
            <div>
              <Label htmlFor="position" className="text-zinc-300">Posição</Label>
              <Select value={form.position} onValueChange={(v) => setForm({ ...form, position: v })}>
                <SelectTrigger id="position" className="mt-1 bg-zinc-900 border-zinc-700 text-white">
                  <SelectValue placeholder="Selecione a posição" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-950 border-zinc-800 text-white">
                  {POSITION_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="whatsapp" className="text-zinc-300">WhatsApp</Label>
              <Input
                id="whatsapp"
                inputMode="numeric"
                maxLength={11}
                value={form.whatsapp}
                onChange={(e) => setForm({ ...form, whatsapp: e.target.value.replace(/\D/g, "") })}
                className="mt-1 bg-zinc-900 border-zinc-700 text-white font-mono"
                placeholder="11987654321"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              className="text-zinc-300 hover:text-white hover:bg-white/5"
            >
              Cancelar
            </Button>
            <Button
              onClick={submit}
              disabled={saveMut.isPending}
              className="bg-[#1565F5] hover:bg-[#0f4fc6] text-white font-semibold"
            >
              {saveMut.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent className="bg-zinc-950 border-zinc-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Remover jogador?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              {confirmDelete?.nickname || confirmDelete?.full_name} será removido do elenco.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-zinc-700 text-zinc-300 hover:bg-white/5 hover:text-white">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && deleteMut.mutate(confirmDelete.id)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
