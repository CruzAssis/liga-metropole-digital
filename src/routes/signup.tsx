// @ts-nocheck
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState, useEffect, type ChangeEvent, type FormEvent } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Spinner } from '@/components/AppSkeletons'
import { Shirt, Star, Users, Check, ArrowLeft } from 'lucide-react'
import { safeInternalPath } from '@/lib/public-url'
import { assignSelfRoles } from '@/lib/onboarding.functions'


export const Route = createFileRoute('/signup')({
  component: SignupPage,
})

const PROFILES = [
  { key: 'jogador', icon: Shirt, label: 'Jogador', desc: 'Crie seu perfil de atleta e seja encontrado por times', color: 'border-blue-500', selectedBg: 'bg-blue-500/20', iconColor: 'text-blue-400' },
  { key: 'diretor', icon: Star, label: 'Diretor', desc: 'Cadastre seu time e participe das competições', color: 'border-yellow-500', selectedBg: 'bg-yellow-500/20', iconColor: 'text-yellow-400' },
  { key: 'torcedor', icon: Users, label: 'Torcedor', desc: 'Acompanhe seu time favorito na liga', color: 'border-green-500', selectedBg: 'bg-green-500/20', iconColor: 'text-green-400' },
]

const POSICOES = ['Goleiro', 'Zagueiro', 'Lateral', 'Volante', 'Meia', 'Atacante']

function maskPhone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

