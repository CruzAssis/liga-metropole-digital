import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { supabase } from '~/integrations/supabase/client'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { Checkbox } from '~/components/ui/checkbox'
import { useToast } from '~/hooks/use-toast'

export const Route = createFileRoute('/signup')({
  component: SignupPage,
})

function SignupPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ full_name: '', cpf: '', phone: '', email: '', password: '' })
  const [perfis, setPerfis] = useState({ is_diretor: false, is_jogador: false, is_torcedor: false })

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  function handlePerfil(key: keyof typeof perfis, val: boolean) {
    setPerfis(prev => ({ ...prev, [key]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!perfis.is_diretor && !perfis.is_jogador && !perfis.is_torcedor) {
      toast({ title: 'Selecione ao menos um perfil', variant: 'destructive' })
      return
    }
    setLoading(true)
// v2 - deploy Vercel
