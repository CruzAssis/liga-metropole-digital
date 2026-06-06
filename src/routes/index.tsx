// @ts-nocheck
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/integrations/supabase/client'
import { MapPin } from 'lucide-react'

export const Route = createFileRoute('/')({
  component: HomePage,
})

type ActiveConference = {
  id: string;
  conference_name: string | null;
  subprefeitura: string | null;
  zona: string | null;
  name: string;
};

const ZONA_LABELS: Record<string, string> = {
  norte: "Zona Norte", sul: "Zona Sul", leste: "Zona Leste", oeste: "Zona Oeste", centro: "Centro",
};

function HomePage() {
  const { user, loading, signOut } = useAuth()
  const navigate = useNavigate()
  const [activeConference, setActiveConference] = useState<ActiveConference | null>(null)

  // Load the active (open or in-progress) conference — default to Norte 1
  useEffect(() => {
    (async () => {
      // Try to find the currently active/open Norte 1 conference first
      const { data } = await supabase
        .from('competitions')
        .select('id, conference_name, subprefeitura, zona, name')
        .in('registration_status', ['open', 'draw_ready', 'active'])
        .order('created_at', { ascending: true })
        .limit(1)
      if (data && data.length > 0) {
        setActiveConference(data[0] as ActiveConference)
      }
    })()
  }, [])

  const handleSignOut = async () => {
    await signOut()
    navigate({ to: '/', replace: true })
  }

  const conferenceLabel = activeConference?.conference_name
    ?? activeConference?.name
    ?? 'Conferência Norte 1'
  const subprefeituraLabel = activeConference?.subprefeitura ?? 'Vila Maria/Vila Guilherme'
  const zonaLabel = activeConference?.zona ? ZONA_LABELS[activeConference.zona] ?? '' : 'Zona Norte'

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <span className="text-lg font-bold tracking-tight">Liga Metrópole</span>
        <div className="flex items-center gap-3">
          <Link to="/ranking" className="text-sm text-zinc-400 hover:text-white transition-colors hidden sm:inline">Classificação</Link>
          {!loading && (
            user ? (
              <button
                onClick={handleSignOut}
                className="text-sm text-zinc-400 hover:text-white transition-colors"
              >
                Sair
              </button>
            ) : (
              <>
                <Link to="/login" className="text-sm text-zinc-400 hover:text-white transition-colors">Entrar</Link>
                <Link to="/signup" className="text-sm bg-[#1565F5] hover:bg-blue-600 text-white px-4 py-1.5 rounded-md font-medium transition-colors">Criar conta</Link>
              </>
            )
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-20">
        <div className="max-w-2xl mx-auto space-y-6">
          <p className="text-[#1565F5] text-sm font-semibold tracking-widest uppercase">TEMPORADA 2026</p>

          {/* Active Conference Badge */}
          <div className="inline-flex items-center gap-2 bg-zinc-900 border border-zinc-700 rounded-full px-4 py-1.5 text-sm text-zinc-300">
            <MapPin className="h-3.5 w-3.5 text-[#1565F5]" />
            <span className="font-medium text-white">{conferenceLabel}</span>
            <span className="text-zinc-500">—</span>
            <span>{subprefeituraLabel}</span>
            <span className="text-xs text-zinc-500 border-l border-zinc-700 pl-2 ml-1">{zonaLabel}</span>
          </div>

          <h1 className="text-5xl md:text-6xl font-black tracking-tight leading-tight">
            Metrópole<br />
            <span className="text-[#1565F5]">Futebol</span>
          </h1>
          <p className="text-zinc-400 text-lg max-w-lg mx-auto leading-relaxed">
            A liga oficial do futebol amador metropolitano. Conferências por subprefeitura de São Paulo — times do seu bairro, jogando perto de você.
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
            32 conferências, uma por subprefeitura de São Paulo. Cada conferência tem seus próprios times, regras e calendário.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { zona: "Zona Norte", count: "7", color: "text-blue-400" },
              { zona: "Zona Leste", count: "12", color: "text-emerald-400" },
              { zona: "Zona Sul", count: "9", color: "text-yellow-400" },
              { zona: "Zona Oeste + Centro", count: "4", color: "text-purple-400" },
            ].map((z) => (
              <div key={z.zona} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
                <div className={`text-2xl font-bold ${z.color}`}>{z.count}</div>
                <div className="text-xs text-zinc-400 mt-1">{z.zona}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">Conferência Norte 1 (piloto)</div>
              <h3 className="text-xl font-bold mb-2">Vila Maria / Vila Guilherme</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                80 times · 40 Mandantes + 40 Visitantes · Lado A e B · 20 rodadas de pontos corridos.
              </p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Demais conferências</div>
              <h3 className="text-xl font-bold mb-2">Configuração própria</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Cada subprefeitura tem seu número de vagas e regras definidas pelo admin. Inscreva seu time na conferência da sua região.
              </p>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-8">
            <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
              <span className="text-[#1565F5]">vs</span> Regra de confronto (Norte 1)
            </h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Mandantes enfrentam <strong className="text-white">apenas</strong> Visitantes.
              Alinhamento direto: Mandante Lado A × Visitante Lado A, Mandante Lado B × Visitante Lado B.
              Times do mesmo tipo nunca se enfrentam na fase regular.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <div className="text-2xl font-bold text-[#1565F5]">32 conferências</div>
              <p className="text-zinc-400 text-sm mt-1">Uma por subprefeitura de São Paulo.</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <div className="text-2xl font-bold text-emerald-400">Top 8 Playoff</div>
              <p className="text-zinc-400 text-sm mt-1">Os 8 melhores de cada ranking disputam quartas, semis e final.</p>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <div className="text-2xl font-bold text-red-400">31 ao 40 Série B</div>
              <p className="text-zinc-400 text-sm mt-1">Últimos 10 de cada ranking são rebaixados na próxima temporada.</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-zinc-800 px-6 py-4 text-center">
        <p className="text-zinc-600 text-sm">2026 Liga Metrópole</p>
      </footer>
    </div>
  )
  }
