import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Upload, Shield, X } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { createTeamRegistration } from '@/lib/team-registration.functions'

export const Route = createFileRoute('/_authenticated/inscricao')({
  component: InscricaoPage,
})

type ColorKey = 'primary_color' | 'secondary_color' | 'tertiary_color'

function InscricaoPage() {
  const navigate = useNavigate()
  const createTeam = useServerFn(createTeamRegistration)
  const logoInput = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [useSecondary, setUseSecondary] = useState(false)
  const [useTertiary, setUseTertiary] = useState(false)

  const [form, setForm] = useState({
    name: '',
    registration_type: 'host' as 'host' | 'visitor',
    home_venue: '',
    home_time: '15:00',
    primary_color: '#1565F5',
    secondary_color: '#FFFFFF',
    tertiary_color: '#000000',
  })

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  function setColor(key: ColorKey, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function handleLogoPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Envie um arquivo de imagem.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('O escudo deve ter no máximo 5MB.')
      return
    }
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  function clearLogo() {
    setLogoFile(null)
    setLogoPreview(null)
    if (logoInput.current) logoInput.current.value = ''
  }

  async function uploadLogo(teamId: string): Promise<void> {
    if (!logoFile) return
    const ext = logoFile.name.split('.').pop() || 'png'
    const path = `logos/${teamId}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('team-logos')
      .upload(path, logoFile, { upsert: true })
    if (upErr) throw upErr
    const { data: pub } = supabase.storage.from('team-logos').getPublicUrl(path)
    const { error: updErr } = await supabase
      .from('teams')
      .update({ logo_url: pub.publicUrl })
      .eq('id', teamId)
    if (updErr) throw updErr
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (form.registration_type === 'host' && !form.home_venue.trim()) {
      toast.error('Informe o endereço do campo')
      return
    }
    setLoading(true)
    try {
      const { team_id } = await createTeam({
        data: {
          name: form.name,
          registration_type: form.registration_type,
          home_venue: form.home_venue || null,
          home_time: form.registration_type === 'host' ? form.home_time || null : null,
          primary_color: form.primary_color || null,
          secondary_color: useSecondary ? form.secondary_color : null,
          tertiary_color: useTertiary ? form.tertiary_color : null,
        },
      })
      if (logoFile) {
        try {
          await uploadLogo(team_id)
        } catch (e) {
          toast.warning('Time criado, mas falhou ao enviar o escudo. Você pode tentar novamente em Minha conta.', {
            description: (e as Error).message,
          })
        }
      }
      setSubmitted(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao enviar inscrição'
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
          <h2 className="text-2xl font-bold text-white">Inscrição enviada!</h2>
          <p className="text-zinc-400">
            A Liga Metrópole entrará em contato via WhatsApp em até 48h para confirmar
            sua participação e orientar sobre o pagamento da taxa de inscrição de{' '}
            <span className="text-[#1565F5] font-semibold">R$ 50,00</span>.
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
          <h1 className="text-2xl font-bold text-white">Inscrição do time</h1>
          <p className="mt-1 text-zinc-400 text-sm">Preencha os dados do seu time para participar da Liga Metrópole 2026.</p>
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
                  <p className="text-xs text-zinc-500 mt-0.5">Meu time não tem campo fixo — joga sempre como visitante</p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {form.registration_type === 'host' && (
            <>
              <div>
                <Label htmlFor="home_venue" className="text-zinc-300">Endereço do campo</Label>
                <Input id="home_venue" name="home_venue" type="text" required value={form.home_venue} onChange={handleChange} className="mt-1 bg-zinc-900 border-zinc-700 text-white" placeholder="Rua, número, bairro — Zona Norte, SP" />
                <p className="text-xs text-zinc-500 mt-1">Obrigatório para mandantes — é onde você vai mandar seus jogos.</p>
              </div>
              <div>
                <Label htmlFor="home_time" className="text-zinc-300">Horário preferencial</Label>
                <Input id="home_time" name="home_time" type="time" value={form.home_time} onChange={handleChange} className="mt-1 bg-zinc-900 border-zinc-700 text-white" />
                <p className="text-xs text-zinc-500 mt-1">Horário em que seu time costuma jogar em casa.</p>
              </div>
            </>
          )}

          {/* Escudo do time */}
          <div>
            <Label className="text-zinc-300 flex items-center gap-2"><Shield className="h-4 w-4" /> Escudo do time</Label>
            <p className="text-xs text-zinc-500 mt-0.5 mb-2">PNG ou JPG, até 5MB. Aparece no ranking, nas partidas e no perfil público.</p>
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-md border border-zinc-700 bg-zinc-900 overflow-hidden flex items-center justify-center shrink-0">
                {logoPreview ? (
                  <img src={logoPreview} alt="Escudo" className="h-full w-full object-cover" />
                ) : (
                  <Shield className="h-7 w-7 text-zinc-600" />
                )}
              </div>
              <input
                ref={logoInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoPick}
              />
              <div className="flex flex-col gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => logoInput.current?.click()} className="gap-2 border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800">
                  <Upload className="h-4 w-4" />
                  {logoFile ? 'Trocar escudo' : 'Enviar escudo'}
                </Button>
                {logoFile && (
                  <Button type="button" variant="ghost" size="sm" onClick={clearLogo} className="gap-2 text-zinc-400 hover:text-white">
                    <X className="h-4 w-4" /> Remover
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Cores do time (até 3) */}
          <div className="space-y-3">
            <div>
              <Label className="text-zinc-300">Cores do uniforme</Label>
              <p className="text-xs text-zinc-500 mt-0.5">Escolha até 3 cores. A cor primária é obrigatória.</p>
            </div>

            <ColorRow
              label="Cor primária"
              value={form.primary_color}
              onChange={(v) => setColor('primary_color', v)}
            />

            {useSecondary ? (
              <ColorRow
                label="Cor secundária"
                value={form.secondary_color}
                onChange={(v) => setColor('secondary_color', v)}
                onRemove={() => { setUseSecondary(false); if (useTertiary) { setUseTertiary(false) } }}
              />
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={() => setUseSecondary(true)} className="border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800">
                + Adicionar cor secundária
              </Button>
            )}

            {useSecondary && (
              useTertiary ? (
                <ColorRow
                  label="Cor terciária"
                  value={form.tertiary_color}
                  onChange={(v) => setColor('tertiary_color', v)}
                  onRemove={() => setUseTertiary(false)}
                />
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={() => setUseTertiary(true)} className="border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800">
                  + Adicionar cor terciária
                </Button>
              )
            )}
          </div>

          <Button type="submit" disabled={loading} className="w-full bg-[#1565F5] hover:bg-blue-600 text-white font-semibold py-2.5">
            {loading ? 'Enviando inscrição...' : 'Enviar inscrição'}
          </Button>
        </form>
      </div>
    </div>
  )
}

function ColorRow({
  label,
  value,
  onChange,
  onRemove,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  onRemove?: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <Label className="text-zinc-400 text-xs">{label}</Label>
        <div className="flex items-center gap-2 mt-1">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-10 w-12 rounded cursor-pointer bg-transparent border-0"
          />
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            maxLength={7}
            className="bg-zinc-900 border-zinc-700 text-white font-mono text-sm uppercase max-w-[120px]"
          />
        </div>
      </div>
      {onRemove && (
        <Button type="button" variant="ghost" size="icon" onClick={onRemove} className="text-zinc-400 hover:text-white mt-5">
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
