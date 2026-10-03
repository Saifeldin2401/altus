import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // Tokenized base. Tactile press feedback (active:scale-[0.98]) with Apple/Emil snappy transition curve. Motion is auto-disabled via prefers-reduced-motion.
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[6px] text-sm font-semibold tracking-[-0.01em] ring-offset-background transition-[transform,background-color,border-color,color,box-shadow] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 motion-reduce:transform-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.97]",
  {
    variants: {
      variant: {
        default: "bg-ds-ink text-ds-on-ink hover:bg-ds-ink/90",
        destructive:
          "bg-ds-danger text-white hover:bg-ds-danger/90",
        outline:
          "border border-ds-border bg-ds-surface text-ds-ink hover:border-ds-border-strong hover:bg-ds-surface-subtle",
        secondary:
          "bg-ds-surface-subtle text-ds-ink hover:bg-ds-border/50",
        ghost: "text-ds-ink hover:bg-ds-surface-subtle", // Transparent by default — recedes until hovered
        link: "text-ds-accent underline-offset-4 hover:underline",
        gold: "bg-ds-accent text-white hover:bg-ds-accent-hover",
        navy: "bg-ds-ink text-ds-on-ink hover:bg-ds-ink/90",
        copper: "bg-ds-accent text-white hover:bg-ds-accent-hover",
        sand: "bg-ds-accent-soft text-ds-ink hover:bg-ds-accent-soft/80",
      },
      size: {
        default: "h-11 px-4 py-2.5 text-sm",
        sm: "h-9 rounded-[6px] px-3 text-xs",
        lg: "h-12 rounded-[6px] px-8 text-base",
        icon: "h-11 w-11",
        "icon-sm": "h-9 w-9",
        "mobile": "h-12 px-5 py-3 text-base w-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const DARK_BG_REGEX = /\bbg-(?:hotel-navy|hotel-navy-dark|hotel-navy-light|altus-copper|altus-charcoal|slate-(?:700|800|900|950)|gray-(?:700|800|900|950)|zinc-(?:700|800|900|950)|neutral-(?:700|800|900|950)|stone-(?:700|800|900|950)|black|blue-(?:600|700|800|900)|indigo-(?:600|700|800|900)|purple-(?:600|700|800|900)|rose-(?:600|700|800|900)|red-(?:600|700|800|900)|emerald-(?:600|700|800|900)|green-(?:600|700|800|900))\b/
const HAS_TEXT_COLOR_REGEX = /\btext-(?:white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|hotel|altus|primary|secondary|muted|accent|destructive)\b/

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    const needsTextWhite = className && DARK_BG_REGEX.test(className) && !HAS_TEXT_COLOR_REGEX.test(className)
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), needsTextWhite ? "text-white" : undefined, className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }

