import { forwardRef } from 'react'
import { Button, type ButtonProps } from '@/components/ui/button'
import { Spinner } from '@/components/AppSkeletons'
import { cn } from '@/lib/utils'

interface PrimaryCTAProps extends ButtonProps {
  loading?: boolean
  fullWidth?: boolean
}

/**
 * Botão de ação primária (Liga Metrópole).
 * Padroniza cor, altura, peso e estado de loading.
 */
export const PrimaryCTA = forwardRef<HTMLButtonElement, PrimaryCTAProps>(
  ({ loading, fullWidth = true, disabled, className, children, ...props }, ref) => (
    <Button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'bg-[#1565F5] hover:bg-blue-600 text-white font-semibold h-11',
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {loading ? <Spinner /> : children}
    </Button>
  ),
)
PrimaryCTA.displayName = 'PrimaryCTA'
