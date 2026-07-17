import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Users, Search, RefreshCw, Shield, MessageCircle, Copy, Pencil } from 'lucide-react'
import { listAdminTeams, type AdminTeamRow } from '@/lib/admin-teams.functions'
import { adminUpdateTeam } from '@/lib/team-profile.functions'
import { supabase } from '@/integrations/supabase/client'
import { buildWhatsAppLink, formatPhoneBR } from '@/lib/wa'
import { toast } from 'sonner'


export const Route = createFileRoute('/_authenticated/admin/times')({
  component: AdminTimes,
})

const SENDER_NAME = 'Liga Metrópole'
const PROPOSAL_URL = 'https://liga-metropole-digital.lovable.app/manifesto/proposta-fundadores'

function inviteMessage(clubName: string) {
  return `Olá, diretor! Aqui é ${SENDER_NAME}. Analisamos a história do ${clubName} e queremos convidá-los a serem pilares da nossa liga. Confira a proposta aqui: ${PROPOSAL_URL}. Vamos elevar o nível da várzea?`
}

function statusBadge(status: string) {
  if (status === 'approved') return <Badge className="bg-green-600 text-white">Aprovado</Badge>
  if (status === 'pending') return <Badge className="bg-yellow-500 text-black">Pendente</Badge>
  if (status === 'waitlist') return <Badge className="bg-blue-600 text-white">Lista de espera</Badge>
  if (status === 'rejected') return <Badge className="bg-red-600 text-white">Reprovado</Badge>
  return <Badge variant="outline">{status}</Badge>
}

function AdminTimes() {
  const listFn = useServerFn(listAdminTeams)
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'teams'],
    queryFn: () => listFn(),
  })
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [editing, setEditing] = useState<AdminTeamRow | null>(null)


  const teams: AdminTeamRow[] = data ?? []
  const filtered = teams.filter((t) => {
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'todos' || t.status === statusFilter
    return matchSearch && matchStatus
  })

  const stats = {
    total: teams.length,
    aprovados: teams.filter((t) => t.status === 'approved').length,
    pendentes: teams.filter((t) => t.status === 'pending').length,
    waitlist: teams.filter((t) => t.status === 'waitlist').length,
  }

  function handleInvite(t: AdminTeamRow) {
    const msg = inviteMessage(t.name)
    const link = buildWhatsAppLink(t.director_phone, msg)
    if (!link) {
      // Sem telefone: copia a mensagem para clipboard
      navigator.clipboard.writeText(msg).then(() => {
        toast.info('Diretor sem telefone cadastrado. Mensagem copiada para colar.')
      })
      return
    }
    window.open(link, '_blank', 'noopener,noreferrer')
  }

  function copyMessage(t: AdminTeamRow) {
    navigator.clipboard.writeText(inviteMessage(t.name)).then(() => toast.success('Mensagem copiada'))
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-7 w-7 text-blue-500" />
          <div>
            <h1 className="text-2xl font-bold text-white">Times inscritos</h1>
            <p className="text-gray-400 text-sm">Envie convites via WhatsApp para os diretores</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={'h-4 w-4 mr-2 ' + (isFetching ? 'animate-spin' : '')} />
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total" value={stats.total} color="text-blue-400" />
        <StatCard label="Aprovados" value={stats.aprovados} color="text-green-400" />
        <StatCard label="Pendentes" value={stats.pendentes} color="text-yellow-400" />
        <StatCard label="Espera" value={stats.waitlist} color="text-sky-400" />
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar time..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-gray-800 border-gray-700 text-white"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] bg-gray-800 border-gray-700 text-white">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="approved">Aprovados</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="waitlist">Lista de espera</SelectItem>
            <SelectItem value="rejected">Reprovados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-gray-800 rounded-lg p-4 animate-pulse h-20" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="text-lg font-medium">Nenhum time encontrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => (
            <div
              key={t.id}
              className="bg-gray-800 rounded-lg p-4 flex flex-col md:flex-row md:items-center gap-4 hover:bg-gray-750 transition-colors"
            >
              {t.logo_url ? (
                <img src={t.logo_url} alt={t.name} className="h-12 w-12 rounded-full object-cover border-2 border-gray-600" />
              ) : (
                <div className="h-12 w-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
                  {t.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-white font-semibold truncate">{t.name}</p>
                  {statusBadge(t.status)}
                  {t.registration_type === 'host' && <Badge variant="outline" className="text-xs">Mandante</Badge>}
                </div>
                <p className="text-gray-400 text-sm mt-1">
                  Diretor: {t.director_name ?? '—'}
                  {t.director_phone ? ` · ${formatPhoneBR(t.director_phone)}` : ' · sem telefone'}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => setEditing(t)} title="Editar time">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => copyMessage(t)}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleInvite(t)}
                  className="bg-[#25D366] hover:bg-[#1ebe5a] text-white font-semibold"
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Convite WhatsApp
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AdminEditTeamDialog
        team={editing}
        onOpenChange={(v) => { if (!v) setEditing(null) }}
        onSaved={() => { setEditing(null); refetch() }}
      />

    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-gray-400 text-xs uppercase tracking-wider">{label}</p>
    </div>
  )
}

