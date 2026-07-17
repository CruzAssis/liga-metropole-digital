import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useMemo } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { toast } from 'sonner'
import { Spinner, SkeletonStatsRow, SkeletonAdminList } from '@/components/AppSkeletons'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DollarSign, CheckCircle, Clock, AlertTriangle, Download,
  TrendingUp, CreditCard, XCircle, ChevronLeft, ChevronRight, Filter,
} from 'lucide-react'
import {
  listPagamentosMes,
  marcarComoPago,
  desfazerPagamento,
  mesAtual,
  type PagamentoStatus,
  type PagamentoMetodo,
} from '@/lib/pagamentos.functions'

export const Route = createFileRoute('/_authenticated/admin/financeiro')({
  component: FinanceiroPage,
})

// ─── Types ────────────────────────────────────────────────────────────────────
type PagRow = {
  team_id: string
  team_name: string
  team_short_name: string
  team_primary_color: string | null
  registration_type: 'host' | 'visitor'
  director_name: string | null
  director_phone: string | null
  pagamento_id: string | null
  status: PagamentoStatus
  valor: number
  data_pagamento: string | null
  metodo: PagamentoMetodo | null
  observacoes: string | null
  dias_atraso: number
  inadimplente: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtMes(mes: string) {
  const [y, m] = mes.split('-')
  const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  return nomes[parseInt(m, 10) - 1] + '/' + y
}

function fmtBRL(val: number) {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function prevMes(mes: string): string {
  const d = new Date(mes)
  d.setMonth(d.getMonth() - 1)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01'
}

function nextMes(mes: string): string {
  const d = new Date(mes)
  d.setMonth(d.getMonth() + 1)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-01'
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status, diasAtraso, inadimplente }: { status: PagamentoStatus; diasAtraso: number; inadimplente: boolean }) {
  if (inadimplente || status === 'atrasado') return (
    <div className="flex items-center gap-1.5">
      <Badge className="bg-red-900/30 text-red-400 border-red-700/40 text-xs font-semibold">
        <AlertTriangle className="h-3 w-3 mr-1" /> Inadimplente
      </Badge>
      {diasAtraso > 0 && <span className="text-xs text-red-400">{diasAtraso}d atraso</span>}
    </div>
  )
  if (status === 'pago') return (
    <Badge className="bg-green-900/30 text-green-400 border-green-700/40 text-xs">
      <CheckCircle className="h-3 w-3 mr-1" /> Pago
    </Badge>
  )
  return (
    <Badge className="bg-amber-900/30 text-amber-400 border-amber-700/40 text-xs">
      <Clock className="h-3 w-3 mr-1" /> Pendente
    </Badge>
  )
}

// ─── Modal Marcar como Pago ───────────────────────────────────────────────────
function ModalPago({ row, mes, onClose, onSaved }: {
  row: PagRow; mes: string; onClose: () => void; onSaved: () => void
}) {
  const [valor, setValor] = useState(row.valor > 0 ? String(row.valor) : '150')
  const [metodo, setMetodo] = useState<PagamentoMetodo>('pix')
  const [obs, setObs] = useState(row.observacoes ?? '')
  const [loading, setLoading] = useState(false)
  const marcarFn = useServerFn(marcarComoPago)

  async function salvar() {
    setLoading(true)
    try {
      await marcarFn({
        data: {
          time_id: row.team_id,
          mes_referencia: mes,
          valor: parseFloat(valor) || 0,
          metodo,
          observacoes: obs || null,
        },
      })
      toast.success('Pagamento registrado!')
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro')
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold text-lg">Registrar Pagamento</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><XCircle className="h-5 w-5" /></button>
        </div>
        <div className="bg-zinc-800 rounded-lg p-3">
          <p className="text-zinc-400 text-xs">Time</p>
          <p className="text-white font-semibold">{row.team_name}</p>
          <p className="text-zinc-400 text-xs mt-1">Mês: {fmtMes(mes)}</p>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-zinc-400 text-xs block mb-1">Valor (R$)</label>
            <input type="number" min={0} step={0.01} value={valor} onChange={e => setValor(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-zinc-400 text-xs block mb-1">Método</label>
            <div className="grid grid-cols-2 gap-2">
              {(['pix', 'outro'] as PagamentoMetodo[]).map(m => (
                <button key={m} onClick={() => setMetodo(m)}
                  className={`py-2 rounded-lg text-sm font-medium border transition-all ${metodo === m ? 'bg-[#1565F5] border-[#1565F5] text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}>
                  {m === 'pix' ? 'PIX' : 'Outro'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-zinc-400 text-xs block mb-1">Observações (opcional)</label>
            <textarea value={obs} onChange={e => setObs(e.target.value)} rows={2} maxLength={500}
              className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm resize-none" />
          </div>
        </div>
        <Button onClick={salvar} disabled={loading} className="w-full bg-[#1565F5] text-white h-11">
          {loading ? <><Spinner className="mr-2 h-4 w-4" />Aguarde...</> : 'Confirmar Pagamento'}
        </Button>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
function FinanceiroPage() {
  const [mes, setMes] = useState(mesAtual())
  const [rows, setRows] = useState<PagRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'todos' | PagamentoStatus>('todos')
  const [modalRow, setModalRow] = useState<PagRow | null>(null)
  const [desfazendo, setDesfazendo] = useState<string | null>(null)

  const listFn = useServerFn(listPagamentosMes)
  const desfazerFn = useServerFn(desfazerPagamento)

  async function load() {
    setLoading(true)
    try {
      const result = await listFn({ data: { mes_referencia: mes } })
      setRows(result.rows as PagRow[])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [mes])

  // Totalizadores calculados no front
  const totais = useMemo(() => {
    const pagos = rows.filter(r => r.status === 'pago')
    const pendentes = rows.filter(r => r.status === 'pendente' && !r.inadimplente)
    const atrasados = rows.filter(r => r.status === 'atrasado' || r.inadimplente)
    return {
      receitaMes: pagos.reduce((s, r) => s + r.valor, 0),
      aReceber: pendentes.reduce((s, r) => s + r.valor, 0),
      atrasado: atrasados.reduce((s, r) => s + r.valor, 0),
      totalPagos: pagos.length,
      totalPendentes: pendentes.length,
      totalAtrasados: atrasados.length,
    }
  }, [rows])

  // Filtro
  const filtered = useMemo(() => {
    if (filtro === 'todos') return rows
    if (filtro === 'atrasado') return rows.filter(r => r.inadimplente || r.status === 'atrasado')
    return rows.filter(r => r.status === filtro && !r.inadimplente)
  }, [rows, filtro])

  async function handleDesfazer(row: PagRow) {
    setDesfazendo(row.team_id)
    try {
      await desfazerFn({ data: { time_id: row.team_id, mes_referencia: mes } })
      toast.success('Pagamento desfeito.')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro')
    } finally { setDesfazendo(null) }
  }

  function exportCSV() {
    const inadimplentes = rows.filter(r => r.status !== 'pago')
    const header = 'Time,Tipo,Diretor,Telefone,Status,Dias Atraso,Valor'
    const lines = inadimplentes.map(r =>
      ['"' + r.team_name + '"',
       r.registration_type === 'host' ? 'Mandante' : 'Visitante',
       '"' + (r.director_name ?? '') + '"',
       r.director_phone ?? '',
       r.inadimplente ? 'atrasado' : r.status,
       r.dias_atraso,
       r.valor].join(',')
    )
    const csv = [header, ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'inadimplentes-' + mes + '.csv'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV exportado: ' + inadimplentes.length + ' times')
  }

  const filtroButtons: { id: 'todos' | PagamentoStatus; label: string; count: number }[] = [
    { id: 'todos', label: 'Todos', count: rows.length },
    { id: 'pago', label: 'Pagos', count: totais.totalPagos },
    { id: 'pendente', label: 'Pendentes', count: totais.totalPendentes },
    { id: 'atrasado', label: 'Atrasados', count: totais.totalAtrasados },
  ]

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-[#1565F5] shrink-0" /> Gestão Financeira
          </h1>
          <p className="text-zinc-400 text-xs sm:text-sm mt-1">Controle de mensalidades dos times</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={exportCSV}
            className="border-zinc-700 text-zinc-300 hover:text-white gap-1">
            <Download className="h-4 w-4" /> <span className="hidden xs:inline sm:inline">Exportar Inadimplentes</span><span className="xs:hidden sm:hidden">Exportar</span>
          </Button>
          <Button variant="outline" size="sm" onClick={load}
            className="border-zinc-700 text-zinc-300">Atualizar</Button>
        </div>
      </div>


      {/* Seletor de mês */}
      <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 w-fit">
        <button onClick={() => setMes(prevMes(mes))}
          className="text-zinc-400 hover:text-white transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-white font-semibold text-lg w-24 text-center">{fmtMes(mes)}</span>
        <button onClick={() => setMes(nextMes(mes))}
          className="text-zinc-400 hover:text-white transition-colors">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Totalizadores */}
      {loading ? (
        <SkeletonStatsRow count={3} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center gap-2 text-green-400 mb-2">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Receita do Mês</span>
          </div>
          <p className="text-3xl font-black text-white">{fmtBRL(totais.receitaMes)}</p>
          <p className="text-zinc-500 text-xs mt-1">{totais.totalPagos} time{totais.totalPagos !== 1 ? 's' : ''} pagos</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center gap-2 text-amber-400 mb-2">
            <Clock className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">A Receber</span>
          </div>
          <p className="text-3xl font-black text-white">{fmtBRL(totais.aReceber)}</p>
          <p className="text-zinc-500 text-xs mt-1">{totais.totalPendentes} pendente{totais.totalPendentes !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center gap-2 text-red-400 mb-2">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Em Atraso</span>
          </div>
          <p className="text-3xl font-black text-white">{fmtBRL(totais.atrasado)}</p>
          <p className="text-zinc-500 text-xs mt-1">{totais.totalAtrasados} inadimplente{totais.totalAtrasados !== 1 ? 's' : ''}</p>
        </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-zinc-500" />
        {filtroButtons.map(f => (
          <button key={f.id} onClick={() => setFiltro(f.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
              filtro === f.id
                ? 'bg-[#1565F5] border-[#1565F5] text-white'
                : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500'
            }`}>
            {f.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${filtro === f.id ? 'bg-white/20' : 'bg-zinc-700'}`}>
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tabela */}
      {loading ? (
        <SkeletonAdminList rows={6} />
      ) : filtered.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
          <p className="text-zinc-400">Nenhum time encontrado para este filtro.</p>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3 font-medium">Time</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Tipo</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Diretor</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">Valor</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Pago em</th>
                <th className="text-right px-4 py-3 font-medium">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filtered.map(row => (
                <tr key={row.team_id} className={`hover:bg-zinc-800/40 transition-colors ${row.inadimplente ? 'bg-red-950/10' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ background: row.team_primary_color || '#1565F5' }}>
                        {row.team_short_name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-white font-medium">{row.team_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className={`text-xs px-2 py-1 rounded border ${row.registration_type === 'host' ? 'border-blue-600/40 text-blue-400' : 'border-purple-600/40 text-purple-400'}`}>
                      {row.registration_type === 'host' ? 'Mandante' : 'Visitante'}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <p className="text-zinc-300 text-xs">{row.director_name ?? '—'}</p>
                    {row.director_phone && (
                      <a href={'https://wa.me/55' + row.director_phone} target="_blank" rel="noopener noreferrer"
                        className="text-green-400 text-xs hover:underline">{row.director_phone}</a>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} diasAtraso={row.dias_atraso} inadimplente={row.inadimplente} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-mono font-semibold ${row.status === 'pago' ? 'text-green-400' : 'text-zinc-300'}`}>
                      {row.valor > 0 ? fmtBRL(row.valor) : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-zinc-400 text-xs">
                    {row.data_pagamento
                      ? new Date(row.data_pagamento).toLocaleDateString('pt-BR') + (row.metodo ? ' · ' + row.metodo.toUpperCase() : '')
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.status !== 'pago' ? (
                      <Button size="sm" onClick={() => setModalRow(row)}
                        className="bg-[#1565F5] hover:bg-blue-600 text-white text-xs h-8 px-3 gap-1">
                        <CreditCard className="h-3.5 w-3.5" /> Marcar Pago
                      </Button>
                    ) : (
                      <button onClick={() => handleDesfazer(row)} disabled={desfazendo === row.team_id}
                        className="text-xs text-zinc-500 hover:text-zinc-300 underline">
                        {desfazendo === row.team_id ? '...' : 'Desfazer'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modalRow && (
        <ModalPago
          row={modalRow}
          mes={mes}
          onClose={() => setModalRow(null)}
          onSaved={load}
        />
      )}
    </div>
  )
}
