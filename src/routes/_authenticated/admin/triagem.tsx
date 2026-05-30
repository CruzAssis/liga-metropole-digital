// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { supabase } from '~/integrations/supabase/client'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { useToast } from '~/hooks/use-toast'

export const Route = createFileRoute('/_authenticated/admin/triagem')({
  component: TriagemPage,
})

function TriagemPage() {
  const { toast } = useToast()
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [approvals, setApprovals] = useState({})

  useEffect(() => { loadPendingTeams() }, [])

  async function loadPendingTeams() {
    setLoading(true)
    const { data } = await supabase
      .from('teams')
      .select('*, diretor:profiles!profiles_time_diretor_id_fkey(nome_completo,telefone)')
      .eq('mensalidade_paga', false)
      .order('created_at', { ascending: true })
    if (data) {
      setTeams(data)
      const initial = {}
      data.forEach(t => { initial[t.id] = { lado: 'A', grupo: 'A', serie: 'A' } })
      setApprovals(initial)
    }
    setLoading(false)
  }
