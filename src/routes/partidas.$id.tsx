// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { supabase } from '~/integrations/supabase/client'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import { Badge } from '~/components/ui/badge'
import { useToast } from '~/hooks/use-toast'

export const Route = createFileRoute('/partidas/$id')({
  component: PartidaPage,
})

function horasRestantes(prazo) {
  const diff = new Date(prazo).getTime() - Date.now()
  if (diff <= 0) return 'Prazo encerrado'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return h + 'h ' + m + 'min restantes'
}

function PartidaPage() {
  const { id } = Route.useParams()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [partida, setPartida] = useState(null)
  const [userTimeId, setUserTimeId] = useState(null)
  const [placarMandante, setPlacarMandante] = useState('')
  const [placarVisitante, setPlacarVisitante] = useState('')
  const [placarConfirmado, setPlacarConfirmado] = useState(false)
  const [gols, setGols] = useState([{ jogador_nome: '', assistencia_nome: '' }])
  const [destaques, setDestaques] = useState([
    { nome: '', numero_camisa: '' },
    { nome: '', numero_camisa: '' },
    { nome: '', numero_camisa: '' },
  ])
  const [destaqueSelecionado, setDestaqueSelecionado] = useState('')
  const [notaDestaque, setNotaDestaque] = useState('')
  const [nomeArbitro, setNomeArbitro] = useState('')
  const [houveIncidente, setHouveIncidente] = useState(false)
  const [descricaoIncidente, setDescricaoIncidente] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('time_diretor_id').eq('id', user.id).single()
        if (profile) setUserTimeId(profile.time_diretor_id)
      }
      const { data } = await supabase
        .from('partidas')
        .select('*, mandante:time_mandante_id(nome,cor_primaria), visitante:time_visitante_id(nome,cor_primaria)')
        .eq('id', id)
        .single()
      if (data) setPartida(data)
      setLoading(false)
    }
    load()
  }, [id])

  const isMandante = partida && userTimeId === partida.time_mandante_id
  const isVisitante = partida && userTimeId === partida.time_visitante_id
  const isParticipante = isMandante || isVisitante

  async function salvarSumula() {
    if (!partida || !userTimeId) return
    setSaving(true)
    try {
      for (const gol of gols.filter(g => g.jogador_nome.trim())) {
        await supabase.from('gols').insert({
          partida_id: partida.id,
          time_id: userTimeId,
          jogador_nome_livre: gol.jogador_nome,
          assistencia_nome_livre: gol.assistencia_nome || null,
        })
      }
      await supabase.from('destaques_partida').upsert({
        partida_id: partida.id,
        time_id: userTimeId,
        candidatos: destaques.filter(d => d.nome.trim()),
        destaque_selecionado_idx: destaqueSelecionado ? parseInt(destaqueSelecionado) - 1 : null,
        nota: notaDestaque ? parseFloat(notaDestaque) : null,
      })
      await supabase.from('sumulas').upsert({
        partida_id: partida.id,
        nome_arbitro: nomeArbitro,
        ...(isMandante && { denuncia_mandante: houveIncidente ? descricaoIncidente : null }),
        ...(isVisitante && { denuncia_visitante: houveIncidente ? descricaoIncidente : null }),
      })
      if (isVisitante && placarMandante && placarVisitante) {
        await supabase.from('partidas').update({
          gols_mandante: parseInt(placarMandante),
          gols_visitante: parseInt(placarVisitante),
          status: 'sumula_iniciada',
        }).eq('id', partida.id)
      }
      toast({ title: 'Sumula salva com sucesso!' })
    } catch (err) {
      toast({ title: err.message || 'Erro ao salvar sumula', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center"><p className="text-zinc-400">Carregando partida...</p></div>
  if (!partida) return <div className="min-h-screen bg-black flex items-center justify-center"><p className="text-zinc-400">Partida nao encontrada.</p></div>

  return (
    <div className="min-h-screen bg-black px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <Badge variant="outline" className="text-zinc-400 border-zinc-700 text-xs">Sumula Digital</Badge>
            {partida.prazo_sumula && <span className="text-xs text-amber-400">{horasRestantes(partida.prazo_sumula)}</span>}
          </div>
          <div className="grid grid-cols-3 items-center gap-4">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center text-white font-bold" style={{ backgroundColor: partida.mandante?.cor_primaria || '#1565F5' }}>
                {partida.mandante?.nome?.[0]}
              </div>
              <p className="text-sm font-medium text-white">{partida.mandante?.nome}</p>
              <p className="text-xs text-zinc-500">Mandante</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-white">VS</p>
              <p className="text-xs text-zinc-500 mt-1">{new Date(partida.data_partida).toLocaleDateString('pt-BR')}</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center text-white font-bold" style={{ backgroundColor: partida.visitante?.cor_primaria || '#888' }}>
                {partida.visitante?.nome?.[0]}
              </div>
              <p className="text-sm font-medium text-white">{partida.visitante?.nome}</p>
              <p className="text-xs text-zinc-500">Visitante</p>
            </div>
          </div>
        </div>

        {!isParticipante && (
          <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 text-center">
            <p className="text-zinc-400">Apenas os times desta partida podem preencher a sumula.</p>
          </div>
        )}

        {isParticipante && (
          <>
            <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 space-y-4">
              <h3 className="text-white font-semibold"><span className="text-[#1565F5]">01</span> Placar da partida</h3>
              <p className="text-xs text-zinc-500">{isVisitante ? 'Como Visitante, voce lanca o placar primeiro.' : 'Confirme o placar lancado pelo Visitante.'}</p>
              <div className="grid grid-cols-3 items-center gap-4">
                <div>
                  <Label className="text-zinc-400 text-xs">{partida.mandante?.nome}</Label>
                  <Input type="number" min="0" value={placarMandante} onChange={e => setPlacarMandante(e.target.value)} className="mt-1 bg-zinc-800 border-zinc-700 text-white text-center text-2xl font-bold h-14" disabled={!isVisitante && !placarConfirmado} />
                </div>
                <div className="text-center text-zinc-500 font-bold text-xl pt-5">x</div>
                <div>
                  <Label className="text-zinc-400 text-xs">{partida.visitante?.nome}</Label>
                  <Input type="number" min="0" value={placarVisitante} onChange={e => setPlacarVisitante(e.target.value)} className="mt-1 bg-zinc-800 border-zinc-700 text-white text-center text-2xl font-bold h-14" disabled={!isVisitante && !placarConfirmado} />
                </div>
              </div>
              {isMandante && placarMandante && (
                <Button variant="outline" onClick={() => setPlacarConfirmado(true)} className="w-full border-green-600 text-green-400 hover:bg-green-900/20">
                  Confirmar placar
                </Button>
              )}
            </div>

            <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 space-y-4">
              <h3 className="text-white font-semibold"><span className="text-[#1565F5]">02</span> Gols do seu time</h3>
              {gols.map((gol, idx) => (
                <div key={idx} className="grid grid-cols-2 gap-3 p-3 bg-zinc-800 rounded-lg">
                  <div>
                    <Label className="text-zinc-400 text-xs">Quem fez o gol</Label>
                    <Input value={gol.jogador_nome} onChange={e => setGols(prev => prev.map((g, i) => i === idx ? { ...g, jogador_nome: e.target.value } : g))} className="mt-1 bg-zinc-700 border-zinc-600 text-white text-sm" placeholder="Nome do jogador" />
                  </div>
                  <div>
                    <Label className="text-zinc-400 text-xs">Assistencia (opcional)</Label>
                    <Input value={gol.assistencia_nome} onChange={e => setGols(prev => prev.map((g, i) => i === idx ? { ...g, assistencia_nome: e.target.value } : g))} className="mt-1 bg-zinc-700 border-zinc-600 text-white text-sm" placeholder="Nome do assistente" />
                  </div>
                  {gols.length > 1 && <button type="button" onClick={() => setGols(prev => prev.filter((_, i) => i !== idx))} className="col-span-2 text-xs text-red-400 text-right">Remover gol</button>}
                </div>
              ))}
              <Button type="button" variant="outline" onClick={() => setGols(prev => [...prev, { jogador_nome: '', assistencia_nome: '' }])} className="w-full border-zinc-700 text-zinc-400">
                + Adicionar gol
              </Button>
            </div>

            <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 space-y-4">
              <h3 className="text-white font-semibold"><span className="text-[#1565F5]">03</span> Destaque da partida</h3>
              <p className="text-sm text-zinc-300">Indique 3 jogadores do seu time como candidatos ao destaque:</p>
              {destaques.map((d, idx) => (
                <div key={idx} className="grid grid-cols-2 gap-3 p-3 bg-zinc-800 rounded-lg">
                  <div>
                    <Label className="text-zinc-400 text-xs">Candidato {idx + 1} - Nome</Label>
                    <Input value={d.nome} onChange={e => setDestaques(prev => prev.map((x, i) => i === idx ? { ...x, nome: e.target.value } : x))} className="mt-1 bg-zinc-700 border-zinc-600 text-white text-sm" placeholder="Nome do jogador" />
                  </div>
                  <div>
                    <Label className="text-zinc-400 text-xs">Num camisa</Label>
                    <Input value={d.numero_camisa} onChange={e => setDestaques(prev => prev.map((x, i) => i === idx ? { ...x, numero_camisa: e.target.value } : x))} className="mt-1 bg-zinc-700 border-zinc-600 text-white text-sm" placeholder="10" />
                  </div>
                </div>
              ))}
              <div className="border-t border-zinc-700 pt-4 space-y-3">
                <p className="text-sm text-zinc-300">Candidatos do adversario - escolha o destaque e de nota (0-10):</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-zinc-400 text-xs">Candidato escolhido (1, 2 ou 3)</Label>
                    <Input type="number" min="1" max="3" value={destaqueSelecionado} onChange={e => setDestaqueSelecionado(e.target.value)} className="mt-1 bg-zinc-800 border-zinc-700 text-white" />
                  </div>
                  <div>
                    <Label className="text-zinc-400 text-xs">Nota (0-10)</Label>
                    <Input type="number" min="0" max="10" step="0.1" value={notaDestaque} onChange={e => setNotaDestaque(e.target.value)} className="mt-1 bg-zinc-800 border-zinc-700 text-white" placeholder="8.5" />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 space-y-4">
              <h3 className="text-white font-semibold"><span className="text-[#1565F5]">04</span> Arbitragem</h3>
              <div>
                <Label className="text-zinc-400 text-xs">Nome do arbitro</Label>
                <Input value={nomeArbitro} onChange={e => setNomeArbitro(e.target.value)} className="mt-1 bg-zinc-800 border-zinc-700 text-white" placeholder="Nome completo do arbitro" />
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="incidente" checked={houveIncidente} onChange={e => setHouveIncidente(e.target.checked)} className="w-4 h-4 accent-red-500" />
                <Label htmlFor="incidente" className="text-zinc-300 cursor-pointer">Houve atitude inadequada da arbitragem</Label>
              </div>
              {houveIncidente && (
                <div>
                  <Label className="text-zinc-400 text-xs">Descreva o ocorrido</Label>
                  <Textarea value={descricaoIncidente} onChange={e => setDescricaoIncidente(e.target.value)} className="mt-1 bg-zinc-800 border-zinc-700 text-white min-h-[80px]" placeholder="Descreva o que aconteceu..." />
                </div>
              )}
            </div>

            <Button onClick={salvarSumula} disabled={saving} className="w-full bg-[#1565F5] hover:bg-blue-600 text-white font-semibold py-3 text-base">
              {saving ? 'Salvando sumula...' : 'Salvar sumula'}
            </Button>
            <p className="text-xs text-zinc-600 text-center">Prazo: 72h apos o jogo. Voce pode editar ate o prazo expirar.</p>
          </>
        )}
      </div>
    </div>
  )
      }
