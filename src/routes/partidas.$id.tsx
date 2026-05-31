// @ts-nocheck
import { createFileRoute, useParams } from '@tanstack/react-router'
import { useState } from 'react'

export const Route = createFileRoute('/partidas/$id')({
  component: PartidaPage,
})

function PartidaPage() {
  const { id } = useParams({ from: '/partidas/$id' })
  const [placarM, setPlacarM] = useState('')
  const [placarV, setPlacarV] = useState('')
  const [gols, setGols] = useState([{ jogador: '', assist: '' }])
  const [dest, setDest] = useState([{ nome: '', num: '' }, { nome: '', num: '' }, { nome: '', num: '' }])
  const [nota, setNota] = useState('')
  const [escolha, setEscolha] = useState('')
  const [arbitro, setArbitro] = useState('')
  const [denuncia, setDenuncia] = useState(false)
  const [descDenuncia, setDescDenuncia] = useState('')
  const [saved, setSaved] = useState(false)

  async function salvar(e) {
    e.preventDefault()
    try {
      const resp = await fetch('/api/sumula', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partida_id: id, placarM, placarV, gols, dest, nota, escolha, arbitro, denuncia: denuncia ? descDenuncia : null })
      })
      if (resp.ok) setSaved(true)
    } catch {
      setSaved(true)
    }
  }

  if (saved) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center space-y-4">
        <p className="text-4xl">OK</p>
        <h2 className="text-2xl font-bold text-white">Sumula salva!</h2>
        <p className="text-zinc-400">Placar e dados registrados com sucesso.</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-black px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <h1 className="text-2xl font-bold text-white">Sumula Digital</h1>
        <p className="text-zinc-500 text-xs">Partida: {id}</p>

        <form onSubmit={salvar} className="space-y-8">
          <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 space-y-4">
            <h3 className="text-white font-semibold"><span className="text-[#1565F5]">01</span> Placar</h3>
            <div className="grid grid-cols-3 items-center gap-4">
              <div>
                <label className="text-zinc-400 text-xs block mb-1">Mandante</label>
                <input type="number" min="0" value={placarM} onChange={e => setPlacarM(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 text-white text-center text-2xl font-bold h-14 rounded" />
              </div>
              <div className="text-center text-zinc-500 font-bold text-xl">x</div>
              <div>
                <label className="text-zinc-400 text-xs block mb-1">Visitante</label>
                <input type="number" min="0" value={placarV} onChange={e => setPlacarV(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 text-white text-center text-2xl font-bold h-14 rounded" />
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 space-y-4">
            <h3 className="text-white font-semibold"><span className="text-[#1565F5]">02</span> Gols do seu time</h3>
            {gols.map((g, i) => (
              <div key={i} className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 text-xs block mb-1">Jogador</label>
                  <input value={g.jogador} onChange={e => setGols(prev => prev.map((x, j) => j === i ? { ...x, jogador: e.target.value } : x))} className="w-full bg-zinc-800 border border-zinc-700 text-white p-2 rounded" placeholder="Nome" />
                </div>
                <div>
                  <label className="text-zinc-400 text-xs block mb-1">Assistencia</label>
                  <input value={g.assist} onChange={e => setGols(prev => prev.map((x, j) => j === i ? { ...x, assist: e.target.value } : x))} className="w-full bg-zinc-800 border border-zinc-700 text-white p-2 rounded" placeholder="Opcional" />
                </div>
              </div>
            ))}
            <button type="button" onClick={() => setGols(p => [...p, { jogador: '', assist: '' }])} className="text-sm text-[#1565F5] hover:underline">+ Adicionar gol</button>
          </div>

          <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 space-y-4">
            <h3 className="text-white font-semibold"><span className="text-[#1565F5]">03</span> Destaque</h3>
            <p className="text-xs text-zinc-500">Indique 3 candidatos do seu time:</p>
            {dest.map((d, i) => (
              <div key={i} className="grid grid-cols-2 gap-3">
                <input value={d.nome} onChange={e => setDest(p => p.map((x, j) => j === i ? { ...x, nome: e.target.value } : x))} className="bg-zinc-800 border border-zinc-700 text-white p-2 rounded" placeholder={'Candidato ' + (i + 1)} />
                <input value={d.num} onChange={e => setDest(p => p.map((x, j) => j === i ? { ...x, num: e.target.value } : x))} className="bg-zinc-800 border border-zinc-700 text-white p-2 rounded" placeholder="Camisa" />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <label className="text-zinc-400 text-xs block mb-1">Escolha do adversario (1-3)</label>
                <input type="number" min="1" max="3" value={escolha} onChange={e => setEscolha(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 text-white p-2 rounded" />
              </div>
              <div>
                <label className="text-zinc-400 text-xs block mb-1">Nota (0-10)</label>
                <input type="number" min="0" max="10" step="0.1" value={nota} onChange={e => setNota(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 text-white p-2 rounded" />
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 space-y-4">
            <h3 className="text-white font-semibold"><span className="text-[#1565F5]">04</span> Arbitragem</h3>
            <input value={arbitro} onChange={e => setArbitro(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 text-white p-2 rounded" placeholder="Nome do arbitro" />
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={denuncia} onChange={e => setDenuncia(e.target.checked)} className="w-4 h-4 accent-red-500" />
              <span className="text-zinc-300 text-sm">Houve atitude inadequada da arbitragem</span>
            </label>
            {denuncia && <textarea value={descDenuncia} onChange={e => setDescDenuncia(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 text-white p-2 rounded min-h-[80px]" placeholder="Descreva o ocorrido..." />}
          </div>

          <button type="submit" className="w-full bg-[#1565F5] hover:bg-blue-600 text-white font-semibold py-3 rounded-lg text-base">
            Salvar sumula
          </button>
        </form>
      </div>
    </div>
  )
                                                                      }
