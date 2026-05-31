// @ts-nocheck
import { createFileRoute, useParams, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/integrations/supabase/client'
import { useAuth } from '~/hooks/use-auth'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { ArrowLeft, Clock, CheckCircle, AlertCircle, Trophy } from 'lucide-react'

export const Route = createFileRoute('/partidas/$id')({
  component: PartidaPage,
})

type Match = {
  id: string; status: string; scheduled_at: string | null
  host_score: number | null; visitor_score: number | null
  host_filled_at: string | null; visitor_confirmed_at: string | null
  stage: string; round: number
  host_team: { id: string; name: string; short_name: string; primary_color: string | null }
  visitor_team: { id: string; name: string; short_name: string; primary_color: string | null }
  competition: { sumula_confirm_window_hours: number | null }
}
type Athlete = { id: string; full_name: string | null; nickname: string | null }
type BestVote = { id: string; voter_team_id: string; opponent_team_id: string; jersey_number: number; identified_name: string | null; rating: number }

function horasRestantes(s: string | null, h: number | null) {
  if (!s) return 72
  return Math.max(0, (new Date(s).getTime() + (h ?? 72) * 3600000 - Date.now()) / 3600000)
}

function EtapaPlacar({ match, myTeamId, onRefresh }: { match: Match; myTeamId: string; onRefresh: () => void }) {
  const isVisitor = myTeamId === match.visitor_team.id
  const isHost = myTeamId === match.host_team.id
  const [hScore, setHScore] = useState(match.host_score ?? 0)
  const [vScore, setVScore] = useState(match.visitor_score ?? 0)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const lancado = !!match.host_filled_at
  const confirmado = !!match.visitor_confirmed_at

  async function lancar() {
    setLoading(true)
    const { error } = await supabase.from('matches').update({ host_score: hScore, visitor_score: vScore, host_filled_at: new Date().toISOString(), status: 'placar_lancado' }).eq('id', match.id)
    if (error) setErro(error.message); else onRefresh()
    setLoading(false)
  }
  async function confirmar() {
    setLoading(true)
    const { error } = await supabase.from('matches').update({ visitor_confirmed_at: new Date().toISOString(), status: 'placar_confirmado' }).eq('id', match.id)
    if (error) setErro(error.message); else onRefresh()
    setLoading(false)
  }
  async function contestar() {
    setLoading(true)
    await supabase.from('matches').update({ host_score: null, visitor_score: null, host_filled_at: null, status: 'agendada' }).eq('id', match.id)
    onRefresh(); setLoading(false)
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
      <h3 className="text-white font-semibold flex items-center gap-2"><span className="text-[#1565F5] font-bold">01</span> Placar</h3>
      {!lancado && (isVisitor ? (
        <div className="space-y-4">
          <p className="text-zinc-400 text-sm">Visitante registra o placar primeiro.</p>
          <div className="grid grid-cols-3 gap-4 items-center text-center">
            <div><p className="text-zinc-400 text-xs mb-1">{match.host_team.short_name} (casa)</p><input type="number" min={0} max={30} value={hScore} onChange={e => setHScore(+e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 text-white text-center text-3xl font-bold h-16 rounded-lg" /></div>
            <div className="text-zinc-500 font-bold text-2xl">x</div>
            <div><p className="text-zinc-400 text-xs mb-1">{match.visitor_team.short_name} (visit.)</p><input type="number" min={0} max={30} value={vScore} onChange={e => setVScore(+e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 text-white text-center text-3xl font-bold h-16 rounded-lg" /></div>
          </div>
          {erro && <p className="text-red-400 text-sm">{erro}</p>}
          <Button onClick={lancar} disabled={loading} className="w-full bg-[#1565F5] text-white">{loading ? 'Salvando...' : 'Confirmar Placar'}</Button>
        </div>
      ) : <p className="text-zinc-400 text-sm text-center py-4">Aguardando Visitante lancar o placar...</p>)}
      {lancado && !confirmado && (
        <div className="space-y-3">
          <div className="bg-zinc-800 rounded-lg p-4 text-center"><p className="text-zinc-400 text-xs mb-1">Placar lancado:</p><p className="text-white text-3xl font-bold">{match.host_score} x {match.visitor_score}</p></div>
          {isHost ? <div className="grid grid-cols-2 gap-3"><Button variant="outline" onClick={contestar} disabled={loading} className="border-red-800 text-red-400">Contestar</Button><Button onClick={confirmar} disabled={loading} className="bg-[#1565F5] text-white">{loading ? '...' : 'Confirmar'}</Button></div>
            : <p className="text-zinc-400 text-sm text-center">Aguardando confirmacao do Mandante.</p>}
        </div>
      )}
      {lancado && confirmado && <div className="flex items-center gap-2 text-green-400"><CheckCircle className="h-5 w-5" /><span>Placar confirmado: {match.host_score} x {match.visitor_score}</span></div>}
    </div>
  )
}

function EtapaGols({ match, myTeamId, athletes, onRefresh }: { match: Match; myTeamId: string; athletes: Athlete[]; onRefresh: () => void }) {
  const [goals, setGoals] = useState<Array<{ aid: string; nome: string; min: string }>>([])
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const myTeam = myTeamId === match.host_team.id ? match.host_team : match.visitor_team
  const myScore = myTeamId === match.host_team.id ? (match.host_score ?? 0) : (match.visitor_score ?? 0)

  useEffect(() => {
    supabase.from('match_events').select('*').eq('match_id', match.id).eq('team_id', myTeamId).eq('kind', 'goal')
      .then(({ data }) => { if (data?.length) { setSaved(true); setGoals(data.map(e => ({ aid: e.athlete_id, nome: '', min: String(e.minute ?? '') }))) } })
  }, [match.id, myTeamId])

  async function salvar() {
    setLoading(true)
    await supabase.from('match_events').delete().eq('match_id', match.id).eq('team_id', myTeamId).eq('kind', 'goal')
    const rows = goals.filter(g => g.aid || g.nome).map(g => ({ match_id: match.id, team_id: myTeamId, athlete_id: g.aid || '', kind: 'goal', minute: g.min ? +g.min : null }))
    if (rows.length) await supabase.from('match_events').insert(rows)
    setSaved(true); onRefresh(); setLoading(false)
  }

  if (saved) return (
    <div className="rounded-xl border border-green-800/40 bg-green-900/10 p-4">
      <div className="flex items-center gap-2 text-green-400"><CheckCircle className="h-4 w-4" /><span className="font-semibold text-sm">Gols do {myTeam.name} confirmados</span></div>
      <button onClick={() => setSaved(false)} className="text-xs text-zinc-500 underline mt-1">Editar</button>
    </div>
  )

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
      <h3 className="text-white font-semibold flex items-center gap-2"><span className="text-[#1565F5] font-bold">02</span> Gols do {myTeam.name}</h3>
      <p className="text-zinc-400 text-sm">{myScore} gol{myScore !== 1 ? 's' : ''} a registrar.</p>
      <div className="space-y-2">
        {goals.map((g, i) => (
          <div key={i} className="grid grid-cols-[1fr_70px_30px] gap-2">
            {athletes.length ? (
              <select value={g.aid} onChange={e => setGoals(p => p.map((x, j) => j === i ? { ...x, aid: e.target.value } : x))} className="bg-zinc-800 border border-zinc-700 text-white rounded px-2 py-1 text-sm">
                <option value="">Jogador...</option>{athletes.map(a => <option key={a.id} value={a.id}>{a.nickname || a.full_name}</option>)}
              </select>
            ) : <input placeholder="Nome" value={g.nome} onChange={e => setGoals(p => p.map((x, j) => j === i ? { ...x, nome: e.target.value } : x))} className="bg-zinc-800 border border-zinc-700 text-white rounded px-2 py-1 text-sm" />}
            <input type="number" placeholder="Min" value={g.min} onChange={e => setGoals(p => p.map((x, j) => j === i ? { ...x, min: e.target.value } : x))} className="bg-zinc-800 border border-zinc-700 text-white rounded px-2 py-1 text-sm text-center" />
            <button onClick={() => setGoals(p => p.filter((_, j) => j !== i))} className="text-red-400 font-bold">x</button>
          </div>
        ))}
        {goals.length < myScore && <button onClick={() => setGoals(p => [...p, { aid: '', nome: '', min: '' }])} className="text-sm text-[#1565F5]">+ Gol</button>}
        {!goals.length && <p className="text-zinc-500 text-sm italic">Nenhum gol — confirme com 0.</p>}
      </div>
      <Button onClick={salvar} disabled={loading} className="w-full bg-[#1565F5] text-white">{loading ? 'Salvando...' : 'Confirmar Gols'}</Button>
    </div>
  )
}

function EtapaDestaque({ match, myTeamId, onRefresh }: { match: Match; myTeamId: string; onRefresh: () => void }) {
  const oppId = myTeamId === match.host_team.id ? match.visitor_team.id : match.host_team.id
  const oppTeam = myTeamId === match.host_team.id ? match.visitor_team : match.host_team
  const [vote, setVote] = useState<BestVote | null>(null)
  const [jersey, setJersey] = useState('')
  const [name, setName] = useState('')
  const [rating, setRating] = useState(7)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    supabase.from('match_best_opponent_votes').select('*').eq('match_id', match.id).eq('voter_team_id', myTeamId).maybeSingle()
      .then(({ data }) => { if (data) { setVote(data); setJersey(String(data.jersey_number)); setName(data.identified_name ?? ''); setRating(data.rating); setDone(true) } })
  }, [match.id, myTeamId])

  async function salvar() {
    if (!jersey) { setErro('Informe o numero da camisa.'); return }
    setLoading(true); setErro('')
    const payload = { match_id: match.id, voter_team_id: myTeamId, opponent_team_id: oppId, jersey_number: +jersey, identified_name: name || null, rating }
    const { error } = vote ? await supabase.from('match_best_opponent_votes').update(payload).eq('id', vote.id) : await supabase.from('match_best_opponent_votes').insert(payload)
    if (error) { setErro(error.message); setLoading(false); return }
    const { data: all } = await supabase.from('match_best_opponent_votes').select('id').eq('match_id', match.id)
    if ((all?.length ?? 0) >= 2) await supabase.from('matches').update({ status: 'encerrada' }).eq('id', match.id)
    setDone(true); onRefresh(); setLoading(false)
  }

  if (done) return (
    <div className="rounded-xl border border-green-800/40 bg-green-900/10 p-4">
      <div className="flex items-center gap-2 text-green-400"><Trophy className="h-4 w-4" /><span className="font-semibold text-sm">Destaque do {oppTeam.name} avaliado: #{jersey}{name ? ' ' + name : ''} — {rating}/10</span></div>
      <button onClick={() => setDone(false)} className="text-xs text-zinc-500 underline mt-1">Editar</button>
    </div>
  )

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
      <h3 className="text-white font-semibold flex items-center gap-2"><span className="text-[#1565F5] font-bold">03</span> Destaque do {oppTeam.name}</h3>
      <p className="text-zinc-400 text-sm">Avalie o melhor jogador adversario.</p>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-zinc-400 text-xs block mb-1">Camisa *</label><input type="number" min={1} max={99} value={jersey} onChange={e => setJersey(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 text-white rounded px-3 py-2 text-sm" /></div>
        <div><label className="text-zinc-400 text-xs block mb-1">Nome (opcional)</label><input value={name} onChange={e => setName(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 text-white rounded px-3 py-2 text-sm" /></div>
      </div>
      <div>
        <label className="text-zinc-400 text-xs block mb-2">Nota: <strong className="text-[#1565F5]">{rating}/10</strong></label>
        <input type="range" min={1} max={10} value={rating} onChange={e => setRating(+e.target.value)} className="w-full accent-[#1565F5]" />
        <div className="flex justify-between text-xs text-zinc-500 mt-1"><span>1-Fraco</span><span>10-Excepcional</span></div>
      </div>
      {erro && <p className="text-red-400 text-sm">{erro}</p>}
      <Button onClick={salvar} disabled={loading} className="w-full bg-[#1565F5] text-white">{loading ? 'Salvando...' : 'Confirmar ' + rating + '/10'}</Button>
    </div>
  )
}

function PartidaPage() {
  const { id } = useParams({ from: '/partidas/$id' })
  const { user } = useAuth()
  const [match, setMatch] = useState<Match | null>(null)
  const [myTeamId, setMyTeamId] = useState<string | null>(null)
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [votes, setVotes] = useState<BestVote[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

  async function load() {
    const { data, error } = await supabase.from('matches')
      .select('*, host_team:teams!matches_host_team_id_fkey(id,name,short_name,primary_color), visitor_team:teams!matches_visitor_team_id_fkey(id,name,short_name,primary_color), competition:competitions(sumula_confirm_window_hours)')
      .eq('id', id).single()
    if (error || !data) { setErro('Partida nao encontrada.'); setLoading(false); return }
    setMatch(data as any)
    if (user) {
      const { data: team } = await supabase.from('teams').select('id').eq('manager_id', user.id).maybeSingle()
      if (team) { setMyTeamId(team.id); const { data: ats } = await supabase.from('athletes').select('id,full_name,nickname').eq('team_id', team.id); setAthletes(ats ?? []) }
    }
    const { data: vs } = await supabase.from('match_best_opponent_votes').select('*').eq('match_id', id)
    setVotes(vs ?? []); setLoading(false)
  }

  useEffect(() => { load() }, [id, user])

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-zinc-400">Carregando...</div>
  if (erro || !match) return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="text-center space-y-3"><AlertCircle className="mx-auto h-10 w-10 text-red-400" /><p className="text-red-400">{erro || 'Partida nao encontrada.'}</p><Link to="/resultados" className="text-[#1565F5] text-sm">Voltar</Link></div>
    </div>
  )

  const encerrada = match.status === 'encerrada'
  const meuJogo = myTeamId && (myTeamId === match.host_team.id || myTeamId === match.visitor_team.id)
  const horas = horasRestantes(match.scheduled_at, match.competition?.sumula_confirm_window_hours ?? null)
  const etapa1ok = !!match.host_filled_at && !!match.visitor_confirmed_at

  return (
    <div className="min-h-screen bg-black px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-5">
        <Link to="/resultados" className="flex items-center gap-2 text-zinc-500 text-sm"><ArrowLeft className="h-4 w-4" /> Voltar</Link>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Badge variant="outline" className="text-zinc-400 border-zinc-700 text-xs">{match.stage} . Rodada {match.round}</Badge>
            {encerrada ? <Badge className="bg-green-900/30 text-green-400 border-green-800/40 text-xs">Encerrada</Badge>
              : horas === 0 ? <Badge className="bg-red-900/30 text-red-400 border-red-800/40 text-xs">Prazo expirado</Badge>
              : <Badge className="bg-blue-900/30 text-blue-400 border-blue-800/40 text-xs"><Clock className="h-3 w-3 mr-1 inline" />{Math.floor(horas)}h restantes</Badge>}
          </div>
          <div className="grid grid-cols-3 items-center gap-4 text-center">
            <div>
              <div className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center font-bold text-sm text-white" style={{ background: match.host_team.primary_color || '#1565F5' }}>{match.host_team.short_name.slice(0,2)}</div>
              <p className="text-white font-semibold text-sm">{match.host_team.name}</p><p className="text-zinc-500 text-xs">Casa</p>
            </div>
            <div>
              {etapa1ok ? <p className="text-white font-black text-4xl">{match.host_score} x {match.visitor_score}</p> : <p className="text-zinc-600 font-black text-4xl">- x -</p>}
              {match.scheduled_at && <p className="text-zinc-500 text-xs mt-1">{new Date(match.scheduled_at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</p>}
            </div>
            <div>
              <div className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center font-bold text-sm text-white bg-zinc-700">{match.visitor_team.short_name.slice(0,2)}</div>
              <p className="text-white font-semibold text-sm">{match.visitor_team.name}</p><p className="text-zinc-500 text-xs">Visitante</p>
            </div>
          </div>
        </div>

        {encerrada && (
          <div className="rounded-xl border border-blue-800/40 bg-blue-900/10 p-5 text-center space-y-3">
            <Trophy className="mx-auto h-8 w-8 text-[#1565F5]" />
            <h2 className="text-white font-bold text-lg">Sumula Encerrada!</h2>
            <p className="text-zinc-400 text-sm">{match.host_team.name} {match.host_score} x {match.visitor_score} {match.visitor_team.name}</p>
            {votes.map(v => (
              <div key={v.id} className="text-left bg-zinc-900 rounded-lg p-3 text-sm">
                <p className="text-zinc-400 text-xs">Destaque do {v.opponent_team_id === match.host_team.id ? match.host_team.name : match.visitor_team.name}:</p>
                <p className="text-white">#{v.jersey_number}{v.identified_name ? ' - ' + v.identified_name : ''} . <span className="text-[#1565F5] font-bold">{v.rating}/10</span></p>
              </div>
            ))}
          </div>
        )}

        {!meuJogo && !encerrada && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 text-center">
            <AlertCircle className="mx-auto h-7 w-7 text-zinc-500 mb-2" />
            <p className="text-zinc-400 text-sm">{user ? 'Apenas Diretores dos times desta partida preenchem a sumula.' : 'Faca login para preencher a sumula.'}</p>
            {!user && <Link to="/login" className="mt-2 inline-block text-[#1565F5] text-sm">Entrar</Link>}
          </div>
        )}

        {meuJogo && !encerrada && (
          <div className="space-y-4">
            <EtapaPlacar match={match} myTeamId={myTeamId!} onRefresh={load} />
            {etapa1ok && <EtapaGols match={match} myTeamId={myTeamId!} athletes={athletes} onRefresh={load} />}
            {etapa1ok && <EtapaDestaque match={match} myTeamId={myTeamId!} onRefresh={load} />}
          </div>
        )}
      </div>
    </div>
  )
      }
