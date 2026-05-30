// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { supabase } from '~/integrations/supabase/client'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Textarea } from '~/components/ui/textarea'
import { Badge } from '~/components/ui/badge'
import { useToast } from '~/hooks/use-toast'

export const Route = createFileRoute('/partidas/$id')({
  component: PartidaPage,
})

function horasRestantes(prazo) {
  const diff = new Date(prazo).getTime() - Date.now()
  if (diff <= 0) return 'Prazo encerrado'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return h + 'h ' + m + 'min restantes'
}

function PartidaPage() {
  const { id } = Route.useParams()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [partida, setPartida] = useState(null)
  const [userTimeId, setUserTimeId] = useState(null)
  const [placarMandante, setPlacarMandante] = useState('')
  const [placarVisitante, setPlacarVisitante] = useState('')
  const [placarConfirmado, setPlacarConfirmado] = useState(false)
  const [gols, setGols] = useState([{ jogador_nome: '', assistencia_nome: '' }])
  const [destaques, setDestaques] = useState([{ nome: '', numero_camisa: '' }, { nome: '', numero_camisa: '' }, { nome: '', numero_camisa: '' }])
  const [destaqueSelecionado, setDestaqueSelecionado] = useState('')
  const [notaDestaque, setNotaDestaque] = useState('')
