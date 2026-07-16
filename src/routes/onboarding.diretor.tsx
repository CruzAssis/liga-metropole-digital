// @ts-nocheck
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { StepHeader } from '@/components/ui/step-header'
import { PrimaryCTA } from '@/components/ui/primary-cta'
import { Upload, X, MapPin } from 'lucide-react'

export const Route = createFileRoute('/onboarding/diretor')({
  component: DiretorOnboarding,
})

const SUBPREFEITURAS = [
  'Aricanduva/Formosa/Carrão', 'Butantã', 'Campo Limpo', 'Casa Verde/Cachoeirinha',
  'Cidade Ademar', 'Cidade Tiradentes', 'Ermelino Matarazzo', 'Freguesia/Brasilândia',
  'Guaianases', 'Ipiranga', 'Itaim Paulista', 'Itaquera', 'Jabaquara', 'Jaçanã/Tremembé',
  'Lapa', "M'Boi Mirim", 'Mooca', 'Parelheiros', 'Penha', 'Perus', 'Pinheiros',
  'Pirituba/Jaraguá', 'Santana/Tucuruvi', 'Santo Amaro', 'São Mateus', 'São Miguel',
  'Sapopemba', 'Sé', 'Socorro', 'Vila Maria/Vila Guilherme', 'Vila Mariana', 'Vila Prudente',
]

