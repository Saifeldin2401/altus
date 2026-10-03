import { Badge } from '@/components/ui/badge'
import type { DocumentStatus } from '@/lib/constants'
import { DOCUMENT_STATUSES } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: DocumentStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const statusConfig = DOCUMENT_STATUSES[status]

  // Explicit high-contrast colors to ensure visibility
  // Using specific Tailwind classes bypassing Badge variants to avoid conflicts
  const colorMap: Record<string, string> = {
    gray: "bg-ds-surface-subtle text-ds-ink border-ds-border hover:bg-ds-surface-subtle/80",
    yellow: "bg-ds-warning-soft text-ds-warning border-ds-warning/30 hover:bg-ds-warning-soft/80",
    blue: "bg-ds-info-soft text-ds-info border-ds-info/30 hover:bg-ds-info-soft/80",
    green: "bg-ds-success-soft text-ds-success border-ds-success/30 hover:bg-ds-success-soft/80",
    orange: "bg-ds-warning-soft text-ds-warning border-ds-warning/30 hover:bg-ds-warning-soft/80",
    red: "bg-ds-danger-soft text-ds-danger border-ds-danger/30 hover:bg-ds-danger-soft/80",
  }

  // Fallback to gray if color is not found
  const colorClasses = colorMap[statusConfig.color] || colorMap.gray

  return (
    <Badge
      variant="outline"
      className={cn(
        "border px-2.5 py-0.5 font-medium",
        colorClasses,
        className
      )}
    >
      {statusConfig.label}
    </Badge>
  )
}
