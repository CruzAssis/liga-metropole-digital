import { BrandLogo } from '@/components/BrandLogo'
import { Link } from '@tanstack/react-router'
import { Download, Image as ImageIcon, UserPlus } from 'lucide-react'
import { useRef, useState } from 'react'
import { toJpeg } from 'html-to-image'

export type ManifestoTeam = {
  name: string
  short_name: string | null
  logo_url: string | null
}

export function ManifestoContent({ team }: { team: ManifestoTeam }) {
  const flyerRef = useRef<HTMLElement | null>(null)
  const [exporting, setExporting] = useState(false)

  async function handleDownloadImage() {
    if (!flyerRef.current || exporting) return
    setExporting(true)
    // Força largura de desktop para não sair cortado em telas pequenas
    const node = flyerRef.current
    const EXPORT_WIDTH = 720
    const prevWidth = node.style.width
    const prevMaxWidth = node.style.maxWidth
    node.style.width = `${EXPORT_WIDTH}px`
    node.style.maxWidth = `${EXPORT_WIDTH}px`
    // Aguarda o layout recalcular antes de capturar
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    try {
      const height = Math.max(node.scrollHeight, node.offsetHeight)
      const dataUrl = await toJpeg(node, {
        quality: 0.92,
        pixelRatio: 2,
        backgroundColor: '#000000',
        cacheBust: true,
        width: EXPORT_WIDTH,
        height,
        canvasWidth: EXPORT_WIDTH,
        canvasHeight: height,
        style: {
          margin: '0',
          transform: 'none',
          width: `${EXPORT_WIDTH}px`,
          height: `${height}px`,
        },
      })
      const a = document.createElement('a')
      const safe = team.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      a.download = `manifesto-${safe || 'liga-metropole'}.jpg`
      a.href = dataUrl
      a.click()
    } catch (e) {
      console.error('[manifesto] falha ao gerar imagem', e)
    } finally {
      node.style.width = prevWidth
      node.style.maxWidth = prevMaxWidth
      setExporting(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#1565F5]" aria-hidden />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(circle at 20% 0%, rgba(21,101,245,0.18), transparent 55%), radial-gradient(circle at 90% 100%, rgba(21,101,245,0.10), transparent 60%)',
        }}
      />

      <article ref={flyerRef} className="relative max-w-2xl mx-auto px-6 py-16 sm:py-20">
        <header className="flex items-center justify-between gap-6 mb-14">
          <div className="flex flex-col items-center gap-2">
            {team.logo_url ? (
              <img
                src={team.logo_url}
                alt={`Emblema ${team.name}`}
                className="h-16 w-16 sm:h-20 sm:w-20 object-contain"
                draggable={false}
              />
            ) : (
              <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 font-bold text-xs">
                {team.short_name ?? team.name.slice(0, 3).toUpperCase()}
              </div>
            )}
            <span className="text-[10px] uppercase tracking-widest text-zinc-500">
              Clube Fundador
            </span>
          </div>

          <div
            className="flex-1 h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent"
            aria-hidden
          />

          <div className="flex flex-col items-center gap-2">
            <BrandLogo className="h-16 w-auto sm:h-20" />
            <span className="text-[10px] uppercase tracking-widest text-zinc-500">
              Liga Metrópole
            </span>
          </div>
        </header>

        <p className="text-xs uppercase tracking-[0.3em] text-[#1565F5] font-semibold mb-3">
          Manifesto — Convite ao {team.name}
        </p>
        <h1 className="text-3xl sm:text-4xl font-black leading-tight mb-10">
          <span className="text-white">{team.name}</span>
          <span className="text-zinc-500">,</span>{' '}
          <span className="text-zinc-300">o futebol de várzea é, antes de tudo,</span>{' '}
          <span className="text-[#1565F5]">um ato de resistência.</span>
        </h1>

        <div className="space-y-6 text-zinc-200 text-base sm:text-lg leading-relaxed">
          <p>
            É aqui, nos campos de terra e grama da nossa Subprefeitura, que batem os corações
            mais puros do futebol paulistano.
          </p>
          <p>
            A Liga Metrópole não nasce para ser apenas uma tabela de jogos. Nascemos para ser o{' '}
            <strong className="text-white">arquivo da sua história</strong> e o{' '}
            <strong className="text-white">holofote do seu talento</strong>. Acreditamos que
            cada gol marcado, cada defesa impossível e cada rodada organizada por um diretor
            apaixonado merece ser vista, registrada e celebrada.
          </p>
          <p className="text-white font-semibold">
            Nosso propósito é claro: dar visibilidade a quem a história esqueceu.
          </p>

          <div className="space-y-4 border-l-2 border-[#1565F5] pl-5 py-1">
            <div>
              <p className="text-white font-bold">Competitividade Real</p>
              <p className="text-zinc-300">
                Organizamos o caos em conferências, transformando a várzea na vitrine que ela
                sempre deveria ter sido.
              </p>
            </div>
            <div>
              <p className="text-white font-bold">Caça de Talentos</p>
              <p className="text-zinc-300">
                Os dados não mentem. Vamos mostrar para o mundo a estatística, o craque da
                partida e o talento que, até hoje, estava escondido nos nossos bairros.
              </p>
            </div>
            <div>
              <p className="text-white font-bold">Legado</p>
              <p className="text-zinc-300">
                Queremos documentar a vida de cada clube, a luta de cada diretor e o que cada
                camisa representa para sua comunidade. Queremos mostrar do que a várzea é
                feita: de garra, de sangue e de sonho.
              </p>
            </div>
          </div>

          <p>
            A Liga Metrópole é a <strong className="text-white">tecnologia servindo à paixão</strong>.
            É o dado que vira troféu, é o flyer que vira reconhecimento, é a sua história virando
            memória.
          </p>

          <div className="mt-10 rounded-xl border border-[#1565F5]/40 bg-[#1565F5]/5 p-6">
            <p className="text-zinc-200">
              <span className="text-white font-semibold">{team.name}</span>, você foi convidado
              porque o seu time não é apenas um nome em uma súmula — é um{' '}
              <strong className="text-white">pilar desse movimento</strong>.
            </p>
            <p className="mt-3 text-xl sm:text-2xl font-black text-white">
              Seja um <span className="text-[#1565F5]">Clube Fundador</span>.
            </p>
          </div>
        </div>

        <div className="mt-12 flex flex-col sm:flex-row gap-3 print:hidden">
          <Link
            to="/signup"
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#1565F5] hover:bg-[#1565F5]/90 text-white font-bold py-4 px-6 transition-colors"
          >
            <UserPlus className="h-5 w-5" />
            Cadastrar equipe
          </Link>
          <button
            type="button"
            onClick={handleDownloadImage}
            disabled={exporting}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 hover:border-[#1565F5] hover:bg-zinc-900 text-white font-semibold py-4 px-6 transition-colors disabled:opacity-60"
          >
            <ImageIcon className="h-5 w-5" />
            {exporting ? 'Gerando imagem...' : 'Baixar flyer (JPG)'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') window.print()
            }}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 hover:border-[#1565F5] hover:bg-zinc-900 text-white font-semibold py-4 px-6 transition-colors"
          >
            <Download className="h-5 w-5" />
            Baixar em PDF
          </button>
        </div>

        <footer className="mt-16 pt-8 border-t border-zinc-800">
          <p className="text-white font-bold text-lg tracking-wide">
            Diretoria Liga Metrópole
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Gestão: Shelder &amp; Kabelo (Índio)
          </p>
        </footer>
      </article>
    </div>
  )
}
