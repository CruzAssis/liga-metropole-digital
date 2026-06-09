// @ts-nocheck
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState, useEffect, type ChangeEvent, type FormEvent } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Spinner } from '@/components/AppSkeletons'

export const Route = createFileRoute('/signup')({
  component: SignupPage,
})

function SignupPage() {
  const navigate = useNavigate()
  const [checkingAuth, setCheckingAuth] = useState(true)
  const search = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
  const perfil = search.get('perfil')

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      if (data.user) {
        // User already logged in - redirect appropriately
        if (perfil === 'diretor') {
          navigate({ to: '/_authenticated/inscricao', replace: true })
        } else {
          navigate({ to: '/onboarding', replace: true })
        }
      } else {
        setCheckingAuth(false)
      }
    })()
  }, [])

  if (checkingAuth) return null
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    full_name: '',
    cpf: '',
    phone: '',
    email: '',
    password: '',
  })

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (form.cpf.length < 11) {
      toast.error('CPF deve ter 11 dÃ­gitos')
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          emailRedirectTo: window.location.origin + '/',
          data: {
            full_name: form.full_name,
            cpf: form.cpf,
            phone: form.phone,
          },
        },
      })
      if (error) throw error

      if (data.session) {
        toast.success('Conta criada! Agora escolha seu perfil.')
        navigate({ to: '/onboarding', replace: true })
      } else {
        toast.success('Conta criada! Verifique seu email para confirmar o cadastro.')
        navigate({ to: '/login', replace: true })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar conta'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link to="/" className="text-2xl font-bold text-white tracking-tight">Liga MetrÃ³pole</Link>
          <h2 className="mt-4 text-xl font-semibold text-zinc-200">Criar conta</h2>
          <p className="mt-1 text-sm text-zinc-400">Passo 1 de 2 â Dados bÃ¡sicos</p>
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
            <Label htmlFor="cpf" className="text-zinc-300">CPF (apenas nÃºmeros)</Label>
            <Input
              id="cpf"
              name="cpf"
              type="text"
              required
              maxLength={11}
              value={form.cpf}
              onChange={handleChange}
              className="mt-1 bg-zinc-900 border-zinc-700 text-white"
              placeholder="00000000000"
            />
          </div>

          <div>
            <Label htmlFor="phone" className="text-zinc-300">WhatsApp</Label>
            <Input
              id="phone"
              name="phone"
              type="text"
              required
              value={form.phone}
              onChange={handleChange}
              className="mt-1 bg-zinc-900 border-zinc-700 text-white"
              placeholder="11987654321"
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
              minLength={6}
              value={form.password}
              onChange={handleChange}
              className="mt-1 bg-zinc-900 border-zinc-700 text-white"
              placeholder="MÃ­nimo 6 caracteres"
            />
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
          JÃ¡ tem conta?{' '}
          <Link to="/login" className="text-blue-400 hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}
