// @ts-nocheck
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { StepHeader } from '@/components/ui/step-header'
import { PrimaryCTA } from '@/components/ui/primary-cta'
import { Heart } from 'lucide-react'

export const Route = createFileRoute('/onboarding/torcedor')({
  component: TorcedorOnboarding,
})

const SUBPREFEITURAS = [
  'Aricanduva/Formosa/Carrão', 'Butantã', 'Campo Limpo', 'Casa Verde/Cachoeirinha',
  'Cidade Ademar', 'Cidade Tiradentes', 'Ermelino Matarazzo', 'Freguesia/Brasilândia',
  'Guaianases', 'Ipiranga', 'Itaim Paulista', 'Itaquera', 'Jabaquara', 'Jaçanã/Tremembé',
  'Lapa', "M'Boi Mirim", 'Mooca', 'Parelheiros', 'Penha', 'Perus', 'Pinheiros',
  'Pirituba/Jaraguá', 'Santana/Tucuruvi', 'Santo Amaro', 'São Mateus', 'São Miguel',
  'Sapopemba', 'Sé', 'Socorro', 'Vila Maria/Vila Guilherme', 'Vila Mariana', 'Vila Prudente',
]

function TorcedorOnboarding() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState(null)
  const [search, setSearch] = useState('')
  const [teams, setTeams] = useState([])
  const [teamsLoading, setTeamsLoading] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [filters, setFilters] = useState({ subprefeitura: '', bairro: '', registration_type: '' })
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) navigate({ to: '/login', replace: true })
      else setUserId(data.user.id)
    })
  }, [])

  useEffect(() => {
    const timeout = setTimeout(async () => {
      setTeamsLoading(true)
      let q = supabase.from('teams').select('id, name, short_name, logo_url, home_venue').eq('status', 'approved')
      if (search.trim()) q = q.ilike('name', '%' + search + '%')
      if (filters.registration_type) q = q.eq('registration_type', filters.registration_type)
      const { data } = await q.limit(20).order('name', { ascending: true })
      setTeams(data ?? [])
      setTeamsLoading(false)
    }, 400)
    return () => clearTimeout(timeout)
  }, [search, filters])

  async function handleConfirm() {
    setErrorMsg('')
    if (!selectedTeam) { setErrorMsg('Selecione um time para torcer'); toast.error('Selecione um time para torcer'); return }
    if (!userId) return
    setLoading(true)
    try {
      const { data: existing } = await supabase.from('team_supporters').select('id').eq('user_id', userId).eq('team_id', selectedTeam.id).single()
      if (!existing) {
        const { error } = await supabase.from('team_supporters').insert({ user_id: userId, team_id: selectedTeam.id })
        if (error) throw error
      }
      toast.success('Agora você torce por ' + selectedTeam.name + '!')
      navigate({ to: '/torcedor', replace: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao selecionar time'
      setErrorMsg(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black px-4 py-12">
      <div className="max-w-xl mx-auto space-y-8">
        <StepHeader
          title="Escolha seu Time"
          subtitle="Encontre o time que você quer torcer na Liga Metrópole"
        />

        <div className="space-y-4">
          {/* Search */}
          <div>
            <Label className="text-zinc-300">Buscar por nome</Label>
            <Input type="text" value={search} onChange={e => setSearch(e.target.value)} className="mt-1 bg-zinc-900 border-zinc-700 text-white" placeholder="Nome do time..." />
          </div>

          {/* Filters */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-zinc-300 text-xs">Subprefeitura</Label>
              <select value={filters.subprefeitura} onChange={e => setFilters(prev => ({ ...prev, subprefeitura: e.target.value }))} className="w-full mt-1 bg-zinc-900 border border-zinc-700 text-white rounded-md px-2 py-1.5 text-xs">
                <option value="">Todas</option>
                {SUBPREFEITURAS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-zinc-300 text-xs">Tipo</Label>
              <select value={filters.registration_type} onChange={e => setFilters(prev => ({ ...prev, registration_type: e.target.value }))} className="w-full mt-1 bg-zinc-900 border border-zinc-700 text-white rounded-md px-2 py-1.5 text-xs">
                <option value="">Todos</option>
                <option value="host">Mandante</option>
                <option value="visitor">Visitante</option>
              </select>
            </div>
          </div>
        </div>

        {/* Teams list */}
        <div className="space-y-2">
          {teamsLoading && <p className="text-sm text-zinc-400">Buscando times...</p>}
          {!teamsLoading && teams.length === 0 && (
            <p className="text-sm text-zinc-500 text-center py-8">Nenhum time encontrado com esses filtros</p>
          )}
          {teams.map(team => (
            <button
              key={team.id}
              type="button"
              onClick={() => setSelectedTeam(selectedTeam?.id === team.id ? null : team)}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${selectedTeam?.id === team.id ? 'border-red-500 bg-red-500/10' : 'border-zinc-700 bg-zinc-900 hover:border-zinc-600'}`}
            >
              {team.logo_url ? (
                <img src={team.logo_url} alt={team.name} className="w-12 h-12 object-contain rounded-lg flex-shrink-0" />
              ) : (
                <div className="w-12 h-12 bg-zinc-800 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-zinc-500 text-xs font-bold">{team.short_name}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm">{team.name}</p>
                {team.home_venue && <p className="text-xs text-zinc-500 mt-0.5 truncate">{team.home_venue}</p>}
              </div>
              {selectedTeam?.id === team.id && (
                <Heart className="h-5 w-5 text-red-400 fill-red-400 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>

        {selectedTeam && (
          <div className="p-4 border border-red-500/30 bg-red-500/5 rounded-xl">
            <p className="text-sm text-zinc-300">Você vai torcer para <span className="font-semibold text-white">{selectedTeam.name}</span></p>
          </div>
        )}

        <PrimaryCTA
          onClick={handleConfirm}
          loading={loading}
          loadingText="Salvando..."
          errorMessage={errorMsg}
          disabled={!selectedTeam}
          className="bg-red-600 hover:bg-red-700 py-3"
        >
          Torcer por este time
        </PrimaryCTA>

        <button
          type="button"
          onClick={() => navigate({ to: '/torcedor', replace: true })}
          className="w-full text-center text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Fazer isso depois
        </button>
      </div>
    </div>
  )
}
