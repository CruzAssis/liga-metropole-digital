// @ts-nocheck
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/inscricao')({
  component: InscricaoPage,
})

function InscricaoPage() {
  const navigate = useNavigate()
  
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({
    nome: '',
    tipo: 'mandante',
    endereco_campo: '',
    cor_primaria: '#1565F5',
    cor_secundaria: '#FFFFFF',
  })

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (form.tipo === 'mandante' && !form.endereco_campo.trim()) {
      toast({ title: 'Informe o endereco do campo', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuario nao autenticado')
      const { data: team, error } = await supabase.from('teams').insert({
        nome: form.nome,
        tipo: form.tipo,
        cor_primaria: form.cor_primaria,
        cor_secundaria: form.cor_secundaria,
        grupo: 'A',
        fase_atual: 'fase1',
        mensalidade_paga: false,
      }).select('id').single()
      if (error) throw error
      if (team) {
        await supabase.from('profiles').update({ time_diretor_id: team.id }).eq('id', user.id)
      }
      setSubmitted(true)
    } catch (err) {
      toast({ title: err.message || 'Erro ao enviar inscricao', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="text-center max-w-md space-y-6">
          <div className="text-5xl">OK</div>
          <h2 className="text-2xl font-bold text-white">Inscricao enviada!</h2>
          <p className="text-zinc-400">
            A Liga Metropole entrara em contato via WhatsApp em ate 48h para confirmar
            sua participacao e orientar sobre o pagamento da taxa de inscricao de{' '}
            <span className="text-[#1565F5] font-semibold">R 50,00</span>.
          </p>
          <p className="text-sm text-zinc-500">
            Apos a confirmacao, sua mensalidade de R 120/mes comeca com o inicio da temporada (Agosto/2025).
          </p>
          <Button onClick={() => navigate({ to: '/minha-conta' })} className="bg-[#1565F5] hover:bg-blue-600 text-white">
            Ir para minha conta
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black px-4 py-12">
      <div className="max-w-lg mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Inscricao do time</h1>
          <p className="mt-1 text-zinc-400 text-sm">Preencha os dados do seu time para participar da Liga Metropole 2025.</p>
        </div>
        <div className="bg-zinc-900 border border-[#1565F5]/30 rounded-lg p-4">
          <p className="text-sm text-zinc-300">
            <span className="text-[#1565F5] font-semibold">Taxa de inscricao: R 50,00</span>
            {' '}garante sua vaga. Apos aprovacao, voce recebe instrucoes de pagamento via WhatsApp.
          </p>
          <p className="text-xs text-zinc-500 mt-1">A mensalidade de R 120/mes comeca apenas quando a temporada iniciar.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="nome" className="text-zinc-300">Nome do time</Label>
            <Input id="nome" name="nome" type="text" required value={form.nome} onChange={handleChange} className="mt-1 bg-zinc-900 border-zinc-700 text-white" placeholder="Ex: Vila Nova FC" />
          </div>
          <div>
            <Label className="text-zinc-300">Tipo de time</Label>
            <p className="text-xs text-zinc-500 mt-0.5 mb-3">Mandante tem campo fixo. Visitante joga fora.</p>
            <RadioGroup value={form.tipo} onValueChange={v => setForm(prev => ({ ...prev, tipo: v }))} className="space-y-3">
              <div className="flex items-start gap-3 bg-zinc-900 border border-zinc-700 rounded-lg p-3">
                <RadioGroupItem value="mandante" id="mandante" className="mt-0.5" />
                <div>
                  <Label htmlFor="mandante" className="text-white cursor-pointer font-medium">Mandante</Label>
                  <p className="text-xs text-zinc-500 mt-0.5">Meu time tem campo fixo para mandar os jogos em casa</p>
                </div>
              </div>
              <div className="flex items-start gap-3 bg-zinc-900 border border-zinc-700 rounded-lg p-3">
                <RadioGroupItem value="visitante" id="visitante" className="mt-0.5" />
                <div>
                  <Label htmlFor="visitante" className="text-white cursor-pointer font-medium">Visitante</Label>
                  <p className="text-xs text-zinc-500 mt-0.5">Meu time nao tem campo fixo - joga sempre como visitante</p>
                </div>
              </div>
            </RadioGroup>
          </div>
          {form.tipo === 'mandante' && (
            <div>
              <Label htmlFor="endereco_campo" className="text-zinc-300">Endereco do campo</Label>
              <Input id="endereco_campo" name="endereco_campo" type="text" required value={form.endereco_campo} onChange={handleChange} className="mt-1 bg-zinc-900 border-zinc-700 text-white" placeholder="Rua, numero, bairro - Zona Norte, SP" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-zinc-300">Cor primaria</Label>
              <div className="flex items-center gap-2 mt-1">
                <input type="color" name="cor_primaria" value={form.cor_primaria} onChange={handleChange} className="h-10 w-12 rounded cursor-pointer bg-transparent border-0" />
                <Input name="cor_primaria" value={form.cor_primaria} onChange={handleChange} className="bg-zinc-900 border-zinc-700 text-white font-mono text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-zinc-300">Cor secundaria</Label>
              <div className="flex items-center gap-2 mt-1">
                <input type="color" name="cor_secundaria" value={form.cor_secundaria} onChange={handleChange} className="h-10 w-12 rounded cursor-pointer bg-transparent border-0" />
                <Input name="cor_secundaria" value={form.cor_secundaria} onChange={handleChange} className="bg-zinc-900 border-zinc-700 text-white font-mono text-sm" />
              </div>
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-[#1565F5] hover:bg-blue-600 text-white font-semibold py-2.5">
            {loading ? 'Enviando inscricao...' : 'Enviar inscricao'}
          </Button>
        </form>
      </div>
    </div>
  )
      }
