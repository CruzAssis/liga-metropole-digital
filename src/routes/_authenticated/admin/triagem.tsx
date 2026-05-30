// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { supabase } from '~/integrations/supabase/client'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { useToast } from '~/hooks/use-toast'

export const Route = createFileRoute('/_authenticated/admin/triagem')({
  component: TriagemPage,
})

function TriagemPage() {
  const { toast } = useToast()
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [approvals, setApprovals] = useState({})

  useEffect(() => { loadPendingTeams() }, [])

  async function loadPendingTeams() {
    setLoading(true)
    const { data } = await supabase
      .from('teams')
      .select('*, diretor:profiles!profiles_time_diretor_id_fkey(nome_completo,telefone)')
      .eq('mensalidade_paga', false)
      .order('created_at', { ascending: true })
    if (data) {
      setTeams(data)
      const initial = {}
      data.forEach(t => { initial[t.id] = { lado: 'A', grupo: 'A', serie: 'A' } })
      setApprovals(initial)
    }
    setLoading(false)
  }

  async function aprovarTime(teamId) {
    const config = approvals[teamId]
    if (!config?.lado || !config?.grupo) {
      toast({ title: 'Defina o Lado e o Grupo antes de aprovar', variant: 'destructive' })
      return
    }
    setSaving(teamId)
    try {
      const { error } = await supabase.from('teams').update({
        lado: config.lado, grupo: config.grupo, serie: config.serie, mensalidade_paga: true
      }).eq('id', teamId)
      if (error) throw error
      toast({ title: 'Time aprovado!' })
      setTeams(prev => prev.filter(t => t.id !== teamId))
    } catch (err) {
      toast({ title: err.message || 'Erro ao aprovar', variant: 'destructive' })
    } finally { setSaving(null) }
  }

  function updateApproval(teamId, field, value) {
    setApprovals(prev => ({ ...prev, [teamId]: { ...prev[teamId], [field]: value } }))
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
        {['mandante', 'visitante'].map(tipo => (
          <div key={tipo} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <p className="text-zinc-500 text-xs uppercase tracking-wide">{tipo}s pendentes</p>
            <p className="text-3xl font-bold text-white mt-1">{teams.filter(t => t.tipo === tipo).length}</p>
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
          const config = approvals[team.id] || { lado: 'A', grupo: 'A', serie: 'A' }
          return (
            <div key={team.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: team.cor_primaria || '#1565F5' }}>
                  {team.nome?.[0]}
                </div>
                <div>
                  <p className="text-white font-semibold">{team.nome}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className={team.tipo === 'mandante' ? 'border-blue-600 text-blue-400 text-xs' : 'border-purple-600 text-purple-400 text-xs'}>
                      {team.tipo}
                    </Badge>
                    <span className="text-zinc-500 text-xs">{new Date(team.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
              </div>

              {team.diretor && (
                <div className="bg-zinc-800 rounded-lg p-3 text-sm">
                  <p className="text-zinc-300"><span className="text-zinc-500">Diretor: </span>{team.diretor.nome_completo}</p>
                  {team.diretor.telefone && (
                    <p className="text-zinc-300 mt-1">
                      <span className="text-zinc-500">WhatsApp: </span>
                      <a href={'https://wa.me/55' + team.diretor.telefone} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:underline">{team.diretor.telefone}</a>
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-zinc-400 text-xs block mb-1">Lado</label>
                  <Select value={config.lado} onValueChange={v => updateApproval(team.id, 'lado', v)}>
                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="A">Lado A</SelectItem><SelectItem value="B">Lado B</SelectItem></SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-zinc-400 text-xs block mb-1">Grupo</label>
                  <Select value={config.grupo} onValueChange={v => updateApproval(team.id, 'grupo', v)}>
                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">Grupo A</SelectItem><SelectItem value="B">Grupo B</SelectItem>
                      <SelectItem value="C">Grupo C</SelectItem><SelectItem value="D">Grupo D</SelectItem>
                    </SelectContent>
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
