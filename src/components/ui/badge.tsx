import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 whitespace-nowrap shrink-0 leading-normal",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-ds-ink text-ds-on-ink",
        secondary:
          "border-ds-border bg-ds-surface-subtle text-ds-ink-secondary",
        destructive:
          "border-ds-danger/30 bg-ds-danger-soft text-ds-danger",
        outline: "border-ds-border text-ds-ink-secondary bg-transparent",
        gold: "border-ds-accent/30 bg-ds-accent-soft text-ds-accent",
        navy: "border-transparent bg-ds-ink text-ds-on-ink",
        copper: "border-ds-warning/30 bg-ds-warning-soft text-ds-warning",
        emerald: "border-ds-success/30 bg-ds-success-soft text-ds-success",
        sand: "border-ds-accent/20 bg-ds-accent-soft text-ds-ink",
        "outline-gold": "text-ds-accent border-ds-accent/40",
        "outline-copper": "text-ds-warning border-ds-warning/40",
        success: "border-ds-success/30 bg-ds-success-soft text-ds-success",
        warning: "border-ds-warning/30 bg-ds-warning-soft text-ds-warning",
      },
      size: {
        sm: "px-2 py-0.5 text-[11px]",
        md: "px-2.5 py-0.5 text-xs",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
  VariantProps<typeof badgeVariants> {
  /** Renders a small filled dot instead of a label */
  dot?: boolean
  /** Numeric count to display; overrides children when set */
  count?: number
  /** Max count before showing "N+" (default 99) */
  maxCount?: number
}

function Badge({ className, variant, size, dot, count, maxCount = 99, children, ...props }: BadgeProps) {
  if (dot) {
    const dotSizes: Record<string, string> = { sm: "h-2 w-2", md: "h-2.5 w-2.5", lg: "h-3 w-3" }
    return (
      <span
        className={cn(
          "rounded-full",
          badgeVariants({ variant }),
          dotSizes[size ?? "md"],
          className
        )}
        {...props}
      />
    )
  }

  const displayCount = count !== undefined
    ? (count > maxCount ? `${maxCount}+` : count)
    : undefined

  const isNumeric = count !== undefined || typeof children === 'number'

  return (
    <span className={cn(badgeVariants({ variant, size }), isNumeric && "font-mono tracking-tight", className)} {...props}>
      {displayCount !== undefined ? displayCount : children}
    </span>
  )
}

export { Badge, badgeVariants }
