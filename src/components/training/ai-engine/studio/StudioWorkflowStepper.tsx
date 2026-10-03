import React from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import {
  BookOpen,
  Compass,
  FileText,
  FileQuestion,
  Image as ImageIcon,
  Cpu,
  CheckCircle2,
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
  issuesCount = 0,
}: StudioWorkflowStepperProps) {
  const { t } = useTranslation('training')

  return (
    <div className="w-full shrink-0 border-b border-ds-border bg-ds-surface select-none">
      <nav
        aria-label={t('builder.stagesLabel', 'Course creator steps')}
        className="flex items-stretch gap-1 overflow-x-auto px-4 [scrollbar-width:none]"
      >
        {STUDIO_STAGES.map((stage) => {
          const isActive = stage.id === currentStage
          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => onSelectStage(stage.id)}
              aria-current={isActive ? 'step' : undefined}
              title={t(stage.descKey, stage.defaultDesc)}
              className={cn(
                'relative flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-[6px] px-2.5 text-xs transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent/40',
                isActive ? 'font-semibold text-ds-ink' : 'font-medium text-ds-muted hover:text-ds-ink'
              )}
            >
              <span
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold tabular-nums',
                  isActive ? 'border-ds-ink bg-ds-ink text-ds-on-ink' : 'border-ds-border bg-ds-surface text-ds-muted'
                )}
              >
                {stage.number}
              </span>
              <span>{t(`builder.stagesShort.${stage.id}`, stage.defaultTitle)}</span>
              {stage.id === 'review' && issuesCount > 0 && (
                <span className="rounded-full bg-ds-warning-soft px-1.5 text-[11px] font-semibold text-ds-warning-text tabular-nums">
                  {issuesCount}
                </span>
              )}
              {isActive && <span aria-hidden className="absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-ds-ink" />}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
