// @ts-nocheck
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/integrations/supabase/client'
import { MapPin, Trophy, Calendar, ChevronRight, Users, Shirt, Star, Menu, X, LayoutDashboard, User } from 'lucide-react'

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
  norte: 'Zona Norte', sul: 'Zona Sul', leste: 'Zona Leste', oeste: 'Zona Oeste', centro: 'Centro',
};

function HomePage() {
  const { user, loading, signOut } = useAuth()
  const navigate = useNavigate()
  const [activeConference, setActiveConference] = useState(null)
  const [recentMatches, setRecentMatches] = useState([])
  const [upcomingMatches, setUpcomingMatches] = useState([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase
        .from('competitions')
        .select('id, conference_name, subprefeitura, zona, name')
        .in('registration_status', ['open', 'draw_ready', 'active'])
        .order('created_at', { ascending: true })
        .limit(1)
      if (data && data.length > 0) setActiveConference(data[0])
    })()
  }, [])

  useEffect(() => {
    if (!user) return
    ;(async () => {
      const { data: rm } = await supabase
        .from('matches')
        .select('id, home_team, away_team, home_score, away_score, conference_name')
        .in('status', ['confirmed', 'closed'])
        .order('updated_at', { ascending: false })
        .limit(5)
      if (rm) setRecentMatches(rm)
      const { data: um } = await supabase
        .from('matches')
        .select('id, home_team, away_team, scheduled_at, conference_name, venue')
        .eq('status', 'scheduled')
        .order('scheduled_at', { ascending: true })
        .limit(5)
      if (um) setUpcomingMatches(um)
      // Check admin role
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
      if (roles && roles.some((r) => r.role === 'admin')) setIsAdmin(true)
    })()
  }, [user])

  const handleSignOut = async () => {
    await signOut()
    navigate({ to: '/', replace: true })
  }

  const conferenceLabel = activeConference?.conference_name ?? activeConference?.name ?? 'Conferencia Norte 1'
  const subprefeituraLabel = activeConference?.subprefeitura ?? 'Vila Maria/Vila Guilherme'
  const zonaLabel = activeConference?.zona ? (ZONA_LABELS[activeConference.zona] ?? '') : 'Zona Norte'

  const navLinks = [
    { to: '/ranking', label: 'Ranking' },
    { to: '/resultados', label: 'Resultados' },
    { to: '/agenda', label: 'Agenda' },
    { to: '/times', label: 'Times' },
    { to: '/atletas', label: 'Atletas' },
  ]

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* HEADER */}
      <header className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-zinc-800 sticky top-0 bg-black/95 backdrop-blur-sm z-50">
        <Link to="/" className="text-xl font-black tracking-tight text-white hover:text-zinc-200 transition-colors flex-shrink-0">
          Liga <span className="text-[#1565F5]">Metropole</span>
        </Link>

        {!loading && user ? (
          <>
            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1 mx-4">
              {navLinks.map(link => (
                <Link key={link.to} to={link.to} className="text-sm text-zinc-400 hover:text-white px-3 py-1.5 rounded-md hover:bg-zinc-800 transition-colors">
                  {link.label}
                </Link>
              ))}
              {isAdmin && (
                <Link to="/_authenticated/admin/dashboard" className="text-sm text-yellow-400 hover:text-yellow-300 px-3 py-1.5 rounded-md hover:bg-zinc-800 transition-colors flex items-center gap-1">
                  <LayoutDashboard className="h-3.5 w-3.5" />Painel Admin
                </Link>
              )}
            </nav>
            <div className="flex items-center gap-2">
              <Link to="/_authenticated/minha-conta" className="hidden md:flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white px-3 py-1.5 rounded-md hover:bg-zinc-800 transition-colors">
                <User className="h-4 w-4" />Minha Conta
              </Link>
              <button onClick={handleSignOut} className="hidden md:block text-sm text-zinc-500 hover:text-white px-3 py-1.5 rounded-md hover:bg-zinc-800 transition-colors">
                Sair
              </button>
              {/* Mobile menu toggle */}
              <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2 text-zinc-400 hover:text-white">
                {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </>
        ) : (
          !loading && (
            <Link to="/login" className="text-sm bg-[#1565F5] hover:bg-blue-600 text-white px-5 py-2 rounded-lg font-semibold transition-colors">
              Entrar
            </Link>
          )
        )}
      </header>

      {/* Mobile menu dropdown */}
      {menuOpen && user && (
        <div className="md:hidden bg-zinc-900 border-b border-zinc-800 px-4 py-3 space-y-1 z-40">
          {navLinks.map(link => (
            <Link key={link.to} to={link.to} onClick={() => setMenuOpen(false)} className="block text-sm text-zinc-300 hover:text-white py-2 px-3 rounded-md hover:bg-zinc-800 transition-colors">
              {link.label}
            </Link>
          ))}
          {isAdmin && (
            <Link to="/_authenticated/admin/dashboard" onClick={() => setMenuOpen(false)} className="flex items-center gap-1.5 text-sm text-yellow-400 hover:text-yellow-300 py-2 px-3 rounded-md hover:bg-zinc-800 transition-colors">
              <LayoutDashboard className="h-4 w-4" />Painel Admin
            </Link>
          )}
          <Link to="/_authenticated/minha-conta" onClick={() => setMenuOpen(false)} className="flex items-center gap-1.5 text-sm text-zinc-300 hover:text-white py-2 px-3 rounded-md hover:bg-zinc-800 transition-colors">
            <User className="h-4 w-4" />Minha Conta
          </Link>
          <button onClick={handleSignOut} className="w-full text-left text-sm text-zinc-500 hover:text-white py-2 px-3 rounded-md hover:bg-zinc-800 transition-colors">
            Sair
          </button>
        </div>
      )}

      {/* HERO */}
      <section className="flex flex-col items-center justify-center text-center px-4 py-16 md:py-24">
        <p className="text-[#1565F5] text-xs font-bold tracking-widest uppercase mb-4">TEMPORADA 2026</p>
        <div className="inline-flex items-center gap-2 bg-zinc-900 border border-zinc-700 rounded-full px-4 py-1.5 text-sm text-zinc-300 mb-8">
          <MapPin className="h-3.5 w-3.5 text-[#1565F5]" />
          <span className="font-medium text-white">{conferenceLabel}</span>
          <span className="text-zinc-500">-</span>
          <span>{subprefeituraLabel}</span>
          <span className="text-xs text-zinc-500 border-l border-zinc-700 pl-2 ml-1">{zonaLabel}</span>
        </div>
        <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-tight mb-6">
          METROPOLE<br /><span className="text-[#1565F5]">FUTEBOL</span>
        </h1>
        <p className="text-zinc-400 text-lg max-w-lg mx-auto leading-relaxed mb-10">
          A liga oficial do futebol amador metropolitano
        </p>

        {!loading && (
          user ? (
            <div className="w-full max-w-5xl mx-auto space-y-10 text-left">
              {recentMatches.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-[#1565F5]" />Ultimos Resultados
                    </h2>
                    <Link to="/resultados" className="text-sm text-[#1565F5] hover:underline flex items-center gap-1">
                      Ver todos <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                  <div className="space-y-3">
                    {recentMatches.map((m) => (
                      <div key={m.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between">
                        <div className="flex-1 text-right"><span className="font-semibold text-zinc-100 text-sm">{m.home_team}</span></div>
                        <div className="mx-4 text-center">
                          <span className="text-2xl font-bold text-white tabular-nums">{m.home_score ?? '-'} x {m.away_score ?? '-'}</span>
                          <p className="text-xs text-zinc-500 mt-0.5">{m.conference_name}</p>
                        </div>
                        <div className="flex-1 text-left"><span className="font-semibold text-zinc-100 text-sm">{m.away_team}</span></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {upcomingMatches.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-[#1565F5]" />Proximos Jogos
                    </h2>
                    <Link to="/agenda" className="text-sm text-[#1565F5] hover:underline flex items-center gap-1">
                      Ver agenda <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                  <div className="space-y-3">
                    {upcomingMatches.map((m) => {
                      const dt = new Date(m.scheduled_at)
                      const dateStr = dt.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
                      const timeStr = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                      return (
                        <div key={m.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-[#1565F5] font-medium">{m.conference_name}</span>
                            <span className="text-xs text-zinc-400">{dateStr} - {timeStr}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-zinc-100 text-sm">{m.home_team}</span>
                            <span className="text-zinc-600 font-bold text-lg mx-3">x</span>
                            <span className="font-semibold text-zinc-100 text-sm text-right">{m.away_team}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              {recentMatches.length === 0 && upcomingMatches.length === 0 && (
                <p className="text-zinc-500 text-center py-8">Nenhum jogo disponivel no momento.</p>
              )}
            </div>
          ) : (
            <div className="w-full max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-5 px-4">
              <div className="flex flex-col bg-zinc-950 border-2 border-blue-600 rounded-2xl p-8 text-center hover:border-blue-400 hover:bg-zinc-900 transition-all group">
                <div className="w-14 h-14 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-5">
                  <Shirt className="h-7 w-7 text-blue-400" />
                </div>
                <span className="text-xs font-bold tracking-widest text-blue-400 uppercase mb-2">Cadastro como Jogador</span>
                <h3 className="text-xl font-black text-white mb-3 leading-tight">FACA PARTE DO JOGO!<br /><span className="text-blue-400">CRIE SEU PERFIL DE ATLETA</span></h3>
                <p className="text-zinc-400 text-sm mb-8 flex-1">Registre seus dados, escolha sua posicao e fique disponivel para os times da sua regiao.</p>
                <Link to="/signup" search={{ perfil: 'jogador' }} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl transition-colors text-sm uppercase tracking-wide">
                  Quero ser jogador
                </Link>
              </div>
              <div className="flex flex-col bg-zinc-950 border-2 border-yellow-600 rounded-2xl p-8 text-center hover:border-yellow-400 hover:bg-zinc-900 transition-all group md:scale-105 md:shadow-2xl">
                <div className="w-14 h-14 bg-yellow-600/20 rounded-full flex items-center justify-center mx-auto mb-5">
                  <Star className="h-7 w-7 text-yellow-400" />
                </div>
                <span className="text-xs font-bold tracking-widest text-yellow-400 uppercase mb-2">Cadastro como Diretor</span>
                <h3 className="text-xl font-black text-white mb-3 leading-tight">LIDERE SEU TIME!<br /><span className="text-yellow-400">CADASTRE SUA EQUIPE NA LIGA</span></h3>
                <p className="text-zinc-400 text-sm mb-8 flex-1">Inscreva seu clube, gerencie o elenco e dispute as conferencias da sua subprefeitura.</p>
                <Link to="/signup" search={{ perfil: 'diretor' }} className="w-full bg-yellow-600 hover:bg-yellow-500 text-black font-bold py-3 px-6 rounded-xl transition-colors text-sm uppercase tracking-wide">
                  Inscrever meu time
                </Link>
              </div>
              <div className="flex flex-col bg-zinc-950 border-2 border-green-600 rounded-2xl p-8 text-center hover:border-green-400 hover:bg-zinc-900 transition-all group">
                <div className="w-14 h-14 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-5">
                  <Users className="h-7 w-7 text-green-400" />
                </div>
                <span className="text-xs font-bold tracking-widest text-green-400 uppercase mb-2">Cadastro como Torcedor</span>
                <h3 className="text-xl font-black text-white mb-3 leading-tight">TORCA PELO SEU CLUBE!<br /><span className="text-green-400">FIQUE POR DENTRO DE TUDO</span></h3>
                <p className="text-zinc-400 text-sm mb-8 flex-1">Acompanhe resultados, tabelas e proximos jogos do seu time favorito na liga.</p>
                <Link to="/signup" search={{ perfil: 'torcedor' }} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-6 rounded-xl transition-colors text-sm uppercase tracking-wide">
                  Quero torcer
                </Link>
              </div>
            </div>
          )
        )}

        {!loading && !user && (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
            <Link to="/ranking" className="border border-zinc-700 hover:border-zinc-400 text-zinc-300 hover:text-white font-semibold px-8 py-3 rounded-xl transition-colors text-sm">
              Ver classificacao
            </Link>
            <Link to="/agenda" className="border border-zinc-700 hover:border-zinc-400 text-zinc-300 hover:text-white font-semibold px-8 py-3 rounded-xl transition-colors text-sm">
              Ver agenda
            </Link>
          </div>
        )}
      </section>

      <footer className="border-t border-zinc-800 px-6 py-4 text-center mt-auto">
        <p className="text-zinc-600 text-sm">2026 Liga Metropole</p>
      </footer>
    </div>
  )
    }
