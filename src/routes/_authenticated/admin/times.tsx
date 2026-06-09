import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Users, Search, Filter, RefreshCw, Shield, MapPin, Trophy } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/admin/times')({
  component: AdminTimes,
})

interface Time {
  id: string
  nome: string
  status: string
  liga_id: string | null
  conferencia_id: string | null
  escudo_url: string | null
  created_at: string
  diretor_id: string | null
  ligas?: { nome: string } | null
}

function AdminTimes() {
  const [times, setTimes] = useState<Time[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [refreshing, setRefreshing] = useState(false)

  async function loadTimes() {
    setLoading(true)
    const { data, error } = await supabase
      .from('times')
      .select('*, ligas(nome)')
      .order('created_at', { ascending: false })
    if (error) {
      toast.error('Erro ao carregar times: ' + error.message)
    } else {
      setTimes(data || [])
    }
    setLoading(false)
  }

  useEffect(() => { loadTimes() }, [])

  async function handleRefresh() {
    setRefreshing(true)
    await loadTimes()
    setRefreshing(false)
  }

  const filtered = times.filter(t => {
    const matchSearch = t.nome.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'todos' || t.status === statusFilter
    return matchSearch && matchStatus
  })

  const stats = {
    total: times.length,
    aprovados: times.filter(t => t.status === 'approved').length,
    pendentes: times.filter(t => t.status === 'pending').length,
    reprovados: times.filter(t => t.status === 'rejected').length,
  }

  function statusBadge(status: string) {
    if (status === 'approved') return <Badge className="bg-green-600 text-white">Aprovado</Badge>
    if (status === 'pending') return <Badge className="bg-yellow-500 text-white">Pendente</Badge>
    if (status === 'rejected') return <Badge className="bg-red-600 text-white">Reprovado</Badge>
    return <Badge variant="outline">{status}</Badge>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-7 w-7 text-blue-500" />
          <div>
            <h1 className="text-2xl font-bold text-white">Gestao de Times</h1>
            <p className="text-gray-400 text-sm">Visualize e gerencie todos os times cadastrados</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={"h-4 w-4 mr-2 " + (refreshing ? 'animate-spin' : '')} />
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 flex items-center gap-3">
          <Users className="h-8 w-8 text-blue-400" />
          <div><p className="text-2xl font-bold text-white">{stats.total}</p><p className="text-gray-400 text-xs">Total</p></div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 flex items-center gap-3">
          <Trophy className="h-8 w-8 text-green-400" />
          <div><p className="text-2xl font-bold text-white">{stats.aprovados}</p><p className="text-gray-400 text-xs">Aprovados</p></div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 flex items-center gap-3">
          <Filter className="h-8 w-8 text-yellow-400" />
          <div><p className="text-2xl font-bold text-white">{stats.pendentes}</p><p className="text-gray-400 text-xs">Pendentes</p></div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 flex items-center gap-3">
          <MapPin className="h-8 w-8 text-red-400" />
          <div><p className="text-2xl font-bold text-white">{stats.reprovados}</p><p className="text-gray-400 text-xs">Reprovados</p></div>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar time..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-gray-800 border-gray-700 text-white"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] bg-gray-800 border-gray-700 text-white">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="approved">Aprovados</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="rejected">Reprovados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="bg-gray-800 rounded-lg p-4 animate-pulse">
              <div className="h-5 bg-gray-700 rounded w-1/3 mb-2" />
              <div className="h-4 bg-gray-700 rounded w-1/4" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="text-lg font-medium">Nenhum time encontrado</p>
          <p className="text-sm mt-1">
            {search || statusFilter !== 'todos'
              ? 'Tente ajustar os filtros de busca.'
              : 'Ainda nao ha times cadastrados.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(time => (
            <div
              key={time.id}
              className="bg-gray-800 rounded-lg p-4 flex items-center gap-4 hover:bg-gray-750 transition-colors"
            >
              {time.escudo_url ? (
                <img
                  src={time.escudo_url}
                  alt={time.nome}
                  className="h-12 w-12 rounded-full object-cover border-2 border-gray-600"
                />
              ) : (
                <div className="h-12 w-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
                  {time.nome.charAt(0)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold truncate">{time.nome}</p>
                <p className="text-gray-400 text-sm">
                  {time.ligas ? time.ligas.nome : 'Sem liga'} &bull; {new Date(time.created_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <div className="shrink-0">
                {statusBadge(time.status)}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <p className="text-gray-500 text-sm text-center">
          Exibindo {filtered.length} de {times.length} times
        </p>
      )}
    </div>
  )
         }
