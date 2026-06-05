import { createFileRoute, useParams, Link } from '@tanstack/react-router'
import { useEffect, useState, useCallback } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft, Clock, CheckCircle, AlertCircle, Trophy,
  Star, Users, FileText, TrendingUp, Timer
} from 'lucide-react'
import {
  submitSumulaScore,
  confirmSumulaScore,
  disputeSumulaScore,
  saveSumulaGoalsAndDestaque,
  rateSumulaOpponentBest,
  applyAutoWO,
  msUntilWO,
} from '@/lib/sumula-digital.functions'
import { DestaqueInlineShare } from '@/components/DestaqueShareCard'
import { type DestaqueShareData } from '@/lib/share'

export const Route = createFileRoute('/sumula/$partidaId')({
  component: SumulaDigitalPage,
})

// ─── Types ───────────────────────────────────────────────────────────────────
type Team = { id: string; name: string; short_name: string; primary_color: string | null }
type Match = {
  id: string
  status: string
  scheduled_at: string | null
  host_score: number | null
  visitor_score: number | null
  host_filled_at: string | null
  visitor_confirmed_at: string | null
  questionamento_arbitragem?: string | null
  stage: string
  round: number
  host_team: Team
  visitor_team: Team
}
type Athlete = { id: string; full_name: string | null; nickname: string | null }
type OwnVote = { id: string; team_id: string; jersey_number: number; identified_name: string | null; athlete_id: string | null }
type OpponentVote = { id: string; voter_team_id: string; opponent_team_id: string; jersey_number: number; identified_name: string | null; rating: number }
type GoalEvent = { id: string; team_id: string; athlete_id: string | null; minute: number | null }
type DestaquePublicado = { id: string; team_id: string; jersey_number: number; identified_name: string | null; rating: number; published_at: string }

type SumulaEtapa = 'etapa1' | 'etapa2' | 'etapa3' | 'encerrada' | 'wo'
type EtapaStatus = 'pendente' | 'em_andamento' | 'concluido'

