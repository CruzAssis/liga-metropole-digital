import { createFileRoute, useParams, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { BrandLogo } from '@/components/BrandLogo'
import { AlertCircle } from 'lucide-react'

export const Route = createFileRoute('/manifesto/$slug')({
  head: () => ({
    meta: [
      { title: 'Manifesto — Liga Metrópole' },
      {
        name: 'description',
        content:
          'Manifesto da Liga Metrópole: a tecnologia servindo à paixão da várzea. Dado que vira troféu. Flyer que vira reconhecimento. História que vira memória.',
      },
      { property: 'og:title', content: 'Manifesto — Liga Metrópole' },
      {
        property: 'og:description',
        content:
          'Você foi convidado porque o seu time não é apenas um nome em uma súmula — é um pilar desse movimento. Seja um Clube Fundador.',
      },
      { property: 'og:type', content: 'article' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
  }),
  component: ManifestoPage,
  errorComponent: ManifestoError,
  notFoundComponent: ManifestoNotFound,
})

type Team = {
  id: string
  name: string
  short_name: string | null
  logo_url: string | null
  primary_color: string | null
}

function ManifestoPage() {
  const { slug } = useParams({ from: '/manifesto/$slug' })
  const [team, setTeam] = useState<Team | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error: err } = await supabase
        .from('teams')
        .select('id, name, short_name, logo_url, primary_color')
        .eq('slug', slug)
        .maybeSingle()
      if (cancelled) return
      if (err) {
        setError('Não conseguimos carregar o clube. Tente novamente em instantes.')
      } else if (!data) {
        setError('Clube não encontrado.')
      } else {
        setTeam(data as Team)
      }
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [slug])

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-zinc-400">
        Carregando manifesto...
      </div>
    )
  }

  if (error || !team) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-md">
          <AlertCircle className="mx-auto h-10 w-10 text-red-400" />
          <p className="text-red-400 text-sm">{error || 'Clube não encontrado.'}</p>
          <Link to="/" className="inline-block text-sm text-[#1565F5] hover:underline">
            Voltar para o início
          </Link>
        </div>
      </div>
    )
  }

  return <ManifestoContent team={team} />
}

