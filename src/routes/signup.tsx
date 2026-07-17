// @ts-nocheck
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState, useEffect, type ChangeEvent, type FormEvent } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Spinner } from '@/components/AppSkeletons'
import { Shirt, Star, Users, Check } from 'lucide-react'

export const Route = createFileRoute('/signup')({
  component: SignupPage,
})

const PROFILES = [
  {
    key: 'jogador',
    icon: Shirt,
    label: 'Jogador',
    desc: 'Crie seu perfil de atleta e seja encontrado por times',
    color: 'border-blue-500',
    bg: 'bg-blue-500/10',
    selectedBg: 'bg-blue-500/20',
    iconColor: 'text-blue-400',
  },
  {
    key: 'diretor',
    icon: Star,
    label: 'Diretor',
    desc: 'Cadastre seu time e participe das competicoes',
    color: 'border-yellow-500',
    bg: 'bg-yellow-500/10',
    selectedBg: 'bg-yellow-500/20',
    iconColor: 'text-yellow-400',
  },
  {
    key: 'torcedor',
    icon: Users,
    label: 'Torcedor',
    desc: 'Acompanhe seu time favorito na liga',
    color: 'border-green-500',
    bg: 'bg-green-500/10',
    selectedBg: 'bg-green-500/20',
    iconColor: 'text-green-400',
  },
]

function SignupPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const search = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
  const perfilParam = search.get('perfil') || ''
  const [selectedPerfil, setSelectedPerfil] = useState(perfilParam)

  const [form, setForm] = useState({
    full_name: '',
    cpf: '',
    phone: '',
    email: '',
    password: '',
  })

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      if (data.user) {
        if (perfilParam === 'diretor') {
          navigate({ to: '/inscricao', replace: true })
        } else if (perfilParam === 'jogador') {
          navigate({ to: '/onboarding/jogador', replace: true })
        } else if (perfilParam === 'torcedor') {
          navigate({ to: '/onboarding/torcedor', replace: true })
        } else {
          navigate({ to: '/onboarding', replace: true })
        }
      } else {
        setCheckingAuth(false)
      }
    })()
  }, [])

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (form.cpf.length < 11) {
      toast.error('CPF invalido')
      return
    }
    if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(form.password)) {
      toast.error('A senha precisa ter no mínimo 8 caracteres, com letras e números.')
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            full_name: form.full_name,
            cpf: form.cpf.replace(/D/g, ''),
            phone: form.phone,
          },
        },
      })
      if (error) throw error

      // Garantir sessão ativa antes de redirecionar (idempotente com auto-confirm).
      let session = data.session
      if (!session) {
        try {
          const { data: signIn } = await supabase.auth.signInWithPassword({
            email: form.email,
            password: form.password,
          })
          session = signIn.session ?? null
        } catch {
          session = null
        }
      }
      if (!session) {
        // Aguarda o listener do onAuthStateChange propagar a sessão (até 2s).
        session = await new Promise((resolve) => {
          const sub = supabase.auth.onAuthStateChange((_e, s) => {
            if (s) {
              clearTimeout(timer)
              sub.data.subscription.unsubscribe()
              resolve(s)
            }
          })
          const timer = setTimeout(() => {
            sub.data.subscription.unsubscribe()
            resolve(null)
          }, 2000)
        })
      }

      // Redirecionamento consistente para a tela de Boas-vindas, independente do retorno.
      const perfil = selectedPerfil || perfilParam
      toast.success('Conta criada!')
      if (perfil === 'diretor') {
        navigate({ to: '/onboarding/diretor', replace: true })
      } else if (perfil === 'jogador') {
        navigate({ to: '/onboarding/jogador', replace: true })
      } else if (perfil === 'torcedor') {
        navigate({ to: '/onboarding/torcedor', replace: true })
      } else {
        navigate({ to: '/onboarding', replace: true })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar conta'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  if (checkingAuth) return null

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link to="/" className="text-2xl font-bold text-white tracking-tight">Liga Metropole</Link>
          <h2 className="mt-4 text-xl font-semibold text-zinc-200">Criar conta</h2>
          <p className="mt-1 text-sm text-zinc-400">Passo 1 de 2 - Dados basicos</p>
        </div>

        {/* Profile selector */}
        <div className="space-y-2">
          <p className="text-sm text-zinc-400 font-medium">Quero me cadastrar como:</p>
          <div className="grid grid-cols-3 gap-2">
            {PROFILES.map(p => {
              const Icon = p.icon
              const isSelected = selectedPerfil === p.key
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setSelectedPerfil(p.key)}
                  className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${isSelected ? p.color + ' ' + p.selectedBg : 'border-zinc-700 bg-zinc-900 hover:border-zinc-500'}`}
                >
                  {isSelected && <Check className="absolute top-1.5 right-1.5 h-3 w-3 text-white" />}
                  <Icon className={`h-5 w-5 ${isSelected ? p.iconColor : 'text-zinc-500'}`} />
                  <span className={`text-xs font-medium ${isSelected ? 'text-white' : 'text-zinc-400'}`}>{p.label}</span>
                </button>
              )
            })}
          </div>
          {selectedPerfil && (
            <p className="text-xs text-zinc-500 text-center">
              {PROFILES.find(p => p.key === selectedPerfil)?.desc}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label htmlFor="full_name" className="text-zinc-300">Nome completo</Label>
            <Input
              id="full_name"
              name="full_name"
              type="text"
              required
              value={form.full_name}
              onChange={handleChange}
              className="mt-1 bg-zinc-900 border-zinc-700 text-white"
              placeholder="Seu nome completo"
            />
          </div>
          <div>
            <Label htmlFor="cpf" className="text-zinc-300">CPF</Label>
            <Input
              id="cpf"
              name="cpf"
              type="text"
              required
              maxLength={14}
              value={form.cpf}
              onChange={handleChange}
              className="mt-1 bg-zinc-900 border-zinc-700 text-white"
              placeholder="000.000.000-00"
            />
          </div>
          <div>
            <Label htmlFor="phone" className="text-zinc-300">Telefone</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              value={form.phone}
              onChange={handleChange}
              className="mt-1 bg-zinc-900 border-zinc-700 text-white"
              placeholder="(11) 99999-9999"
            />
          </div>
          <div>
            <Label htmlFor="email" className="text-zinc-300">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              value={form.email}
              onChange={handleChange}
              className="mt-1 bg-zinc-900 border-zinc-700 text-white"
              placeholder="seu@email.com"
            />
          </div>
          <div>
            <Label htmlFor="password" className="text-zinc-300">Senha</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={handleChange}
              className="mt-1 bg-zinc-900 border-zinc-700 text-white"
              placeholder="Mínimo 8 caracteres"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Use no mínimo 8 caracteres, com letras e números.
            </p>
          </div>



          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1565F5] hover:bg-blue-600 text-white font-semibold"
          >
            {loading ? <Spinner /> : 'Continuar'}
          </Button>
        </form>

        <p className="text-center text-sm text-zinc-500">
          Ja tem conta?{' '}
          <Link to="/login" className="text-blue-400 hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
          }
