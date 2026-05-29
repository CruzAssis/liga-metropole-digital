import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { supabase } from '~/integrations/supabase/client'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Checkbox } from '~/components/ui/checkbox'
import { useToast } from '~/hooks/use-toast'

export const Route = createFileRoute('/signup')({
  component: SignupPage,
})

function SignupPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ full_name: '', cpf: '', phone: '', email: '', password: '' })
  const [perfis, setPerfis] = useState({ is_diretor: false, is_jogador: false, is_torcedor: false })

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  function handlePerfil(key: keyof typeof perfis, val: boolean) {
    setPerfis(prev => ({ ...prev, [key]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!perfis.is_diretor && !perfis.is_jogador && !perfis.is_torcedor) {
      toast({ title: 'Selecione ao menos um perfil', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { full_name: form.full_name, cpf: form.cpf, phone: form.phone, ...perfis } },
      })
      if (error) throw error
      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          nome_completo: form.full_name,
          cpf: form.cpf,
          telefone: form.phone,
          ...perfis,
        })
      }
      toast({ title: 'Conta criada com sucesso!' })
      navigate({ to: perfis.is_diretor ? '/inscricao' : '/' })
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao criar conta', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link to="/" className="text-2xl font-bold text-white tracking-tight">Liga Metropole Varzea</Link>
          <h2 className="mt-4 text-xl font-semibold text-white">Criar conta</h2>
          <p className="mt-1 text-sm text-zinc-400">Preencha seus dados para comecar.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-4">
            <div>
              <Label htmlFor="full_name" className="text-zinc-300">Nome completo</Label>
              <Input id="full_name" name="full_name" type="text" required value={form.full_name} onChange={handleChange} className="mt-1 bg-zinc-900 border-zinc-700 text-white" placeholder="Seu nome completo" />
            </div>
            <div>
              <Label htmlFor="cpf" className="text-zinc-300">CPF (apenas numeros)</Label>
              <Input id="cpf" name="cpf" type="text" required maxLength={11} value={form.cpf} onChange={handleChange} className="mt-1 bg-zinc-900 border-zinc-700 text-white" placeholder="00000000000" />
            </div>
            <div>
              <Label htmlFor="phone" className="text-zinc-300">WhatsApp (DDD + numero)</Label>
              <Input id="phone" name="phone" type="text" required value={form.phone} onChange={handleChange} className="mt-1 bg-zinc-900 border-zinc-700 text-white" placeholder="11987654321" />
            </div>
            <div>
              <Label htmlFor="email" className="text-zinc-300">Email</Label>
              <Input id="email" name="email" type="email" required value={form.email} onChange={handleChange} className="mt-1 bg-zinc-900 border-zinc-700 text-white" />
            </div>
            <div>
              <Label htmlFor="password" className="text-zinc-300">Senha</Label>
              <Input id="password" name="password" type="password" required minLength={6} value={form.password} onChange={handleChange} className="mt-1 bg-zinc-900 border-zinc-700 text-white" />
            </div>
          </div>
          <div className="border border-zinc-700 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium text-zinc-300">Como voce vai usar o app? <span className="text-zinc-500 font-normal">(pode escolher mais de um)</span></p>
            <div className="flex items-start gap-3">
              <Checkbox id="is_diretor" checked={perfis.is_diretor} onCheckedChange={v => handlePerfil('is_diretor', !!v)} className="mt-0.5 border-zinc-600" />
              <div>
                <Label htmlFor="is_diretor" className="text-white cursor-pointer">Sou Diretor</Label>
                <p className="text-xs text-zinc-500 mt-0.5">Quero inscrever e gerenciar um time na liga</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox id="is_jogador" checked={perfis.is_jogador} onCheckedChange={v => handlePerfil('is_jogador', !!v)} className="mt-0.5 border-zinc-600" />
              <div>
                <Label htmlFor="is_jogador" className="text-white cursor-pointer">Sou Jogador</Label>
                <p className="text-xs text-zinc-500 mt-0.5">Quero ter meu ID Metropole e acompanhar minhas estatisticas</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox id="is_torcedor" checked={perfis.is_torcedor} onCheckedChange={v => handlePerfil('is_torcedor', !!v)} className="mt-0.5 border-zinc-600" />
              <div>
                <Label htmlFor="is_torcedor" className="text-white cursor-pointer">Sou Torcedor</Label>
                <p className="text-xs text-zinc-500 mt-0.5">Quero acompanhar meu time favorito</p>
              </div>
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-[#1565F5] hover:bg-blue-600 text-white font-semibold py-2.5">
            {loading ? 'Criando conta...' : 'Criar conta'}
          </Button>
        </form>
        <p className="text-center text-sm text-zinc-500">
          Ja tem conta? <Link to="/login" className="text-[#1565F5] hover:underline font-medium">Entrar</Link>
        </p>
      </div>
    </div>
  )
}
