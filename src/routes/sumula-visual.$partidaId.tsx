import { createFileRoute, useParams, Link } from '@tanstack/react-router'
import { useEffect, useState, useCallback } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft, Plus, Trash2, Star, Trophy, CheckCircle2,
  Clock, AlertCircle, FileText, Send, X, Loader2,
} from 'lucide-react'
import {
  submitSumulaScore,
  confirmSumulaScore,
  saveSumulaGoalsAndDestaque,
} from '@/lib/sumula-digital.functions'

const supabaseAny = supabase as any

export const Route = createFileRoute('/sumula-visual/$partidaId')({
  head: () => ({
    meta: [
      { title: 'Súmula da Partida | Liga Metrópole' },
      { name: 'description', content: 'Preencha a súmula da partida — placar, gols, destaque e observações.' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: SumulaVisualPage,
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
  dispute_reason?: string | null
  stage: string
  round: number
  host_team_id: string
  visitor_team_id: string
  host_team: Team
  visitor_team: Team
}
type Athlete = { id: string; full_name: string | null; nickname: string | null; team_id: string }
type OwnVote = { id: string; team_id: string; jersey_number: number; identified_name: string | null; athlete_id: string | null }
type GoalEvent = { id: string; team_id: string; athlete_id: string | null; minute: number | null }

// ─── Page ───────────────────────────────────────────────────────────────────
function SumulaVisualPage() {
  const { partidaId } = useParams({ from: '/sumula-visual/$partidaId' })
  const { user } = useAuth()

  const [match, setMatch] = useState<Match | null>(null)
  const [myTeamId, setMyTeamId] = useState<string | null>(null)
  const [athletesByTeam, setAthletesByTeam] = useState<Record<string, Athlete[]>>({})
  const [ownVotes, setOwnVotes] = useState<OwnVote[]>([])
  const [goalEvents, setGoalEvents] = useState<GoalEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

  const load = useCallback(async () => {
    setErro('')
    const { data, error } = await supabase
      .from('matches')
      .select(`*,
        host_team:teams!matches_host_team_id_fkey(id,name,short_name,primary_color),
        visitor_team:teams!matches_visitor_team_id_fkey(id,name,short_name,primary_color)
      `)
      .eq('id', partidaId)
      .single()
    if (error || !data) { setErro('Partida não encontrada.'); setLoading(false); return }
    const m = data as unknown as Match
    setMatch(m)

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
      if (teamId && (teamId === m.host_team_id || teamId === m.visitor_team_id)) {
        setMyTeamId(teamId)
      } else {
        setMyTeamId(null)
      }
    }

    // Load athletes for both teams (needed to show names in goal cards)
    const { data: ats } = await supabase
      .from('athletes')
      .select('id,full_name,nickname,team_id')
      .in('team_id', [m.host_team_id, m.visitor_team_id])
    const grouped: Record<string, Athlete[]> = { [m.host_team_id]: [], [m.visitor_team_id]: [] }
    for (const a of (ats ?? []) as Athlete[]) {
      if (grouped[a.team_id]) grouped[a.team_id].push(a)
    }
    setAthletesByTeam(grouped)

    const [ownRes, goalRes] = await Promise.all([
      supabaseAny.from('match_best_own_votes').select('*').eq('match_id', partidaId),
      supabase.from('match_events').select('*').eq('match_id', partidaId).eq('kind', 'goal'),
    ])
    setOwnVotes((ownRes.data ?? []) as unknown as OwnVote[])
    setGoalEvents((goalRes.data ?? []) as unknown as GoalEvent[])
    setLoading(false)
  }, [partidaId, user])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-400">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-[#1565F5]" /> Carregando súmula...
        </div>
      </div>
    )
  }

  if (erro || !match) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4 text-center">
        <div className="space-y-3">
          <AlertCircle className="mx-auto h-10 w-10 text-red-400" />
          <p className="text-red-400">{erro || 'Partida não encontrada.'}</p>
          <Link to="/resultados" className="text-[#1565F5] text-sm">Voltar para resultados</Link>
        </div>
      </div>
    )
  }

  return <SumulaContent match={match} myTeamId={myTeamId} athletesByTeam={athletesByTeam}
    ownVotes={ownVotes} goalEvents={goalEvents} onRefresh={load} isSignedIn={!!user} />
}

