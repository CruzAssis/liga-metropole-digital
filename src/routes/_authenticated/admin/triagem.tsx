import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/admin/triagem')({
  component: TriagemPage,
})

type Director = { full_name: string | null; phone: string | null } | null
type PendingTeam = {
  id: string
  name: string
  short_name: string
  registration_type: string
  primary_color: string | null
  home_venue: string | null
  created_at: string
  manager_id: string
  director?: Director
}
type ApprovalConfig = { lado: 'A' | 'B'; serie: 'A' | 'B' }

function TriagemPage() {
  const [teams, setTeams] = useState<PendingTeam[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [approvals, setApprovals] = useState<Record<string, ApprovalConfig>>({})

  useEffect(() => { loadPendingTeams() }, [])

  async function loadPendingTeams() {
    setLoading(true)
    const { data, error } = await supabase
      .from('teams')
      .select('id,name,short_name,registration_type,primary_color,home_venue,created_at,manager_id')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }
    const list = (data ?? []) as PendingTeam[]
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
    enriched.forEach(t => { initial[t.id] = { lado: 'A', serie: 'A' } })
    setApprovals(initial)
    setLoading(false)
  }

  async function aprovarTime(teamId: string) {
    const config = approvals[teamId]
    if (!config) return
    setSaving(teamId)
    try {
      const { error } = await supabase
        .from('teams')
        .update({
          status: 'approved',
          lado: config.lado,
          serie: config.serie,
          approved_at: new Date().toISOString(),
        })
        .eq('id', teamId)
      if (error) throw error
      toast.success('Time aprovado!')
      setTeams(prev => prev.filter(t => t.id !== teamId))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao aprovar'
      toast.error(msg)
    } finally { setSaving(null) }
  }

  function updateApproval(teamId: string, field: keyof ApprovalConfig, value: string) {
    setApprovals(prev => ({
      ...prev,
      [teamId]: { ...prev[teamId], [field]: value as 'A' | 'B' },
    }))
  }

  if (loading) return <div className="p-8 text-zinc-400">Carregando...</div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Triagem de Inscricoes</h1>
          <p className="text-zinc-400 text-sm mt-1">{teams.length} time{teams.length !== 1 ? 's' : ''} aguardando aprovacao</p>
        </div>
        <Button variant="outline" onClick={loadPendingTeams} className="border-zinc-700 text-zinc-300">Atualizar</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(['host', 'visitor'] as const).map(tipo => (
          <div key={tipo} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <p className="text-zinc-500 text-xs uppercase tracking-wide">{tipo === 'host' ? 'Mandantes' : 'Visitantes'} pendentes</p>
            <p className="text-3xl font-bold text-white mt-1">{teams.filter(t => t.registration_type === tipo).length}</p>
          </div>
        ))}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <p className="text-zinc-500 text-xs uppercase tracking-wide">Total</p>
          <p className="text-3xl font-bold text-[#1565F5] mt-1">{teams.length}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <p className="text-zinc-500 text-xs uppercase tracking-wide">Meta</p>
          <p className="text-3xl font-bold text-zinc-400 mt-1">80</p>
        </div>
      </div>

      {teams.length === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
          <p className="text-zinc-400">Nenhuma inscricao pendente.</p>
        </div>
      )}

      <div className="space-y-4">
        {teams.map(team => {
          const config = approvals[team.id] || { lado: 'A', serie: 'A' }
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
                <p className="text-zinc-400 text-xs"><span className="text-zinc-500">Campo: </span>{team.home_venue}</p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 text-xs block mb-1">Lado</label>
                  <Select value={config.lado} onValueChange={v => updateApproval(team.id, 'lado', v)}>
                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="A">Lado A</SelectItem><SelectItem value="B">Lado B</SelectItem></SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-zinc-400 text-xs block mb-1">Serie</label>
                  <Select value={config.serie} onValueChange={v => updateApproval(team.id, 'serie', v)}>
                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="A">Serie A</SelectItem><SelectItem value="B">Serie B</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>

              <Button onClick={() => aprovarTime(team.id)} disabled={saving === team.id} className="w-full bg-[#1565F5] hover:bg-blue-600 text-white">
                {saving === team.id ? 'Aprovando...' : 'Aprovar time'}
              </Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
