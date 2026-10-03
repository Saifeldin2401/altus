import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface ToolbarButtonProps {
  icon: LucideIcon
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  className?: string
  variant?: 'editor' | 'floating'
}

function ToolbarButton({
  icon: Icon,
  label,
  active = false,
  disabled = false,
  onClick,
  className,
  variant = 'editor',
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-muted-foreground transition-colors',
        'hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-40',
        active && 'border-ds-accent/60 bg-ds-accent/15 text-ds-ink',
        variant === 'floating' && 'border-ds-ink-secondary bg-ds-ink text-ds-muted hover:bg-ds-ink hover:text-ds-on-ink',
        variant === 'floating' && active && 'border-ds-accent bg-ds-accent/20 text-ds-accent',
        className
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
    </button>
  )
}

export default ToolbarButton