function ManifestoContent({ team }: { team: Team }) {
  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Faixa superior azul royal — assinatura visual da marca */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#1565F5]" aria-hidden />

      {/* Grão sutil radial no fundo (azul royal muito translúcido) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(circle at 20% 0%, rgba(21,101,245,0.18), transparent 55%), radial-gradient(circle at 90% 100%, rgba(21,101,245,0.10), transparent 60%)',
        }}
      />

      <article className="relative max-w-2xl mx-auto px-6 py-16 sm:py-20">
        {/* Header: logos harmonizados */}
        <header className="flex items-center justify-between gap-6 mb-14">
          <div className="flex flex-col items-center gap-2">
            {team.logo_url ? (
              <img
                src={team.logo_url}
                alt={`Emblema ${team.name}`}
                className="h-16 w-16 sm:h-20 sm:w-20 object-contain"
                draggable={false}
              />
            ) : (
              <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 font-bold text-xs">
                {team.short_name ?? team.name.slice(0, 3).toUpperCase()}
              </div>
            )}
            <span className="text-[10px] uppercase tracking-widest text-zinc-500">
              Clube Fundador
            </span>
          </div>

          <div
            className="flex-1 h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent"
            aria-hidden
          />

          <div className="flex flex-col items-center gap-2">
            <BrandLogo className="h-16 w-auto sm:h-20" />
            <span className="text-[10px] uppercase tracking-widest text-zinc-500">
              Liga Metrópole
            </span>
          </div>
        </header>

        {/* Eyebrow + saudação personalizada */}
        <p className="text-xs uppercase tracking-[0.3em] text-[#1565F5] font-semibold mb-3">
          Manifesto — Convite ao {team.name}
        </p>
        <h1 className="text-3xl sm:text-4xl font-black leading-tight mb-10">
          <span className="text-white">{team.name}</span>
          <span className="text-zinc-500">,</span>{' '}
          <span className="text-zinc-300">o futebol de várzea é, antes de tudo,</span>{' '}
          <span className="text-[#1565F5]">um ato de resistência.</span>
        </h1>

        {/* Corpo do manifesto */}
        <div className="space-y-6 text-zinc-200 text-base sm:text-lg leading-relaxed">
          <p>
            É aqui, nos campos de terra e grama da nossa Subprefeitura, que batem os corações
            mais puros do futebol paulistano.
          </p>
          <p>
            A Liga Metrópole não nasce para ser apenas uma tabela de jogos. Nascemos para ser o{' '}
            <strong className="text-white">arquivo da sua história</strong> e o{' '}
            <strong className="text-white">holofote do seu talento</strong>. Acreditamos que
            cada gol marcado, cada defesa impossível e cada rodada organizada por um diretor
            apaixonado merece ser vista, registrada e celebrada.
          </p>
          <p className="text-white font-semibold">
            Nosso propósito é claro: dar visibilidade a quem a história esqueceu.
          </p>

          {/* Pilares */}
          <div className="space-y-4 border-l-2 border-[#1565F5] pl-5 py-1">
            <div>
              <p className="text-white font-bold">Competitividade Real</p>
              <p className="text-zinc-300">
                Organizamos o caos em conferências, transformando a várzea na vitrine que ela
                sempre deveria ter sido.
              </p>
            </div>
            <div>
              <p className="text-white font-bold">Caça de Talentos</p>
              <p className="text-zinc-300">
                Os dados não mentem. Vamos mostrar para o mundo a estatística, o craque da
                partida e o talento que, até hoje, estava escondido nos nossos bairros.
              </p>
            </div>
            <div>
              <p className="text-white font-bold">Legado</p>
              <p className="text-zinc-300">
                Queremos documentar a vida de cada clube, a luta de cada diretor e o que cada
                camisa representa para sua comunidade. Queremos mostrar do que a várzea é
                feita: de garra, de sangue e de sonho.
              </p>
            </div>
          </div>

          <p>
            A Liga Metrópole é a <strong className="text-white">tecnologia servindo à paixão</strong>.
            É o dado que vira troféu, é o flyer que vira reconhecimento, é a sua história virando
            memória.
          </p>

          {/* Bloco de destaque final */}
          <div className="mt-10 rounded-xl border border-[#1565F5]/40 bg-[#1565F5]/5 p-6">
            <p className="text-zinc-200">
              <span className="text-white font-semibold">{team.name}</span>, você foi convidado
              porque o seu time não é apenas um nome em uma súmula — é um{' '}
              <strong className="text-white">pilar desse movimento</strong>.
            </p>
            <p className="mt-3 text-xl sm:text-2xl font-black text-white">
              Seja um <span className="text-[#1565F5]">Clube Fundador</span>.
            </p>
          </div>
        </div>

        {/* Assinatura híbrida */}
        <footer className="mt-16 pt-8 border-t border-zinc-800">
          <p className="text-white font-bold text-lg tracking-wide">
            Diretoria Liga Metrópole
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Gestão: Shelder &amp; Kabelo (Índio)
          </p>
        </footer>
      </article>
    </div>
  )
}

function ManifestoError() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="text-center space-y-3">
        <AlertCircle className="mx-auto h-10 w-10 text-red-400" />
        <p className="text-red-400 text-sm">Não conseguimos carregar este manifesto.</p>
        <Link to="/" className="text-[#1565F5] text-sm hover:underline">
          Voltar para o início
        </Link>
      </div>
    </div>
  )
}

function ManifestoNotFound() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="text-center space-y-3">
        <AlertCircle className="mx-auto h-10 w-10 text-zinc-500" />
        <p className="text-zinc-400 text-sm">Clube não encontrado.</p>
        <Link to="/" className="text-[#1565F5] text-sm hover:underline">
          Voltar para o início
        </Link>
      </div>
    </div>
  )
}
