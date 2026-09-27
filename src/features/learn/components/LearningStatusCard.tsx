import type { LucideIcon } from 'lucide-react'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface LearningStatusCardProps {
  title: string
  value: string | number
  detail: string
  href: string
  icon: LucideIcon
  tone?: 'gold' | 'rose' | 'green' | 'blue' | 'purple'
}

const toneStyles = {
  gold: { iconBg: 'bg-ds-brass/15', iconText: 'text-ds-brass' },
  rose: { iconBg: 'bg-ds-danger-soft', iconText: 'text-ds-danger' },
  green: { iconBg: 'bg-ds-success-soft', iconText: 'text-ds-success' },
  blue: { iconBg: 'bg-ds-info-soft', iconText: 'text-ds-info' },
  purple: { iconBg: 'bg-ds-accent-soft', iconText: 'text-ds-accent' },
} as const

/**
 * A headline number with a link to the list behind it (My day / My learning summary row).
 */
export function LearningStatusCard({
  title,
  value,
  detail,
  href,
  icon: Icon,
  tone = 'gold',
}: LearningStatusCardProps) {
  const t = toneStyles[tone] || toneStyles.gold

  return (
    <Link
      to={href}
      className="group flex min-h-[92px] items-center gap-4 rounded-xl border border-ds-border bg-ds-surface p-4 shadow-[0_2px_8px_rgb(21_33_46/0.03)] transition-[transform,border-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:border-ds-border-strong hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent motion-reduce:hover:translate-y-0"
    >
      <span className={cn('inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors', t.iconBg, t.iconText)}>
        <Icon aria-hidden="true" className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-ds-muted">{title}</span>
        <div className="flex items-baseline gap-1.5 mt-0.5">
          <span className="font-editorial text-[32px] sm:text-[34px] font-bold leading-none text-ds-ink">
            {value}
          </span>
          <span className="text-xs font-normal text-ds-muted">{detail}</span>
        </div>
      </span>
      <ChevronRight
        aria-hidden="true"
        className="h-4 w-4 shrink-0 text-ds-muted transition-transform duration-200 ease-out group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
      />
    </Link>
  )
}
