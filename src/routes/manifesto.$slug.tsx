import { createFileRoute, useParams, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { ManifestoContent } from '@/components/ManifestoContent'
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
      // 1) Manifesto salvo (fonte principal)
      const { data: m, error: mErr } = await (supabase.from('manifestos' as never) as any)
        .select('team_name, logo_url')
        .eq('slug', slug)
        .maybeSingle()
      if (cancelled) return
      if (!mErr && m) {
        setTeam({
          id: slug,
          name: m.team_name,
          short_name: null,
          logo_url: m.logo_url,
          primary_color: null,
        })
        setLoading(false)
        return
      }
      // 2) Fallback: time cadastrado com esse slug
      const { data, error: err } = await supabase
        .from('teams')
        .select('id, name, short_name, logo_url, primary_color')
        .eq('slug', slug)
        .maybeSingle()
      if (cancelled) return
      if (err) {
        setError('Não conseguimos carregar o clube. Tente novamente em instantes.')
      } else if (!data) {
        setError('Manifesto não encontrado.')
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
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        Carregando manifesto...
      </div>
    )
  }

  if (error || !team) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-md">
          <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
          <p className="text-destructive text-sm">{error || 'Clube não encontrado.'}</p>
          <Link to="/" className="inline-block text-sm text-primary hover:underline">
            Voltar para o início
          </Link>
        </div>
      </div>
    )
  }

  return <ManifestoContent team={team} />
}




function ManifestoError() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center space-y-3">
        <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
        <p className="text-destructive text-sm">Não conseguimos carregar este manifesto.</p>
        <Link to="/" className="text-primary text-sm hover:underline">
          Voltar para o início
        </Link>
      </div>
    </div>
  )
}

function ManifestoNotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center space-y-3">
        <AlertCircle className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">Clube não encontrado.</p>
        <Link to="/" className="text-primary text-sm hover:underline">
          Voltar para o início
        </Link>
      </div>
    </div>
  )
}
