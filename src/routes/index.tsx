// @ts-nocheck
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { supabase } from '@/integrations/supabase/client'
import { Trophy, Calendar, ChevronRight, Menu, X, LayoutDashboard, User, Instagram, Mail, MessageCircle, FileText, ShieldCheck, ClipboardList, BarChart3, Users, MapPin, Sparkles, ArrowRight, Check } from 'lucide-react'
import { useRouterState } from '@tanstack/react-router'
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
    return <PublicHome
      leagueName={leagueName}
      season={season}
      tagline={tagline}
      formatDesc={formatDesc}
      whatsapp={whatsapp}
      instagram={instagram}
      rulesUrl={rulesUrl}
      contactEmail={contactEmail}
    />
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
            Temporada {season} · Zona Norte
          </span>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-4 text-white">
            Bem-vindo de volta à <span className="text-[#4C9BFF]">{leagueName}</span>
          </h1>
          <p className="text-zinc-300 max-w-2xl mx-auto text-sm md:text-base leading-relaxed">
            {tagline || 'A liga que valoriza a história da várzea. Aqui cada gol vira estatística, cada partida vira legado e cada clube conquista sua vitrine.'}
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
              <p className="text-sm text-foreground/90 mt-1">{formatDesc}</p>
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

          {/* Canais oficiais */}
          {(whatsapp || instagram || rulesUrl || contactEmail) && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs">
              {whatsapp && (
                <a href={`https://wa.me/${whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-black/50 backdrop-blur px-3 py-1.5 text-foreground/90 hover:text-primary">
                  <MessageCircle className="h-3.5 w-3.5" />WhatsApp
                </a>
              )}
              {instagram && (
                <a href={`https://instagram.com/${instagram.replace('@','')}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-black/50 backdrop-blur px-3 py-1.5 text-foreground/90 hover:text-primary">
                  <Instagram className="h-3.5 w-3.5" />{instagram.startsWith('@') ? instagram : `@${instagram}`}
                </a>
              )}
              {rulesUrl && (
                <a href={rulesUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-black/50 backdrop-blur px-3 py-1.5 text-foreground/90 hover:text-primary">
                  <FileText className="h-3.5 w-3.5" />Regulamento
                </a>
              )}
              {contactEmail && (
                <a href={`mailto:${contactEmail}`} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-black/50 backdrop-blur px-3 py-1.5 text-foreground/90 hover:text-primary">
                  <Mail className="h-3.5 w-3.5" />{contactEmail}
                </a>
              )}
            </div>
          )}
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
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-zinc-600 text-sm flex-wrap">
          <span>© {new Date().getFullYear()} {leagueName}</span>
          <span className="hidden sm:inline">·</span>
          <Link to="/privacidade" className="hover:text-zinc-400 transition-colors">Privacidade</Link>
          <span>·</span>
          <Link to="/termos" className="hover:text-zinc-400 transition-colors">Termos</Link>
          {contactEmail && (<><span>·</span><a href={`mailto:${contactEmail}`} className="hover:text-zinc-400 transition-colors">{contactEmail}</a></>)}
          {instagram && (<><span>·</span><a href={`https://instagram.com/${instagram.replace('@','')}`} target="_blank" rel="noreferrer" className="hover:text-zinc-400 transition-colors">{instagram.startsWith('@') ? instagram : `@${instagram}`}</a></>)}
        </div>
      </footer>

    </div>
  )
}

