import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Upload, Shield, X, MapPin } from 'lucide-react'
import { toast } from 'sonner'
import { Spinner } from '@/components/AppSkeletons'
import { supabase } from '@/integrations/supabase/client'
import { createTeamRegistration } from '@/lib/team-registration.functions'

export const Route = createFileRoute('/_authenticated/inscricao')({
  component: InscricaoPage,
})

type ColorKey = 'primary_color' | 'secondary_color' | 'tertiary_color'

// ── Subprefeituras de SP (mesma lista do admin/ligas.tsx) ──────────────────
type SubprefeituraOption = {
  label: string;
  zona: string;
  conference_name: string;
};

const SUBPREFEITURAS: SubprefeituraOption[] = [
  { label: "Vila Maria/Vila Guilherme", zona: "norte", conference_name: "Conferência Norte 1" },
  { label: "Santana/Tucuruvi",          zona: "norte", conference_name: "Conferência Norte 2" },
  { label: "Casa Verde",                zona: "norte", conference_name: "Conferência Norte 3" },
  { label: "Jaçanã/Tremembé",           zona: "norte", conference_name: "Conferência Norte 4" },
  { label: "Perus/Anhanguera",          zona: "norte", conference_name: "Conferência Norte 5" },
  { label: "Pirituba/Jaraguá",          zona: "norte", conference_name: "Conferência Norte 6" },
  { label: "Freguesia/Brasilândia",     zona: "norte", conference_name: "Conferência Norte 7" },
  { label: "Penha",                     zona: "leste", conference_name: "Conferência Leste 1" },
  { label: "Mooca",                     zona: "leste", conference_name: "Conferência Leste 2" },
  { label: "Vila Prudente",             zona: "leste", conference_name: "Conferência Leste 3" },
  { label: "Aricanduva",                zona: "leste", conference_name: "Conferência Leste 4" },
  { label: "Sapopemba",                 zona: "leste", conference_name: "Conferência Leste 5" },
  { label: "São Mateus",                zona: "leste", conference_name: "Conferência Leste 6" },
  { label: "Itaquera",                  zona: "leste", conference_name: "Conferência Leste 7" },
  { label: "Guaianases",                zona: "leste", conference_name: "Conferência Leste 8" },
  { label: "Cidade Tiradentes",         zona: "leste", conference_name: "Conferência Leste 9" },
  { label: "Ermelino Matarazzo",        zona: "leste", conference_name: "Conferência Leste 10" },
  { label: "Itaim Paulista",            zona: "leste", conference_name: "Conferência Leste 11" },
  { label: "São Miguel",                zona: "leste", conference_name: "Conferência Leste 12" },
  { label: "Ipiranga",                  zona: "sul",   conference_name: "Conferência Sul 1" },
  { label: "Vila Mariana",              zona: "sul",   conference_name: "Conferência Sul 2" },
  { label: "Jabaquara",                 zona: "sul",   conference_name: "Conferência Sul 3" },
  { label: "Cidade Ademar",             zona: "sul",   conference_name: "Conferência Sul 4" },
  { label: "Santo Amaro",               zona: "sul",   conference_name: "Conferência Sul 5" },
  { label: "Campo Limpo",               zona: "sul",   conference_name: "Conferência Sul 6" },
  { label: "M'Boi Mirim",               zona: "sul",   conference_name: "Conferência Sul 7" },
  { label: "Parelheiros",               zona: "sul",   conference_name: "Conferência Sul 8" },
  { label: "Capela do Socorro",         zona: "sul",   conference_name: "Conferência Sul 9" },
  { label: "Lapa",                      zona: "oeste", conference_name: "Conferência Oeste 1" },
  { label: "Pinheiros",                 zona: "oeste", conference_name: "Conferência Oeste 2" },
  { label: "Butantã",                   zona: "oeste", conference_name: "Conferência Oeste 3" },
  { label: "Sé",                        zona: "centro",conference_name: "Conferência Centro" },
];

const ZONA_LABELS: Record<string, string> = {
  norte: "Zona Norte", sul: "Zona Sul", leste: "Zona Leste", oeste: "Zona Oeste", centro: "Centro",
};

