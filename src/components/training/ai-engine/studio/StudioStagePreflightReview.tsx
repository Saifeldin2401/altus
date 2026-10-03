import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Cpu,
  FileQuestion,
  FileText,
  Image as ImageIcon,
  Layers,
  Target,
} from 'lucide-react'
import type { StudioStageId } from './StudioWorkflowStepper'
import type { FullCourseGenerationConfig } from '@/types/aiCourseEngine'
import { StudioIntelligentAdvisor, type IntelligentRecommendation } from './StudioIntelligentAdvisor'
import type { ConsistencyReport } from '@/lib/ai/courseHarmonizer'
import { cn } from '@/lib/utils'

interface StudioStagePreflightReviewProps {
  config: FullCourseGenerationConfig
  onJumpToStage: (stage: StudioStageId) => void
  onHarmonize: () => void
  onSavePresetClick: () => void
  onGenerateClick: () => void
  isGenerating?: boolean
  consistencyReport?: ConsistencyReport
  recommendations: IntelligentRecommendation[]
  onApplyAllRecommendations?: () => void
}

export function StudioStagePreflightReview({
  config,
  onJumpToStage,
  onHarmonize,
  onSavePresetClick,
  onGenerateClick,
  isGenerating = false,
  consistencyReport,
  recommendations,
  onApplyAllRecommendations,
}: StudioStagePreflightReviewProps) {
  const { t } = useTranslation('training')

  // moduleCount / lessonsPerModule may be 'auto'; estimate with the defaults in that case.
  const asCount = (v: unknown, fallback: number) => (typeof v === 'number' && v > 0 ? v : fallback)
  const totalLessons = asCount(config.granularity?.moduleCount, 4) * asCount(config.granularity?.lessonsPerModule, 3)
  const totalDurationMinutes = totalLessons * asCount(config.granularity?.lessonDuration, 15)
  const hours = Math.floor(totalDurationMinutes / 60)
  const minutes = totalDurationMinutes % 60
  const durationString = hours > 0 ? `${hours}h ${minutes > 0 ? `${minutes}m` : ''}` : `${minutes}m`

  const hasIssues = consistencyReport && consistencyReport.issues.length > 0
  const issueCount = consistencyReport?.issues.length ?? 0

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-2">
      {/* 1. Header: what was actually checked, no invented score */}
      <div className="p-4 rounded-[8px] border border-ds-border bg-ds-surface flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-ds-ink">
            {t('builder.reviewTitle', 'Review before you generate')}
          </h2>
          <p className="text-xs text-ds-muted">
            {t('builder.reviewDesc', 'Check the settings below. Nothing is generated until you press Create course.')}
          </p>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 self-start rounded-full px-2.5 py-1 text-xs font-semibold md:self-auto',
            hasIssues ? 'bg-ds-warning-soft text-ds-warning-text' : 'bg-ds-success-soft text-ds-success'
          )}
        >
          {hasIssues
            ? t('builder.settingsIssues', { count: issueCount, defaultValue: '{{count}} settings to look at' })
            : t('builder.settingsConsistent', 'Settings are consistent')}
        </span>
      </div>

      {/* 2. Intelligent Pedagogical Advisor Banner */}
      <StudioIntelligentAdvisor
        recommendations={recommendations}
        consistencyReport={consistencyReport}
        onApplyAllRecommendations={onApplyAllRecommendations}
      />

      {/* 3. Comprehensive Summary Card Tree */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Card 1: Basics & Target */}
        <Card className="border hover:border-ds-accent/30 transition-all">
          <CardContent className="p-4 space-y-2.5">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                <Target className="w-3.5 h-3.5 text-ds-accent" />
                <span>1. Basics & Audience</span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onJumpToStage('basics')}
                className="h-6 text-[11px] font-bold text-ds-accent hover:text-ds-accent"
              >
                Edit
              </Button>
            </div>
            <div className="text-xs space-y-1">
              <p className="font-semibold text-foreground truncate">{config.topic || 'Custom Subject'}</p>
              <p className="text-muted-foreground">Mode: <span className="capitalize">{config.generationMode.replace('_', ' ')}</span></p>
              <p className="text-muted-foreground">Audience: <span className="capitalize">{config.targetAudience}</span> • Level: <span className="capitalize">{config.difficulty}</span></p>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Structure & Granularity */}
        <Card className="border hover:border-ds-accent/30 transition-all">
          <CardContent className="p-4 space-y-2.5">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                <Layers className="w-3.5 h-3.5 text-ds-info" />
                <span>2. Structure & Pace</span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onJumpToStage('design')}
                className="h-6 text-[11px] font-bold text-ds-accent hover:text-ds-accent"
              >
                Edit
              </Button>
            </div>
            <div className="text-xs space-y-1">
              <p className="font-semibold text-foreground">
                {config.granularity?.moduleCount || 4} Modules • {totalLessons} Lessons Total
              </p>
              <p className="text-muted-foreground">Duration: ~{durationString} ({config.granularity?.lessonDuration || 15}m per lesson)</p>
              <p className="text-muted-foreground">Strategy: <span className="capitalize">{config.instructionalStrategy?.replace(/_/g, ' ')}</span></p>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Content Depth & Mix */}
        <Card className="border hover:border-ds-accent/30 transition-all">
          <CardContent className="p-4 space-y-2.5">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                <FileText className="w-3.5 h-3.5 text-ds-success" />
                <span>3. Content & Components</span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onJumpToStage('content')}
                className="h-6 text-[11px] font-bold text-ds-accent hover:text-ds-accent"
              >
                Edit
              </Button>
            </div>
            <div className="text-xs space-y-1">
              <p className="font-semibold text-foreground capitalize">{config.overallDepth} Depth</p>
              <p className="text-muted-foreground">{config.lessonComponents?.length || 10} Interactive Components</p>
              <p className="text-muted-foreground">Procedures, Scripts, Checklists & Case Studies</p>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Assessments & Quizzes */}
        <Card className="border hover:border-ds-accent/30 transition-all">
          <CardContent className="p-4 space-y-2.5">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                <FileQuestion className="w-3.5 h-3.5 text-ds-warning" />
                <span>4. Assessments</span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onJumpToStage('assessments')}
                className="h-6 text-[11px] font-bold text-ds-accent hover:text-ds-accent"
              >
                Edit
              </Button>
            </div>
            <div className="text-xs space-y-1">
              <p className="font-semibold text-foreground capitalize">{config.quizConfig?.placement?.replace('_', ' ') || 'Per Module'}</p>
              <p className="text-muted-foreground">{config.quizConfig?.questionCount || 5} Questions per quiz ({config.quizConfig?.passingScore || 85}% Passing)</p>
              <p className="text-muted-foreground">{config.questionTypes?.length || 4} Question Types (MCQ, Scenario, Ordering)</p>
            </div>
          </CardContent>
        </Card>

        {/* Card 5: Visuals & Media */}
        <Card className="border hover:border-ds-accent/30 transition-all">
          <CardContent className="p-4 space-y-2.5">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                <ImageIcon className="w-3.5 h-3.5 text-ds-warning" />
                <span>5. Visuals & Media</span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onJumpToStage('visuals')}
                className="h-6 text-[11px] font-bold text-ds-accent hover:text-ds-accent"
              >
                Edit
              </Button>
            </div>
            <div className="text-xs space-y-1">
              <p className="font-semibold text-foreground">
                {config.imageConfig?.enableAIImages ? (config.imageConfig?.imageModel?.includes('flux') ? '✨ FLUX.1 Schnell Ultra-HD' : '⚡ SDXL-Lightning Free') : 'Visuals Disabled'}
              </p>
              <p className="text-muted-foreground">Style: <span className="capitalize">{config.imageConfig?.preferredStyle?.replace('_', ' ') || 'Educational Illustration'}</span></p>
            </div>
          </CardContent>
        </Card>

        {/* Card 6: AI Engine */}
        <Card className="border hover:border-ds-accent/30 transition-all">
          <CardContent className="p-4 space-y-2.5">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                <Cpu className="w-4 h-4 text-ds-accent" />
                <span>6. AI Engine & Tone</span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onJumpToStage('ai_settings')}
                className="h-6 text-[11px] font-bold text-ds-accent hover:text-ds-accent"
              >
                Edit
              </Button>
            </div>
            <div className="text-xs space-y-1">
              <p className="font-semibold text-foreground">Auto Intelligent Router</p>
              <p className="text-muted-foreground">Language: {config.aiControls?.targetLanguage || 'English'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  )
}
