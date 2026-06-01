import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { toast } from 'sonner'
import { createTeamRegistration } from '@/lib/team-registration.functions'

export const Route = createFileRoute('/_authenticated/inscricao')({
  component: InscricaoPage,
})

function InscricaoPage() {
  const navigate = useNavigate()
  const createTeam = useServerFn(createTeamRegistration)

  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({
    name: '',
    registration_type: 'host' as 'host' | 'visitor',
    home_venue: '',
    home_time: '15:00',
    primary_color: '#1565F5',
  })

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (form.registration_type === 'host' && !form.home_venue.trim()) {
      toast.error('Informe o endereco do campo')
      return
    }
    setLoading(true)
    try {
      await createTeam({
        data: {
          name: form.name,
          registration_type: form.registration_type,
          home_venue: form.home_venue || null,
          home_time: form.registration_type === 'host' ? form.home_time || null : null,
          primary_color: form.primary_color || null,
        },
      })
      setSubmitted(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao enviar inscricao'
      toast.error(msg)
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
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="name" className="text-zinc-300">Nome do time</Label>
            <Input id="name" name="name" type="text" required value={form.name} onChange={handleChange} className="mt-1 bg-zinc-900 border-zinc-700 text-white" placeholder="Ex: Vila Nova FC" />
          </div>
          <div>
            <Label className="text-zinc-300">Tipo de time</Label>
            <p className="text-xs text-zinc-500 mt-0.5 mb-3">Mandante tem campo fixo. Visitante joga fora.</p>
            <RadioGroup value={form.registration_type} onValueChange={(v) => setForm(prev => ({ ...prev, registration_type: v as 'host' | 'visitor' }))} className="space-y-3">
              <div className="flex items-start gap-3 bg-zinc-900 border border-zinc-700 rounded-lg p-3">
                <RadioGroupItem value="host" id="host" className="mt-0.5" />
                <div>
                  <Label htmlFor="host" className="text-white cursor-pointer font-medium">Mandante</Label>
                  <p className="text-xs text-zinc-500 mt-0.5">Meu time tem campo fixo para mandar os jogos em casa</p>
                </div>
              </div>
              <div className="flex items-start gap-3 bg-zinc-900 border border-zinc-700 rounded-lg p-3">
                <RadioGroupItem value="visitor" id="visitor" className="mt-0.5" />
                <div>
                  <Label htmlFor="visitor" className="text-white cursor-pointer font-medium">Visitante</Label>
                  <p className="text-xs text-zinc-500 mt-0.5">Meu time nao tem campo fixo - joga sempre como visitante</p>
                </div>
              </div>
            </RadioGroup>
          </div>
          {form.registration_type === 'host' && (
            <>
              <div>
                <Label htmlFor="home_venue" className="text-zinc-300">Endereço do campo</Label>
                <Input id="home_venue" name="home_venue" type="text" required value={form.home_venue} onChange={handleChange} className="mt-1 bg-zinc-900 border-zinc-700 text-white" placeholder="Rua, número, bairro - Zona Norte, SP" />
                <p className="text-xs text-zinc-500 mt-1">Obrigatório para mandantes — é onde você vai mandar seus jogos.</p>
              </div>
              <div>
                <Label htmlFor="home_time" className="text-zinc-300">Horário preferencial</Label>
                <Input id="home_time" name="home_time" type="time" value={form.home_time} onChange={handleChange} className="mt-1 bg-zinc-900 border-zinc-700 text-white" />
                <p className="text-xs text-zinc-500 mt-1">Horário em que seu time costuma jogar em casa.</p>
              </div>
            </>
          )}
          <div>
            <Label className="text-zinc-300">Cor primaria</Label>
            <div className="flex items-center gap-2 mt-1">
              <input type="color" name="primary_color" value={form.primary_color} onChange={handleChange} className="h-10 w-12 rounded cursor-pointer bg-transparent border-0" />
              <Input name="primary_color" value={form.primary_color} onChange={handleChange} className="bg-zinc-900 border-zinc-700 text-white font-mono text-sm" />
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
