import * as React from "react"

import { cn } from "@/lib/utils"

type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 sm:h-10 w-full rounded-[6px] border border-ds-border bg-ds-surface px-3 py-2 text-base sm:text-sm shadow-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-ds-muted ring-offset-background file:border-0 file:bg-secondary file:text-secondary-foreground file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent/40 focus-visible:ring-offset-0 focus-visible:border-ds-accent disabled:cursor-not-allowed disabled:bg-ds-surface-subtle disabled:text-ds-muted text-ds-ink",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }

