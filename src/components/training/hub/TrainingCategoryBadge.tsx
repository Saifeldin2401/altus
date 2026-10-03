import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  Award,
  Crown,
  HeartHandshake,
  type LucideIcon,
  ShieldCheck,
  Sparkles,
  Tag,
  Utensils,
  Wrench
} from 'lucide-react'

interface CategoryTheme {
  label: string
  bg: string
  text: string
  border: string
  dot: string
  icon: LucideIcon
}

function getCategoryTheme(categoryName?: string | null): CategoryTheme {
  const cat = (categoryName || '').toLowerCase().trim()

  if (cat.includes('front') || cat.includes('reception') || cat.includes('hafawa') || cat.includes('concierge') || cat.includes('guest')) {
    return {
      label: categoryName || 'Front Desk & Hafawa',
      bg: 'bg-ds-warning-soft',
      text: 'text-ds-warning',
      border: 'border-ds-warning/30',
      dot: 'bg-ds-warning',
      icon: HeartHandshake
    }
  }

  if (cat.includes('food') || cat.includes('beverage') || cat.includes('f&b') || cat.includes('dining') || cat.includes('culinary') || cat.includes('kitchen') || cat.includes('restaurant')) {
    return {
      label: categoryName || 'Food & Beverage',
      bg: 'bg-ds-success-soft',
      text: 'text-ds-success',
      border: 'border-ds-success/30',
      dot: 'bg-ds-success',
      icon: Utensils
    }
  }

  if (cat.includes('housekeep') || cat.includes('room') || cat.includes('laundry') || cat.includes('clean')) {
    return {
      label: categoryName || 'Housekeeping',
      bg: 'bg-ds-info-soft',
      text: 'text-ds-info',
      border: 'border-ds-info/30',
      dot: 'bg-ds-info',
      icon: Sparkles
    }
  }

  if (cat.includes('compliance') || cat.includes('safety') || cat.includes('security') || cat.includes('haccp') || cat.includes('fire') || cat.includes('audit')) {
    return {
      label: categoryName || 'Safety & Compliance',
      bg: 'bg-ds-danger-soft',
      text: 'text-ds-danger',
      border: 'border-ds-danger/30',
      dot: 'bg-ds-danger',
      icon: ShieldCheck
    }
  }

  if (cat.includes('leader') || cat.includes('manage') || cat.includes('executive') || cat.includes('supervisor')) {
    return {
      label: categoryName || 'Leadership',
      bg: 'bg-ds-accent-soft',
      text: 'text-ds-accent',
      border: 'border-ds-accent/30',
      dot: 'bg-ds-accent',
      icon: Crown
    }
  }

  if (cat.includes('onboard') || cat.includes('orient') || cat.includes('brand') || cat.includes('culture')) {
    return {
      label: categoryName || 'Brand & Onboarding',
      bg: 'bg-ds-info-soft',
      text: 'text-ds-info',
      border: 'border-ds-info/30',
      dot: 'bg-ds-info',
      icon: Award
    }
  }

  if (cat.includes('engineer') || cat.includes('maint') || cat.includes('facility') || cat.includes('technic')) {
    return {
      label: categoryName || 'Engineering',
      bg: 'bg-ds-warning-soft',
      text: 'text-ds-warning',
      border: 'border-ds-warning/30',
      dot: 'bg-ds-warning',
      icon: Wrench
    }
  }

  return {
    label: categoryName || 'General',
    bg: 'bg-ds-surface-subtle',
    text: 'text-ds-ink-secondary',
    border: 'border-ds-border',
    dot: 'bg-ds-muted',
    icon: Tag
  }
}

interface TrainingCategoryBadgeProps {
  category?: string | null
  className?: string
  showIcon?: boolean
  size?: 'sm' | 'default'
}

export function TrainingCategoryBadge({
  category,
  className,
  showIcon = true,
  size = 'default'
}: TrainingCategoryBadgeProps) {
  if (!category) return null

  const theme = getCategoryTheme(category)
  const Icon = theme.icon

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium transition-colors border",
        size === 'sm' ? "text-[11px] px-2 py-0.5 min-h-[20px] gap-1 shrink-0 whitespace-nowrap" : "text-xs px-2.5 py-0.5 min-h-[22px] gap-1.5 shrink-0 whitespace-nowrap",
        theme.bg,
        theme.text,
        theme.border,
        className
      )}
    >
      {showIcon && <Icon className={size === 'sm' ? "h-3 w-3 shrink-0" : "h-3.5 w-3.5 shrink-0"} />}
      <span className="whitespace-nowrap">{category}</span>
    </Badge>
  )
}
