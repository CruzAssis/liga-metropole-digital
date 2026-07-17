import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft, Plus, Trash2, Star, Trophy, CheckCircle2,
  Clock, AlertCircle, FileText, Eye, Send, X
} from 'lucide-react'

export const Route = createFileRoute('/sumula-exemplo')({
  head: () => ({
    meta: [
      { title: 'Súmula Digital — Exemplo Interativo | Liga Metrópole' },
      { name: 'description', content: 'Visualização funcional da Súmula Digital: registre gols, escolha destaques e envie a súmula para validação cruzada.' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: SumulaExemploPage,
})

// ─── Exemplo de dados ────────────────────────────────────────────────────────
type Jogador = { id: string; nome: string; camisa: number }

const TIME_A = {
  nome: 'Capital FC',
  sigla: 'CAP',
  cor: '#1565F5',
  jogadores: [
    { id: 'a1', nome: 'Silva', camisa: 10 },
    { id: 'a2', nome: 'Souza', camisa: 9 },
    { id: 'a3', nome: 'Lima', camisa: 7 },
    { id: 'a4', nome: 'Ribeiro', camisa: 5 },
    { id: 'a5', nome: 'Costa', camisa: 1 },
  ] as Jogador[],
}
const TIME_B = {
  nome: 'Vila Sport',
  sigla: 'VIL',
  cor: '#F59E0B',
  jogadores: [
    { id: 'b1', nome: 'Santos', camisa: 11 },
    { id: 'b2', nome: 'Pereira', camisa: 8 },
    { id: 'b3', nome: 'Almeida', camisa: 6 },
    { id: 'b4', nome: 'Nunes', camisa: 4 },
    { id: 'b5', nome: 'Rocha', camisa: 12 },
  ] as Jogador[],
}

// Exemplo pré-preenchido conforme requisito
const EXEMPLO_PREENCHIDO = {
  golsA: [
    { autorId: 'a1', autorNome: 'Silva' },
    { autorId: 'a2', autorNome: 'Souza' },
  ],
  golsB: [{ autorId: 'b1', autorNome: 'Santos' }],
  destaqueId: 'a1',
  destaqueNome: 'Silva (Capital FC)',
  observacao: 'Arbitragem confusa no segundo tempo.',
  placarA: 2,
  placarB: 1,
}

// ─── Página ──────────────────────────────────────────────────────────────────
function SumulaExemploPage() {
  const [modo, setModo] = useState<'editar' | 'exemplo'>('editar')
  const [status, setStatus] = useState<'rascunho' | 'aguardando' | 'homologada'>('rascunho')

  // Estado editável
  const [golsA, setGolsA] = useState<{ autorId: string; autorNome: string }[]>([])
  const [golsB, setGolsB] = useState<{ autorId: string; autorNome: string }[]>([])
  const [destaqueId, setDestaqueId] = useState<string>('')
  const [observacao, setObservacao] = useState('')
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  // Se em modo exemplo, usar dados fixos
  const view = modo === 'exemplo'
    ? {
        golsA: EXEMPLO_PREENCHIDO.golsA,
        golsB: EXEMPLO_PREENCHIDO.golsB,
        destaqueId: EXEMPLO_PREENCHIDO.destaqueId,
        observacao: EXEMPLO_PREENCHIDO.observacao,
        placarA: EXEMPLO_PREENCHIDO.placarA,
        placarB: EXEMPLO_PREENCHIDO.placarB,
      }
    : {
        golsA,
        golsB,
        destaqueId,
        observacao,
        placarA: golsA.length,
        placarB: golsB.length,
      }

  const todosJogadores = [
    ...TIME_A.jogadores.map(j => ({ ...j, time: TIME_A.nome, timeSigla: TIME_A.sigla })),
    ...TIME_B.jogadores.map(j => ({ ...j, time: TIME_B.nome, timeSigla: TIME_B.sigla })),
  ]
  const destaqueJogador = todosJogadores.find(j => j.id === view.destaqueId)

  function addGol(time: 'A' | 'B', jogador: Jogador) {
    const entry = { autorId: jogador.id, autorNome: jogador.nome }
    if (time === 'A') setGolsA(g => [...g, entry])
    else setGolsB(g => [...g, entry])
  }
  function removeGol(time: 'A' | 'B', idx: number) {
    if (time === 'A') setGolsA(g => g.filter((_, i) => i !== idx))
    else setGolsB(g => g.filter((_, i) => i !== idx))
  }

  function confirmarEnvio() {
    setShowConfirmModal(false)
    setStatus('aguardando')
    // simular adversário confirmando após 3s
    setTimeout(() => setStatus('homologada'), 3500)
  }

  const isReadOnly = modo === 'exemplo' || status !== 'rascunho'

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-12">
      {/* Header topo */}
      <div className="sticky top-0 z-20 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
          <StatusBadge status={status} />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-6 space-y-6">
        {/* Título */}
        <div>
          <h1 className="font-display text-2xl md:text-3xl text-white">Súmula da Partida</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Mockup interativo — teste o fluxo completo de preenchimento da súmula digital.
          </p>
        </div>

        {/* Toggle modo */}
        <div className="flex items-center gap-2 p-1 bg-zinc-900 border border-zinc-800 rounded-lg w-fit">
          <button
            onClick={() => setModo('editar')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
              modo === 'editar' ? 'bg-[#1565F5] text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <FileText className="h-3.5 w-3.5 inline mr-1" /> Preencher
          </button>
          <button
            onClick={() => setModo('exemplo')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
              modo === 'exemplo' ? 'bg-[#1565F5] text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Eye className="h-3.5 w-3.5 inline mr-1" /> Ver exemplo preenchido
          </button>
        </div>

        {modo === 'exemplo' && (
          <div className="rounded-lg border border-blue-800/40 bg-blue-950/20 p-3 text-sm text-blue-200">
            <strong>Exemplo:</strong> súmula preenchida — Time A 2×1 Time B, gols de Silva e Souza (A) e Santos (B),
            destaque Silva, observação sobre arbitragem.
          </div>
        )}

        {/* HEADER da súmula: Times + Placar */}
        <div className="rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 p-6">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <div className="text-center">
              <div
                className="mx-auto h-14 w-14 rounded-full flex items-center justify-center font-black text-xl mb-2"
                style={{ backgroundColor: TIME_A.cor + '33', color: TIME_A.cor }}
              >
                {TIME_A.sigla}
              </div>
              <p className="text-white font-semibold text-sm md:text-base">{TIME_A.nome}</p>
              <p className="text-zinc-500 text-xs">Mandante</p>
            </div>

            <div className="text-center">
              <div className="flex items-baseline gap-2 md:gap-4">
                <span className="text-5xl md:text-7xl font-black tabular-nums">{view.placarA}</span>
                <span className="text-3xl md:text-4xl text-zinc-600 font-black">×</span>
                <span className="text-5xl md:text-7xl font-black tabular-nums">{view.placarB}</span>
              </div>
              <p className="text-zinc-500 text-xs mt-1">Placar da partida</p>
            </div>

            <div className="text-center">
              <div
                className="mx-auto h-14 w-14 rounded-full flex items-center justify-center font-black text-xl mb-2"
                style={{ backgroundColor: TIME_B.cor + '33', color: TIME_B.cor }}
              >
                {TIME_B.sigla}
              </div>
              <p className="text-white font-semibold text-sm md:text-base">{TIME_B.nome}</p>
              <p className="text-zinc-500 text-xs">Visitante</p>
            </div>
          </div>
        </div>

        {/* Seção Gols — Time A */}
        <SecaoGols
          time="A"
          nomeTime={TIME_A.nome}
          cor={TIME_A.cor}
          jogadores={TIME_A.jogadores}
          gols={view.golsA}
          onAdd={j => addGol('A', j)}
          onRemove={idx => removeGol('A', idx)}
          readOnly={isReadOnly}
        />

        {/* Seção Gols — Time B */}
        <SecaoGols
          time="B"
          nomeTime={TIME_B.nome}
          cor={TIME_B.cor}
          jogadores={TIME_B.jogadores}
          gols={view.golsB}
          onAdd={j => addGol('B', j)}
          onRemove={idx => removeGol('B', idx)}
          readOnly={isReadOnly}
        />

        {/* Seção Destaque */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-400" />
            <h2 className="font-display text-lg text-white">Destaque da Partida</h2>
          </div>
          <p className="text-zinc-500 text-xs">Eleja o jogador que mais se destacou em campo.</p>

          <select
            value={view.destaqueId}
            onChange={e => setDestaqueId(e.target.value)}
            disabled={isReadOnly}
            className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-3 text-sm disabled:opacity-70"
          >
            <option value="">— Selecione o destaque —</option>
            <optgroup label={TIME_A.nome}>
              {TIME_A.jogadores.map(j => (
                <option key={j.id} value={j.id}>#{j.camisa} {j.nome}</option>
              ))}
            </optgroup>
            <optgroup label={TIME_B.nome}>
              {TIME_B.jogadores.map(j => (
                <option key={j.id} value={j.id}>#{j.camisa} {j.nome}</option>
              ))}
            </optgroup>
          </select>

          {destaqueJogador && (
            <div className="flex items-center gap-3 rounded-lg bg-amber-500/10 border border-amber-500/30 p-3">
              <div className="h-10 w-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Trophy className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="text-amber-200 font-semibold text-sm">
                  #{destaqueJogador.camisa} {destaqueJogador.nome}
                </p>
                <p className="text-amber-400/70 text-xs">{destaqueJogador.time} · Destaque eleito</p>
              </div>
            </div>
          )}
        </section>

        {/* Seção Arbitragem */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-400" />
            <h2 className="font-display text-lg text-white">Observações sobre a Arbitragem</h2>
          </div>
          <p className="text-zinc-500 text-xs">
            Registre reclamações ou observações sobre a arbitragem (opcional).
          </p>
          <textarea
            value={view.observacao}
            onChange={e => setObservacao(e.target.value)}
            disabled={isReadOnly}
            rows={4}
            maxLength={1000}
            placeholder="Ex: Arbitragem confusa no segundo tempo, marcação de impedimento duvidosa aos 30'..."
            className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-3 text-sm resize-y disabled:opacity-70"
          />
          <p className="text-zinc-600 text-xs text-right">{view.observacao.length}/1000</p>
        </section>

        {/* Botão ação */}
        {modo === 'editar' && status === 'rascunho' && (
          <Button
            onClick={() => setShowConfirmModal(true)}
            className="w-full h-14 bg-[#1565F5] hover:bg-[#0f4fd1] text-white text-base font-semibold rounded-xl"
          >
            <Send className="h-5 w-5 mr-2" />
            Confirmar e Enviar Súmula
          </Button>
        )}

        {status === 'aguardando' && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-5 flex items-start gap-3">
            <Clock className="h-6 w-6 text-amber-400 flex-shrink-0 animate-pulse" />
            <div>
              <p className="text-amber-200 font-semibold">Aguardando Adversário</p>
              <p className="text-amber-400/70 text-sm mt-1">
                Sua súmula foi enviada. Assim que o time adversário confirmar, o ranking será atualizado automaticamente.
              </p>
            </div>
          </div>
        )}

        {status === 'homologada' && (
          <div className="rounded-xl border border-green-500/40 bg-green-500/10 p-5 flex items-start gap-3">
            <CheckCircle2 className="h-6 w-6 text-green-400 flex-shrink-0" />
            <div>
              <p className="text-green-200 font-semibold">Súmula Homologada</p>
              <p className="text-green-400/70 text-sm mt-1">
                Ambos os times confirmaram. O ranking foi atualizado automaticamente com os gols, o destaque e o resultado.
              </p>
              <Button
                onClick={() => { setStatus('rascunho'); setGolsA([]); setGolsB([]); setDestaqueId(''); setObservacao('') }}
                variant="outline"
                size="sm"
                className="mt-3 border-green-700 text-green-300 hover:bg-green-900/30"
              >
                Nova súmula
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de confirmação */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-400" />
                <h3 className="font-display text-lg text-white">Confirmar envio</h3>
              </div>
              <button onClick={() => setShowConfirmModal(false)} className="text-zinc-500 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-zinc-400 text-sm">
              Você está enviando o placar <strong className="text-white">{view.placarA} × {view.placarB}</strong> com{' '}
              <strong className="text-white">{view.golsA.length + view.golsB.length} gols</strong> registrados.
              Após o envio, o time adversário precisará confirmar para o ranking ser atualizado.
            </p>
            <div className="rounded-lg bg-zinc-800/60 p-3 text-xs text-zinc-400 space-y-1">
              <p>• Gols {TIME_A.sigla}: {view.golsA.map(g => g.autorNome).join(', ') || '—'}</p>
              <p>• Gols {TIME_B.sigla}: {view.golsB.map(g => g.autorNome).join(', ') || '—'}</p>
              <p>• Destaque: {destaqueJogador ? `#${destaqueJogador.camisa} ${destaqueJogador.nome}` : '—'}</p>
              <p>• Arbitragem: {view.observacao ? 'Com observação' : 'Sem observações'}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={() => setShowConfirmModal(false)}>Cancelar</Button>
              <Button onClick={confirmarEnvio} className="bg-[#1565F5] hover:bg-[#0f4fd1] text-white">
                Confirmar envio
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Componentes auxiliares ─────────────────────────────────────────────────
function StatusBadge({ status }: { status: 'rascunho' | 'aguardando' | 'homologada' }) {
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
  return (
    <Badge className="bg-zinc-700/40 text-zinc-300 border border-zinc-600 gap-1">
      <FileText className="h-3 w-3" /> Rascunho
    </Badge>
  )
}

function SecaoGols({
  time, nomeTime, cor, jogadores, gols, onAdd, onRemove, readOnly,
}: {
  time: 'A' | 'B'
  nomeTime: string
  cor: string
  jogadores: Jogador[]
  gols: { autorId: string; autorNome: string }[]
  onAdd: (j: Jogador) => void
  onRemove: (idx: number) => void
  readOnly: boolean
}) {
  const [selectorOpen, setSelectorOpen] = useState(false)
  const [selectedId, setSelectedId] = useState('')

  function confirmar() {
    const j = jogadores.find(x => x.id === selectedId)
    if (!j) return
    onAdd(j)
    setSelectedId('')
    setSelectorOpen(false)
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-1.5 rounded-full" style={{ backgroundColor: cor }} />
          <h2 className="font-display text-lg text-white">Gols — {nomeTime}</h2>
        </div>
        <Badge className="bg-zinc-800 text-zinc-300 border border-zinc-700">
          {gols.length} gol{gols.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {gols.length === 0 && !selectorOpen && (
        <p className="text-zinc-500 text-sm py-2">Nenhum gol registrado ainda.</p>
      )}

      {gols.length > 0 && (
        <ul className="space-y-2">
          {gols.map((g, idx) => {
            const j = jogadores.find(x => x.id === g.autorId)
            return (
              <li key={idx} className="flex items-center justify-between bg-zinc-800/60 border border-zinc-800 rounded-lg px-3 py-2">
                <div className="flex items-center gap-3">
                  <div
                    className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ backgroundColor: cor + '33', color: cor }}
                  >
                    {j?.camisa ?? '?'}
                  </div>
                  <span className="text-white text-sm font-medium">{g.autorNome}</span>
                  <span className="text-zinc-500 text-xs">⚽ Gol</span>
                </div>
                {!readOnly && (
                  <button
                    onClick={() => onRemove(idx)}
                    className="text-zinc-500 hover:text-red-400 p-1"
                    aria-label="Remover gol"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {!readOnly && !selectorOpen && (
        <button
          onClick={() => setSelectorOpen(true)}
          className="w-full flex items-center justify-center gap-2 border border-dashed border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white rounded-lg py-3 text-sm transition"
        >
          <Plus className="h-4 w-4" /> Registrar Gol
        </button>
      )}

      {!readOnly && selectorOpen && (
        <div className="space-y-2 rounded-lg border border-zinc-700 bg-zinc-800/40 p-3">
          <label className="text-zinc-300 text-xs font-semibold">Quem fez o gol?</label>
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm"
          >
            <option value="">— Selecione o jogador —</option>
            {jogadores.map(j => (
              <option key={j.id} value={j.id}>#{j.camisa} {j.nome}</option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => { setSelectorOpen(false); setSelectedId('') }}>
              Cancelar
            </Button>
            <Button onClick={confirmar} disabled={!selectedId} className="bg-[#1565F5] hover:bg-[#0f4fd1] text-white">
              Adicionar gol
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
