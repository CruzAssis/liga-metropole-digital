import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

type Variant = 'page' | 'badge' | 'inline'

interface StepHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  step?: number | string
  variant?: Variant
  stepClassName?: string
  className?: string
}

/**
 * Cabeçalho reutilizável para páginas e etapas de fluxo.
 * - `page`   → título grande centralizado + subtítulo (onboarding).
 * - `badge`  → título com badge circular numerado (súmula).
 * - `inline` → título com número inline em destaque (partidas).
 */
export function StepHeader({
  title,
  subtitle,
  step,
  variant = 'page',
  stepClassName,
  className,
}: StepHeaderProps) {
  if (variant === 'page') {
    return (
      <div className={cn('text-center', className)}>
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>}
      </div>
    )
  }

  if (variant === 'badge') {
    return (
      <h3
        className={cn(
          'text-white font-semibold flex items-center gap-2',
          className,
        )}
      >
        {step !== undefined && (
          <span
            className={cn(
              'w-7 h-7 rounded-full bg-[#1565F5] text-white text-sm font-bold flex items-center justify-center',
              stepClassName,
            )}
          >
            {step}
          </span>
        )}
        {title}
      </h3>
    )
  }

  // inline
  return (
    <h3
      className={cn(
        'text-white font-semibold flex items-center gap-2',
        className,
      )}
    >
      {step !== undefined && (
        <span className={cn('text-[#1565F5] font-bold', stepClassName)}>
          {step}
        </span>
      )}
      {title}
    </h3>
  )
}
