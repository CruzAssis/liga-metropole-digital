// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { supabase } from '~/integrations/supabase/client'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { useToast } from '~/hooks/use-toast'

export const Route = createFileRoute('/partidas/$id')({
  component: PartidaPage,
})

function PartidaPage() {
  const { id } = Route.useParams()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [partida, setPartida] = useState(null)
  const [userTimeId, setUserTimeId] = useState(null)
  const [placarMandante, setPlacarMandante] = useState('')
  const [placarVisitante, setPlacarVisitante] = useState('')
  const [golNome, setGolNome] = useState('')
  const [assistenciaNome, setAssistenciaNome] = useState('')
  const [candidato1, setCandidato1] = useState('')
  const [candidato2, setCandidato2] = useState('')
  const [candidato3, setCandidato3] = useState('')
  const [destaqueSelecionado, setDestaqueSelecionado] = useState('')
  const [notaDestaque, setNotaDestaque] = useState('')
  const [nomeArbitro, setNomeArbitro] = useState('')
  const [denuncia, setDenuncia] = useState('')
  const [houveIncidente, setHouveIncidente] = useState(false)

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
        .eq('id', id).single()
      if (data) setPartida(data)
      setLoading(false)
    }
    load()
  }, [id])

  const isMandante = partida && userTimeId === partida.time_mandante_id
  const isVisitante = partida && userTimeId === partida.time_visitante_id

  async function salvarSumula() {
    if (!partida || !userTimeId) return
    setSaving(true)
    try {
      if (golNome.trim()) {
        await supabase.from('gols').insert({ partida_id: partida.id, time_id: userTimeId, jogador_nome_livre: golNome, assistencia_nome_livre: assistenciaNome || null })
      }
      await supabase.from('destaques_partida').upsert({ partida_id: partida.id, time_id: userTimeId, candidatos: [{ nome: candidato1 }, { nome: candidato2 }, { nome: candidato3 }].filter(c => c.nome), destaque_selecionado_idx: destaqueSelecionado ? parseInt(destaqueSelecionado) - 1 : null, nota: notaDestaque ? parseFloat(notaDestaque) : null })
      await supabase.from('sumulas').upsert({ partida_id: partida.id, nome_arbitro: nomeArbitro, ...(isMandante && { denuncia_mandante: houveIncidente ? denuncia : null }), ...(isVisitante && { denuncia_visitante: houveIncidente ? denuncia : null }) })
      if (isVisitante && placarMandante && placarVisitante) {
        await supabase.from('partidas').update({ gols_mandante: parseInt(placarMandante), gols_visitante: parseInt(placarVisitante), status: 'sumula_iniciada' }).eq('id', partida.id)
      }
      toast({ title: 'Sumula salva!' })
    } catch (err) {
      toast({ title: err.message || 'Erro ao salvar', variant: 'destructive' })
    } finally { setSaving(false) }
  }

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center"><p className="text-zinc-400">Carregando...</p></div>
  if (!partida) return <div className="min-h-screen bg-black flex items-center justify-center"><p className="text-zinc-400">Partida nao encontrada.</p></div>
  if (!isMandante && !isVisitante) return <div className="min-h-screen bg-black flex items-center justify-center"><p className="text-zinc-400">Apenas os times desta partida podem preencher a sumula.</p></div>

  return (
    <div className="min-h-screen bg-black px-4 py-8">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
          <p className="text-xs text-zinc-500 mb-3">Sumula Digital</p>
          <div className="grid grid-cols-3 items-center gap-4 text-center">
            <div>
              <p className="text-white font-semibold">{partida.mandante?.nome}</p>
              <p className="text-xs text-zinc-500">Mandante</p>
            </div>
            <p className="text-2xl font-bold text-white">VS</p>
            <div>
              <p className="text-white font-semibold">{partida.visitante?.nome}</p>
              <p className="text-xs text-zinc-500">Visitante</p>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800 space-y-3">
          <p className="text-white font-semibold"><span className="text-[#1565F5]">01</span> Placar</p>
          <p className="text-xs text-zinc-500">{isVisitante ? 'Voce lanca o placar primeiro.' : 'Confirme o placar do Visitante.'}</p>
          <div className="grid grid-cols-3 items-center gap-3">
            <div><Label className="text-zinc-400 text-xs">{partida.mandante?.nome}</Label><Input type="number" min="0" value={placarMandante} onChange={e => setPlacarMandante(e.target.value)} className="mt-1 bg-zinc-800 border-zinc-700 text-white text-center text-xl font-bold h-12" disabled={!isVisitante} /></div>
            <p className="text-center text-zinc-500 font-bold pt-5">x</p>
            <div><Label className="text-zinc-400 text-xs">{partida.visitante?.nome}</Label><Input type="number" min="0" value={placarVisitante} onChange={e => setPlacarVisitante(e.target.value)} className="mt-1 bg-zinc-800 border-zinc-700 text-white text-center text-xl font-bold h-12" disabled={!isVisitante} /></div>
          </div>
        </div>

        <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800 space-y-3">
          <p className="text-white font-semibold"><span className="text-[#1565F5]">02</span> Gol do seu time</p>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-zinc-400 text-xs">Quem fez o gol</Label><Input value={golNome} onChange={e => setGolNome(e.target.value)} className="mt-1 bg-zinc-800 border-zinc-700 text-white" placeholder="Nome do jogador" /></div>
            <div><Label className="text-zinc-400 text-xs">Assistencia</Label><Input value={assistenciaNome} onChange={e => setAssistenciaNome(e.target.value)} className="mt-1 bg-zinc-800 border-zinc-700 text-white" placeholder="Opcional" /></div>
          </div>
        </div>

        <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800 space-y-3">
          <p className="text-white font-semibold"><span className="text-[#1565F5]">03</span> Destaque — Indique 3 candidatos do seu time</p>
          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-zinc-400 text-xs">Candidato 1</Label><Input value={candidato1} onChange={e => setCandidato1(e.target.value)} className="mt-1 bg-zinc-800 border-zinc-700 text-white text-sm" placeholder="Nome" /></div>
            <div><Label className="text-zinc-400 text-xs">Candidato 2</Label><Input value={candidato2} onChange={e => setCandidato2(e.target.value)} className="mt-1 bg-zinc-800 border-zinc-700 text-white text-sm" placeholder="Nome" /></div>
            <div><Label className="text-zinc-400 text-xs">Candidato 3</Label><Input value={candidato3} onChange={e => setCandidato3(e.target.value)} className="mt-1 bg-zinc-800 border-zinc-700 text-white text-sm" placeholder="Nome" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div><Label className="text-zinc-400 text-xs">Escolha do adversario (1-3)</Label><Input type="number" min="1" max="3" value={destaqueSelecionado} onChange={e => setDestaqueSelecionado(e.target.value)} className="mt-1 bg-zinc-800 border-zinc-700 text-white" /></div>
            <div><Label className="text-zinc-400 text-xs">Nota (0-10)</Label><Input type="number" min="0" max="10" step="0.1" value={notaDestaque} onChange={e => setNotaDestaque(e.target.value)} className="mt-1 bg-zinc-800 border-zinc-700 text-white" placeholder="8.5" /></div>
          </div>
        </div>

        <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800 space-y-3">
          <p className="text-white font-semibold"><span className="text-[#1565F5]">04</span> Arbitragem</p>
          <div><Label className="text-zinc-400 text-xs">Nome do arbitro</Label><Input value={nomeArbitro} onChange={e => setNomeArbitro(e.target.value)} className="mt-1 bg-zinc-800 border-zinc-700 text-white" placeholder="Nome completo" /></div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={houveIncidente} onChange={e => setHouveIncidente(e.target.checked)} className="w-4 h-4 accent-red-500" />
            <span className="text-zinc-300 text-sm">Houve conduta inadequada da arbitragem</span>
          </label>
          {houveIncidente && <div><Label className="text-zinc-400 text-xs">Descricao</Label><Input value={denuncia} onChange={e => setDenuncia(e.target.value)} className="mt-1 bg-zinc-800 border-zinc-700 text-white" placeholder="Descreva o ocorrido" /></div>}
        </div>

        <Button onClick={salvarSumula} disabled={saving} className="w-full bg-[#1565F5] hover:bg-blue-600 text-white font-semibold py-3">
          {saving ? 'Salvando...' : 'Salvar sumula'}
        </Button>
        <p className="text-xs text-zinc-600 text-center">Prazo: 72h apos o jogo.</p>
      </div>
    </div>
  )
                                                                                                                                                                                  }
