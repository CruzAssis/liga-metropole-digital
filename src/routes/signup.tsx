// @ts-nocheck
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export const Route = createFileRoute('/signup')({
  component: SignupPage,
})

function SignupPage() {
  const navigate = useNavigate()
  
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ full_name: '', cpf: '', phone: '', email: '', password: '' })
  const [is_diretor, setIsDiretor] = useState(false)
  const [is_jogador, setIsJogador] = useState(false)
  const [is_torcedor, setIsTorcedor] = useState(false)

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!is_diretor && !is_jogador && !is_torcedor) {
      toast.error('Selecione ao menos um perfil')
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { full_name: form.full_name, cpf: form.cpf, phone: form.phone, is_diretor, is_jogador, is_torcedor } },
      })
      if (error) throw error
      if (data.user) {
        await supabase.from('profiles').upsert({ id: data.user.id, nome_completo: form.full_name, cpf: form.cpf, telefone: form.phone, is_diretor, is_jogador, is_torcedor })
      }
      toast.success('Conta criada com sucesso!')
      navigate({ to: is_diretor ? '/inscricao' : '/' })
    } catch (err) {
      toast.error(err.message || 'Erro ao criar conta')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link to="/" className="text-2xl font-bold text-white tracking-tight">Liga Metropole</Link>
          <h2 className="mt-4 text-xl font-semibold text-white">Criar conta</h2>
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
              <Label htmlFor="phone" className="text-zinc-300">WhatsApp</Label>
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
            <p className="text-sm font-medium text-zinc-300">Como voce vai usar o app?</p>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={is_diretor} onChange={e => setIsDiretor(e.target.checked)} className="w-4 h-4 accent-blue-500" />
              <div>
                <span className="text-white text-sm">Sou Diretor</span>
                <p className="text-xs text-zinc-500">Quero inscrever e gerenciar um time na liga</p>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={is_jogador} onChange={e => setIsJogador(e.target.checked)} className="w-4 h-4 accent-blue-500" />
              <div>
                <span className="text-white text-sm">Sou Jogador</span>
                <p className="text-xs text-zinc-500">Quero ter meu ID Metropole</p>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={is_torcedor} onChange={e => setIsTorcedor(e.target.checked)} className="w-4 h-4 accent-blue-500" />
              <div>
                <span className="text-white text-sm">Sou Torcedor</span>
                <p className="text-xs text-zinc-500">Quero acompanhar meu time favorito</p>
              </div>
            </label>
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-[#1565F5] hover:bg-blue-600 text-white font-semibold py-2.5">
            {loading ? 'Criando conta...' : 'Criar conta'}
          </Button>
        </form>
        <p className="text-center text-sm text-zinc-500">
          Ja tem conta? <Link to="/login" className="text-[#1565F5] hover:underline">Entrar</Link>
        </p>
      </div>
    </div>
  )
}
