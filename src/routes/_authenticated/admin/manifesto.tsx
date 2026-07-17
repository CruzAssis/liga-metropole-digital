import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useRef, useState } from 'react'
import { ManifestoContent } from '@/components/ManifestoContent'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Upload, Copy, Check, ImageIcon } from 'lucide-react'
import { toast } from 'sonner'

export const Route = createFileRoute('/_authenticated/admin/manifesto')({
  component: AdminManifestoPage,
})

function slugify(input: string) {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function AdminManifestoPage() {
  const [name, setName] = useState('')
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [copied, setCopied] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const slug = useMemo(() => slugify(name), [name])
  const shareUrl = useMemo(() => {
    if (!slug) return ''
    return `${typeof window !== 'undefined' ? window.location.origin : ''}/manifesto/${slug}`
  }, [slug])

  function handleFile(f: File | null) {
    if (!f) return
    if (!f.type.startsWith('image/')) {
      toast.error('Envie um arquivo de imagem (PNG, JPG, SVG).')
      return
    }
    if (f.size > 3 * 1024 * 1024) {
      toast.error('Imagem muito grande. Máximo 3MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setLogoDataUrl(String(reader.result))
    reader.readAsDataURL(f)
  }

  function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Informe o nome do time.')
      return
    }
    setShowPreview(true)
  }

  async function handleCopy() {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    toast.success('Link copiado')
    setTimeout(() => setCopied(false), 1500)
  }

  if (showPreview) {
    return (
      <div className="min-h-screen bg-black">
        <div className="sticky top-0 z-30 bg-black/80 backdrop-blur border-b border-zinc-800">
          <div className="max-w-2xl mx-auto px-6 py-3 flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-widest text-zinc-500">
              Prévia do manifesto
            </p>
            <div className="flex items-center gap-2">
              {shareUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="border-zinc-700 text-white hover:bg-zinc-900"
                >
                  {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                  Copiar link
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPreview(false)}
                className="text-zinc-300 hover:bg-zinc-900"
              >
                Editar
              </Button>
            </div>
          </div>
        </div>
        <ManifestoContent
          team={{
            name: name.trim(),
            short_name: null,
            logo_url: logoDataUrl,
          }}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#1565F5]" aria-hidden />
      <div className="max-w-xl mx-auto px-6 py-16">
        <p className="text-xs uppercase tracking-[0.3em] text-[#1565F5] font-semibold mb-3">
          Admin — Carta Convite
        </p>
        <h1 className="text-3xl font-black mb-2">Gerar Manifesto</h1>
        <p className="text-zinc-400 text-sm mb-10">
          Envie o escudo do time e informe o nome. Vamos gerar a carta convite personalizada
          com o manifesto da Liga Metrópole.
        </p>

        <form onSubmit={handleGenerate} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="team-name" className="text-white">
              Nome do time
            </Label>
            <Input
              id="team-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Vila Nova FC"
              className="bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600"
              autoFocus
            />
            {slug && (
              <p className="text-xs text-zinc-500">
                URL: <span className="text-[#1565F5]">/manifesto/{slug}</span>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-white">Escudo do time</Label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full flex items-center gap-4 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/60 hover:bg-zinc-900 hover:border-[#1565F5]/60 transition-colors p-4 text-left"
            >
              {logoDataUrl ? (
                <img
                  src={logoDataUrl}
                  alt="Prévia do escudo"
                  className="h-16 w-16 object-contain shrink-0"
                />
              ) : (
                <div className="h-16 w-16 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                  <ImageIcon className="h-6 w-6 text-zinc-500" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  {logoDataUrl ? 'Trocar escudo' : 'Enviar escudo'}
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  PNG, JPG ou SVG — até 3MB
                </p>
              </div>
            </button>
          </div>

          <Button
            type="submit"
            className="w-full bg-[#1565F5] hover:bg-[#1565F5]/90 text-white font-semibold h-12"
          >
            Gerar carta convite
          </Button>
        </form>
      </div>
    </div>
  )
}