// ─── Content ────────────────────────────────────────────────────────────────
function SumulaContent({
  match, myTeamId, athletesByTeam, ownVotes, goalEvents, onRefresh, isSignedIn,
}: {
  match: Match; myTeamId: string | null
  athletesByTeam: Record<string, Athlete[]>
  ownVotes: OwnVote[]; goalEvents: GoalEvent[]
  onRefresh: () => void; isSignedIn: boolean
}) {
  const isVisitor = myTeamId === match.visitor_team_id
  const isHost = myTeamId === match.host_team_id
  const lancado = !!match.host_filled_at
  const confirmado = !!match.visitor_confirmed_at
  const isClosed = match.status === 'closed' || match.status === 'confirmed'
  const isDisputed = match.status === 'disputed'
  const isWO = match.status === 'wo'

  // Derived status for badge
  let status: 'rascunho' | 'aguardando' | 'homologada' | 'contestada' | 'wo' = 'rascunho'
  if (isWO) status = 'wo'
  else if (isDisputed) status = 'contestada'
  else if (isClosed) status = 'homologada'
  else if (lancado && !confirmado) status = 'aguardando'

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-16">
      {/* Sticky top */}
      <div className="sticky top-0 z-20 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <Link to="/resultados" className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
          <StatusBadge status={status} />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-6 space-y-6">
        <div>
          <h1 className="font-display text-2xl md:text-3xl text-white">Súmula da Partida</h1>
          <p className="text-zinc-500 text-sm mt-1">
            {match.stage} · Rodada {match.round}
            {match.scheduled_at && ` · ${new Date(match.scheduled_at).toLocaleString('pt-BR')}`}
          </p>
        </div>

        {/* Header: Times + Placar */}
        <PlacarHeader match={match} lancado={lancado} />

        {/* Placar input (só visitante, antes de lançar) */}
        {!isClosed && !isWO && !lancado && (
          <PlacarInput match={match} isVisitor={isVisitor} isHost={isHost} onRefresh={onRefresh} />
        )}

        {/* Confirmação do mandante */}
        {!isClosed && !isWO && lancado && !confirmado && !isDisputed && (
          <ConfirmarPlacar match={match} isHost={isHost} isVisitor={isVisitor} onRefresh={onRefresh} />
        )}

        {/* Contestada */}
        {isDisputed && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-5 space-y-2">
            <div className="flex items-center gap-2 text-red-300 font-semibold">
              <AlertCircle className="h-5 w-5" /> Súmula contestada
            </div>
            {match.dispute_reason && <p className="text-zinc-300 text-sm">{match.dispute_reason}</p>}
            <p className="text-zinc-500 text-xs">
              O ranking está travado. O administrador da liga foi notificado.
            </p>
          </div>
        )}

        {/* Seções de Gols + Destaque — visíveis quando placar confirmado */}
        {(lancado || isClosed) && !isWO && (
          <>
            <GoalsAndDestaqueSection
              match={match}
              team={match.host_team}
              teamId={match.host_team_id}
              score={match.host_score ?? 0}
              athletes={athletesByTeam[match.host_team_id] ?? []}
              existingGoals={goalEvents.filter(g => g.team_id === match.host_team_id)}
              existingOwnVote={ownVotes.find(v => v.team_id === match.host_team_id)}
              editable={isHost && !isClosed && !isDisputed}
              onRefresh={onRefresh}
            />
            <GoalsAndDestaqueSection
              match={match}
              team={match.visitor_team}
              teamId={match.visitor_team_id}
              score={match.visitor_score ?? 0}
              athletes={athletesByTeam[match.visitor_team_id] ?? []}
              existingGoals={goalEvents.filter(g => g.team_id === match.visitor_team_id)}
              existingOwnVote={ownVotes.find(v => v.team_id === match.visitor_team_id)}
              editable={isVisitor && !isClosed && !isDisputed}
              onRefresh={onRefresh}
            />
          </>
        )}

        {/* Observação de arbitragem (readonly quando já lançada) */}
        {(match.questionamento_arbitragem || (lancado && !isClosed)) && (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-400" />
              <h2 className="font-display text-lg text-white">Observações sobre a Arbitragem</h2>
            </div>
            {match.questionamento_arbitragem ? (
              <p className="text-zinc-300 text-sm whitespace-pre-wrap">{match.questionamento_arbitragem}</p>
            ) : (
              <p className="text-zinc-500 text-sm italic">Nenhuma observação registrada.</p>
            )}
          </section>
        )}

        {/* Não é diretor */}
        {!myTeamId && !isClosed && !isWO && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 text-center space-y-3">
            <AlertCircle className="mx-auto h-7 w-7 text-zinc-500" />
            <p className="text-zinc-400 text-sm">
              {isSignedIn
                ? 'Apenas os diretores dos times desta partida podem preencher a súmula.'
                : 'Faça login para preencher a súmula.'}
            </p>
            {!isSignedIn && (
              <Link to="/login" className="inline-block mt-2 px-4 py-2 bg-[#1565F5] text-white rounded-lg text-sm">
                Entrar
              </Link>
            )}
          </div>
        )}

        {isClosed && (
          <div className="rounded-xl border border-green-500/40 bg-green-500/10 p-5 flex items-start gap-3">
            <CheckCircle2 className="h-6 w-6 text-green-400 flex-shrink-0" />
            <div>
              <p className="text-green-200 font-semibold">Súmula Homologada</p>
              <p className="text-green-400/70 text-sm mt-1">
                Ambos os times confirmaram. O ranking foi atualizado automaticamente com o resultado, gols e destaques.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Placar Header ──────────────────────────────────────────────────────────
function PlacarHeader({ match, lancado }: { match: Match; lancado: boolean }) {
  const color = (t: Team) => t.primary_color || '#1565F5'
  const showScore = lancado || match.status === 'closed' || match.status === 'confirmed'
  return (
    <div className="rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 p-6">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div className="text-center">
          <div
            className="mx-auto h-14 w-14 rounded-full flex items-center justify-center font-black text-lg mb-2"
            style={{ backgroundColor: color(match.host_team) + '33', color: color(match.host_team) }}
          >
            {match.host_team.short_name.slice(0, 3).toUpperCase()}
          </div>
          <p className="text-white font-semibold text-sm md:text-base">{match.host_team.name}</p>
          <p className="text-zinc-500 text-xs">Mandante</p>
        </div>
        <div className="text-center">
          <div className="flex items-baseline gap-2 md:gap-4">
            <span className="text-5xl md:text-7xl font-black tabular-nums">
              {showScore ? match.host_score ?? '—' : '—'}
            </span>
            <span className="text-3xl md:text-4xl text-zinc-600 font-black">×</span>
            <span className="text-5xl md:text-7xl font-black tabular-nums">
              {showScore ? match.visitor_score ?? '—' : '—'}
            </span>
          </div>
          <p className="text-zinc-500 text-xs mt-1">Placar da partida</p>
        </div>
        <div className="text-center">
          <div
            className="mx-auto h-14 w-14 rounded-full flex items-center justify-center font-black text-lg mb-2"
            style={{ backgroundColor: color(match.visitor_team) + '33', color: color(match.visitor_team) }}
          >
            {match.visitor_team.short_name.slice(0, 3).toUpperCase()}
          </div>
          <p className="text-white font-semibold text-sm md:text-base">{match.visitor_team.name}</p>
          <p className="text-zinc-500 text-xs">Visitante</p>
        </div>
      </div>
    </div>
  )
}

// ─── Placar Input (visitante) ────────────────────────────────────────────────
function PlacarInput({ match, isVisitor, isHost, onRefresh }: {
  match: Match; isVisitor: boolean; isHost: boolean; onRefresh: () => void
}) {
  const [hScore, setHScore] = useState(0)
  const [vScore, setVScore] = useState(0)
  const [obs, setObs] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const submitFn = useServerFn(submitSumulaScore)

  async function enviar() {
    setLoading(true); setErro('')
    try {
      await submitFn({ data: {
        match_id: match.id, host_score: hScore, visitor_score: vScore,
        questionamento_arbitragem: obs || null,
      } })
      setShowModal(false); onRefresh()
    } catch (e) { setErro(e instanceof Error ? e.message : 'Erro') }
    finally { setLoading(false) }
  }

  if (isHost) return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 text-center">
      <Clock className="mx-auto h-6 w-6 text-zinc-500 mb-2" />
      <p className="text-zinc-400 text-sm">Aguardando o Visitante lançar o placar da partida.</p>
    </div>
  )

  if (!isVisitor) return null

  return (
    <>
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-[#1565F5]" />
          <h2 className="font-display text-lg text-white">Lançar Placar</h2>
        </div>
        <p className="text-zinc-500 text-xs">Como visitante, você registra o placar final.</p>
        <div className="grid grid-cols-3 gap-3 items-center text-center">
          <div>
            <p className="text-zinc-400 text-xs mb-1">{match.host_team.short_name}</p>
            <input type="number" min={0} max={50} value={hScore} onChange={e => setHScore(+e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 text-white text-center text-4xl font-black h-16 rounded-xl" />
          </div>
          <div className="text-zinc-500 font-black text-3xl">×</div>
          <div>
            <p className="text-zinc-400 text-xs mb-1">{match.visitor_team.short_name}</p>
            <input type="number" min={0} max={50} value={vScore} onChange={e => setVScore(+e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 text-white text-center text-4xl font-black h-16 rounded-xl" />
          </div>
        </div>
        <div>
          <label className="text-zinc-400 text-xs block mb-1">Observações sobre a arbitragem (opcional)</label>
          <textarea value={obs} onChange={e => setObs(e.target.value)} rows={3} maxLength={1000}
            placeholder="Ex: Arbitragem confusa no segundo tempo..."
            className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm resize-y" />
        </div>
        <Button onClick={() => setShowModal(true)}
          className="w-full h-12 bg-[#1565F5] hover:bg-[#0f4fd1] text-white font-semibold rounded-xl">
          <Send className="h-4 w-4 mr-2" /> Confirmar e Enviar Súmula
        </Button>
      </section>

      {showModal && (
        <ConfirmModal
          title="Confirmar envio da súmula"
          body={<>
            <p>Você está enviando o placar <strong className="text-white">{hScore} × {vScore}</strong>.</p>
            <p className="mt-2">O Mandante ({match.host_team.name}) precisará confirmar para homologar.</p>
            {obs && <p className="mt-2 text-zinc-500 text-xs">Observação: {obs}</p>}
          </>}
          loading={loading} erro={erro}
          onCancel={() => setShowModal(false)}
          onConfirm={enviar}
        />
      )}
    </>
  )
}

// ─── Confirmar placar (host) ─────────────────────────────────────────────────
function ConfirmarPlacar({ match, isHost, isVisitor, onRefresh }: {
  match: Match; isHost: boolean; isVisitor: boolean; onRefresh: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const confirmFn = useServerFn(confirmSumulaScore)

  async function confirmar() {
    setLoading(true); setErro('')
    try { await confirmFn({ data: { match_id: match.id } }); onRefresh() }
    catch (e) { setErro(e instanceof Error ? e.message : 'Erro') }
    finally { setLoading(false) }
  }

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-5 space-y-3">
      <div className="flex items-start gap-3">
        <Clock className="h-6 w-6 text-amber-400 flex-shrink-0 animate-pulse" />
        <div className="flex-1">
          <p className="text-amber-200 font-semibold">
            {isHost ? 'Confirme o placar reportado pelo visitante' : 'Aguardando Adversário'}
          </p>
          <p className="text-amber-400/70 text-sm mt-1">
            Placar: <strong className="text-white">{match.host_score} × {match.visitor_score}</strong>
          </p>
        </div>
      </div>
      {isHost && (
        <Button onClick={confirmar} disabled={loading}
          className="w-full bg-[#1565F5] hover:bg-[#0f4fd1] text-white">
          {loading ? 'Confirmando...' : 'Confirmar Placar'}
        </Button>
      )}
      {isVisitor && (
        <p className="text-zinc-400 text-xs">Aguardando confirmação do Mandante.</p>
      )}
      {erro && <p className="text-red-400 text-sm">{erro}</p>}
    </div>
  )
}

// ─── Gols + Destaque por time ────────────────────────────────────────────────
function GoalsAndDestaqueSection({
  match, team, teamId, score, athletes, existingGoals, existingOwnVote, editable, onRefresh,
}: {
  match: Match; team: Team; teamId: string; score: number
  athletes: Athlete[]
  existingGoals: GoalEvent[]
  existingOwnVote: OwnVote | undefined
  editable: boolean
  onRefresh: () => void
}) {
  const color = team.primary_color || '#1565F5'
  const [goals, setGoals] = useState<Array<{ athlete_id: string | null; minute: string }>>(() =>
    existingGoals.map(g => ({ athlete_id: g.athlete_id, minute: g.minute?.toString() ?? '' }))
  )
  const [destaqueAthleteId, setDestaqueAthleteId] = useState<string>(existingOwnVote?.athlete_id ?? '')
  const [selectorOpen, setSelectorOpen] = useState(false)
  const [selectedAthlete, setSelectedAthlete] = useState('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [saved, setSaved] = useState(!!existingOwnVote)
  const saveFn = useServerFn(saveSumulaGoalsAndDestaque)

  const readOnly = !editable || saved
  const destaqueAthlete = athletes.find(a => a.id === destaqueAthleteId)
  const destaqueJersey = existingOwnVote?.jersey_number ?? 10 // fallback

  function addGol() {
    if (!selectedAthlete) return
    setGoals(g => [...g, { athlete_id: selectedAthlete, minute: '' }])
    setSelectedAthlete('')
    setSelectorOpen(false)
  }

  function removeGol(idx: number) {
    setGoals(g => g.filter((_, i) => i !== idx))
  }

  async function salvar() {
    if (!destaqueAthleteId) { setErro('Selecione o destaque da sua equipe.'); return }
    setLoading(true); setErro('')
    try {
      const ath = athletes.find(a => a.id === destaqueAthleteId)
      const name = ath?.nickname || ath?.full_name || null
      // Jersey: keep existing if present, else 10 as placeholder
      const jersey = existingOwnVote?.jersey_number ?? 10
      await saveFn({ data: {
        match_id: match.id, team_id: teamId,
        goals: goals.map(g => ({ athlete_id: g.athlete_id, minute: g.minute ? parseInt(g.minute, 10) : null })),
        destaque_jersey: jersey,
        destaque_name: name,
        destaque_athlete_id: destaqueAthleteId,
      } })
      setSaved(true); onRefresh()
    } catch (e) { setErro(e instanceof Error ? e.message : 'Erro') }
    finally { setLoading(false) }
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-1.5 rounded-full" style={{ backgroundColor: color }} />
          <h2 className="font-display text-lg text-white">Gols — {team.name}</h2>
        </div>
        <Badge className="bg-zinc-800 text-zinc-300 border border-zinc-700">
          {goals.length} / {score}
        </Badge>
      </div>

      {goals.length === 0 ? (
        <p className="text-zinc-500 text-sm py-1">Nenhum gol registrado.</p>
      ) : (
        <ul className="space-y-2">
          {goals.map((g, idx) => {
            const ath = athletes.find(a => a.id === g.athlete_id)
            const label = ath?.nickname || ath?.full_name || 'Atleta'
            return (
              <li key={idx} className="flex items-center justify-between bg-zinc-800/60 border border-zinc-800 rounded-lg px-3 py-2">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ backgroundColor: color + '33', color }}>
                    ⚽
                  </div>
                  <span className="text-white text-sm font-medium">{label}</span>
                  {g.minute && <span className="text-zinc-500 text-xs">{g.minute}'</span>}
                </div>
                {!readOnly && (
                  <button onClick={() => removeGol(idx)}
                    className="text-zinc-500 hover:text-red-400 p-1" aria-label="Remover gol">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {!readOnly && !selectorOpen && (
        <button onClick={() => setSelectorOpen(true)}
          className="w-full flex items-center justify-center gap-2 border border-dashed border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white rounded-lg py-3 text-sm transition">
          <Plus className="h-4 w-4" /> Registrar Gol
        </button>
      )}

      {!readOnly && selectorOpen && (
        <div className="space-y-2 rounded-lg border border-zinc-700 bg-zinc-800/40 p-3">
          <label className="text-zinc-300 text-xs font-semibold">Quem fez o gol?</label>
          <select value={selectedAthlete} onChange={e => setSelectedAthlete(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm">
            <option value="">— Selecione o jogador —</option>
            {athletes.length === 0 ? (
              <option disabled>Nenhum atleta cadastrado no time</option>
            ) : (
              athletes.map(a => (
                <option key={a.id} value={a.id}>{a.nickname || a.full_name || 'Atleta'}</option>
              ))
            )}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => { setSelectorOpen(false); setSelectedAthlete('') }}>Cancelar</Button>
            <Button onClick={addGol} disabled={!selectedAthlete}
              className="bg-[#1565F5] hover:bg-[#0f4fd1] text-white">Adicionar gol</Button>
          </div>
        </div>
      )}

      {/* Destaque */}
      <div className="border-t border-zinc-800 pt-4 space-y-2">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-amber-400" />
          <p className="text-white font-medium text-sm">Destaque de {team.name}</p>
        </div>
        <select
          value={destaqueAthleteId}
          onChange={e => setDestaqueAthleteId(e.target.value)}
          disabled={readOnly}
          className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm disabled:opacity-70"
        >
          <option value="">— Selecione o destaque —</option>
          {athletes.map(a => (
            <option key={a.id} value={a.id}>{a.nickname || a.full_name || 'Atleta'}</option>
          ))}
        </select>
        {destaqueAthlete && (
          <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-sm">
            <Trophy className="h-4 w-4 text-amber-400" />
            <span className="text-amber-200 font-semibold">
              {destaqueAthlete.nickname || destaqueAthlete.full_name}
            </span>
          </div>
        )}
      </div>

      {editable && !saved && (
        <Button onClick={salvar} disabled={loading || !destaqueAthleteId}
          className="w-full h-12 bg-[#1565F5] hover:bg-[#0f4fd1] text-white font-semibold rounded-xl">
          {loading ? 'Salvando...' : 'Salvar Gols + Destaque'}
        </Button>
      )}
      {saved && editable && (
        <button onClick={() => setSaved(false)} className="text-xs text-zinc-500 underline">Editar</button>
      )}
      {erro && (
        <div className="flex items-start gap-2 rounded-lg border border-red-800/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          <AlertCircle className="h-4 w-4 mt-0.5" /> {erro}
        </div>
      )}
      {!editable && !existingOwnVote && (
        <p className="text-zinc-600 text-xs italic">
          Só o diretor de {team.name} pode registrar os gols e o destaque deste time.
        </p>
      )}
    </section>
  )
}

// ─── Confirmation Modal ─────────────────────────────────────────────────────
function ConfirmModal({
  title, body, loading, erro, onCancel, onConfirm,
}: {
  title: string; body: React.ReactNode; loading: boolean; erro: string
  onCancel: () => void; onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-400" />
            <h3 className="font-display text-lg text-white">{title}</h3>
          </div>
          <button onClick={onCancel} className="text-zinc-500 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="text-zinc-400 text-sm">{body}</div>
        {erro && <p className="text-red-400 text-sm">{erro}</p>}
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={onCancel} disabled={loading}>Cancelar</Button>
          <Button onClick={onConfirm} disabled={loading}
            className="bg-[#1565F5] hover:bg-[#0f4fd1] text-white">
            {loading ? 'Enviando...' : 'Confirmar envio'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Status Badge ───────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: 'rascunho' | 'aguardando' | 'homologada' | 'contestada' | 'wo' }) {
  if (status === 'homologada')
    return (
      <Badge className="bg-green-500/20 text-green-300 border border-green-500/40 gap-1">
        <CheckCircle2 className="h-3 w-3" /> Súmula Homologada
      </Badge>
    )
  if (status === 'aguardando')
    return (
      <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/40 gap-1">
        <Clock className="h-3 w-3" /> Aguardando Adversário
      </Badge>
    )
  if (status === 'contestada')
    return (
      <Badge className="bg-red-500/20 text-red-300 border border-red-500/40 gap-1">
        <AlertCircle className="h-3 w-3" /> Contestada
      </Badge>
    )
  if (status === 'wo')
    return (
      <Badge className="bg-zinc-700/40 text-zinc-300 border border-zinc-600 gap-1">
        WO Automático
      </Badge>
    )
  return (
    <Badge className="bg-zinc-700/40 text-zinc-300 border border-zinc-600 gap-1">
      <FileText className="h-3 w-3" /> Rascunho
    </Badge>
  )
}
