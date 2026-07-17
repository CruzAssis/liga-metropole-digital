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
