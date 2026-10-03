import { cn } from "@/lib/utils"
import * as React from "react"

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-[6px] border border-ds-border bg-ds-surface px-3 py-2 text-sm ring-offset-background placeholder:text-ds-muted focus-visible:outline-none focus-visible:border-ds-accent focus-visible:ring-2 focus-visible:ring-ds-accent/40 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:bg-ds-surface-subtle disabled:text-ds-muted text-ds-ink",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }



