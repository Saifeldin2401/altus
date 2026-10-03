import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface LearningPageHeroProps {
  eyebrow: string
  title: string
  description?: ReactNode
  children?: ReactNode
  quote?: ReactNode
  rightCard?: ReactNode
  image?: string
  className?: string
}

/**
 * Shared hospitality backdrop for the Learn and Knowledge workspace homes.
 * Editorial serif headline over a hotel photograph that fades into the surface
 * colour (so it works in dark mode and RTL), with an optional quote or side card.
 */
export function LearningPageHero({
  eyebrow,
  title,
  description,
  children,
  quote,
  rightCard,
  image = '/assets/altus/service-bell-hero.jpg',
  className,
}: LearningPageHeroProps) {
  return (
    <header
      className={cn(
        'relative isolate overflow-hidden rounded-[8px] border border-ds-border bg-ds-surface px-6 py-8 sm:px-10 sm:py-10 shadow-[0_4px_24px_rgb(21_33_46/0.03)]',
        className,
      )}
    >
      {/* Background image anchored to the right (or left in RTL) */}
      <div
        aria-hidden="true"
        className="absolute inset-y-0 end-0 -z-10 w-full sm:w-[65%] lg:w-[50%] bg-cover bg-center bg-no-repeat opacity-90 transition-opacity"
        style={{ backgroundImage: `url(${image})` }}
      />
      {/* Luxury smooth gradient mask blending into warm ivory surface */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-r from-ds-surface from-40% via-ds-surface/75 via-65% to-ds-surface/15 rtl:bg-gradient-to-l"
      />

      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
        {/* Left / Main text content */}
        <div className="max-w-3xl space-y-3.5">
          <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.2em] text-ds-brass">
            {eyebrow}
          </p>
          <h1 className="max-w-2xl font-editorial text-[38px] sm:text-[48px] lg:text-[52px] font-medium leading-[1.04] text-ds-ink">
            {title}
          </h1>
          {description && (
            <div className="max-w-2xl text-sm sm:text-base leading-relaxed text-ds-ink-secondary">
              {description}
            </div>
          )}
          {children && <div className="pt-2">{children}</div>}
        </div>

        {/* Right side element: either a frosted widget card or the signature Altus editorial quote */}
        {rightCard ? (
          <div className="shrink-0 self-start lg:self-center mt-2 lg:mt-0">
            {rightCard}
          </div>
        ) : quote ? (
          <div className="hidden lg:flex shrink-0 items-center justify-end self-center pe-4">
            <p className="font-editorial text-[22px] sm:text-[24px] font-semibold leading-[1.15] text-ds-ink text-end max-w-[14rem] tracking-tight">
              {quote}
            </p>
          </div>
        ) : null}
      </div>
    </header>
  )
}
