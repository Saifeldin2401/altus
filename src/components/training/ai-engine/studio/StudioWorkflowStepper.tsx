import React from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  BookOpen,
  Compass,
  FileText,
  FileQuestion,
  Image as ImageIcon,
  Cpu,
  CheckCircle2
} from 'lucide-react'

export type StudioStageId =
  | 'basics'
  | 'design'
  | 'content'
  | 'assessments'
  | 'visuals'
  | 'ai_settings'
  | 'review'

interface StudioStageConfig {
  id: StudioStageId
  number: number
  titleKey: string
  defaultTitle: string
  descKey: string
  defaultDesc: string
  icon: React.ElementType
  badgeKey?: string
  defaultBadge?: string
}

export const STUDIO_STAGES: StudioStageConfig[] = [
  {
    id: 'basics',
    number: 1,
    titleKey: 'builder.stages.basics',
    defaultTitle: 'Course Basics',
    descKey: 'builder.stages.basicsDesc',
    defaultDesc: 'Topic, Mode & Audience',
    icon: BookOpen,
  },
  {
    id: 'design',
    number: 2,
    titleKey: 'builder.stages.design',
    defaultTitle: 'Learning Design',
    descKey: 'builder.stages.designDesc',
    defaultDesc: 'Strategy & Structure',
    icon: Compass,
  },
  {
    id: 'content',
    number: 3,
    titleKey: 'builder.stages.content',
    defaultTitle: 'Content Depth',
    descKey: 'builder.stages.contentDesc',
    defaultDesc: 'Depth & Components',
    icon: FileText,
  },
  {
    id: 'assessments',
    number: 4,
    titleKey: 'builder.stages.assessments',
    defaultTitle: 'Assessments',
    descKey: 'builder.stages.assessmentsDesc',
    defaultDesc: 'Quizzes & Questions',
    icon: FileQuestion,
  },
  {
    id: 'visuals',
    number: 5,
    titleKey: 'builder.stages.visuals',
    defaultTitle: 'Visuals & Media',
    descKey: 'builder.stages.visualsDesc',
    defaultDesc: 'Cloudflare AI Images',
    icon: ImageIcon,
    defaultBadge: 'Ultra HD',
  },
  {
    id: 'ai_settings',
    number: 6,
    titleKey: 'builder.stages.aiSettings',
    defaultTitle: 'AI Engine',
    descKey: 'builder.stages.aiSettingsDesc',
    defaultDesc: 'Models & Tone',
    icon: Cpu,
  },
  {
    id: 'review',
    number: 7,
    titleKey: 'builder.stages.review',
    defaultTitle: 'Review & Audit',
    descKey: 'builder.stages.reviewDesc',
    defaultDesc: 'Pre-flight Validation',
    icon: CheckCircle2,
  },
]

interface StudioWorkflowStepperProps {
  currentStage: StudioStageId
  onSelectStage: (stage: StudioStageId) => void
  completedStages?: Set<StudioStageId>
  issuesCount?: number
}

export function StudioWorkflowStepper({
  currentStage,
  onSelectStage,
  completedStages = new Set(),
  issuesCount = 0,
}: StudioWorkflowStepperProps) {
  const { t, i18n } = useTranslation('training')
  const isRTL = i18n.dir() === 'rtl'

  const currentIndex = STUDIO_STAGES.findIndex((s) => s.id === currentStage)
  const progressPercent = Math.round(((currentIndex + 1) / STUDIO_STAGES.length) * 100)

  return (
    <div className="w-full bg-card/90 border-b px-4 py-2.5 select-none transition-all">
      {/* Top progress line */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-ds-accent/15 text-ds-accent font-bold text-[11px]">
            {currentIndex + 1}
          </div>
          <span className="text-xs font-semibold text-foreground">
            {t('builder.stageStep', 'Stage {{current}} of {{total}}', {
              current: currentIndex + 1,
              total: STUDIO_STAGES.length,
            })}
            : <span className="text-ds-accent font-bold">{t(STUDIO_STAGES[currentIndex]?.titleKey || '', STUDIO_STAGES[currentIndex]?.defaultTitle || '')}</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          {issuesCount > 0 && (
            <Badge variant="outline" className="text-[11px] bg-ds-warning-soft text-ds-warning border-ds-warning/30">
              ⚡ {issuesCount} {t('builder.suggestionsAvailable', 'Suggestions')}
            </Badge>
          )}
          <span className="text-[11px] font-mono text-muted-foreground">
            {progressPercent}% {t('builder.configured', 'Complete')}
          </span>
        </div>
      </div>

      {/* Responsive Horizontal Stepper Track */}
      <div className="grid grid-cols-7 gap-1.5 overflow-x-auto scrollbar-none">
        {STUDIO_STAGES.map((stage, idx) => {
          const Icon = stage.icon
          const isActive = stage.id === currentStage
          const isCompleted = completedStages.has(stage.id) || idx < currentIndex

          return (
            <button
              key={stage.id}
              onClick={() => onSelectStage(stage.id)}
              className={cn(
                'group relative flex items-center gap-2 p-2 rounded-lg border text-start transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ds-accent/30',
                isActive
                  ? 'bg-ds-accent/10 border-ds-accent shadow-sm'
                  : isCompleted
                  ? 'bg-card hover:bg-muted/60 border-border/80 hover:border-ds-accent/30'
                  : 'bg-card/40 opacity-75 hover:opacity-100 hover:bg-muted/40 border-border/50'
              )}
            >
              {/* Step indicator circle */}
              <div
                className={cn(
                  'w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0 transition-transform group-hover:scale-105',
                  isActive
                    ? 'bg-ds-accent text-white dark:text-ds-on-ink shadow-sm'
                    : isCompleted
                    ? 'bg-ds-success text-white dark:text-ds-on-ink'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {isCompleted && !isActive ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <Icon className="w-3.5 h-3.5" />
                )}
              </div>

              {/* Title & subtitle */}
              <div className="min-w-0 flex-1 hidden md:block">
                <div className="flex items-center gap-1">
                  <p
                    className={cn(
                      'text-xs font-bold truncate leading-tight',
                      isActive
                        ? 'text-ds-accent'
                        : isCompleted
                        ? 'text-foreground'
                        : 'text-muted-foreground'
                    )}
                  >
                    {t(stage.titleKey, stage.defaultTitle)}
                  </p>
                  {stage.defaultBadge && (
                    <span className="text-[11px] px-1 py-0.2 bg-ds-warning-soft text-ds-warning rounded font-bold">
                      {stage.defaultBadge}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
                  {t(stage.descKey, stage.defaultDesc)}
                </p>
              </div>

              {/* Active Bottom Glow Indicator */}
              {isActive && (
                <div className="absolute inset-x-2 -bottom-1 h-0.5 bg-ds-accent rounded-full" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