function SignupPage() {
  const navigate = useNavigate()
  const assignRoles = useServerFn(assignSelfRoles)
  const [loading, setLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const search = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
  const perfilParam = search.get('perfil') || ''
  const redirectTo = safeInternalPath(search.get('redirect'), '')

  const [step, setStep] = useState(perfilParam ? 2 : 1)
  const [perfil, setPerfil] = useState(perfilParam)

  const [form, setForm] = useState({
    full_name: '',
    whatsapp: '',
    email: '',
    password: '',
    // jogador
    nickname: '',
    position: '',
    date_of_birth: '',
    // diretor
    club_name: '',
    director_role: '',
  })

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      if (data.user) {
        if (redirectTo) window.location.replace(redirectTo)
        else navigate({ to: '/minha-conta', replace: true })
      } else {
        setCheckingAuth(false)
      }
    })()
  }, [])

  function handleChange(e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: name === 'whatsapp' ? maskPhone(value) : value }))
  }

  function selectPerfil(key: string) {
    setPerfil(key)
    setStep(2)
  }

  function goToStep3() {
    if (!form.full_name.trim()) return toast.error('Informe seu nome completo')
    if (form.whatsapp.replace(/\D/g, '').length < 10) return toast.error('Informe um WhatsApp válido')
    if (!form.email.trim()) return toast.error('Informe seu email')
    if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(form.password)) return toast.error('Senha: mín. 8 caracteres com letras e números')
    if (perfil === 'torcedor') {
      handleSubmit()
      return
    }
    setStep(3)
  }

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault()
    // Validate step 3
    if (perfil === 'jogador') {
      if (!form.nickname.trim()) return toast.error('Informe seu apelido (nome de craque)')
      if (!form.position) return toast.error('Selecione sua posição preferida')
      if (!form.date_of_birth) return toast.error('Informe sua data de nascimento')
    }
    if (perfil === 'diretor') {
      if (!form.club_name.trim()) return toast.error('Informe o nome do clube')
      if (!form.director_role.trim()) return toast.error('Informe seu cargo')
    }

    setLoading(true)
    try {
      const meta: Record<string, string> = {
        full_name: form.full_name.trim(),
        whatsapp: form.whatsapp,
        profile_type: perfil,
      }
      if (perfil === 'jogador') {
        meta.nickname = form.nickname.trim()
        meta.position = form.position
        meta.date_of_birth = form.date_of_birth
      }
      if (perfil === 'diretor') {
        meta.club_name = form.club_name.trim()
        meta.director_role = form.director_role.trim()
      }

      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: meta },
      })
      if (error) throw error

      let session = data.session
      if (!session) {
        try {
          const { data: signIn } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password })
          session = signIn.session ?? null
        } catch { session = null }
      }

      // Persist chosen role so /onboarding can auto-skip and sub-flows have RLS access
      if (session) {
        const roleMap: Record<string, 'director' | 'player' | 'supporter'> = {
          diretor: 'director',
          jogador: 'player',
          torcedor: 'supporter',
        }
        const roleKey = roleMap[perfil]
        if (roleKey) {
          try { await assignRoles({ data: { roles: [roleKey] } }) } catch {}
        }
      }

      toast.success('Conta criada!')
      if (redirectTo) {
        window.location.replace(redirectTo)
        return
      }
      if (perfil === 'diretor') navigate({ to: '/onboarding/diretor', replace: true })
      else if (perfil === 'jogador') navigate({ to: '/onboarding/jogador', replace: true })
      else if (perfil === 'torcedor') navigate({ to: '/onboarding/torcedor', replace: true })
      else navigate({ to: '/onboarding', replace: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar conta'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  if (checkingAuth) return null

  const totalSteps = perfil === 'torcedor' ? 2 : 3

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link to="/" className="text-2xl font-bold text-white tracking-tight">Liga Metrópole</Link>
          <h2 className="mt-4 text-xl font-semibold text-zinc-200">Criar conta</h2>
          {step > 1 && (
            <p className="mt-1 text-sm text-zinc-400">Passo {step - 1} de {totalSteps - 1}</p>
          )}
        </div>

        {/* Progress bar */}
        {step > 1 && (
          <div className="flex gap-2">
            {Array.from({ length: totalSteps - 1 }).map((_, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < step - 1 ? 'bg-[#1565F5]' : 'bg-zinc-800'}`} />
            ))}
          </div>
        )}

        {/* STEP 1: Perfil */}
        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-zinc-400 text-center">Como você quer entrar na Liga?</p>
            {PROFILES.map(p => {
              const Icon = p.icon
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => selectPerfil(p.key)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 border-zinc-700 bg-zinc-900 hover:${p.color} transition-all text-left`}
                >
                  <Icon className={`h-6 w-6 ${p.iconColor}`} />
                  <div className="flex-1">
                    <p className="font-semibold text-white">{p.label}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">{p.desc}</p>
                  </div>
                </button>
              )
            })}
            <p className="text-center text-sm text-zinc-500 pt-4">
              Já tem conta?{' '}
              <Link to="/login" className="text-blue-400 hover:underline">Entrar</Link>
            </p>
          </div>
        )}

        {/* STEP 2: Dados básicos */}
        {step === 2 && (
          <form onSubmit={(e) => { e.preventDefault(); goToStep3() }} className="space-y-4">
            <button type="button" onClick={() => setStep(1)} className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white">
              <ArrowLeft className="h-3 w-3" /> Trocar perfil ({PROFILES.find(p => p.key === perfil)?.label})
            </button>

            <div>
              <Label htmlFor="full_name" className="text-zinc-300">Nome completo</Label>
              <Input id="full_name" name="full_name" required value={form.full_name} onChange={handleChange} className="mt-1 bg-zinc-900 border-zinc-700 text-white" placeholder="Seu nome completo" />
            </div>
            <div>
              <Label htmlFor="whatsapp" className="text-zinc-300">WhatsApp</Label>
              <Input id="whatsapp" name="whatsapp" type="tel" required value={form.whatsapp} onChange={handleChange} className="mt-1 bg-zinc-900 border-zinc-700 text-white" placeholder="(11) 99999-9999" />
            </div>
            <div>
              <Label htmlFor="email" className="text-zinc-300">Email</Label>
              <Input id="email" name="email" type="email" required value={form.email} onChange={handleChange} className="mt-1 bg-zinc-900 border-zinc-700 text-white" placeholder="seu@email.com" />
            </div>
            <div>
              <Label htmlFor="password" className="text-zinc-300">Senha</Label>
              <Input id="password" name="password" type="password" required minLength={8} value={form.password} onChange={handleChange} className="mt-1 bg-zinc-900 border-zinc-700 text-white" placeholder="Mínimo 8 caracteres" />
              <p className="mt-1 text-xs text-zinc-500">Use no mínimo 8 caracteres, com letras e números.</p>
            </div>

            <Button type="submit" disabled={loading} className="w-full bg-[#1565F5] hover:bg-blue-600 text-white font-semibold">
              {loading ? <Spinner /> : (perfil === 'torcedor' ? 'Criar conta' : 'Continuar')}
            </Button>
          </form>
        )}

        {/* STEP 3: Dados específicos */}
        {step === 3 && perfil === 'jogador' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <button type="button" onClick={() => setStep(2)} className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white">
              <ArrowLeft className="h-3 w-3" /> Voltar
            </button>
            <p className="text-sm text-zinc-400">Conte um pouco sobre você como atleta</p>
            <div>
              <Label htmlFor="nickname" className="text-zinc-300">Apelido (Nome de craque)</Label>
              <Input id="nickname" name="nickname" required value={form.nickname} onChange={handleChange} className="mt-1 bg-zinc-900 border-zinc-700 text-white" placeholder="Como te chamam em campo" />
            </div>
            <div>
              <Label htmlFor="position" className="text-zinc-300">Posição preferida</Label>
              <select id="position" name="position" required value={form.position} onChange={handleChange} className="w-full mt-1 bg-zinc-900 border border-zinc-700 text-white rounded-md px-3 py-2 text-sm">
                <option value="">Selecione...</option>
                {POSICOES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="date_of_birth" className="text-zinc-300">Data de nascimento</Label>
              <Input id="date_of_birth" name="date_of_birth" type="date" required value={form.date_of_birth} onChange={handleChange} className="mt-1 bg-zinc-900 border-zinc-700 text-white" />
            </div>

            <Button type="submit" disabled={loading} className="w-full bg-[#1565F5] hover:bg-blue-600 text-white font-semibold">
              {loading ? <Spinner /> : 'Criar conta'}
            </Button>
          </form>
        )}

        {step === 3 && perfil === 'diretor' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <button type="button" onClick={() => setStep(2)} className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white">
              <ArrowLeft className="h-3 w-3" /> Voltar
            </button>
            <p className="text-sm text-zinc-400">Conte sobre o clube que você representa</p>
            <div>
              <Label htmlFor="club_name" className="text-zinc-300">Nome do clube</Label>
              <Input id="club_name" name="club_name" required value={form.club_name} onChange={handleChange} className="mt-1 bg-zinc-900 border-zinc-700 text-white" placeholder="Ex: EC Metrópole" />
            </div>
            <div>
              <Label htmlFor="director_role" className="text-zinc-300">Seu cargo no clube</Label>
              <Input id="director_role" name="director_role" required value={form.director_role} onChange={handleChange} className="mt-1 bg-zinc-900 border-zinc-700 text-white" placeholder="Ex: Presidente, Treinador, Diretor" />
            </div>

            <Button type="submit" disabled={loading} className="w-full bg-[#1565F5] hover:bg-blue-600 text-white font-semibold">
              {loading ? <Spinner /> : 'Criar conta'}
            </Button>
          </form>
        )}

        {step > 1 && (
          <p className="text-center text-sm text-zinc-500">
            Já tem conta?{' '}
            <Link to="/login" className="text-blue-400 hover:underline">Entrar</Link>
          </p>
        )}
      </div>
    </div>
  )
}
