// @ts-nocheck
import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <span className="text-lg font-bold tracking-tight">Liga Metropole Varzea</span>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-sm text-zinc-400 hover:text-white transition-colors">Entrar</Link>
          <Link to="/signup" className="text-sm bg-[#1565F5] hover:bg-blue-600 text-white px-4 py-1.5 rounded-md font-medium transition-colors">Criar conta</Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-20">
        <div className="max-w-2xl mx-auto space-y-6">
          <p className="text-[#1565F5] text-sm font-semibold tracking-widest uppercase">TEMPORADA 2026</p>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight leading-tight">
            Metropole<br />
            <span className="text-[#1565F5]">Varzea</span>
          </h1>
          <p className="text-zinc-400 text-lg max-w-lg mx-auto leading-relaxed">
            A liga oficial da varzea metropolitana. 80 times, dois grupos - Mandantes e Visitantes - uma temporada inteira de futebol de bairro.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              to="/signup"
              className="w-full sm:w-auto bg-[#1565F5] hover:bg-blue-600 text-white font-semibold px-8 py-3 rounded-lg text-base transition-colors text-center"
            >
