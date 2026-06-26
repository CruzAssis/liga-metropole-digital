// @ts-nocheck
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Spinner } from '@/components/AppSkeletons'
import { Users, Trophy, Heart } from 'lucide-react'
import { assignSelfRoles } from '@/lib/onboarding.functions'

export const Route = createFileRoute('/onboarding')({
  component: OnboardingPage,
})

const PROFILES = [
  {
    key: 'director',
    icon: Trophy,
    title: 'Sou Diretor',
    description: 'Quero cadastrar um time e participar das competições.',
    color: 'border-blue-500 bg-blue-500/10',
    selectedColor: 'border-blue-400 bg-blue-500/25 ring-2 ring-blue-500',
  },
  {
    key: 'player',
    icon: Users,
    title: 'Sou Jogador',
    description: 'Quero criar meu perfil de atleta e ser encontrado por times.',
    color: 'border-green-500 bg-green-500/10',
    selectedColor: 'border-green-400 bg-green-500/25 ring-2 ring-green-500',
  },
  {
    key: 'supporter',
    icon: Heart,
    title: 'Sou Torcedor',
    description: 'Quero torcer por um time e acompanhar os jogos.',
    color: 'border-red-500 bg-red-500/10',
    selectedColor: 'border-red-400 bg-red-500/25 ring-2 ring-red-500',
  },
]

function OnboardingPage() {
  const navigate = useNavigate()
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const assignRoles = useServerFn(assignSelfRoles)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        navigate({ to: '/login', replace: true })
      } else {
        setUserId(data.user.id)
      }
    })
  }, [])

  function toggleProfile(key: string) {
    setSelected(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  async function handleContinue() {
    if (selected.length === 0) {
      toast.error('Selecione pelo menos um perfil')
      return
    }
    if (!userId) return
    setLoading(true)
    try {
      // Assign roles via server function (RLS prevents direct client insert)
      await assignRoles({ data: { roles: selected as ('director' | 'player' | 'supporter')[] } })


      toast.success('Perfil salvo!')

      // Navigate based on selections - priority: director > player > supporter
      if (selected.includes('director')) {
        navigate({ to: '/onboarding/diretor', replace: true })
      } else if (selected.includes('player')) {
        navigate({ to: '/onboarding/jogador', replace: true })
      } else {
        navigate({ to: '/onboarding/torcedor', replace: true })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar perfil'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Como você quer participar?</h1>
          <p className="mt-2 text-sm text-zinc-400">Passo 2 de 2 — Escolha seu perfil (pode escolher mais de um)</p>
        </div>

        <div className="space-y-4">
          {PROFILES.map(profile => {
            const Icon = profile.icon
            const isSelected = selected.includes(profile.key)
            return (
              <button
                key={profile.key}
                onClick={() => toggleProfile(profile.key)}
                className={`w-full flex items-start gap-4 p-5 rounded-xl border-2 text-left transition-all cursor-pointer ${isSelected ? profile.selectedColor : profile.color}`}
              >
                <div className="mt-0.5">
                  <Icon className={`h-6 w-6 ${isSelected ? 'text-white' : 'text-zinc-400'}`} />
                </div>
                <div>
                  <h3 className={`font-semibold text-base ${isSelected ? 'text-white' : 'text-zinc-300'}`}>{profile.title}</h3>
                  <p className={`text-sm mt-1 ${isSelected ? 'text-zinc-200' : 'text-zinc-500'}`}>{profile.description}</p>
                </div>
                {isSelected && (
                  <div className="ml-auto mt-0.5 h-5 w-5 rounded-full bg-white flex items-center justify-center flex-shrink-0">
                    <svg className="h-3 w-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            )
          })}
        </div>

        <Button
          onClick={handleContinue}
          disabled={loading || selected.length === 0}
          className="w-full bg-[#1565F5] hover:bg-blue-600 text-white font-semibold py-3 text-base"
        >
          {loading ? <Spinner /> : 'Continuar'}
        </Button>

        <button
          onClick={() => navigate({ to: '/minha-conta', replace: true })}
          className="w-full text-center text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Pular por agora
        </button>
      </div>
    </div>
  )
}
