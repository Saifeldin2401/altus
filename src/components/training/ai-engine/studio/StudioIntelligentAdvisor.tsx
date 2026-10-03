import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sparkles, Wand2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ConsistencyReport } from '@/lib/ai/courseHarmonizer'

export interface IntelligentRecommendation {
  id: string
  category: 'depth' | 'structure' | 'assessment' | 'visuals' | 'pedagogy'
  severity: 'info' | 'warning' | 'high'
  titleKey: string
  defaultTitle: string
  descKey: string
  defaultDesc: string
  actionLabelKey?: string
  defaultActionLabel?: string
  onApply: () => void
}

interface StudioIntelligentAdvisorProps {
  recommendations: IntelligentRecommendation[]
  consistencyReport?: ConsistencyReport
  onApplyAllRecommendations?: () => void
  className?: string
}

export function StudioIntelligentAdvisor({
  recommendations,
  consistencyReport,
  onApplyAllRecommendations,
  className,
}: StudioIntelligentAdvisorProps) {
  const { t } = useTranslation('training')

  if (recommendations.length === 0 && (!consistencyReport || consistencyReport.issues.length === 0)) {
    // The review header already says the settings are consistent; no extra banner.
    return null
  }

  const primaryRec = recommendations[0]

  return (
    <div
      className={cn(
        'p-3 rounded-[8px] border border-ds-accent/80 bg-ds-accent-soft/70 transition-all shadow-sm',
        className
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Advice description */}
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-ds-accent text-white dark:text-ds-on-ink flex items-center justify-center shrink-0 shadow-sm mt-0.5">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-foreground">
                {t('builder.aiAdvisorTitle', 'AI Pedagogical Advisor')}
              </span>
              <Badge variant="outline" className="text-[11px] bg-ds-accent-soft text-ds-accent border-ds-accent/30">
                {recommendations.length} {recommendations.length === 1 ? 'Optimization' : 'Optimizations'} Available
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              {primaryRec ? t(primaryRec.descKey, primaryRec.defaultDesc) : (consistencyReport?.issues[0]?.message || 'Configuration tuning available.')}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          {primaryRec && (
            <Button
              size="sm"
              onClick={primaryRec.onApply}
              className="h-8 text-xs font-bold bg-ds-accent hover:bg-ds-accent text-white dark:text-ds-on-ink shadow-sm"
            >
              <Wand2 className="w-3.5 h-3.5 me-1.5" />
              {t(primaryRec.actionLabelKey || 'builder.applyRecommendation', primaryRec.defaultActionLabel || 'Apply Recommendation')}
            </Button>
          )}

          {onApplyAllRecommendations && recommendations.length > 1 && (
            <Button
              size="sm"
              variant="outline"
              onClick={onApplyAllRecommendations}
              className="h-8 text-xs font-semibold border-ds-accent/30 hover:bg-ds-accent-soft/50"
            >
              {t('builder.applyAllRecommendations', 'Apply All ({{count}})', { count: recommendations.length })}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
