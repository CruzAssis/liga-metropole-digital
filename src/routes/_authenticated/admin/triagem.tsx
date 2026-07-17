import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Spinner } from '@/components/AppSkeletons'
import { AlertTriangle, CheckCircle2, Clock, MapPin, Phone, RotateCcw, Search, XCircle } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/admin/triagem')({
  component: TriagemPage,
})

type Director = { full_name: string | null; phone: string | null } | null
type TeamStatus = 'pending' | 'approved' | 'rejected' | 'waitlist'
type TeamRow = {
  id: string
  name: string
  short_name: string
  logo_url: string | null
  registration_type: 'host' | 'visitor'
  primary_color: string | null
  home_venue: string | null
  home_time: string | null
  created_at: string
  approved_at: string | null
  manager_id: string
  status: TeamStatus
  lado: 'A' | 'B'
  serie: 'A' | 'B'
  competition_id: string | null
  rejected_reason: string | null
  director?: Director
}
type Competition = {
  id: string
  name: string
  conference_name: string | null
  zona: string | null
  subprefeitura: string | null
  host_slots: number
  visitor_slots: number
  max_teams: number
  registration_status: string
  use_sides: boolean
}
type ApprovalConfig = {
  competition_id: string
  lado: 'A' | 'B'
  serie: 'A' | 'B'
}

type SlotKey = string // `${competition_id}:${type}:${lado}`

function slotKey(cid: string, type: 'host' | 'visitor', lado: 'A' | 'B'): SlotKey {
  return `${cid}:${type}:${lado}`
}

function slotLabel(type: 'host' | 'visitor', lado: 'A' | 'B') {
  return `${type === 'host' ? 'Mandantes' : 'Visitantes'} ${lado}`
}

