// @ts-nocheck
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { StepHeader } from '@/components/ui/step-header'
import { PrimaryCTA } from '@/components/ui/primary-cta'

export const Route = createFileRoute('/onboarding/jogador')({
  component: JogadorOnboarding,
})

const POSICOES = ['Goleiro', 'Zagueiro', 'Lateral', 'Volante', 'Meia', 'Atacante']

function JogadorOnboarding() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState(null)
  const [teamSearch, setTeamSearch] = useState('')
  const [teams, setTeams] = useState([])
  const [teamsLoading, setTeamsLoading] = useState(false)
  const [selectedTeamId, setSelectedTeamId] = useState(null)
  const [mode, setMode] = useState(null)
  const [form, setForm] = useState({ nickname: '', position: '', age: '', phrase: '', rating: 5 })
  const [errorMsg, setErrorMsg] = useState('')
  const nicknameRef = useRef(null)
  const positionRef = useRef(null)
  const modeRef = useRef(null)
  const teamRef = useRef(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) navigate({ to: '/login', replace: true })
      else setUserId(data.user.id)
    })
  }, [])

  useEffect(() => {
    if (!teamSearch.trim()) { setTeams([]); return }
    const timeout = setTimeout(async () => {
      setTeamsLoading(true)
      const { data } = await supabase.from('teams').select('id, name, short_name, logo_url').ilike('name', '%' + teamSearch + '%').eq('status', 'approved').limit(10)
      setTeams(data ?? [])
      setTeamsLoading(false)
    }, 400)
    return () => clearTimeout(timeout)
  }, [teamSearch])

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  function failWith(msg, ref) {
    setErrorMsg(msg)
    toast.error(msg)
    if (ref?.current) {
      ref.current.focus?.()
      ref.current.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErrorMsg('')
    if (!form.nickname.trim()) return failWith('Informe seu apelido de campo', nicknameRef)
    if (!form.position) return failWith('Selecione sua posição', positionRef)
    if (!mode) return failWith('Escolha entre vincular a uma equipe ou entrar no mercado', modeRef)
    if (mode === 'team' && !selectedTeamId) return failWith('Busque e selecione um time', teamRef)
    if (!userId) return
    setLoading(true)
    try {
      const { data: profile } = await supabase.from('profiles').select('cpf').eq('id', userId).single()
      const cpf = profile?.cpf ?? ''
      const cpf_last4 = cpf.slice(-4)
      const encoder = new TextEncoder()
      const buf = encoder.encode(cpf)
      const hashBuffer = await crypto.subtle.digest('SHA-256', buf)
      const cpf_hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
      const { error } = await supabase.from('athletes').insert({
        user_id: userId, nickname: form.nickname.trim(), position: form.position,
        cpf_hash, cpf_last4, team_id: mode === 'team' && selectedTeamId ? selectedTeamId : null, available_for_transfer: mode === 'market', verified: false,
      })
      if (error) throw error
      toast.success(mode === 'market' ? 'Você está no mercado de jogadores!' : 'Perfil de jogador criado!')
      navigate({ to: '/minha-conta', replace: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar perfil'
      setErrorMsg(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black px-4 py-12">
      <div className="max-w-xl mx-auto space-y-8">
        <StepHeader
          title="Perfil de Jogador"
          subtitle="Crie seu perfil de atleta na Liga Metrópole"
        />
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="nickname" className="text-zinc-300">Apelido / Nome de campo</Label>
            <Input id="nickname" name="nickname" type="text" required value={form.nickname} onChange={handleChange} className="mt-1 bg-zinc-900 border-zinc-700 text-white" placeholder="Como você é chamado em campo?" />
          </div>
          <div>
            <Label className="text-zinc-300">Posição</Label>
            <select name="position" value={form.position} onChange={handleChange} required className="w-full mt-1 bg-zinc-900 border border-zinc-700 text-white rounded-md px-3 py-2 text-sm">
              <option value="">Selecione sua posição...</option>
              {POSICOES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="age" className="text-zinc-300">Idade</Label>
            <Input id="age" name="age" type="number" min="10" max="99" value={form.age} onChange={handleChange} className="mt-1 bg-zinc-900 border-zinc-700 text-white" placeholder="Ex: 25" />
          </div>
          <div>
            <Label htmlFor="phrase" className="text-zinc-300">Meu estilo de jogo em uma frase</Label>
            <Input id="phrase" name="phrase" type="text" maxLength={100} value={form.phrase} onChange={handleChange} className="mt-1 bg-zinc-900 border-zinc-700 text-white" placeholder="Ex: Rápido e sempre na correria" />
            <p className="text-xs text-zinc-600 mt-1">{form.phrase.length}/100</p>
          </div>
          <div>
            <Label className="text-zinc-300">Como você avalia seu nível? ({form.rating}/10)</Label>
            <input type="range" min="1" max="10" name="rating" value={form.rating} onChange={e => setForm(prev => ({ ...prev, rating: Number(e.target.value) }))} className="w-full mt-2 accent-blue-500" />
            <div className="flex justify-between text-xs text-zinc-600 mt-1"><span>Iniciante (1)</span><span>Semi-profissional (10)</span></div>
          </div>
          <div className="space-y-3">
            <Label className="text-zinc-300">O que você quer fazer?</Label>
            <div className="space-y-2">
              <button type="button" onClick={() => setMode('team')} className={`w-full p-4 rounded-xl border-2 text-left ${mode === 'team' ? 'border-blue-500 bg-blue-500/10' : 'border-zinc-700 bg-zinc-900'}`}>
                <p className="font-medium text-white text-sm">Vincular a uma equipe</p>
                <p className="text-xs text-zinc-400 mt-1">Busque pelo nome do time que você já joga</p>
              </button>
              <button type="button" onClick={() => setMode('market')} className={`w-full p-4 rounded-xl border-2 text-left ${mode === 'market' ? 'border-green-500 bg-green-500/10' : 'border-zinc-700 bg-zinc-900'}`}>
                <p className="font-medium text-white text-sm">Entrar no mercado de jogadores</p>
                <p className="text-xs text-zinc-400 mt-1">Seu perfil ficará visível para diretores que buscam jogadores</p>
              </button>
            </div>
          </div>
          {mode === 'team' && (
            <div>
              <Label className="text-zinc-300">Buscar time pelo nome</Label>
              <Input type="text" value={teamSearch} onChange={e => setTeamSearch(e.target.value)} className="mt-1 bg-zinc-900 border-zinc-700 text-white" placeholder="Digite o nome do time..." />
              {teamsLoading && <p className="text-sm text-zinc-400 mt-2">Buscando...</p>}
              {teams.length > 0 && (
                <div className="mt-2 border border-zinc-700 rounded-lg overflow-hidden">
                  {teams.map(t => (
                    <button key={t.id} type="button" onClick={() => { setSelectedTeamId(t.id); setTeamSearch(t.name); setTeams([]) }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 text-left">
                      {t.logo_url && <img src={t.logo_url} alt={t.name} className="w-8 h-8 object-contain rounded" />}
                      <span className="text-white text-sm">{t.name}</span>
                      <span className="text-zinc-500 text-xs ml-auto">{t.short_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <PrimaryCTA
            type="submit"
            loading={loading}
            loadingText="Criando..."
            disabled={
              !form.nickname.trim() ||
              !form.position ||
              !mode ||
              (mode === 'team' && !selectedTeamId)
            }
            className="py-3"
          >
            Criar Perfil de Jogador
          </PrimaryCTA>
          <button type="button" onClick={() => navigate({ to: '/minha-conta', replace: true })} className="w-full text-center text-sm text-zinc-500 hover:text-zinc-300">
            Fazer isso depois
          </button>
        </form>
      </div>
    </div>
  )
}
