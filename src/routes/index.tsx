// @ts-nocheck
import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <span className="text-lg font-bold tracking-tight">Liga Metrópole Várzea</span>
        <div className="flex items-center gap-3">
          <Link to="/ranking" className="text-sm text-zinc-400 hover:text-white transition-colors hidden sm:inline">Classificação</Link>
          <Link to="/login" className="text-sm text-zinc-400 hover:text-white transition-colors">Entrar</Link>
          <Link to="/signup" className="text-sm bg-[#1565F5] hover:bg-blue-600 text-white px-4 py-1.5 rounded-md font-medium transition-colors">Criar conta</Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-20">
        <div className="max-w-2xl mx-auto space-y-6">
          <p className="text-[#1565F5] text-sm font-semibold tracking-widest uppercase">TEMPORADA 2026</p>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight leading-tight">
            Metrópole<br />
            <span className="text-[#1565F5]">Várzea</span>
          </h1>
          <p className="text-zinc-400 text-lg max-w-lg mx-auto leading-relaxed">
            A liga oficial da várzea metropolitana. 80 times, dois grupos — Mandantes e Visitantes — uma temporada inteira de futebol de bairro.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link to="/signup" className="w-full sm:w-auto bg-[#1565F5] hover:bg-blue-600 text-white font-semibold px-8 py-3 rounded-lg text-base transition-colors text-center">
              Inscrever meu time
            </Link>
            <Link to="/ranking" className="w-full sm:w-auto border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white font-medium px-8 py-3 rounded-lg text-base transition-colors text-center">
              Ver classificação
            </Link>
          </div>
        </div>
      </main>

      {/* Como funciona */}
      <section className="border-t border-zinc-800 px-6 py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-2">Como funciona a liga</h2>
          <p className="text-zinc-400 text-center mb-10 max-w-xl mx-auto">
            Dois grupos fixos, vinte rodadas de pontos corridos e mata-mata para definir o campeão da várzea metropolitana.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">Grupo 1</div>
              <h3 className="text-xl font-bold mb-2">40 Mandantes</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Times que <strong className="text-white">têm campo fixo</strong> e mandam seus jogos em casa.
                Divididos em Lado A (20) e Lado B (20).
              </p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <div className="text-xs font-semibold text-purple-400 uppercase tracking-wider mb-2">Grupo 2</div>
              <h3 className="text-xl font-bold mb-2">40 Visitantes</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Times que <strong className="text-white">não têm campo fixo</strong> e jogam sempre como visitantes.
                Divididos em Lado A (20) e Lado B (20).
              </p>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-8">
            <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
              <span className="text-[#1565F5]">⚔</span> Regra de confronto
            </h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Mandantes enfrentam <strong className="text-white">apenas</strong> Visitantes.
              Alinhamento direto: Mandante Lado A × Visitante Lado A, Mandante Lado B × Visitante Lado B.
              Times do mesmo tipo nunca se enfrentam na fase regular.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <div className="text-2xl font-bold text-[#1565F5]">20 rodadas</div>
              <p className="text-zinc-400 text-sm mt-1">Fase regular em pontos corridos. V=3, E=1, D=0.</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <div className="text-2xl font-bold text-emerald-400">Top 8 → Playoff</div>
              <p className="text-zinc-400 text-sm mt-1">Os 8 melhores de cada ranking disputam quartas, semis e final.</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <div className="text-2xl font-bold text-red-400">31º–40º → Série B</div>
              <p className="text-zinc-400 text-sm mt-1">Últimos 10 de cada ranking são rebaixados na próxima temporada.</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-zinc-800 px-6 py-4 text-center">
        <p className="text-zinc-600 text-sm">© 2026 Liga Metrópole Várzea</p>
      </footer>
    </div>
  )
}