const STATUS_TABS: { key: TeamStatus; label: string; icon: React.ReactNode }[] = [
  { key: 'pending', label: 'Pendentes', icon: <Clock className="h-3.5 w-3.5" /> },
  { key: 'approved', label: 'Aprovados', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  { key: 'waitlist', label: 'Lista de espera', icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  { key: 'rejected', label: 'Reprovados', icon: <XCircle className="h-3.5 w-3.5" /> },
]

function TriagemPage() {
  const [teams, setTeams] = useState<TeamRow[]>([])
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [masterOpen, setMasterOpen] = useState<boolean>(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [approvals, setApprovals] = useState<Record<string, ApprovalConfig>>({})
  const [tab, setTab] = useState<TeamStatus>('pending')
  const [search, setSearch] = useState('')

  useEffect(() => { void loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [teamsRes, compsRes, settingsRes] = await Promise.all([
        supabase
          .from('teams')
          .select('id,name,short_name,logo_url,registration_type,primary_color,home_venue,home_time,created_at,approved_at,manager_id,status,lado,serie,competition_id,rejected_reason')
          .order('created_at', { ascending: true }),
        supabase
          .from('competitions')
          .select('id,name,conference_name,zona,subprefeitura,host_slots,visitor_slots,max_teams,registration_status,use_sides')
          .order('created_at', { ascending: true }),
        supabase.from('system_settings').select('master_registration_open').eq('id', true).maybeSingle(),
      ])

      if (teamsRes.error) throw teamsRes.error
      if (compsRes.error) throw compsRes.error

      const list = (teamsRes.data ?? []) as unknown as TeamRow[]
      const comps = (compsRes.data ?? []) as unknown as Competition[]
      setMasterOpen(Boolean(settingsRes.data?.master_registration_open))

      // Load directors
      const managerIds = Array.from(new Set(list.map(t => t.manager_id)))
      let dirMap = new Map<string, Director>()
      if (managerIds.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id,full_name,phone')
          .in('id', managerIds)
        dirMap = new Map((profs ?? []).map(p => [p.id, { full_name: p.full_name, phone: p.phone }]))
      }
      const enriched = list.map(t => ({ ...t, director: dirMap.get(t.manager_id) ?? null }))
      setTeams(enriched)
      setCompetitions(comps)

      // Initial approval config: pick first open competition; lado A / serie A
      const openComps = comps.filter(c => ['open', 'draw_ready', 'closed'].includes(c.registration_status))
      const defaultCompId = openComps[0]?.id ?? comps[0]?.id ?? ''
      const initial: Record<string, ApprovalConfig> = {}
      enriched.filter(t => t.status === 'pending').forEach(t => {
        initial[t.id] = {
          competition_id: t.competition_id ?? defaultCompId,
          lado: 'A',
          serie: 'A',
        }
      })
      setApprovals(initial)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar dados'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  // Slot counts by (competition, type, lado)
  const slotCounts = useMemo(() => {
    const counts: Record<SlotKey, number> = {}
    for (const t of teams) {
      if (t.status === 'approved' && t.competition_id) {
        const k = slotKey(t.competition_id, t.registration_type, t.lado)
        counts[k] = (counts[k] ?? 0) + 1
      }
    }
    return counts
  }, [teams])

  function slotLimit(comp: Competition | undefined, type: 'host' | 'visitor'): number {
    if (!comp) return 0
    const total = type === 'host' ? comp.host_slots : comp.visitor_slots
    return comp.use_sides ? Math.ceil(total / 2) : total
  }

  function slotFull(comp: Competition | undefined, type: 'host' | 'visitor', lado: 'A' | 'B'): boolean {
    if (!comp) return true
    const current = slotCounts[slotKey(comp.id, type, lado)] ?? 0
    return current >= slotLimit(comp, type)
  }

  function competitionById(id: string | null | undefined): Competition | undefined {
    return competitions.find(c => c.id === id)
  }

  async function aprovarTime(team: TeamRow) {
    const config = approvals[team.id]
    if (!config?.competition_id) {
      toast.error('Selecione uma conferência para aprovar o time.')
      return
    }
    const comp = competitionById(config.competition_id)
    if (!comp) {
      toast.error('Conferência inválida.')
      return
    }
    if (slotFull(comp, team.registration_type, config.lado)) {
      toast.error(`${slotLabel(team.registration_type, config.lado)} da ${comp.conference_name ?? comp.name} está cheio.`)
      return
    }
    setSaving(team.id)
    try {
      const { error } = await supabase
        .from('teams')
        .update({
          status: 'approved',
          lado: config.lado,
          serie: config.serie,
          competition_id: config.competition_id,
          approved_at: new Date().toISOString(),
          rejected_reason: null,
        })
        .eq('id', team.id)
      if (error) throw error
      toast.success(`Time aprovado em ${comp.conference_name ?? comp.name}`)
      await loadAll()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao aprovar'
      toast.error(msg)
    } finally { setSaving(null) }
  }

  async function reprovarTime(team: TeamRow) {
    const reason = window.prompt('Motivo da reprovação (obrigatório):')
    if (!reason || !reason.trim()) return
    setSaving(team.id)
    try {
      const { error } = await supabase
        .from('teams')
        .update({ status: 'rejected', rejected_reason: reason.trim(), approved_at: null })
        .eq('id', team.id)
      if (error) throw error
      toast.success('Time reprovado.')
      await loadAll()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao reprovar'
      toast.error(msg)
    } finally { setSaving(null) }
  }

  async function moverParaEspera(team: TeamRow) {
    setSaving(team.id)
    try {
      const { error } = await supabase
        .from('teams')
        .update({ status: 'waitlist', approved_at: null })
        .eq('id', team.id)
      if (error) throw error
      toast.success('Time movido para lista de espera.')
      await loadAll()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao mover'
      toast.error(msg)
    } finally { setSaving(null) }
  }

  async function reverterParaPendente(team: TeamRow) {
    if (!confirm(`Reverter "${team.name}" para pendente?`)) return
    setSaving(team.id)
    try {
      const { error } = await supabase
        .from('teams')
        .update({ status: 'pending', approved_at: null, rejected_reason: null })
        .eq('id', team.id)
      if (error) throw error
      toast.success('Time voltou para triagem.')
      await loadAll()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao reverter'
      toast.error(msg)
    } finally { setSaving(null) }
  }

  function updateApproval(teamId: string, field: keyof ApprovalConfig, value: string) {
    setApprovals(prev => ({
      ...prev,
      [teamId]: { ...(prev[teamId] ?? { competition_id: '', lado: 'A', serie: 'A' }), [field]: value },
    }))
  }

  if (loading) return <div className="p-8 text-zinc-400">Carregando...</div>

  const counts: Record<TeamStatus, number> = {
    pending: teams.filter(t => t.status === 'pending').length,
    approved: teams.filter(t => t.status === 'approved').length,
    waitlist: teams.filter(t => t.status === 'waitlist').length,
    rejected: teams.filter(t => t.status === 'rejected').length,
  }

  const visible = teams
    .filter(t => t.status === tab)
    .filter(t => {
      if (!search.trim()) return true
      const q = search.trim().toLowerCase()
      return t.name.toLowerCase().includes(q) || t.short_name.toLowerCase().includes(q)
    })

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-white">Triagem de Inscrições</h1>
          <p className="text-zinc-400 text-xs sm:text-sm mt-1">
            Aprove, mova para lista de espera ou reprove inscrições e vincule cada time a uma conferência.
          </p>
        </div>
        <Button variant="outline" onClick={loadAll} className="self-start sm:self-auto border-zinc-700 text-zinc-300">Atualizar</Button>
      </div>


      {!masterOpen && (
        <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-yellow-200 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            A <strong>Chave Mestra de cadastros</strong> está desligada — novos times chegam à triagem, mas o acesso público às inscrições continua bloqueado até você ligar o interruptor em <em>Admin → Chave Mestra</em>.
          </div>
        </div>
      )}

      {competitions.length === 0 && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
          Nenhuma conferência cadastrada. Crie uma em <em>Admin → Ligas</em> antes de aprovar times.
        </div>
      )}

      {/* Slot summary per competition */}
      {competitions.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">Ocupação por conferência</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {competitions.map(comp => {
              const rows: { type: 'host' | 'visitor'; lado: 'A' | 'B' }[] = comp.use_sides
                ? [
                    { type: 'host', lado: 'A' }, { type: 'host', lado: 'B' },
                    { type: 'visitor', lado: 'A' }, { type: 'visitor', lado: 'B' },
                  ]
                : [{ type: 'host', lado: 'A' }, { type: 'visitor', lado: 'A' }]
              const total = teams.filter(t => t.status === 'approved' && t.competition_id === comp.id).length
              return (
                <div key={comp.id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-white text-sm font-semibold truncate">{comp.conference_name ?? comp.name}</p>
                    <span className="text-xs text-zinc-500 tabular-nums">{total}/{comp.max_teams}</span>
                  </div>
                  {comp.subprefeitura && (
                    <p className="text-[11px] text-zinc-500 flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3" />{comp.subprefeitura}
                    </p>
                  )}
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {rows.map(r => {
                      const c = slotCounts[slotKey(comp.id, r.type, r.lado)] ?? 0
                      const limit = slotLimit(comp, r.type)
                      const full = c >= limit
                      const pct = limit > 0 ? Math.min(100, (c / limit) * 100) : 0
                      return (
                        <div key={`${r.type}-${r.lado}`} className="text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-zinc-400">
                              {comp.use_sides ? slotLabel(r.type, r.lado) : (r.type === 'host' ? 'Mandantes' : 'Visitantes')}
                            </span>
                            <span className={full ? 'text-red-400 tabular-nums' : 'text-zinc-300 tabular-nums'}>{c}/{limit}</span>
                          </div>
                          <div className="mt-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                            <div className={full ? 'bg-red-500 h-full' : 'bg-emerald-500 h-full'} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Tabs + Search */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === t.key
                ? 'border-blue-500 bg-blue-500/15 text-blue-300'
                : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {t.icon} {t.label}
            <span className="ml-1 tabular-nums text-zinc-500">{counts[t.key]}</span>
          </button>
        ))}
        <div className="relative ml-auto w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input
            placeholder="Buscar por nome ou sigla..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 bg-zinc-900 border-zinc-800 text-white"
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
          <p className="text-zinc-400">Nenhum time nesta categoria.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map(team => {
            const config = approvals[team.id]
            const targetComp = competitionById(config?.competition_id)
            const targetFull = tab === 'pending' && !!targetComp && !!config
              ? slotFull(targetComp, team.registration_type, config.lado)
              : false
            const teamComp = competitionById(team.competition_id)

            return (
              <div key={team.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
                <div className="flex items-start gap-3">
                  {team.logo_url ? (
                    <img src={team.logo_url} alt={team.name} className="w-11 h-11 rounded-full object-cover border border-zinc-800" />
                  ) : (
                    <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ backgroundColor: team.primary_color || '#1565F5' }}>
                      {team.short_name?.[0] || team.name?.[0]}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white font-semibold">{team.name}</p>
                      <span className="text-zinc-500 text-xs">({team.short_name})</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className={team.registration_type === 'host' ? 'border-blue-600 text-blue-400 text-xs' : 'border-purple-600 text-purple-400 text-xs'}>
                        {team.registration_type === 'host' ? 'Mandante' : 'Visitante'}
                      </Badge>
                      {team.status === 'approved' && (
                        <Badge variant="outline" className="text-xs border-emerald-600 text-emerald-400">
                          Lado {team.lado} · Série {team.serie}
                        </Badge>
                      )}
                      {teamComp && (
                        <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-300">
                          {teamComp.conference_name ?? teamComp.name}
                        </Badge>
                      )}
                      <span className="text-zinc-500 text-xs">
                        Inscrito em {new Date(team.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>
                </div>

                {team.director && (team.director.full_name || team.director.phone) && (
                  <div className="bg-zinc-800/60 rounded-lg p-3 text-sm space-y-1">
                    {team.director.full_name && (
                      <p className="text-zinc-300"><span className="text-zinc-500">Diretor: </span>{team.director.full_name}</p>
                    )}
                    {team.director.phone && (
                      <p className="text-zinc-300 flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5 text-zinc-500" />
                        <a
                          href={'https://wa.me/55' + team.director.phone.replace(/\D/g, '')}
                          target="_blank" rel="noopener noreferrer"
                          className="text-green-400 hover:underline"
                        >{team.director.phone}</a>
                      </p>
                    )}
                  </div>
                )}

                {team.home_venue && (
                  <p className="text-zinc-400 text-xs flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-zinc-500" />
                    <span className="text-zinc-500">Campo:</span> {team.home_venue}
                    {team.home_time && <span className="text-zinc-500"> · {team.home_time}</span>}
                  </p>
                )}

                {team.status === 'rejected' && team.rejected_reason && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                    <span className="font-semibold">Motivo da reprovação: </span>{team.rejected_reason}
                  </div>
                )}

                {tab === 'pending' && (
                  <>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="sm:col-span-3">
                        <label className="text-zinc-400 text-xs block mb-1">Conferência</label>
                        <Select
                          value={config?.competition_id ?? ''}
                          onValueChange={v => updateApproval(team.id, 'competition_id', v)}
                        >
                          <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                            <SelectValue placeholder="Selecione a conferência" />
                          </SelectTrigger>
                          <SelectContent>
                            {competitions.map(c => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.conference_name ?? c.name}
                                {c.subprefeitura ? ` — ${c.subprefeitura}` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-zinc-400 text-xs block mb-1">Lado</label>
                        <Select
                          value={config?.lado ?? 'A'}
                          onValueChange={v => updateApproval(team.id, 'lado', v)}
                          disabled={!targetComp?.use_sides}
                        >
                          <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="A" disabled={!!targetComp && slotFull(targetComp, team.registration_type, 'A')}>
                              Lado A {targetComp && slotFull(targetComp, team.registration_type, 'A') ? '(cheio)' : ''}
                            </SelectItem>
                            <SelectItem value="B" disabled={!!targetComp && slotFull(targetComp, team.registration_type, 'B')}>
                              Lado B {targetComp && slotFull(targetComp, team.registration_type, 'B') ? '(cheio)' : ''}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        {targetComp && !targetComp.use_sides && (
                          <p className="text-[10px] text-zinc-500 mt-1">Conferência sem divisão por lados</p>
                        )}
                      </div>
                      <div>
                        <label className="text-zinc-400 text-xs block mb-1">Série</label>
                        <Select value={config?.serie ?? 'A'} onValueChange={v => updateApproval(team.id, 'serie', v)}>
                          <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="A">Série A</SelectItem>
                            <SelectItem value="B">Série B</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-3">
                      <Button
                        onClick={() => aprovarTime(team)}
                        disabled={saving === team.id || targetFull || !config?.competition_id}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                      >
                        {saving === team.id
                          ? <><Spinner className="mr-2 h-4 w-4" />Aguarde...</>
                          : targetFull
                            ? 'Vaga cheia'
                            : <><CheckCircle2 className="h-4 w-4 mr-1" /> Aprovar</>}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => moverParaEspera(team)}
                        disabled={saving === team.id}
                        className="border-yellow-700 text-yellow-300 hover:bg-yellow-900/30"
                      >
                        <AlertTriangle className="h-4 w-4 mr-1" /> Lista de espera
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => reprovarTime(team)}
                        disabled={saving === team.id}
                        className="border-red-800 text-red-400 hover:bg-red-950"
                      >
                        <XCircle className="h-4 w-4 mr-1" /> Reprovar
                      </Button>
                    </div>
                  </>
                )}

                {tab !== 'pending' && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => reverterParaPendente(team)}
                      disabled={saving === team.id}
                      className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                    >
                      <RotateCcw className="h-4 w-4 mr-1" /> Voltar para triagem
                    </Button>
                    {tab === 'waitlist' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => reprovarTime(team)}
                        disabled={saving === team.id}
                        className="border-red-800 text-red-400 hover:bg-red-950"
                      >
                        <XCircle className="h-4 w-4 mr-1" /> Reprovar
                      </Button>
                    )}
                    {tab === 'approved' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => moverParaEspera(team)}
                        disabled={saving === team.id}
                        className="border-yellow-700 text-yellow-300 hover:bg-yellow-900/30"
                      >
                        <AlertTriangle className="h-4 w-4 mr-1" /> Mover para espera
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