// ============== PUBLIC HOME COMPONENT ==============
function PublicHome({
  leagueName, season, tagline, formatDesc, whatsapp, instagram, rulesUrl, contactEmail,
}: {
  leagueName: string; season: string; tagline?: string; formatDesc: string;
  whatsapp?: string; instagram?: string; rulesUrl?: string; contactEmail?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  const navLinks = [
    { to: '/ranking', label: 'Ranking' },
    { to: '/times', label: 'Times' },
    { to: '/atletas', label: 'Atletas' },
    { to: '/agenda', label: 'Agenda' },
  ]

  const features = [
    { icon: ClipboardList, title: 'Súmula digital', desc: 'Placar, gols e destaques lançados no app — validação cruzada entre diretores.' },
    { icon: ShieldCheck, title: 'ID Metrópole', desc: 'Perfil verificado por atleta com histórico oficial, estatísticas e destaques.' },
    { icon: BarChart3, title: 'Ranking em tempo real', desc: 'Classificação automática por conferência e ranking de craques por avaliação.' },
    { icon: Users, title: 'Torcida engajada', desc: 'Torcedores acompanham o clube, votam em destaques e recebem notícias da liga.' },
  ]

  const steps = [
    { n: '01', title: 'Inscreva seu time', desc: 'Diretor cadastra o clube em 2 minutos — nome, subprefeitura, lado e mando.' },
    { n: '02', title: 'Monte o elenco', desc: 'Envie o link de convite. Cada atleta cria seu ID Metrópole verificado.' },
    { n: '03', title: 'Jogue e registre', desc: 'Placar e gols entram na súmula digital. Ranking e estatísticas atualizam sozinhos.' },
  ]

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: '#09090B', color: '#FAFAFA' }}>
      {/* NAVBAR */}
      <nav
        role="banner"
        className="sticky top-0 z-50 flex items-center justify-between px-4 md:px-8 h-16"
        style={{
          background: 'rgba(9,9,11,0.85)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid #27272A',
        }}
      >
        <Link to="/" aria-label="Liga Metrópole — Início" className="flex items-center gap-2 shrink-0">
          <BrandLogo className="h-9 w-auto" />
          <span className="font-black tracking-tight text-sm hidden sm:inline">
            <span className="text-white">LIGA</span>{' '}
            <span className="text-[#1565F5]">METRÓPOLE</span>
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-1" role="navigation" aria-label="Navegação principal">
          {navLinks.map((l) => {
            const active = pathname === l.to
            return (
              <Link
                key={l.to}
                to={l.to}
                aria-current={active ? 'page' : undefined}
                className="relative px-4 py-2 text-sm font-medium rounded-md transition-colors hover:text-white"
                style={{ color: active ? '#FFFFFF' : '#A1A1AA' }}
              >
                {l.label}
                {active && (
                  <span aria-hidden className="absolute left-3 right-3 -bottom-[1px] h-[2px] rounded-full" style={{ background: '#1565F5' }} />
                )}
              </Link>
            )
          })}
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/login"
            className="hidden sm:inline-flex px-3 py-2 text-sm font-semibold rounded-md transition-colors hover:bg-white/5"
            style={{ color: '#FAFAFA' }}
          >
            Entrar
          </Link>
          <Link
            to="/signup"
            search={{ perfil: 'diretor' }}
            className="hidden md:inline-flex px-4 py-2 text-sm font-bold rounded-md transition-all hover:brightness-110 hover:scale-[1.02]"
            style={{ background: '#1565F5', color: '#FFFFFF', boxShadow: '0 6px 20px rgba(21,101,245,0.35)' }}
          >
            Inscrever time
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="md:hidden inline-flex items-center justify-center h-10 w-10 rounded-md text-zinc-300 hover:bg-white/5"
            aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className="md:hidden border-b px-4 py-3 space-y-1" style={{ background: '#0B0B0F', borderColor: '#27272A' }}>
          {navLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setMenuOpen(false)}
              className="block px-3 py-3 text-sm font-medium rounded-md hover:bg-white/5"
              style={{ color: pathname === l.to ? '#FFFFFF' : '#A1A1AA' }}
            >
              {l.label}
            </Link>
          ))}
          <Link
            to="/login"
            onClick={() => setMenuOpen(false)}
            className="block px-3 py-3 text-sm font-semibold rounded-md hover:bg-white/5 text-white sm:hidden"
          >
            Entrar
          </Link>
          <Link
            to="/signup"
            search={{ perfil: 'diretor' }}
            onClick={() => setMenuOpen(false)}
            className="block text-center px-4 py-3 mt-1 text-sm font-bold rounded-md"
            style={{ background: '#1565F5', color: '#FFFFFF' }}
          >
            Inscrever time
          </Link>
        </div>
      )}

      {/* HERO */}
      <HeroCarousel />

      {/* STATS — social proof */}
      <AnimatedStats />

      {/* BENEFÍCIOS — por que a Liga */}
      <section className="px-4 md:px-8 py-16 md:py-24 border-t" style={{ borderColor: '#18181B' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 md:mb-14">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-widest mb-4"
              style={{ background: 'rgba(21,101,245,0.12)', border: '1px solid rgba(21,101,245,0.35)', color: '#93BBFF' }}>
              <Sparkles className="h-3 w-3" /> Feito para a várzea profissional
            </span>
            <h2 className="font-black tracking-tight text-white text-3xl md:text-5xl" style={{ letterSpacing: '-0.02em' }}>
              Tudo que a sua liga <span style={{ color: '#4C9BFF' }}>merece</span>.
            </h2>
            <p className="mt-4 text-zinc-400 max-w-2xl mx-auto text-sm md:text-base leading-relaxed">
              Da súmula digital ao ranking oficial — a Liga Metrópole transforma cada rodada em legado documentado para o clube e para o atleta.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((f) => (
              <div
                key={f.title}
                className="group relative rounded-2xl p-6 transition-all hover:-translate-y-1"
                style={{ background: '#111114', border: '1px solid #1F1F23' }}
              >
                <div className="inline-flex items-center justify-center h-11 w-11 rounded-xl mb-4"
                  style={{ background: 'rgba(21,101,245,0.15)', border: '1px solid rgba(21,101,245,0.35)' }}>
                  <f.icon className="h-5 w-5" style={{ color: '#4C9BFF' }} />
                </div>
                <h3 className="text-white font-bold text-base mb-1.5">{f.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FORMATO */}
      <section className="px-4 md:px-8 py-16 md:py-24 border-t" style={{ borderColor: '#18181B', background: '#0B0B0F' }}>
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: '#4C9BFF' }}>
              Formato da temporada {season}
            </span>
            <h2 className="mt-3 font-black text-white text-3xl md:text-4xl" style={{ letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              32 subprefeituras. <br />
              <span style={{ color: '#4C9BFF' }}>Pontos corridos</span> + mata-mata.
            </h2>
            <p className="mt-4 text-zinc-400 text-sm md:text-base leading-relaxed max-w-lg">
              {formatDesc}
            </p>

            <ul className="mt-6 space-y-3">
              {[
                'Turno único por conferência (Lado A / Lado B)',
                'Súmula digital com validação cruzada entre diretores',
                'Ranking oficial e ranking de craques atualizados a cada rodada',
                'Mata-mata final entre os melhores classificados',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-zinc-300">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                    style={{ background: 'rgba(21,101,245,0.2)', border: '1px solid rgba(21,101,245,0.4)' }}>
                    <Check className="h-3 w-3" style={{ color: '#4C9BFF' }} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { k: '32', label: 'Subprefeituras elegíveis' },
              { k: '2', label: 'Conferências (Lado A e B)' },
              { k: '40', label: 'Clubes por conferência' },
              { k: '1', label: 'Turno + mata-mata final' },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl p-6 text-center"
                style={{ background: '#111114', border: '1px solid #1F1F23' }}>
                <div className="font-black text-white text-4xl md:text-5xl tabular-nums" style={{ letterSpacing: '-0.03em' }}>
                  {s.k}
                </div>
                <div className="mt-2 text-[11px] uppercase tracking-widest text-zinc-500 font-semibold">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section className="px-4 md:px-8 py-16 md:py-24 border-t" style={{ borderColor: '#18181B' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 md:mb-14">
            <h2 className="font-black tracking-tight text-white text-3xl md:text-5xl" style={{ letterSpacing: '-0.02em' }}>
              Do cadastro ao pódio em <span style={{ color: '#4C9BFF' }}>3 passos</span>.
            </h2>
          </div>

          <ol className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {steps.map((s) => (
              <li key={s.n} className="relative rounded-2xl p-6 md:p-8"
                style={{ background: '#111114', border: '1px solid #1F1F23' }}>
                <div className="font-black text-6xl md:text-7xl tabular-nums leading-none opacity-30"
                  style={{ color: '#1565F5', letterSpacing: '-0.04em' }}>
                  {s.n}
                </div>
                <h3 className="mt-4 text-white font-bold text-lg">{s.title}</h3>
                <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{s.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="px-4 md:px-8 py-16 md:py-24 border-t" style={{ borderColor: '#18181B' }}>
        <div className="max-w-4xl mx-auto text-center relative overflow-hidden rounded-3xl p-8 md:p-14"
          style={{
            background: 'radial-gradient(ellipse at top, rgba(21,101,245,0.25) 0%, rgba(9,9,11,0) 60%), #0B0B0F',
            border: '1px solid rgba(21,101,245,0.35)',
          }}>
          <MapPin className="h-8 w-8 mx-auto mb-4" style={{ color: '#4C9BFF' }} />
          <h2 className="font-black text-white text-3xl md:text-5xl" style={{ letterSpacing: '-0.02em', lineHeight: 1.05 }}>
            Garanta a vaga do seu clube <br className="hidden sm:inline" /> como <span style={{ color: '#4C9BFF' }}>fundador</span>.
          </h2>
          <p className="mt-4 text-zinc-300 max-w-xl mx-auto text-sm md:text-base leading-relaxed">
            Vagas limitadas de clubes fundadores com acesso vitalício. Cadastre em 2 minutos e valide os dados depois.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/signup"
              search={{ perfil: 'diretor' }}
              className="inline-flex items-center justify-center gap-2 rounded-lg font-bold uppercase tracking-wider transition-all hover:brightness-110 hover:scale-[1.02] w-full sm:w-auto"
              style={{
                background: '#1565F5', color: '#FFFFFF', padding: '16px 32px', fontSize: 14,
                letterSpacing: '0.05em', boxShadow: '0 10px 40px rgba(21,101,245,0.5)',
              }}
            >
              Inscrever meu time <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/times"
              className="inline-flex items-center justify-center gap-2 rounded-lg font-semibold text-sm w-full sm:w-auto"
              style={{
                background: 'transparent', color: '#FAFAFA',
                padding: '16px 28px', border: '1px solid #27272A',
              }}
            >
              Ver clubes já inscritos
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="px-6 py-8 text-center mt-auto border-t" style={{ borderColor: '#18181B' }}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <BrandLogo className="h-6 w-auto" />
            <span className="text-xs text-zinc-500">© {new Date().getFullYear()} {leagueName}</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs" style={{ color: '#71717A' }}>
            <Link to="/privacidade" className="hover:text-zinc-300 transition-colors">Privacidade</Link>
            <Link to="/termos" className="hover:text-zinc-300 transition-colors">Termos</Link>
            {rulesUrl && <a href={rulesUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-zinc-300"><FileText className="h-3 w-3" />Regulamento</a>}
            {contactEmail && <a href={`mailto:${contactEmail}`} className="inline-flex items-center gap-1 hover:text-zinc-300"><Mail className="h-3 w-3" />{contactEmail}</a>}
            {instagram && <a href={`https://instagram.com/${instagram.replace('@','')}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-zinc-300"><Instagram className="h-3 w-3" />{instagram.startsWith('@') ? instagram : `@${instagram}`}</a>}
            {whatsapp && <a href={`https://wa.me/${whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-zinc-300"><MessageCircle className="h-3 w-3" />WhatsApp</a>}
          </div>
        </div>
      </footer>
    </div>
  )
}