type OpenLeague = {
  id: string;
  name: string;
  conference_name: string | null;
  subprefeitura: string | null;
  zona: string | null;
  season: number | null;
  host_slots: number;
  visitor_slots: number;
  max_teams: number;
  starts_at: string | null;
};

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

  const [selectedSubprefeitura, setSelectedSubprefeitura] = useState<string>('')
  const [allLeagues, setAllLeagues] = useState<OpenLeague[]>([])
  const [leaguesLoading, setLeaguesLoading] = useState(true)
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>('')

  const [form, setForm] = useState({
    name: '',
    registration_type: 'host' as 'host' | 'visitor',
    home_venue: '',
    home_time: '15:00',
    primary_color: '#1565F5',
    secondary_color: '#FFFFFF',
    tertiary_color: '#000000',
  })

  // Load all open leagues (with conference info)
  useEffect(() => {
    (async () => {
      setLeaguesLoading(true)
      const { data } = await supabase
        .from('competitions')
        .select('id, name, conference_name, subprefeitura, zona, season, host_slots, visitor_slots, max_teams, starts_at')
        .eq('registration_status', 'open')
        .order('created_at', { ascending: false })
      const list = (data ?? []) as OpenLeague[]
      setAllLeagues(list)
      setLeaguesLoading(false)
    })()
  }, [])

  // Filter leagues by selected subprefeitura
  const filteredLeagues = selectedSubprefeitura
    ? allLeagues.filter((l) => l.subprefeitura === selectedSubprefeitura)
    : allLeagues

  // Auto-select first league when subprefeitura changes
  useEffect(() => {
    if (filteredLeagues.length > 0) {
      setSelectedLeagueId(filteredLeagues[0].id)
    } else {
      setSelectedLeagueId('')
    }
  }, [selectedSubprefeitura, allLeagues.length])

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
    if (!file.type.startsWith('image/')) { toast.error('Envie um arquivo de imagem.'); return }
    if (file.size > 5 * 1024 * 1024) { toast.error('O escudo deve ter no máximo 5MB.'); return }
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
    const { error: upErr } = await supabase.storage.from('team-logos').upload(path, logoFile, { upsert: true })
    if (upErr) throw upErr
    const { data: pub } = supabase.storage.from('team-logos').getPublicUrl(path)
    const { error: updErr } = await supabase.from('teams').update({ logo_url: pub.publicUrl }).eq('id', teamId)
    if (updErr) throw updErr
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!selectedLeagueId) { toast.error('Selecione uma conferência para se inscrever'); return }
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
          competition_id: selectedLeagueId,
        },
      })
      if (logoFile) {
        try { await uploadLogo(team_id) } catch (e) {
          toast.warning('Time criado, mas falhou ao enviar o escudo.', { description: (e as Error).message })
        }
      }
      setSubmitted(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar inscrição')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="text-center max-w-md space-y-6">
          <div className="text-5xl">✓</div>
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

  if (!leaguesLoading && allLeagues.length === 0) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="text-center max-w-md space-y-4">
          <div className="text-4xl">⚠</div>
          <h2 className="text-xl font-bold text-white">Inscrições encerradas</h2>
          <p className="text-zinc-400">
            Nenhuma conferência está com inscrições abertas no momento.
            Acompanhe nossas redes sociais para saber quando a próxima temporada começar.
          </p>
          <Button variant="outline" onClick={() => navigate({ to: '/' })}>Voltar ao início</Button>
        </div>
      </div>
    )
  }

  const zonas = ["norte", "leste", "sul", "oeste", "centro"] as const;

  return (
    <div className="min-h-screen bg-black px-4 py-12">
      <div className="max-w-lg mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Inscrição do time</h1>
          <p className="mt-1 text-zinc-400 text-sm">Selecione sua subprefeitura e preencha os dados do seu time.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Step 1: Subprefeitura */}
          <div>
            <Label className="text-zinc-300 flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> Sua subprefeitura
            </Label>
            <p className="text-xs text-zinc-500 mt-0.5 mb-2">Selecione a subprefeitura onde seu time atua.</p>
            <select
              value={selectedSubprefeitura}
              onChange={(e) => setSelectedSubprefeitura(e.target.value)}
              className="flex h-10 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
            >
              <option value="">— Todas as conferências abertas —</option>
              {zonas.map((zona) => (
                <optgroup key={zona} label={ZONA_LABELS[zona]}>
                  {SUBPREFEITURAS.filter((s) => s.zona === zona).map((s) => (
                    <option key={s.label} value={s.label}>
                      {s.conference_name} — {s.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Step 2: Conference picker (filtered) */}
          <div>
            <Label className="text-zinc-300">Selecione a conferência</Label>
            <p className="text-xs text-zinc-500 mt-0.5 mb-2">Conferências abertas para inscrições.</p>
            {leaguesLoading ? (
              <p className="text-zinc-500 text-sm">Carregando conferências...</p>
            ) : filteredLeagues.length === 0 ? (
              <p className="text-zinc-500 text-sm">
                {selectedSubprefeitura
                  ? `Nenhuma conferência aberta para ${selectedSubprefeitura} no momento.`
                  : 'Nenhuma conferência aberta no momento.'}
              </p>
            ) : (
              <div className="space-y-2">
                {filteredLeagues.map((league) => (
                  <button
                    key={league.id}
                    type="button"
                    onClick={() => setSelectedLeagueId(league.id)}
                    className={[
                      'w-full text-left rounded-lg border p-3 transition-colors',
                      selectedLeagueId === league.id
                        ? 'border-[#1565F5] bg-[#1565F5]/10'
                        : 'border-zinc-700 bg-zinc-900 hover:border-zinc-500',
                    ].join(' ')}
                  >
                    <div className="font-medium text-white">
                      {league.conference_name ?? league.name}
                      {league.season ? ` ${league.season}` : ''}
                    </div>
                    <div className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1">
                      {league.subprefeitura && (
                        <><MapPin className="h-3 w-3" /> {league.subprefeitura} ·{' '}</>
                      )}
                      {league.host_slots} Mandantes + {league.visitor_slots} Visitantes
                      {league.starts_at && ` · Início: ${new Date(league.starts_at).toLocaleDateString('pt-BR')}`}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="name" className="text-zinc-300">Nome do time</Label>
            <Input id="name" name="name" type="text" required value={form.name} onChange={handleChange}
              className="mt-1 bg-zinc-900 border-zinc-700 text-white" placeholder="Ex: Vila Nova FC" />
          </div>

          <div>
            <Label className="text-zinc-300">Tipo de time</Label>
            <p className="text-xs text-zinc-500 mt-0.5 mb-3">Mandante tem campo fixo. Visitante joga fora.</p>
            <RadioGroup
              value={form.registration_type}
              onValueChange={(v) => setForm(prev => ({ ...prev, registration_type: v as 'host' | 'visitor' }))}
              className="space-y-3"
            >
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
                <Input id="home_venue" name="home_venue" type="text" required value={form.home_venue}
                  onChange={handleChange} className="mt-1 bg-zinc-900 border-zinc-700 text-white"
                  placeholder="Rua, número, bairro - São Paulo, SP" />
              </div>
              <div>
                <Label htmlFor="home_time" className="text-zinc-300">Horário preferencial</Label>
                <Input id="home_time" name="home_time" type="time" value={form.home_time}
                  onChange={handleChange} className="mt-1 bg-zinc-900 border-zinc-700 text-white" />
              </div>
            </>
          )}

          <div>
            <Label className="text-zinc-300 flex items-center gap-2"><Shield className="h-4 w-4" /> Escudo do time</Label>
            <p className="text-xs text-zinc-500 mt-0.5 mb-2">PNG ou JPG, até 5MB.</p>
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-md border border-zinc-700 bg-zinc-900 overflow-hidden flex items-center justify-center shrink-0">
                {logoPreview
                  ? <img src={logoPreview} alt="Escudo" className="h-full w-full object-cover" />
                  : <Shield className="h-7 w-7 text-zinc-600" />}
              </div>
              <input ref={logoInput} type="file" accept="image/*" className="hidden" onChange={handleLogoPick} />
              <div className="flex flex-col gap-2">
                <Button type="button" variant="outline" size="sm"
                  onClick={() => logoInput.current?.click()}
                  className="gap-2 border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800">
                  <Upload className="h-4 w-4" />{logoFile ? 'Trocar escudo' : 'Enviar escudo'}
                </Button>
                {logoFile && (
                  <Button type="button" variant="ghost" size="sm" onClick={clearLogo}
                    className="gap-2 text-zinc-400 hover:text-white">
                    <X className="h-4 w-4" /> Remover
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <Label className="text-zinc-300">Cores do uniforme</Label>
              <p className="text-xs text-zinc-500 mt-0.5">Escolha até 3 cores. A cor primária é obrigatória.</p>
            </div>
            <ColorRow label="Cor primária" value={form.primary_color} onChange={(v) => setColor('primary_color', v)} />
            {useSecondary ? (
              <ColorRow label="Cor secundária" value={form.secondary_color}
                onChange={(v) => setColor('secondary_color', v)}
                onRemove={() => { setUseSecondary(false); setUseTertiary(false) }} />
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={() => setUseSecondary(true)}
                className="border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800">
                + Adicionar cor secundária
              </Button>
            )}
            {useSecondary && (
              useTertiary ? (
                <ColorRow label="Cor terciária" value={form.tertiary_color}
                  onChange={(v) => setColor('tertiary_color', v)}
                  onRemove={() => setUseTertiary(false)} />
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={() => setUseTertiary(true)}
                  className="border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800">
                  + Adicionar cor terciária
                </Button>
              )
            )}
          </div>

          <Button type="submit" disabled={loading || !selectedLeagueId}
            className="w-full bg-[#1565F5] hover:bg-blue-600 text-white font-semibold py-2.5">
            {loading ? <><Spinner className="mr-2 h-4 w-4" />Aguarde...</> : 'Enviar inscrição'}
          </Button>
        </form>
      </div>
    </div>
  )
}

function ColorRow({ label, value, onChange, onRemove }: {
  label: string; value: string; onChange: (v: string) => void; onRemove?: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <Label className="text-zinc-400 text-xs">{label}</Label>
        <div className="flex items-center gap-2 mt-1">
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
            className="h-10 w-12 rounded cursor-pointer bg-transparent border-0" />
          <Input value={value} onChange={(e) => onChange(e.target.value)}
            maxLength={7}
            className="bg-zinc-900 border-zinc-700 text-white font-mono text-sm uppercase max-w-[120px]" />
        </div>
      </div>
      {onRemove && (
        <Button type="button" variant="ghost" size="icon" onClick={onRemove}
          className="text-zinc-400 hover:text-white mt-5">
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
  }