// ─── Countdown ───────────────────────────────────────────────────────────────
function Countdown({ scheduledAt }: { scheduledAt: string | null }) {
  const [ms, setMs] = useState(() => {
    if (!scheduledAt) return 72 * 3600 * 1000
    return Math.max(0, new Date(scheduledAt).getTime() + 72 * 3600 * 1000 - Date.now())
  })
  useEffect(() => {
    const id = setInterval(() => {
      if (!scheduledAt) return
      setMs(Math.max(0, new Date(scheduledAt).getTime() + 72 * 3600 * 1000 - Date.now()))
    }, 1000)
    return () => clearInterval(id)
  }, [scheduledAt])

  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  const expired = ms <= 0
  const urgent = ms < 6 * 3600000

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${expired ? 'bg-red-900/30 text-red-400' : urgent ? 'bg-amber-900/30 text-amber-400' : 'bg-zinc-800 text-zinc-300'}`}>
      <Timer className="h-4 w-4 flex-shrink-0" />
      {expired ? (
        <span className="text-sm font-mono font-bold">PRAZO EXPIRADO</span>
      ) : (
        <span className="text-sm font-mono">
          Prazo WO: <strong>{String(h).padStart(2,'0')}:{String(m).padStart(2,'0')}:{String(s).padStart(2,'0')}</strong>
        </span>
      )}
    </div>
  )
}

// ─── Etapa Status Badge ───────────────────────────────────────────────────────
function EtapaStatusBadge({ status, label }: { status: EtapaStatus; label: string }) {
  if (status === 'concluido') return (
    <span className="flex items-center gap-1 text-xs text-green-400 font-medium">
      <CheckCircle className="h-3.5 w-3.5" /> {label}
    </span>
  )
  if (status === 'em_andamento') return (
    <span className="flex items-center gap-1 text-xs text-blue-400 font-medium">
      <Clock className="h-3.5 w-3.5 animate-pulse" /> {label}
    </span>
  )
  return (
    <span className="flex items-center gap-1 text-xs text-zinc-500 font-medium">
      <AlertCircle className="h-3.5 w-3.5" /> {label}
    </span>
  )
}

// ─── ETAPA 1: Visitante lança placar ─────────────────────────────────────────
function Etapa1Placar({ match, myTeamId, onRefresh }: { match: Match; myTeamId: string; onRefresh: () => void }) {
  const isVisitor = myTeamId === match.visitor_team.id
  const isHost = myTeamId === match.host_team.id
  const [hScore, setHScore] = useState(match.host_score ?? 0)
  const [vScore, setVScore] = useState(match.visitor_score ?? 0)
  const [questionamento, setQuestionamento] = useState(match.questionamento_arbitragem ?? '')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const submitFn = useServerFn(submitSumulaScore)
  const confirmFn = useServerFn(confirmSumulaScore)
  const disputeFn = useServerFn(disputeSumulaScore)

  const lancado = !!match.host_filled_at
  const confirmado = !!match.visitor_confirmed_at

  const etapa1Status: EtapaStatus = confirmado ? 'concluido' : lancado ? 'em_andamento' : 'pendente'

  async function lancar() {
    setLoading(true); setErro('')
    try {
      await submitFn({ data: { match_id: match.id, host_score: hScore, visitor_score: vScore, questionamento_arbitragem: questionamento || null } })
      onRefresh()
    } catch (e) { setErro(e instanceof Error ? e.message : 'Erro') }
    finally { setLoading(false) }
  }
  async function confirmar() {
    setLoading(true); setErro('')
    try { await confirmFn({ data: { match_id: match.id } }); onRefresh() }
    catch (e) { setErro(e instanceof Error ? e.message : 'Erro') }
    finally { setLoading(false) }
  }
  async function contestar() {
    setLoading(true); setErro('')
    try { await disputeFn({ data: { match_id: match.id } }); onRefresh() }
    catch (e) { setErro(e instanceof Error ? e.message : 'Erro') }
    finally { setLoading(false) }
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-[#1565F5] text-white text-sm font-bold flex items-center justify-center">1</span>
          Placar Final
        </h3>
        <EtapaStatusBadge status={etapa1Status} label={etapa1Status === 'concluido' ? 'Concluído' : etapa1Status === 'em_andamento' ? 'Aguardando mandante' : 'Pendente'} />
      </div>

      {!lancado && isVisitor && (
        <div className="space-y-4">
          <p className="text-zinc-400 text-sm">Apenas o Visitante registra o placar.</p>
          <div className="grid grid-cols-3 gap-4 items-center text-center">
            <div>
              <p className="text-zinc-400 text-xs mb-2">{match.host_team.short_name} (Casa)</p>
              <input type="number" min={0} max={50} value={hScore} onChange={e => setHScore(+e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 text-white text-center text-4xl font-black h-16 rounded-xl" />
            </div>
            <div className="text-zinc-500 font-black text-3xl">×</div>
            <div>
              <p className="text-zinc-400 text-xs mb-2">{match.visitor_team.short_name} (Visit.)</p>
              <input type="number" min={0} max={50} value={vScore} onChange={e => setVScore(+e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 text-white text-center text-4xl font-black h-16 rounded-xl" />
            </div>
          </div>
          <div>
            <label className="text-zinc-400 text-xs block mb-1">Questionamento de arbitragem (opcional)</label>
            <textarea value={questionamento} onChange={e => setQuestionamento(e.target.value)} rows={3} maxLength={1000}
              placeholder="Descreva qualquer questionamento sobre a arbitragem..."
              className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm resize-none" />
          </div>
          {erro && <p className="text-red-400 text-sm">{erro}</p>}
          <Button onClick={lancar} disabled={loading} className="w-full bg-[#1565F5] text-white h-11">
            {loading ? 'Salvando...' : 'Lançar Placar Final'}
          </Button>
        </div>
      )}

      {!lancado && isHost && (
        <div className="rounded-lg bg-zinc-800/60 p-4 text-center">
          <Clock className="mx-auto h-6 w-6 text-zinc-500 mb-2" />
          <p className="text-zinc-400 text-sm">Aguardando o Visitante lançar o placar...</p>
        </div>
      )}

      {lancado && !confirmado && (
        <div className="space-y-3">
          <div className="bg-zinc-800 rounded-xl p-5 text-center">
            <p className="text-zinc-400 text-xs mb-2">Placar lançado pelo Visitante</p>
            <p className="text-white text-4xl font-black">{match.host_score} × {match.visitor_score}</p>
            <p className="text-zinc-500 text-xs mt-1">{match.host_team.name} × {match.visitor_team.name}</p>
          </div>
          {match.questionamento_arbitragem && (
            <div className="bg-amber-900/20 border border-amber-800/40 rounded-lg p-3">
              <p className="text-amber-400 text-xs font-semibold mb-1">Questionamento de arbitragem:</p>
              <p className="text-zinc-300 text-sm">{match.questionamento_arbitragem}</p>
            </div>
          )}
          {isHost && (
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={contestar} disabled={loading} className="border-red-800/60 text-red-400 hover:bg-red-900/20">
                Contestar
              </Button>
              <Button onClick={confirmar} disabled={loading} className="bg-[#1565F5] text-white">
                {loading ? 'Salvando...' : 'Confirmar Placar'}
              </Button>
            </div>
          )}
          {isVisitor && <p className="text-zinc-400 text-sm text-center">Aguardando confirmação do Mandante.</p>}
          {erro && <p className="text-red-400 text-sm">{erro}</p>}
        </div>
      )}

      {confirmado && (
        <div className="flex items-center gap-2 text-green-400 bg-green-900/10 border border-green-800/30 rounded-lg p-3">
          <CheckCircle className="h-5 w-5 flex-shrink-0" />
          <span className="font-semibold">Placar confirmado: {match.host_score} × {match.visitor_score}</span>
        </div>
      )}
    </div>
  )
}

// ─── ETAPA 2: Gols + Destaque próprio (simultâneo) ───────────────────────────
function Etapa2GolesDestaque({
  match, myTeamId, athletes, ownVotes, goalEvents, onRefresh
}: {
  match: Match; myTeamId: string; athletes: Athlete[]
  ownVotes: OwnVote[]; goalEvents: GoalEvent[]; onRefresh: () => void
}) {
  const myTeam = myTeamId === match.host_team.id ? match.host_team : match.visitor_team
  const myScore = myTeamId === match.host_team.id ? (match.host_score ?? 0) : (match.visitor_score ?? 0)
  const myGoals = goalEvents.filter(e => e.team_id === myTeamId)
  const myOwnVote = ownVotes.find(v => v.team_id === myTeamId)

  const [goals, setGoals] = useState<Array<{ aid: string; min: string }>>(() =>
    myGoals.map(e => ({ aid: e.athlete_id ?? '', min: String(e.minute ?? '') }))
  )
  const [destaqueJersey, setDestaqueJersey] = useState(myOwnVote ? String(myOwnVote.jersey_number) : '')
  const [destaqueName, setDestaqueName] = useState(myOwnVote?.identified_name ?? '')
  const [destaqueAthleteId, setDestaqueAthleteId] = useState(myOwnVote?.athlete_id ?? '')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(!!myOwnVote)
  const [erro, setErro] = useState('')

  const saveFn = useServerFn(saveSumulaGoalsAndDestaque)

  const etapa2MyStatus: EtapaStatus = saved ? 'concluido' : 'em_andamento'

  // Check if opponent also filled
  const oppTeamId = myTeamId === match.host_team.id ? match.visitor_team.id : match.host_team.id
  const oppFilled = ownVotes.some(v => v.team_id === oppTeamId)
  const bothFilled = saved && oppFilled

  async function salvar() {
    if (!destaqueJersey) { setErro('Informe a camisa do destaque.'); return }
    setLoading(true); setErro('')
    try {
      await saveFn({
        data: {
          match_id: match.id,
          team_id: myTeamId,
          goals: goals.map(g => ({ athlete_id: g.aid || null, minute: g.min ? parseInt(g.min, 10) : null })),
          destaque_jersey: parseInt(destaqueJersey, 10),
          destaque_name: destaqueName || null,
          destaque_athlete_id: destaqueAthleteId || null,
        },
      })
      setSaved(true); onRefresh()
    } catch (e) { setErro(e instanceof Error ? e.message : 'Erro') }
    finally { setLoading(false) }
  }

  if (saved) return (
    <div className="rounded-xl border border-green-800/40 bg-green-900/10 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-green-400">
          <CheckCircle className="h-5 w-5" />
          <span className="font-semibold">{myTeam.name} — Etapa 2 concluída</span>
        </div>
        {bothFilled ? (
          <EtapaStatusBadge status="concluido" label="Ambos enviaram" />
        ) : (
          <EtapaStatusBadge status="em_andamento" label="Aguardando adversário" />
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="bg-zinc-800/60 rounded-lg p-3">
          <p className="text-zinc-400 text-xs mb-1">Gols registrados</p>
          <p className="text-white font-bold">{goals.length} / {myScore}</p>
        </div>
        <div className="bg-zinc-800/60 rounded-lg p-3">
          <p className="text-zinc-400 text-xs mb-1">Destaque escolhido</p>
          <p className="text-white font-bold">#{destaqueJersey}{destaqueName ? ' ' + destaqueName : ''}</p>
        </div>
      </div>
      <button onClick={() => setSaved(false)} className="text-xs text-zinc-500 underline">Editar</button>
    </div>
  )

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-[#1565F5] text-white text-sm font-bold flex items-center justify-center">2</span>
          Gols + Destaque — {myTeam.name}
        </h3>
        <EtapaStatusBadge status={etapa2MyStatus} label="Em andamento" />
      </div>

      <div>
        <p className="text-white font-medium text-sm mb-3">
          <Users className="h-4 w-4 inline mr-1" />
          Autores dos Gols ({myScore} gol{myScore !== 1 ? 's' : ''})
        </p>
        <div className="space-y-2">
          {goals.map((g, i) => (
            <div key={i} className="grid grid-cols-[1fr_80px_32px] gap-2 items-center">
              <select value={g.aid} onChange={e => setGoals(p => p.map((x, j) => j === i ? { ...x, aid: e.target.value } : x))}
                className="bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm">
                <option value="">Sem atleta cadastrado</option>
                {athletes.map(a => <option key={a.id} value={a.id}>{a.nickname || a.full_name}</option>)}
              </select>
              <input type="number" placeholder="Min" value={g.min}
                onChange={e => setGoals(p => p.map((x, j) => j === i ? { ...x, min: e.target.value } : x))}
                className="bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm text-center" />
              <button onClick={() => setGoals(p => p.filter((_, j) => j !== i))}
                className="text-red-400 hover:text-red-300 font-bold text-lg w-8 h-8 rounded-full hover:bg-red-900/20">×</button>
            </div>
          ))}
          {goals.length < myScore && (
            <button onClick={() => setGoals(p => [...p, { aid: '', min: '' }])}
              className="text-sm text-[#1565F5] hover:underline">+ Adicionar gol</button>
          )}
          {myScore === 0 && !goals.length && (
            <p className="text-zinc-500 text-sm italic">Nenhum gol — confirme com 0 gols.</p>
          )}
        </div>
      </div>

      <div className="border-t border-zinc-800 pt-4">
        <p className="text-white font-medium text-sm mb-3">
          <Star className="h-4 w-4 inline mr-1" />
          Destaque da Partida — {myTeam.name}
        </p>
        <p className="text-zinc-400 text-xs mb-3">Escolha 1 jogador da <strong>sua equipe</strong> como destaque.</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-zinc-400 text-xs block mb-1">Camisa *</label>
            <input type="number" min={1} max={99} value={destaqueJersey} onChange={e => setDestaqueJersey(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-zinc-400 text-xs block mb-1">Nome (opcional)</label>
            <input value={destaqueName} onChange={e => setDestaqueName(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        {athletes.length > 0 && (
          <div className="mt-2">
            <label className="text-zinc-400 text-xs block mb-1">Ou selecione um atleta cadastrado</label>
            <select value={destaqueAthleteId} onChange={e => setDestaqueAthleteId(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm">
              <option value="">Selecionar atleta...</option>
              {athletes.map(a => <option key={a.id} value={a.id}>{a.nickname || a.full_name}</option>)}
            </select>
          </div>
        )}
      </div>

      {erro && <p className="text-red-400 text-sm">{erro}</p>}
      <Button onClick={salvar} disabled={loading} className="w-full bg-[#1565F5] text-white h-11">
        {loading ? 'Salvando...' : 'Confirmar Gols + Destaque'}
      </Button>
    </div>
  )
}

// ─── ETAPA 3: Nota cruzada ao destaque adversário ────────────────────────────
function Etapa3NotaCruzada({
  match, myTeamId, ownVotes, opponentVotes, onRefresh
}: {
  match: Match; myTeamId: string
  ownVotes: OwnVote[]; opponentVotes: OpponentVote[]; onRefresh: () => void
}) {
  const oppTeam = myTeamId === match.host_team.id ? match.visitor_team : match.host_team
  // The destaque the opponent chose from THEIR OWN team (which is my opponent's team)
  const oppOwnVote = ownVotes.find(v => v.team_id === oppTeam.id)
  const myExistingVote = opponentVotes.find(v => v.voter_team_id === myTeamId)

  const [rating, setRating] = useState(myExistingVote?.rating ?? 7)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(!!myExistingVote)
  const [erro, setErro] = useState('')

  const rateFn = useServerFn(rateSumulaOpponentBest)

  const oppVote = opponentVotes.find(v => v.voter_team_id === oppTeam.id)
  const etapa3Status: EtapaStatus = myExistingVote && oppVote ? 'concluido' : myExistingVote ? 'em_andamento' : 'pendente'

  async function salvar() {
    if (!oppOwnVote) { setErro('Adversário ainda não escolheu seu destaque.'); return }
    setLoading(true); setErro('')
    try {
      await rateFn({
        data: {
          match_id: match.id,
          voter_team_id: myTeamId,
          jersey_number: oppOwnVote.jersey_number,
          identified_name: oppOwnVote.identified_name,
          rating,
        },
      })
      setSaved(true); onRefresh()
    } catch (e) { setErro(e instanceof Error ? e.message : 'Erro') }
    finally { setLoading(false) }
  }

  const ratingLabel = (r: number) => {
    if (r >= 9) return 'Excepcional'
    if (r >= 7) return 'Muito bom'
    if (r >= 5) return 'Regular'
    if (r >= 3) return 'Fraco'
    return 'Muito fraco'
  }

  if (!oppOwnVote) return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-7 h-7 rounded-full bg-zinc-700 text-white text-sm font-bold flex items-center justify-center">3</span>
        <h3 className="text-white font-semibold">Nota ao Destaque — {oppTeam.name}</h3>
        <EtapaStatusBadge status="pendente" label="Aguardando adversário" />
      </div>
      <div className="bg-zinc-800/60 rounded-lg p-4 text-center">
        <Clock className="mx-auto h-6 w-6 text-zinc-500 mb-2" />
        <p className="text-zinc-400 text-sm">
          Aguardando {oppTeam.name} escolher seu destaque na Etapa 2...
        </p>
      </div>
    </div>
  )

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <span className={`w-7 h-7 rounded-full text-white text-sm font-bold flex items-center justify-center ${saved ? 'bg-green-600' : 'bg-[#1565F5]'}`}>3</span>
          Nota ao Destaque — {oppTeam.name}
        </h3>
        <EtapaStatusBadge status={etapa3Status} label={etapa3Status === 'concluido' ? 'Concluído' : etapa3Status === 'em_andamento' ? 'Sua nota salva' : 'Pendente'} />
      </div>

      <div className="bg-zinc-800/60 rounded-xl p-4">
        <p className="text-zinc-400 text-xs mb-1">Destaque escolhido por {oppTeam.name}:</p>
        <p className="text-white font-bold text-lg">
          #{oppOwnVote.jersey_number}
          {oppOwnVote.identified_name ? <span className="ml-2 font-normal text-zinc-300">{oppOwnVote.identified_name}</span> : null}
        </p>
      </div>

      {saved ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-green-400 bg-green-900/10 border border-green-800/30 rounded-lg p-3">
            <Star className="h-5 w-5" />
            <span className="font-semibold">Sua nota: {rating}/10 — {ratingLabel(rating)}</span>
          </div>
          {!oppVote && <p className="text-zinc-500 text-sm text-center">Aguardando nota do {oppTeam.name}...</p>}
          <button onClick={() => setSaved(false)} className="text-xs text-zinc-500 underline">Editar nota</button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-zinc-400 text-sm">Nota de 1 a 10</label>
              <span className={`text-2xl font-black ${rating >= 8 ? 'text-green-400' : rating >= 5 ? 'text-[#1565F5]' : 'text-red-400'}`}>
                {rating}<span className="text-zinc-500 text-base font-normal">/10</span>
              </span>
            </div>
            <input type="range" min={1} max={10} step={1} value={rating}
              onChange={e => setRating(+e.target.value)}
              className="w-full accent-[#1565F5] h-2" />
            <div className="flex justify-between text-xs text-zinc-500 mt-1">
              <span>1 — Muito fraco</span>
              <span className="text-zinc-400 font-medium">{ratingLabel(rating)}</span>
              <span>10 — Excepcional</span>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {[1,2,3,4,5,6,7,8,9,10].map(n => (
              <button key={n} onClick={() => setRating(n)}
                className={`w-9 h-9 rounded-lg text-sm font-bold transition-all ${rating === n ? 'bg-[#1565F5] text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>
                {n}
              </button>
            ))}
          </div>
          {erro && <p className="text-red-400 text-sm">{erro}</p>}
          <Button onClick={salvar} disabled={loading} className="w-full bg-[#1565F5] text-white h-11">
            {loading ? 'Salvando...' : `Confirmar Nota ${rating}/10`}
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Painel público de destaques publicados ───────────────────────────────────
function DestaquePublicado({ match, destaques }: { match: Match; destaques: DestaquePublicado[] }) {
  if (!destaques.length) return null
  return (
    <div className="rounded-xl border border-[#1565F5]/40 bg-gradient-to-br from-[#1565F5]/10 to-zinc-900 p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Trophy className="h-5 w-5 text-yellow-400" />
        <h3 className="text-white font-bold text-lg">Destaques da Partida</h3>
      </div>
      <div className="grid gap-3">
        {destaques.map(d => {
          const team = d.team_id === match.host_team.id ? match.host_team : match.visitor_team
          return (
            <div key={d.id} className="bg-zinc-900/80 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-zinc-400 text-xs mb-1">{team.name}</p>
                <p className="text-white font-bold text-lg">
                  #{d.jersey_number}
                  {d.identified_name ? <span className="ml-2 text-zinc-300 font-normal">{d.identified_name}</span> : null}
                </p>
              </div>
              <div className="text-right">
                <p className="text-zinc-500 text-xs">Nota adversária</p>
                <p className={`text-2xl font-black ${d.rating >= 8 ? 'text-green-400' : d.rating >= 5 ? 'text-[#1565F5]' : 'text-zinc-400'}`}>
                  {d.rating}<span className="text-zinc-500 text-sm">/10</span>
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Share card — shown when destaque is published */}
      {destaques.length > 0 && (
        <div className="mt-4 space-y-3">
          {destaques.map((d) => {
            const shareData: DestaqueShareData = {
              matchId: match.id,
              playerName: d.identified_name ?? `Camisa #${d.jersey_number}`,
              rating: d.rating,
              teamCasa: match.host_team.name,
              teamVisitante: match.visitor_team.name,
              scoreCasa: match.host_score,
              scoreVisitante: match.visitor_score,
              rodada: match.round,
              stage: match.stage,
            }
            return (
              <DestaqueInlineShare key={d.id} data={shareData} />
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Progress Steps ───────────────────────────────────────────────────────────
function ProgressSteps({ etapa, match }: { etapa: SumulaEtapa; match: Match }) {
  const steps = [
    { id: 'etapa1', label: 'Placar', icon: FileText },
    { id: 'etapa2', label: 'Gols + Destaque', icon: Users },
    { id: 'etapa3', label: 'Nota Cruzada', icon: Star },
    { id: 'encerrada', label: 'Publicado', icon: Trophy },
  ]
  const order = ['etapa1', 'etapa2', 'etapa3', 'encerrada', 'wo']
  const currentIdx = order.indexOf(etapa)

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {steps.map((step, i) => {
        const stepOrder = order.indexOf(step.id)
        const isCompleted = etapa === 'wo' ? false : stepOrder < currentIdx
        const isCurrent = stepOrder === currentIdx
        const Icon = step.icon
        return (
          <div key={step.id} className="flex items-center gap-1 flex-shrink-0">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              isCompleted ? 'bg-green-900/40 text-green-400 border border-green-800/40' :
              isCurrent ? 'bg-[#1565F5]/20 text-[#1565F5] border border-[#1565F5]/40' :
              'bg-zinc-800/60 text-zinc-500 border border-zinc-700/40'
            }`}>
              <Icon className="h-3 w-3" />
              {step.label}
            </div>
            {i < steps.length - 1 && <div className={`w-4 h-px ${isCompleted ? 'bg-green-600' : 'bg-zinc-700'}`} />}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
function SumulaDigitalPage() {
  const { partidaId } = useParams({ from: '/sumula/$partidaId' })
  const { user } = useAuth()
  const [match, setMatch] = useState<Match | null>(null)
  const [myTeamId, setMyTeamId] = useState<string | null>(null)
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [ownVotes, setOwnVotes] = useState<OwnVote[]>([])
  const [opponentVotes, setOpponentVotes] = useState<OpponentVote[]>([])
  const [goalEvents, setGoalEvents] = useState<GoalEvent[]>([])
  const [destaques, setDestaques] = useState<DestaquePublicado[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

  const woFn = useServerFn(applyAutoWO)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('matches')
      .select(`*,
        host_team:teams!matches_host_team_id_fkey(id,name,short_name,primary_color),
        visitor_team:teams!matches_visitor_team_id_fkey(id,name,short_name,primary_color)
      `)
      .eq('id', partidaId)
      .single()

    if (error || !data) { setErro('Partida não encontrada.'); setLoading(false); return }
    setMatch(data as unknown as Match)

    // Auto WO check (fire and forget)
    if (data.status !== 'closed' && data.status !== 'wo') {
      const woMs = data.scheduled_at
        ? new Date(data.scheduled_at).getTime() + 72 * 3600 * 1000 - Date.now()
        : Infinity
      if (woMs <= 0 && user) {
        woFn({ data: { match_id: partidaId } }).catch(() => {})
      }
    }

    // Detect director team
    if (user) {
      const { data: managed } = await supabase.from('teams').select('id').eq('manager_id', user.id).maybeSingle()
      let teamId = managed?.id ?? null
      if (!teamId) {
        const { data: member } = await supabase
          .from('team_members').select('team_id')
          .eq('user_id', user.id).eq('role', 'director')
          .not('accepted_at', 'is', null).maybeSingle()
        teamId = member?.team_id ?? null
      }
      if (teamId && (teamId === data.host_team_id || teamId === data.visitor_team_id)) {
        setMyTeamId(teamId)
        const { data: ats } = await supabase.from('athletes').select('id,full_name,nickname').eq('team_id', teamId)
        setAthletes(ats ?? [])
      }
    }

    // Load supplementary data
    const [ownRes, oppRes, goalRes, destRes] = await Promise.all([
      supabase.from('match_best_own_votes').select('*').eq('match_id', partidaId),
      supabase.from('match_best_opponent_votes').select('*').eq('match_id', partidaId),
      supabase.from('match_events').select('*').eq('match_id', partidaId).eq('kind', 'goal'),
      supabase.from('match_destaques_publicados').select('*').eq('match_id', partidaId),
    ])
    setOwnVotes((ownRes.data ?? []) as unknown as OwnVote[])
    setOpponentVotes((oppRes.data ?? []) as unknown as OpponentVote[])
    setGoalEvents((goalRes.data ?? []) as unknown as GoalEvent[])
    setDestaques((destRes.data ?? []) as unknown as DestaquePublicado[])
    setLoading(false)
  }, [partidaId, user])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center text-zinc-400">
      <div className="flex items-center gap-3"><div className="w-5 h-5 border-2 border-[#1565F5] border-t-transparent rounded-full animate-spin" />Carregando súmula...</div>
    </div>
  )

  if (erro || !match) return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="text-center space-y-3">
        <AlertCircle className="mx-auto h-10 w-10 text-red-400" />
        <p className="text-red-400">{erro || 'Partida não encontrada.'}</p>
        <Link to="/resultados" className="text-[#1565F5] text-sm">Voltar para resultados</Link>
      </div>
    </div>
  )

  // Determine current etapa
  const isWO = match.status === 'wo'
  const isClosed = match.status === 'closed'
  const etapa1ok = !!match.host_filled_at && !!match.visitor_confirmed_at
  const etapa2ok = ownVotes.length >= 2
  const etapa3ok = opponentVotes.length >= 2

  let currentEtapa: SumulaEtapa = 'etapa1'
  if (isWO) currentEtapa = 'wo'
  else if (isClosed || etapa3ok) currentEtapa = 'encerrada'
  else if (etapa2ok) currentEtapa = 'etapa3'
  else if (etapa1ok) currentEtapa = 'etapa2'

  const meuJogo = myTeamId && (myTeamId === match.host_team.id || myTeamId === match.visitor_team.id)

  const teamColor = (team: Team) => team.primary_color || '#1565F5'

  return (
    <div className="min-h-screen bg-black px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-5">

        <Link to="/resultados" className="flex items-center gap-2 text-zinc-500 text-sm hover:text-zinc-300 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Voltar para resultados
        </Link>

        {/* Cabeçalho da partida */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-zinc-400 border-zinc-700 text-xs">
              {match.stage} · Rodada {match.round}
            </Badge>
            <Badge className="bg-zinc-800 text-zinc-300 border-zinc-700 text-xs">
              Súmula Digital
            </Badge>
            {isWO && <Badge className="bg-red-900/30 text-red-400 border-red-800/40 text-xs">WO Automático</Badge>}
            {isClosed && <Badge className="bg-green-900/30 text-green-400 border-green-800/40 text-xs">Encerrada</Badge>}
          </div>

          <div className="grid grid-cols-3 items-center gap-4 text-center">
            <div>
              <div className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center font-bold text-sm text-white"
                style={{ background: teamColor(match.host_team) }}>
                {match.host_team.short_name.slice(0,2).toUpperCase()}
              </div>
              <p className="text-white font-semibold text-sm">{match.host_team.name}</p>
              <p className="text-zinc-500 text-xs">Casa</p>
            </div>
            <div>
              {etapa1ok
                ? <p className="text-white font-black text-4xl">{match.host_score} × {match.visitor_score}</p>
                : <p className="text-zinc-600 font-black text-4xl">— × —</p>
              }
              {match.scheduled_at && (
                <p className="text-zinc-500 text-xs mt-1">
                  {new Date(match.scheduled_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
            <div>
              <div className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center font-bold text-sm text-white"
                style={{ background: teamColor(match.visitor_team) }}>
                {match.visitor_team.short_name.slice(0,2).toUpperCase()}
              </div>
              <p className="text-white font-semibold text-sm">{match.visitor_team.name}</p>
              <p className="text-zinc-500 text-xs">Visitante</p>
            </div>
          </div>

          {!isClosed && !isWO && <Countdown scheduledAt={match.scheduled_at} />}
          {!isClosed && !isWO && <ProgressSteps etapa={currentEtapa} match={match} />}
        </div>

        {/* WO */}
        {isWO && (
          <div className="rounded-xl border border-red-800/40 bg-red-900/10 p-6 text-center space-y-2">
            <AlertCircle className="mx-auto h-10 w-10 text-red-400" />
            <h2 className="text-white font-bold text-lg">WO Automático Aplicado</h2>
            <p className="text-zinc-400 text-sm">O prazo de 72h expirou sem preenchimento completo da súmula.</p>
          </div>
        )}

        {/* Encerrada — Destaques Publicados */}
        {(isClosed || currentEtapa === 'encerrada') && (
          <DestaquePublicado match={match} destaques={destaques} />
        )}

        {/* Não é diretor de nenhum time desta partida */}
        {!meuJogo && !isClosed && !isWO && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 text-center space-y-3">
            <AlertCircle className="mx-auto h-7 w-7 text-zinc-500" />
            <p className="text-zinc-400 text-sm">
              {user
                ? 'Apenas os Diretores dos times desta partida podem preencher a súmula.'
                : 'Faça login para preencher a súmula.'}
            </p>
            {!user && (
              <Link to="/login" className="inline-block mt-2 px-4 py-2 bg-[#1565F5] text-white rounded-lg text-sm">
                Entrar
              </Link>
            )}
          </div>
        )}

        {/* Etapas do formulário */}
        {meuJogo && !isWO && (
          <div className="space-y-4">
            {/* Etapa 1: Sempre visível para o time relevante */}
            <Etapa1Placar match={match} myTeamId={myTeamId!} onRefresh={load} />

            {/* Etapa 2: Ambos os times simultaneamente após etapa 1 */}
            {etapa1ok && (
              <Etapa2GolesDestaque
                match={match} myTeamId={myTeamId!} athletes={athletes}
                ownVotes={ownVotes} goalEvents={goalEvents} onRefresh={load}
              />
            )}
            {etapa1ok && !etapa2ok && !isClosed && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-center">
                <p className="text-zinc-500 text-sm">
                  <TrendingUp className="h-4 w-4 inline mr-1" />
                  Etapa 3 (Nota Cruzada) será liberada quando ambos os times concluírem a Etapa 2.
                </p>
              </div>
            )}

            {/* Etapa 3: Cruzada — após ambos terminarem etapa 2 */}
            {etapa2ok && !isClosed && (
              <Etapa3NotaCruzada
                match={match} myTeamId={myTeamId!}
                ownVotes={ownVotes} opponentVotes={opponentVotes} onRefresh={load}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
