import { forwardRef, useCallback, useRef, useState } from 'react'
import { Button, type ButtonProps } from '@/components/ui/button'
import { Spinner } from '@/components/AppSkeletons'
import { cn } from '@/lib/utils'

interface PrimaryCTAProps extends ButtonProps {
  loading?: boolean
  fullWidth?: boolean
  loadingText?: string
}

/**
 * Botão de ação primária (Liga Metrópole).
 * Padroniza cor, altura, peso e estado de loading.
 *
 * Proteções contra duplo-clique:
 * - Enquanto `loading` (controlado pelo pai) for true, o botão fica disabled.
 * - Se o `onClick` retornar uma Promise, gerenciamos um estado interno "pending"
 *   e ignoramos cliques subsequentes até a Promise resolver/rejeitar.
 * - Um ref garante que, mesmo antes do re-render, cliques rápidos consecutivos
 *   não disparem o handler duas vezes.
 */
export const PrimaryCTA = forwardRef<HTMLButtonElement, PrimaryCTAProps>(
  (
    { loading, fullWidth = true, disabled, className, children, loadingText, onClick, ...props },
    ref,
  ) => {
    const [internalPending, setInternalPending] = useState(false)
    const inFlightRef = useRef(false)

    const handleClick = useCallback(
      async (e: React.MouseEvent<HTMLButtonElement>) => {
        if (inFlightRef.current || loading || internalPending || disabled) {
          e.preventDefault()
          return
        }
        if (!onClick) return
        try {
          inFlightRef.current = true
          const ret = onClick(e) as unknown
          if (ret && typeof (ret as Promise<unknown>).then === 'function') {
            setInternalPending(true)
            try {
              await ret
            } finally {
              setInternalPending(false)
            }
          }
        } finally {
          inFlightRef.current = false
        }
      },
      [onClick, loading, internalPending, disabled],
    )

    const isBusy = !!loading || internalPending
    const isDisabled = !!disabled || isBusy

    return (
      <Button
        ref={ref}
        onClick={handleClick}
        disabled={isDisabled}
        aria-busy={isBusy || undefined}
        className={cn(
          'bg-[#1565F5] hover:bg-blue-600 text-white font-semibold h-11 disabled:opacity-60 disabled:cursor-not-allowed',
          fullWidth && 'w-full',
          className,
        )}
        {...props}
      >
        {isBusy ? (
          <span className="inline-flex items-center gap-2">
            <Spinner />
            {loadingText && <span>{loadingText}</span>}
          </span>
        ) : (
          children
        )}
      </Button>
    )
  },
)
PrimaryCTA.displayName = 'PrimaryCTA'