function DiretorOnboarding() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)
  const logoRef = useRef(null)
  const [userId, setUserId] = useState(null)
  const [aceitaTermos, setAceitaTermos] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const subprefRef = useRef(null)
  const nameRef = useRef(null)
  const shortNameRef = useRef(null)
  const termsRef = useRef(null)
  const [form, setForm] = useState({
    subprefeitura: '',
    name: '',
    short_name: '',
    registration_type: 'host',
    bairro: '',
    home_venue: '',
    home_address: '',
    maps_link: '',
    primary_color: '#1565F5',
    secondary_color: '#FFFFFF',
  })

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) navigate({ to: '/login', replace: true })
      else setUserId(data.user.id)
    })
  }, [])

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  function handleLogoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    const reader = new FileReader()
    reader.onload = ev => setLogoPreview(ev.target?.result)
    reader.readAsDataURL(file)
  }

  function removeEmblem() {
    setLogoFile(null)
    setLogoPreview(null)
    if (logoRef.current) logoRef.current.value = ''
  }

  function failWith(msg, ref) {
    setErrorMsg(msg)
    toast.error(msg)
    if (ref?.current) {
      ref.current.focus?.()
      ref.current.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErrorMsg('')
    if (!aceitaTermos) return failWith('Aceite o regulamento para continuar', termsRef)
    if (!form.subprefeitura) return failWith('Selecione uma subprefeitura', subprefRef)
    if (!form.name.trim()) return failWith('Informe o nome do time', nameRef)
    if (!form.short_name.trim()) return failWith('Informe a sigla do time', shortNameRef)
    if (!userId) return
    setLoading(true)
    try {
      let logo_url = null
      if (logoFile && userId) {
        const ext = logoFile.name.split('.').pop()
        const path = userId + '/logo.' + ext
        const { error: upErr } = await supabase.storage.from('team-logos').upload(path, logoFile, { upsert: true })
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('team-logos').getPublicUrl(path)
          logo_url = urlData.publicUrl
        }
      }
      const homeVenueStr = form.registration_type === 'host'
        ? [form.home_venue, form.home_address].filter(Boolean).join(' — ')
        : null
      const { error } = await supabase.from('teams').insert({
        name: form.name.trim(),
        short_name: form.short_name.trim().toUpperCase(),
        registration_type: form.registration_type,
        home_venue: homeVenueStr,
        primary_color: form.primary_color,
        secondary_color: form.secondary_color,
        logo_url,
        manager_id: userId,
        status: 'pending',
        serie: 'A',
        lado: 'A',
        slug: form.name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      })
      if (error) throw error
      toast.success('Time enviado para aprovacao!')
      navigate({ to: '/minha-conta', replace: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao cadastrar time')
    } finally {
      setLoading(false)
    }
  }

  const isMandante = form.registration_type === 'host'

  return (
    <div className="min-h-screen bg-black px-4 py-12">
      <div className="max-w-xl mx-auto space-y-8">
        <StepHeader
          title="Cadastro do Time"
          subtitle="Preencha os dados do seu time para participar da Liga Metrópole"
        />
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label className="text-zinc-300">Subprefeitura</Label>
            <select name="subprefeitura" value={form.subprefeitura} onChange={handleChange} required className="w-full mt-1 bg-zinc-900 border border-zinc-700 text-white rounded-md px-3 py-2 text-sm">
              <option value="">Selecione a subprefeitura...</option>
              {SUBPREFEITURAS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="name" className="text-zinc-300">Nome do time</Label>
            <Input id="name" name="name" type="text" required value={form.name} onChange={handleChange} className="mt-1 bg-zinc-900 border-zinc-700 text-white" placeholder="Ex: Vila Nova FC" />
          </div>
          <div>
            <Label htmlFor="short_name" className="text-zinc-300">Sigla (até 5 letras)</Label>
            <Input id="short_name" name="short_name" type="text" required maxLength={5} value={form.short_name} onChange={handleChange} className="mt-1 bg-zinc-900 border-zinc-700 text-white" placeholder="Ex: VNFC" />
          </div>
          <div>
            <Label className="text-zinc-300">Tipo de time</Label>
            <div className="mt-2 flex gap-4">
              {[{ value: 'host', label: 'Mandante' }, { value: 'visitor', label: 'Visitante' }].map(opt => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="registration_type" value={opt.value} checked={form.registration_type === opt.value} onChange={handleChange} className="accent-blue-500" />
                  <span className="text-white text-sm">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="bairro" className="text-zinc-300">Bairro do time</Label>
            <Input id="bairro" name="bairro" type="text" required value={form.bairro} onChange={handleChange} className="mt-1 bg-zinc-900 border-zinc-700 text-white" placeholder="Ex: Tatuapé" />
          </div>
          {isMandante && (
            <div className="space-y-4 p-4 border border-zinc-800 rounded-xl">
              <p className="text-sm text-zinc-400 font-medium">Informações do campo (Mandante)</p>
              <div>
                <Label htmlFor="home_venue" className="text-zinc-300">Nome do campo</Label>
                <Input id="home_venue" name="home_venue" type="text" value={form.home_venue} onChange={handleChange} className="mt-1 bg-zinc-900 border-zinc-700 text-white" placeholder="Ex: Campo do Parque" />
              </div>
              <div>
                <Label htmlFor="home_address" className="text-zinc-300">Endereço completo</Label>
                <Input id="home_address" name="home_address" type="text" value={form.home_address} onChange={handleChange} className="mt-1 bg-zinc-900 border-zinc-700 text-white" placeholder="Rua, número, bairro - São Paulo, SP" />
              </div>
              <div>
                <Label htmlFor="maps_link" className="text-zinc-300 flex items-center gap-1"><MapPin className="h-4 w-4" /> Link Google Maps (opcional)</Label>
                <Input id="maps_link" name="maps_link" type="url" value={form.maps_link} onChange={handleChange} className="mt-1 bg-zinc-900 border-zinc-700 text-white" placeholder="https://maps.google.com/..." />
              </div>
            </div>
          )}
          <div>
            <Label className="text-zinc-300">Emblema do time</Label>
            <div className="mt-2">
              {logoPreview ? (
                <div className="relative w-24 h-24">
                  <img src={logoPreview} alt="Preview" className="w-24 h-24 object-contain rounded-lg border border-zinc-700" />
                  <button type="button" onClick={removeEmblem} className="absolute -top-2 -right-2 bg-red-600 rounded-full p-0.5">
                    <X className="h-3 w-3 text-white" />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => logoRef.current?.click()} className="flex items-center gap-2 px-4 py-2 border border-dashed border-zinc-600 rounded-lg text-zinc-400 hover:border-zinc-400 text-sm">
                  <Upload className="h-4 w-4" /> Enviar emblema
                </button>
              )}
              <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="primary_color" className="text-zinc-300">Cor primária</Label>
              <div className="flex items-center gap-2 mt-1">
                <input id="primary_color" name="primary_color" type="color" value={form.primary_color} onChange={handleChange} className="h-9 w-9 rounded border border-zinc-700 cursor-pointer bg-transparent" />
                <span className="text-zinc-400 text-sm">{form.primary_color}</span>
              </div>
            </div>
            <div>
              <Label htmlFor="secondary_color" className="text-zinc-300">Cor secundária</Label>
              <div className="flex items-center gap-2 mt-1">
                <input id="secondary_color" name="secondary_color" type="color" value={form.secondary_color} onChange={handleChange} className="h-9 w-9 rounded border border-zinc-700 cursor-pointer bg-transparent" />
                <span className="text-zinc-400 text-sm">{form.secondary_color}</span>
              </div>
            </div>
          </div>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={aceitaTermos} onChange={e => setAceitaTermos(e.target.checked)} className="mt-0.5 accent-blue-500" />
            <span className="text-sm text-zinc-400">Ao cadastrar você concorda com o <a href="/termos" target="_blank" className="text-blue-400 hover:underline">regulamento da Liga Metrópole</a></span>
          </label>
          <PrimaryCTA
            type="submit"
            loading={loading}
            loadingText="Cadastrando..."
            disabled={!aceitaTermos || !form.name.trim() || !form.short_name.trim() || !form.subprefeitura}
            className="py-3"
          >
            Cadastrar Time
          </PrimaryCTA>
          <button type="button" onClick={() => navigate({ to: '/minha-conta', replace: true })} className="w-full text-center text-sm text-zinc-500 hover:text-zinc-300">
            Fazer isso depois
          </button>
        </form>
      </div>
    </div>
  )
}
