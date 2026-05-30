// @ts-nocheck
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { supabase } from '~/integrations/supabase/client'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group'
import { useToast } from '~/hooks/use-toast'

export const Route = createFileRoute('/_authenticated/inscricao')({
  component: InscricaoPage,
})

function InscricaoPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
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
