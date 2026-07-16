import { forwardRef, useCallback, useRef, useState } from 'react'
import { Button, type ButtonProps } from '@/components/ui/button'
import { Spinner } from '@/components/AppSkeletons'
import { cn } from '@/lib/utils'
import { AlertCircle } from 'lucide-react'

interface PrimaryCTAProps extends ButtonProps {
  loading?: boolean
  fullWidth?: boolean
  loadingText?: string
  /** Mensagem de erro destacada mostrada acima do botão. */
  errorMessage?: string | null
}

/**
 * Botão de ação primária (Liga Metrópole).
 * Padroniza cor, altura, peso, estado de loading e exibição de erro.
 *
 * Proteções contra duplo-clique:
 * - Enquanto `loading` (controlado pelo pai) for true, o botão fica disabled.
 * - Se o `onClick` retornar uma Promise, gerenciamos um estado interno "pending"
 *   e ignoramos cliques subsequentes até a Promise resolver/rejeitar.
 * - Um ref garante que, mesmo antes do re-render, cliques rápidos consecutivos
 *   não disparem o handler duas vezes.
 *
 * Erros: passe `errorMessage` para renderizar um bloco destacado (role="alert")
 * imediatamente acima do botão, com ícone e cor de erro.
 */
export const PrimaryCTA = forwardRef<HTMLButtonElement, PrimaryCTAProps>(
  (
    { loading, fullWidth = true, disabled, className, children, loadingText, errorMessage, onClick, ...props },
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
      <div className={cn(fullWidth && 'w-full', 'space-y-2')}>
        {errorMessage && (
          <div
            role="alert"
            aria-live="assertive"
            className="flex items-start gap-2 rounded-lg border border-red-800/60 bg-red-950/40 px-3 py-2 text-sm text-red-300"
          >
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-400" />
            <span className="leading-snug">{errorMessage}</span>
          </div>
        )}
        <Button
          ref={ref}
          onClick={handleClick}
          disabled={isDisabled}
          aria-busy={isBusy || undefined}
          aria-invalid={errorMessage ? true : undefined}
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
      </div>
    )
  },
)
PrimaryCTA.displayName = 'PrimaryCTA'