type EditForm = {
  name: string
  short_name: string
  lado: 'A' | 'B'
  serie: 'A' | 'B'
  registration_type: 'host' | 'visitor'
  status: 'pending' | 'approved' | 'waitlist' | 'rejected'
  competition_id: string | null
  home_venue: string
  home_time: string
}

function AdminEditTeamDialog({
  team, onOpenChange, onSaved,
}: {
  team: AdminTeamRow | null
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}) {
  const updateFn = useServerFn(adminUpdateTeam)
  const [form, setForm] = useState<EditForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [comps, setComps] = useState<{ id: string; name: string; subprefeitura: string | null }[]>([])

  useEffect(() => {
    if (!team) { setForm(null); return }
    (async () => {
      const [{ data: full }, { data: cs }] = await Promise.all([
        supabase.from('teams')
          .select('name, short_name, lado, serie, registration_type, status, competition_id, home_venue, home_time')
          .eq('id', team.id).maybeSingle(),
        supabase.from('competitions').select('id, name, subprefeitura').order('name'),
      ])
      const f = full as {
        name: string; short_name: string;
        lado: 'A' | 'B' | null; serie: 'A' | 'B' | null;
        registration_type: 'host' | 'visitor';
        status: 'pending' | 'approved' | 'waitlist' | 'rejected';
        competition_id: string | null; home_venue: string | null; home_time: string | null;
      } | null
      setForm({
        name: f?.name ?? team.name,
        short_name: f?.short_name ?? (team.short_name ?? ''),
        lado: f?.lado ?? 'A',
        serie: f?.serie ?? 'A',
        registration_type: (f?.registration_type ?? 'visitor'),
        status: (f?.status ?? 'pending'),
        competition_id: f?.competition_id ?? null,
        home_venue: f?.home_venue ?? '',
        home_time: f?.home_time ? f.home_time.slice(0, 5) : '',
      })
      setComps((cs ?? []) as { id: string; name: string; subprefeitura: string | null }[])
    })()
  }, [team])

  if (!team) return null

  const save = async () => {
    if (!form) return
    setSaving(true)
    try {
      await updateFn({
        data: {
          team_id: team.id,
          name: form.name.trim(),
          short_name: form.short_name.trim().toUpperCase(),
          lado: form.lado,
          serie: form.serie,
          registration_type: form.registration_type,
          status: form.status,
          competition_id: form.competition_id,
          home_venue: form.home_venue.trim() || null,
          home_time: form.home_time || null,
        },
      })
      toast.success('Time atualizado!')
      onSaved()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!team} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">Editar time (Admin)</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Poder total sobre os atributos deste time. Alterações refletem em tempo real.
          </DialogDescription>
        </DialogHeader>
        {!form ? (
          <p className="text-sm text-zinc-400">Carregando...</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nome</Label>
                <Input value={form.name} maxLength={80}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>Sigla</Label>
                <Input value={form.short_name} maxLength={10}
                  onChange={(e) => setForm({ ...form, short_name: e.target.value.toUpperCase() })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Lado (Conferência)</Label>
                <Select value={form.lado} onValueChange={(v) => setForm({ ...form, lado: v as 'A' | 'B' })}>
                  <SelectTrigger className="bg-zinc-900 border-zinc-700"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="A">Lado A</SelectItem><SelectItem value="B">Lado B</SelectItem></SelectContent>
                </Select>
              </div>
              <div>
                <Label>Série</Label>
                <Select value={form.serie} onValueChange={(v) => setForm({ ...form, serie: v as 'A' | 'B' })}>
                  <SelectTrigger className="bg-zinc-900 border-zinc-700"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="A">Série A</SelectItem><SelectItem value="B">Série B</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Mando</Label>
                <Select value={form.registration_type} onValueChange={(v) => setForm({ ...form, registration_type: v as 'host' | 'visitor' })}>
                  <SelectTrigger className="bg-zinc-900 border-zinc-700"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="host">Mandante</SelectItem><SelectItem value="visitor">Visitante</SelectItem></SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as EditForm['status'] })}>
                  <SelectTrigger className="bg-zinc-900 border-zinc-700"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="approved">Aprovado</SelectItem>
                    <SelectItem value="waitlist">Lista de espera</SelectItem>
                    <SelectItem value="rejected">Reprovado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Liga / Subprefeitura</Label>
              <Select
                value={form.competition_id ?? '__none__'}
                onValueChange={(v) => setForm({ ...form, competition_id: v === '__none__' ? null : v })}
              >
                <SelectTrigger className="bg-zinc-900 border-zinc-700"><SelectValue placeholder="Sem liga" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Sem liga —</SelectItem>
                  {comps.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}{c.subprefeitura ? ` · ${c.subprefeitura}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.registration_type === 'host' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Estádio</Label>
                  <Input value={form.home_venue} maxLength={120}
                    onChange={(e) => setForm({ ...form, home_venue: e.target.value })} />
                </div>
                <div>
                  <Label>Horário</Label>
                  <Input type="time" value={form.home_time}
                    onChange={(e) => setForm({ ...form, home_time: e.target.value })} />
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={save} disabled={saving} className="bg-[#1565F5] hover:bg-blue-600 text-white">
                {saving ? 'Salvando...' : 'Salvar alterações'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

