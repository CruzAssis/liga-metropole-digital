import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import criciuma from '@/assets/campos/criciuma-elias.jpeg.asset.json'
import sporting from '@/assets/campos/sporting.jpeg.asset.json'
import mazoni from '@/assets/campos/tomas-mazoni.jpeg.asset.json'
import atlas from '@/assets/campos/atlas.jpeg.asset.json'
import principes from '@/assets/campos/principes-do-morro.jpeg.asset.json'
import guacu from '@/assets/campos/arena-guacu.jpeg.asset.json'
import gremio from '@/assets/campos/arena-gremio.jpeg.asset.json'
import savik from '@/assets/campos/santinhos-savik.jpeg.asset.json'

const SLIDES = [
  { url: criciuma.url, name: 'Criciúma Elias' },
  { url: sporting.url, name: 'Sporting' },
  { url: mazoni.url, name: 'Tomás Mazoni' },
  { url: atlas.url, name: 'Atlas' },
  { url: principes.url, name: 'Príncipes do Morro' },
  { url: guacu.url, name: 'Arena Guaçu' },
  { url: gremio.url, name: 'Arena Grêmio' },
  { url: savik.url, name: 'Santinhos Savik' },
]

const INTERVAL_MS = 6000
const FOUNDER_TAKEN = 2
const FOUNDER_TOTAL = 20

export default function HeroCarousel() {
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % SLIDES.length), INTERVAL_MS)
    return () => clearInterval(t)
  }, [])

  const pct = (FOUNDER_TAKEN / FOUNDER_TOTAL) * 100

  return (
    <section className="relative isolate overflow-hidden h-[90vh] min-h-[600px] w-full">
      {/* Slides */}
      {SLIDES.map((s, i) => (
        <div
          key={s.url}
          aria-hidden={i !== idx}
          className="absolute inset-0 transition-opacity duration-[1500ms] ease-in-out"
          style={{
            opacity: i === idx ? 1 : 0,
            backgroundImage: `url("${s.url}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            transform: i === idx ? 'scale(1.05)' : 'scale(1)',
            transition: 'opacity 1500ms ease-in-out, transform 7000ms ease-out',
          }}
        />
      ))}

      {/* Overlay: black + royal blue at 65% */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.72) 0%, rgba(6,15,40,0.65) 55%, rgba(21,101,245,0.35) 100%)',
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center h-full px-6 max-w-3xl mx-auto">
        <span
          className="inline-flex items-center gap-1.5 mb-6 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-widest"
          style={{ background: 'rgba(21,101,245,0.18)', border: '1px solid rgba(21,101,245,0.45)', color: '#93BBFF' }}
        >
          Zona Norte · Temporada 2026
        </span>

        <h1
          className="font-black text-white"
          style={{
            fontSize: 'clamp(36px, 7vw, 68px)',
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
            textShadow: '0 4px 30px rgba(0,0,0,0.6)',
          }}
        >
          Liga Metrópole:
          <br />
          <span style={{ color: '#FFFFFF' }}>o seu </span>
          <span style={{ color: '#4C9BFF' }}>legado</span>
          <span style={{ color: '#FFFFFF' }}>, a nossa </span>
          <span style={{ color: '#4C9BFF' }}>vitrine</span>
          <span style={{ color: '#FFFFFF' }}>.</span>
        </h1>

        {/* Termômetro de Vagas */}
        <div className="mt-10 w-full max-w-md">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider mb-2 text-white/90">
            <span>Vagas de Clubes Fundadores</span>
            <span className="tabular-nums text-[#4C9BFF]">{FOUNDER_TAKEN} / {FOUNDER_TOTAL}</span>
          </div>
          <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.15)' }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${pct}%`,
                background: 'linear-gradient(90deg, #1565F5 0%, #4C9BFF 100%)',
                boxShadow: '0 0 20px rgba(21,101,245,0.7)',
              }}
            />
          </div>
          <p className="mt-2 text-xs text-white/70">
            {FOUNDER_TOTAL - FOUNDER_TAKEN} vagas restantes · acesso vitalício de fundador
          </p>
        </div>

        {/* CTA */}
        <Link
          to="/signup"
          search={{ perfil: 'diretor' }}
          className="mt-10 inline-flex items-center justify-center rounded-lg font-bold uppercase tracking-wider transition-all hover:brightness-110 hover:scale-[1.02]"
          style={{
            background: '#1565F5',
            color: '#FFFFFF',
            padding: '16px 36px',
            fontSize: 15,
            letterSpacing: '0.05em',
            boxShadow: '0 10px 40px rgba(21,101,245,0.5), 0 0 0 1px rgba(255,255,255,0.1) inset',
          }}
        >
          Cadastrar meu time →
        </Link>

        {/* Field name */}
        <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between text-[11px] uppercase tracking-widest text-white/60">
          <span>{SLIDES[idx].name}</span>
          <div className="flex gap-1.5">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                aria-label={`Ir para slide ${i + 1}`}
                className="h-1 rounded-full transition-all"
                style={{
                  width: i === idx ? 24 : 8,
                  background: i === idx ? '#4C9BFF' : 'rgba(255,255,255,0.35)',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
