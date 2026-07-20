// @ts-nocheck
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/integrations/supabase/client'
import { Trophy, Calendar, ChevronRight, Menu, X, LayoutDashboard, User, Instagram, Mail, MessageCircle, FileText } from 'lucide-react'
import { BrandLogo } from '@/components/BrandLogo'
import AnimatedStats from '@/components/home/AnimatedStats'
import HeroCarousel from '@/components/home/HeroCarousel'
import { useLeagueConfig } from '@/hooks/use-league-config'


export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  const { user, loading, signOut } = useAuth()
  const navigate = useNavigate()
  const cfg = useLeagueConfig()
  const leagueName = cfg?.league_name || 'Liga Metrópole'
  const season = cfg?.season || '2026'
  const tagline = cfg?.tagline
  const formatDesc = cfg?.format_description || '32 subprefeituras, todas em pontos corridos e mata-mata no final.'
  const whatsapp = cfg?.whatsapp
  const instagram = cfg?.instagram
  const rulesUrl = cfg?.rules_url
  const contactEmail = cfg?.contact_email
  const [recentMatches, setRecentMatches] = useState([])
  const [upcomingMatches, setUpcomingMatches] = useState([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)


  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      const matchSelect =
        'id, host_score, visitor_score, scheduled_at, venue, status,' +
        ' host:teams!matches_host_team_id_fkey(name, short_name),' +
        ' visitor:teams!matches_visitor_team_id_fkey(name, short_name),' +
        ' competition:competitions(conference_name, name)'

      const mapRow = (m: any) => ({
        id: m.id,
        home_team: m.host?.short_name ?? m.host?.name ?? '—',
        away_team: m.visitor?.short_name ?? m.visitor?.name ?? '—',
        home_score: m.host_score,
        away_score: m.visitor_score,
        scheduled_at: m.scheduled_at,
        venue: m.venue,
        conference_name: m.competition?.conference_name ?? m.competition?.name ?? '',
      })

      const [{ data: rm, error: rmErr }, { data: um, error: umErr }, { data: roles }] = await Promise.all([
        supabase
          .from('matches')
          .select(matchSelect)
          .eq('status', 'confirmed')
          .order('scheduled_at', { ascending: false })
          .limit(5),
        supabase
          .from('matches')
          .select(matchSelect)
          .eq('status', 'scheduled')
          .order('scheduled_at', { ascending: true })
          .limit(5),
        supabase.from('user_roles').select('role').eq('user_id', user.id),
      ])
      if (cancelled) return
      if (rmErr) console.error('recentMatches', rmErr)
      if (umErr) console.error('upcomingMatches', umErr)
      if (rm) setRecentMatches(rm.map(mapRow))
      if (um) setUpcomingMatches(um.map(mapRow))
      if (roles && roles.some((r) => r.role === 'admin')) setIsAdmin(true)
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  const handleSignOut = async () => {
    await signOut()
    navigate({ to: '/', replace: true })
  }

  // ============== PUBLIC (UNAUTHENTICATED) HOME ==============
  if (!loading && !user) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: '#09090B', color: '#FAFAFA' }}>
        {/* NAVBAR */}
        <nav
          className="sticky top-0 z-50 flex items-center justify-between px-4 md:px-8 h-16"
          style={{
            background: 'rgba(9,9,11,0.95)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid #27272A',
          }}
        >
          <Link to="/" aria-label="Liga Metrópole" className="flex items-center gap-2">
            <BrandLogo className="h-9 w-auto" />
            <span className="font-black tracking-tight text-sm hidden sm:inline">
              <span className="text-white">LIGA</span>{' '}
              <span className="text-[#1565F5]">METRÓPOLE</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            <Link to="/ranking" className="px-4 py-2 text-sm font-medium rounded-md transition-colors" style={{ color: '#A1A1AA' }}>
              Ranking
            </Link>
            <Link to="/times" className="px-4 py-2 text-sm font-medium rounded-md transition-colors" style={{ color: '#A1A1AA' }}>
              Times
            </Link>
            <Link to="/atletas" className="px-4 py-2 text-sm font-medium rounded-md transition-colors" style={{ color: '#A1A1AA' }}>
              Atletas
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="px-4 py-2 text-sm font-semibold rounded-md transition-colors"
              style={{ color: '#FAFAFA' }}
            >
              Entrar
            </Link>
            <Link
              to="/signup"
              search={{ perfil: 'diretor' }}
              className="hidden md:inline-flex px-4 py-2 text-sm font-bold rounded-md transition-all hover:brightness-110"
              style={{ background: '#1565F5', color: '#FFFFFF' }}
            >
              Inscrever time
            </Link>
          </div>
        </nav>

        {/* HERO */}
        <HeroCarousel />


        {/* STATS */}
        <AnimatedStats />

        {/* FOOTER */}
        <footer
          className="px-6 py-6 text-center mt-auto"
          style={{ borderTop: '1px solid #27272A' }}
        >
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-sm" style={{ color: '#52525B' }}>
            <span>© {new Date().getFullYear()} {leagueName}</span>
            <span className="hidden sm:inline">·</span>
            <Link to="/privacidade" className="hover:text-zinc-300 transition-colors">Privacidade</Link>
            <span>·</span>
            <Link to="/termos" className="hover:text-zinc-300 transition-colors">Termos</Link>
            {contactEmail && (<><span>·</span><a href={`mailto:${contactEmail}`} className="hover:text-zinc-300 transition-colors">{contactEmail}</a></>)}
            {instagram && (<><span>·</span><a href={`https://instagram.com/${instagram.replace('@','')}`} target="_blank" rel="noreferrer" className="hover:text-zinc-300 transition-colors">{instagram.startsWith('@') ? instagram : `@${instagram}`}</a></>)}
          </div>
        </footer>

      </div>
    )
  }

  // ============== AUTHENTICATED HOME (unchanged behavior) ==============
  const navLinks = [
    { to: '/ranking', label: 'Ranking' },
    { to: '/resultados', label: 'Resultados' },
    { to: '/agenda', label: 'Agenda' },
    { to: '/times', label: 'Times' },
    { to: '/atletas', label: 'Atletas' },
  ]

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <header className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-zinc-800 sticky top-0 bg-black/95 backdrop-blur-sm z-50">
        <Link to="/" aria-label="Liga Metrópole" className="flex items-center gap-2">
          <BrandLogo className="h-9 w-auto" />
          <span className="font-black tracking-tight text-sm hidden sm:inline">
            <span className="text-white">LIGA</span>{' '}
            <span className="text-[#1565F5]">METRÓPOLE</span>
          </span>
        </Link>

        {!loading && user && (
          <>
            <nav className="hidden md:flex items-center gap-1 mx-4">
              {navLinks.map(link => (
                <Link key={link.to} to={link.to} className="text-sm text-zinc-400 hover:text-white px-3 py-1.5 rounded-md hover:bg-zinc-800 transition-colors">
                  {link.label}
                </Link>
              ))}
              {isAdmin && (
                <Link to="/admin/dashboard" className="text-sm text-yellow-400 hover:text-yellow-300 px-3 py-1.5 rounded-md hover:bg-zinc-800 transition-colors flex items-center gap-1">
                  <LayoutDashboard className="h-3.5 w-3.5" />Painel Admin
                </Link>
              )}
            </nav>
            <div className="flex items-center gap-2">
              <Link to="/minha-conta" className="hidden md:flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white px-3 py-1.5 rounded-md hover:bg-zinc-800 transition-colors">
                <User className="h-4 w-4" />Minha Conta
              </Link>
              <button onClick={handleSignOut} className="hidden md:block text-sm text-zinc-500 hover:text-white px-3 py-1.5 rounded-md hover:bg-zinc-800 transition-colors">
                Sair
              </button>
              <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2 text-zinc-400 hover:text-white">
                {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </>
        )}
      </header>

      {menuOpen && user && (
        <div className="md:hidden bg-zinc-900 border-b border-zinc-800 px-4 py-3 space-y-1 z-40">
          {navLinks.map(link => (
            <Link key={link.to} to={link.to} onClick={() => setMenuOpen(false)} className="block text-sm text-zinc-300 hover:text-white py-2 px-3 rounded-md hover:bg-zinc-800 transition-colors">
              {link.label}
            </Link>
          ))}
          {isAdmin && (
            <Link to="/admin/dashboard" onClick={() => setMenuOpen(false)} className="flex items-center gap-1.5 text-sm text-yellow-400 hover:text-yellow-300 py-2 px-3 rounded-md hover:bg-zinc-800 transition-colors">
              <LayoutDashboard className="h-4 w-4" />Painel Admin
            </Link>
          )}
          <Link to="/minha-conta" onClick={() => setMenuOpen(false)} className="flex items-center gap-1.5 text-sm text-zinc-300 hover:text-white py-2 px-3 rounded-md hover:bg-zinc-800 transition-colors">
            <User className="h-4 w-4" />Minha Conta
          </Link>
          <button onClick={handleSignOut} className="w-full text-left text-sm text-zinc-500 hover:text-white py-2 px-3 rounded-md hover:bg-zinc-800 transition-colors">
            Sair
          </button>
        </div>
      )}

      {/* Hero de boas-vindas com imagem de fundo + filtro preto */}
      <section
        className="relative isolate overflow-hidden w-full"
        style={{
          backgroundImage: `url(/__l5e/assets-v1/d438b335-8cbb-4ede-a9d5-743b72546a9f/home-bg.png)`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div aria-hidden className="absolute inset-0 bg-black/75" />
        <div className="relative z-10 max-w-5xl mx-auto px-4 py-12 md:py-16 text-center">
          <span className="inline-flex items-center gap-1.5 mb-4 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-widest"
            style={{ background: 'rgba(21,101,245,0.18)', border: '1px solid rgba(21,101,245,0.45)', color: '#93BBFF' }}>
            Temporada 2026 · Zona Norte
          </span>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-4 text-white">
            Bem-vindo de volta à <span className="text-[#4C9BFF]">Liga Metrópole</span>
          </h1>
          <p className="text-zinc-300 max-w-2xl mx-auto text-sm md:text-base leading-relaxed">
            A liga que valoriza a história da várzea. Aqui cada gol vira estatística,
            cada partida vira legado e cada clube conquista sua vitrine.
          </p>

          {/* Cards úteis */}
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3 text-left">
            <Link to="/agenda" className="card-hover rounded-xl bg-black/60 backdrop-blur border border-border p-4">
              <Calendar className="h-5 w-5 text-primary mb-2" />
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Próximos jogos</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">Ver agenda</p>
            </Link>
            <Link to="/ranking" className="card-hover rounded-xl bg-black/60 backdrop-blur border border-border p-4">
              <Trophy className="h-5 w-5 text-primary mb-2" />
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Classificação</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">Ranking geral</p>
            </Link>
            <Link to="/times" className="card-hover rounded-xl bg-black/60 backdrop-blur border border-border p-4">
              <LayoutDashboard className="h-5 w-5 text-primary mb-2" />
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Clubes fundadores</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">Ver times</p>
            </Link>
            <Link to="/atletas" className="card-hover rounded-xl bg-black/60 backdrop-blur border border-border p-4">
              <User className="h-5 w-5 text-primary mb-2" />
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Atletas registrados</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">Ver atletas</p>
            </Link>
          </div>

          {/* Info rápida sobre a liga */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3 text-left">
            <div className="rounded-xl bg-black/50 backdrop-blur border border-border p-4">
              <p className="text-xs uppercase tracking-wider text-primary font-semibold">Formato</p>
              <p className="text-sm text-foreground/90 mt-1">32 subprefeituras, todas em pontos corridos e mata-mata no final.</p>
            </div>
            <div className="rounded-xl bg-black/50 backdrop-blur border border-border p-4">
              <p className="text-xs uppercase tracking-wider text-primary font-semibold">Súmula digital</p>
              <p className="text-sm text-foreground/90 mt-1">Diretores lançam placar, gols e destaques direto pelo app após cada jogo.</p>
            </div>
            <div className="rounded-xl bg-black/50 backdrop-blur border border-border p-4">
              <p className="text-xs uppercase tracking-wider text-primary font-semibold">ID Metrópole</p>
              <p className="text-sm text-foreground/90 mt-1">Cada atleta ganha um perfil verificado com histórico e estatísticas oficiais.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col items-center text-center px-4 py-12 md:py-16 w-full max-w-5xl mx-auto">

        <div className="w-full space-y-10 text-left">
          {recentMatches.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-primary" />Últimos Resultados
                </h2>
                <Link to="/resultados" className="text-sm text-primary hover:underline flex items-center gap-1">
                  Ver todos <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="space-y-3">
                {recentMatches.map((m) => (
                  <div key={m.id} className="card-hover bg-card border border-border rounded-xl p-4 flex items-center justify-between">
                    <div className="flex-1 text-right"><span className="font-semibold text-foreground text-sm">{m.home_team}</span></div>
                    <div className="mx-4 text-center">
                      <span className="text-2xl font-bold text-foreground tabular-nums">{m.home_score ?? '-'} x {m.away_score ?? '-'}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">{m.conference_name}</p>
                    </div>
                    <div className="flex-1 text-left"><span className="font-semibold text-foreground text-sm">{m.away_team}</span></div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {upcomingMatches.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />Próximos Jogos
                </h2>
                <Link to="/agenda" className="text-sm text-primary hover:underline flex items-center gap-1">
                  Ver agenda <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="space-y-3">
                {upcomingMatches.map((m) => {
                  const dt = new Date(m.scheduled_at)
                  const dateStr = dt.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
                  const timeStr = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                  return (
                    <div key={m.id} className="card-hover bg-card border border-border rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-primary font-medium">{m.conference_name}</span>
                        <span className="text-xs text-muted-foreground">{dateStr} - {timeStr}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground text-sm">{m.home_team}</span>
                        <span className="text-muted-foreground font-bold text-lg mx-3">x</span>
                        <span className="font-semibold text-foreground text-sm text-right">{m.away_team}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {recentMatches.length === 0 && upcomingMatches.length === 0 && (
            <p className="text-muted-foreground text-center py-8">Nenhum jogo disponível no momento.</p>
          )}
        </div>
      </section>

      <footer className="border-t border-zinc-800 px-6 py-4 text-center mt-auto">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-zinc-600 text-sm">
          <span>© 2026 Liga Metrópole</span>
          <span className="hidden sm:inline">·</span>
          <Link to="/privacidade" className="hover:text-zinc-400 transition-colors">Privacidade</Link>
          <span>·</span>
          <Link to="/termos" className="hover:text-zinc-400 transition-colors">Termos</Link>
        </div>
      </footer>
    </div>
  )
}
