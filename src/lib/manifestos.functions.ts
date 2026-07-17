import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

const slugSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9-]+$/, 'Slug inválido')

const saveSchema = z.object({
  slug: slugSchema,
  team_name: z.string().min(2).max(120),
  // Data URL (data:image/...;base64,....) opcional. Se ausente, mantém o logo atual.
  logo_data_url: z.string().max(6_000_000).optional().nullable(),
})

function decodeDataUrl(dataUrl: string): { bytes: Uint8Array; contentType: string; ext: string } | null {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl)
  if (!match) return null
  const contentType = match[1]
  const b64 = match[2]
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const extMap: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
  }
  const ext = extMap[contentType] ?? 'png'
  return { bytes, contentType, ext }
}

export const saveManifesto = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => saveSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

    // Autorização: apenas admin
    const { data: adminRow } = await context.supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', context.userId)
      .eq('role', 'admin')
      .maybeSingle()
    if (!adminRow) throw new Error('Apenas administradores podem salvar manifestos.')

    let logo_url: string | null | undefined = undefined
    if (data.logo_data_url) {
      const decoded = decodeDataUrl(data.logo_data_url)
      if (!decoded) throw new Error('Formato de imagem inválido.')
      if (decoded.bytes.byteLength > 3 * 1024 * 1024) {
        throw new Error('Imagem muito grande (máx 3MB).')
      }
      const path = `manifestos/${data.slug}-${Date.now()}.${decoded.ext}`
      const { error: upErr } = await supabaseAdmin.storage
        .from('team-logos')
        .upload(path, decoded.bytes, { contentType: decoded.contentType, upsert: true })
      if (upErr) throw new Error(`Erro ao enviar escudo: ${upErr.message}`)
      const { data: pub } = supabaseAdmin.storage.from('team-logos').getPublicUrl(path)
      logo_url = pub.publicUrl
    }

    // Upsert por slug
    const { data: existing } = await supabaseAdmin
      .from('manifestos' as never)
      .select('id, logo_url')
      .eq('slug', data.slug)
      .maybeSingle()

    if (existing) {
      const patch: Record<string, unknown> = { team_name: data.team_name }
      if (logo_url !== undefined) patch.logo_url = logo_url
      const { error } = await supabaseAdmin
        .from('manifestos' as never)
        .update(patch)
        .eq('slug', data.slug)
      if (error) throw new Error(error.message)
    } else {
      const { error } = await supabaseAdmin.from('manifestos' as never).insert({
        slug: data.slug,
        team_name: data.team_name,
        logo_url: logo_url ?? null,
        created_by: context.userId,
      })
      if (error) throw new Error(error.message)
    }

    return { slug: data.slug }
  })

export const listManifestos = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: adminRow } = await context.supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', context.userId)
      .eq('role', 'admin')
      .maybeSingle()
    if (!adminRow) throw new Error('Apenas administradores.')

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { data, error } = await supabaseAdmin
      .from('manifestos' as never)
      .select('id, slug, team_name, logo_url, created_at')
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []) as Array<{
      id: string
      slug: string
      team_name: string
      logo_url: string | null
      created_at: string
    }>
  })

export const deleteManifesto = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ slug: slugSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: adminRow } = await context.supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', context.userId)
      .eq('role', 'admin')
      .maybeSingle()
    if (!adminRow) throw new Error('Apenas administradores.')

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { error } = await supabaseAdmin
      .from('manifestos' as never)
      .delete()
      .eq('slug', data.slug)
    if (error) throw new Error(error.message)
    return { ok: true }
  })
