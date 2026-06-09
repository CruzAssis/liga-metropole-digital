import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Spinner } from '@/components/AppSkeletons'

export const Route = createFileRoute('/_authenticated/admin/triagem')({
  component: TriagemPage,
})

type Director = { full_name: string | null; phone: string | null } | null
type TeamRow = {
  id: string
  name: string
  short_name: string
  registration_type: 'host' | 'visitor'
  primary_color: string | null
  home_venue: string | null
  home_time: string | null
  created_at: string
  manager_id: string
  status: 'pending' | 'approved' | 'rejected' | 'waitlist'
  lado: 'A' | 'B'
  director?: Director
}
type ApprovalConfig = { lado: 'A' | 'B'; serie: 'A' | 'B' }

const SLOT_LIMIT = 20

type SlotKey = `${'host' | 'visitor'}-${'A' | 'B'}`

function slotLabel(type: 'host' | 'visitor', lado: 'A' | 'B') {
  return `${type === 'host' ? 'Mandantes' : 'Visitantes'} ${lado}`
}

function TriagemPage() {
  const [teams, setTeams] = useState<TeamRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [approvals, setApprovals] = useState<Record<string, ApprovalConfig>>({})

  useEffect(() => { loadTeams() }, [])

  async function loadTeams() {
    setLoading(true)
    const { data, error } = await supabase
      .from('teams')
      .select('id,name,short_name,registration_type,primary_color,home_venue,home_time,created_at,manager_id,status,lado')
      .in('status', ['pending', 'approved'])
      .order('created_at', { ascending: true })
    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }
    const list = (data ?? []) as TeamRow[]
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
    const initial: Record<string, ApprovalConfig> = {}
    enriched.filter(t => t.status === 'pending').forEach(t => { initial[t.id] = { lado: 'A', serie: 'A' } })
    setApprovals(initial)
    setLoading(false)
  }

  const slotCounts = useMemo(() => {
    const counts: Record<SlotKey, number> = {
      'host-A': 0, 'host-B': 0, 'visitor-A': 0, 'visitor-B': 0,
    }
    for (const t of teams) {
      if (t.status === 'approved') {
        counts[`${t.registration_type}-${t.lado}` as SlotKey]++
      }
    }
    return counts
  }, [teams])

  function slotFull(type: 'host' | 'visitor', lado: 'A' | 'B') {
    return slotCounts[`${type}-${lado}` as SlotKey] >= SLOT_LIMIT
  }

  async function aprovarTime(team: TeamRow) {
    const config = approvals[team.id]
    if (!config) return
    if (slotFull(team.registration_type, config.lado)) {
      toast.error(`Vaga em ${slotLabel(team.registration_type, config.lado)} está cheia (20/20)`)
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
          approved_at: new Date().toISOString(),
        })
        .eq('id', team.id)
      if (error) throw error
      toast.success('Time aprovado!')
      await loadTeams()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao aprovar'
      toast.error(msg)
    } finally { setSaving(null) }
  }
  async function reprovarTime(team: TeamRow) {
    const reason = window.prompt('Motivo da reprovacao (obrigatorio):')
    if (!reason || !reason.trim()) return
    setSaving(team.id)
    try {
      const { error } = await supabase
        .from('teams')
        .update({ status: 'rejected', rejected_reason: reason.trim() })
        .eq('id', team.id)
      if (error) throw error
      toast.success('Time reprovado.')
      await loadTeams()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao reprovar'
      toast.error(msg)
    } finally {
      setSaving(null)
    }
  }



  function updateApproval(teamId: string, field: keyof ApprovalConfig, value: string) {
    setApprovals(prev => ({
      ...prev,
      [teamId]: { ...prev[teamId], [field]: value as 'A' | 'B' },
    }))
  }

  if (loading) return <div className="p-8 text-zinc-400">Carregando...</div>

  const pending = teams.filter(t => t.status === 'pending')

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Triagem de Inscrições</h1>
          <p className="text-zinc-400 text-sm mt-1">{pending.length} time{pending.length !== 1 ? 's' : ''} aguardando aprovação</p>
        </div>
        <Button variant="outline" onClick={loadTeams} className="border-zinc-700 text-zinc-300">Atualizar</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(['host', 'visitor'] as const).flatMap(type =>
          (['A', 'B'] as const).map(lado => {
            const c = slotCounts[`${type}-${lado}` as SlotKey]
            const pct = (c / SLOT_LIMIT) * 100
            const full = c >= SLOT_LIMIT
            const almost = c >= SLOT_LIMIT - 3 && !full
            return (
              <div key={`${type}-${lado}`} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                <p className="text-zinc-500 text-xs uppercase tracking-wide">{slotLabel(type, lado)}</p>
                <p className="text-3xl font-bold text-white mt-1 tabular-nums">{c}<span className="text-zinc-600 text-base font-normal">/{SLOT_LIMIT}</span></p>
                <div className="mt-2 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={full ? 'bg-red-500 h-full' : almost ? 'bg-yellow-500 h-full' : 'bg-emerald-500 h-full'}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {full && <p className="text-red-400 text-xs mt-2">Vaga cheia</p>}
                {almost && <p className="text-yellow-400 text-xs mt-2">Quase cheia</p>}
              </div>
            )
          }),
        )}
      </div>

      {pending.length === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
          <p className="text-zinc-400">Nenhuma inscrição pendente.</p>
        </div>
      )}

      <div className="space-y-4">
        {pending.map(team => {
          const config = approvals[team.id] || { lado: 'A' as const, serie: 'A' as const }
          const targetFull = slotFull(team.registration_type, config.lado)
          return (
            <div key={team.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: team.primary_color || '#1565F5' }}>
                  {team.short_name?.[0] || team.name?.[0]}
                </div>
                <div>
                  <p className="text-white font-semibold">{team.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className={team.registration_type === 'host' ? 'border-blue-600 text-blue-400 text-xs' : 'border-purple-600 text-purple-400 text-xs'}>
                      {team.registration_type === 'host' ? 'mandante' : 'visitante'}
                    </Badge>
                    <span className="text-zinc-500 text-xs">{new Date(team.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
              </div>

              {team.director && (
                <div className="bg-zinc-800 rounded-lg p-3 text-sm">
                  <p className="text-zinc-300"><span className="text-zinc-500">Diretor: </span>{team.director.full_name}</p>
                  {team.director.phone && (
                    <p className="text-zinc-300 mt-1">
                      <span className="text-zinc-500">WhatsApp: </span>
                      <a href={'https://wa.me/55' + team.director.phone} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:underline">{team.director.phone}</a>
                    </p>
                  )}
                </div>
              )}

              {team.home_venue && (
                <p className="text-zinc-400 text-xs"><span className="text-zinc-500">Campo: </span>{team.home_venue}{team.home_time && ` · ${team.home_time}`}</p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 text-xs block mb-1">Lado</label>
                  <Select value={config.lado} onValueChange={v => updateApproval(team.id, 'lado', v)}>
                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A" disabled={slotFull(team.registration_type, 'A')}>
                        Lado A {slotFull(team.registration_type, 'A') ? '(cheio)' : ''}
                      </SelectItem>
                      <SelectItem value="B" disabled={slotFull(team.registration_type, 'B')}>
                        Lado B {slotFull(team.registration_type, 'B') ? '(cheio)' : ''}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-zinc-400 text-xs block mb-1">Série</label>
                  <Select value={config.serie} onValueChange={v => updateApproval(team.id, 'serie', v)}>
                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="A">Série A</SelectItem><SelectItem value="B">Série B</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                onClick={() => aprovarTime(team)}
                disabled={saving === team.id || targetFull}
                className="w-full bg-[#1565F5] hover:bg-blue-600 text-white disabled:opacity-50"
              >
                {targetFull
                  ? `${slotLabel(team.registration_type, config.lado)} cheio`
                  : saving === team.id ? <><Spinner className="mr-2 h-4 w-4" />Aguarde...</> : 'Aprovar time'}
              </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => reprovarTime(team)}
              disabled={saving === team.id}
              className="w-full border-red-800 text-red-400 hover:bg-red-950 mt-2"
            >
              {saving === team.id ? <><Spinner className="mr-2 h-4 w-4" />Aguarde...</> : 'Reprovar time'}
            </Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
