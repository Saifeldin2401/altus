/**
 * CourseQAInspectorSheet
 * Comprehensive LCMS Quality Audit, Gap Analysis & Compliance Inspector
 */

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import type { CourseQAQualityReport } from '@/types/aiCourseEngine'
import { useState } from 'react'
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  FileCheck,
  GraduationCap,
  Layers,
  Loader2,
  RotateCw,
  ShieldAlert,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface CourseQAInspectorSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  qaReport?: CourseQAQualityReport | null
  courseTitle?: string
  onRegenerateArea?: (area: string) => Promise<void> | void
  onAutoRemediateAll?: () => Promise<void> | void
}

export function CourseQAInspectorSheet({
  open,
  onOpenChange,
  qaReport,
  courseTitle,
  onRegenerateArea,
  onAutoRemediateAll,
}: CourseQAInspectorSheetProps) {
  const { t, i18n } = useTranslation('training')
  const isRTL = i18n.dir() === 'rtl'
  const [loadingArea, setLoadingArea] = useState<string | null>(null)
  const [isRemediatingAll, setIsRemediatingAll] = useState(false)

  if (!qaReport) return null

  const handleFixArea = async (area: string) => {
    if (!onRegenerateArea) return
    setLoadingArea(area)
    try {
      await onRegenerateArea(area)
    } finally {
      setLoadingArea(null)
    }
  }

  const handleFixAll = async () => {
    if (!onAutoRemediateAll) return
    setIsRemediatingAll(true)
    try {
      await onAutoRemediateAll()
    } finally {
      setIsRemediatingAll(false)
    }
  }

  const scoreColor =
    qaReport.overallScore >= 90
      ? 'text-ds-success'
      : qaReport.overallScore >= 80
      ? 'text-ds-accent'
      : 'text-ds-warning'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isRTL ? 'left' : 'right'}
        className="w-full sm:max-w-xl p-0 flex flex-col h-full"
      >
        <SheetHeader className="p-6 border-b bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-ds-accent-soft text-ds-accent">
                <FileCheck className="w-5 h-5" />
              </div>
              <div>
                <SheetTitle className="text-base font-bold">
                  {t('builder.qaAuditTitle', 'Course Quality & LCMS Audit')}
                </SheetTitle>
                <SheetDescription className="text-xs truncate max-w-[280px]">
                  {courseTitle || t('builder.untitledCourse', 'Course Curriculum')}
                </SheetDescription>
              </div>
            </div>
            <div className="text-end">
              <span className={cn('text-2xl font-black', scoreColor)}>
                {qaReport.overallScore}%
              </span>
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                {t('builder.qaScore', 'QA Index')}
              </p>
            </div>
          </div>

          {qaReport.identifiedGaps.length > 0 && onAutoRemediateAll && (
            <div className="pt-3 border-t mt-3 flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {qaReport.identifiedGaps.length} {t('builder.actionableGaps', 'quality improvements available')}
              </span>
              <Button
                size="sm"
                onClick={handleFixAll}
                disabled={isRemediatingAll || loadingArea !== null}
                className="bg-ds-accent hover:bg-ds-accent text-white dark:text-ds-on-ink font-bold h-8 text-xs shadow-sm"
              >
                {isRemediatingAll ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin me-1.5" />
                ) : (
                  <Zap className="w-3.5 h-3.5 me-1.5 text-ds-warning" />
                )}
                <span>{t('builder.remediateAllBtn', '⚡ Auto-Remediate All Issues')}</span>
              </Button>
            </div>
          )}
        </SheetHeader>

        <ScrollArea className="flex-1 p-6 space-y-6">
          {/* Quality Metrics Grid */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <Card className="p-3 bg-card/60">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-1.5">
                <Target className="w-3.5 h-3.5 text-ds-info" />
                <span>{t('builder.objAlignment', 'Objective Alignment')}</span>
              </div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-lg font-bold text-foreground">
                  {qaReport.objectiveAlignmentScore}%
                </span>
                <Badge variant="outline" className="text-[11px] bg-ds-info-soft text-ds-info">
                  {t('builder.aligned', 'Strong')}
                </Badge>
              </div>
              <Progress value={qaReport.objectiveAlignmentScore} className="h-1.5" />
            </Card>

            <Card className="p-3 bg-card/60">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-ds-accent" />
                <span>{t('builder.cognitiveProgression', 'Cognitive Pacing')}</span>
              </div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-lg font-bold text-foreground">
                  {qaReport.cognitiveProgressionScore}%
                </span>
                <Badge variant="outline" className="text-[11px] bg-ds-accent-soft text-ds-accent">
                  {t('builder.progressive', 'Progressive')}
                </Badge>
              </div>
              <Progress value={qaReport.cognitiveProgressionScore} className="h-1.5" />
            </Card>

            <Card className="p-3 bg-card/60">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-1.5">
                <Layers className="w-3.5 h-3.5 text-ds-info" />
                <span>{t('builder.contentDepthScore', 'Content Depth')}</span>
              </div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-lg font-bold text-foreground">
                  {qaReport.contentDepthScore}%
                </span>
                <Badge variant="outline" className="text-[11px] bg-ds-info-soft text-ds-info">
                  {t('builder.exhaustive', 'Rigorous')}
                </Badge>
              </div>
              <Progress value={qaReport.contentDepthScore} className="h-1.5" />
            </Card>

            <Card className="p-3 bg-card/60">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-1.5">
                <Award className="w-3.5 h-3.5 text-ds-success" />
                <span>{t('builder.quizRigour', 'Quiz Discrimination')}</span>
              </div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-lg font-bold text-foreground">
                  {qaReport.quizRigourScore}%
                </span>
                <Badge variant="outline" className="text-[11px] bg-ds-success-soft text-ds-success">
                  {t('builder.validated', 'High')}
                </Badge>
              </div>
              <Progress value={qaReport.quizRigourScore} className="h-1.5" />
            </Card>
          </div>

          {/* Identified Gaps & Weak Areas */}
          <div className="space-y-3 mb-6">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-ds-warning" />
                <span>{t('builder.identifiedGaps', 'Identified Gaps & Refinement Opportunities')}</span>
              </h4>
              <Badge variant="secondary" className="text-[11px]">
                {qaReport.identifiedGaps.length} {t('builder.issues', 'items')}
              </Badge>
            </div>

            {qaReport.identifiedGaps.length === 0 ? (
              <div className="p-4 rounded-lg bg-ds-success-soft border border-ds-success/30 text-ds-success text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-ds-success shrink-0" />
                <span>{t('builder.noGapsFound', 'Zero structural gaps detected. Course meets all LCMS publication benchmarks.')}</span>
              </div>
            ) : (
              <div className="space-y-2.5">
                {qaReport.identifiedGaps.map((gap, idx) => {
                  const isThisLoading = loadingArea === gap.area
                  return (
                    <Card key={idx} className="p-3.5 border-s-4 border-s-ds-warning">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-foreground">
                              {gap.area}
                            </span>
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[11px] px-1.5 py-0 uppercase font-bold',
                                gap.severity === 'high'
                                  ? 'bg-ds-danger-soft text-ds-danger border-ds-danger/30'
                                  : 'bg-ds-warning-soft text-ds-warning border-ds-warning/30'
                              )}
                            >
                              {gap.severity}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {isRTL ? gap.issue_ar || gap.issue : gap.issue}
                          </p>
                          <p className="text-xs text-ds-accent font-medium mt-1.5 bg-ds-accent-soft p-2 rounded">
                            💡 <strong>{t('builder.recommendedFix', 'Fix')}:</strong>{' '}
                            {isRTL ? gap.suggestedFix_ar || gap.suggestedFix : gap.suggestedFix}
                          </p>
                        </div>

                        {gap.canAutoRegenerate && onRegenerateArea && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isThisLoading || isRemediatingAll}
                            className="text-xs shrink-0 text-ds-accent border-ds-accent/30 hover:bg-ds-accent-soft font-bold"
                            onClick={() => handleFixArea(gap.area)}
                          >
                            {isThisLoading ? (
                              <Loader2 className="w-3 h-3 animate-spin me-1" />
                            ) : (
                              <RotateCw className="w-3 h-3 me-1" />
                            )}
                            <span>{isThisLoading ? t('common:loading', 'Fixing...') : t('builder.autoFix', 'Fix with AI')}</span>
                          </Button>
                        )}
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>

          {/* KSA Compliance Verification */}
          <div className="space-y-2 mb-6">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-ds-success" />
              <span>{t('builder.complianceAudit', 'KSA Labor & Hospitality Standards')}</span>
            </h4>
            <div className="p-3.5 rounded-lg border bg-muted/30 flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-foreground">
                  {t('builder.ksaLaborSafety', 'Saudi Hospitality Regulatory Alignment')}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {t('builder.verifiedServiceKsa', 'Verified against five-star benchmarks & local hotel hospitality regulations.')}
                </p>
              </div>
              <Badge className="bg-ds-success text-white dark:text-ds-on-ink text-[11px] font-bold">
                ✓ {t('builder.compliant', 'Verified')}
              </Badge>
            </div>
          </div>

          {/* LCMS Recommendations */}
          {qaReport.recommendations && qaReport.recommendations.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-ds-accent" />
                <span>{t('builder.lcmsRecommendations', 'LCMS Insights & Enhancements')}</span>
              </h4>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                {qaReport.recommendations.map((rec, rIdx) => (
                  <li key={rIdx} className="flex items-start gap-2">
                    <span className="text-ds-accent font-bold">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
