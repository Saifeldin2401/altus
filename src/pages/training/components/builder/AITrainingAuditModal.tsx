import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  Sparkles,
  Wand2,
} from 'lucide-react'
import type { TrainingAuditResult } from '@/lib/trainingBuilderValidator'
import { buildAIImprovementPlan, type AIImprovementPlan, type AISuggestionResult } from '@/lib/trainingAICompletionEngine'
import type { TrainingSection } from './trainingBuilderTypes'

interface AITrainingAuditModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  auditResult: TrainingAuditResult
  title: string
  setTitle: (v: string) => void
  description: string
  setDescription: (v: string) => void
  category?: string
  difficultyLevel?: string
  audience?: string
  sections: TrainingSection[]
  setSections: React.Dispatch<React.SetStateAction<TrainingSection[]>>
  isRTL: boolean
}

export function AITrainingAuditModal({
  open,
  onOpenChange,
  auditResult,
  title,
  setTitle,
  description,
  setDescription,
  category,
  difficultyLevel,
  audience,
  sections,
  setSections,
  isRTL,
}: AITrainingAuditModalProps) {
  const { t } = useTranslation('training')
  const { toast } = useToast()
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false)
  const [improvementPlan, setImprovementPlan] = useState<AIImprovementPlan | null>(null)
  const [selectedTab, setSelectedTab] = useState<'overview' | 'errors' | 'warnings' | 'ai_plan'>('overview')
  const [appliedSuggestionIds, setAppliedSuggestionIds] = useState<Set<string>>(new Set())

  const handleRunAIOptimizer = async () => {
    setIsGeneratingPlan(true)
    setSelectedTab('ai_plan')
    try {
      const plan = await buildAIImprovementPlan({
        title,
        description,
        category,
        difficultyLevel,
        audience,
        sections,
        language: isRTL ? 'Arabic' : 'English',
      })
      setImprovementPlan(plan)
      if (plan.totalSuggestions > 0) {
        toast({
          title: '✨ AI Plan Generated',
          description: `Synthesized ${plan.totalSuggestions} contextual improvements.`,
        })
      }
    } catch (e) {
      console.error('Failed to generate AI improvement plan:', e)
      toast({
        title: 'Error',
        description: 'Failed to generate AI improvement plan. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsGeneratingPlan(false)
    }
  }

  const handleApplySingleSuggestion = (sug: AISuggestionResult) => {
    const sugKey = `${sug.targetId}_${sug.fieldType}`
    if (sug.fieldType === 'module_title') {
      setTitle(sug.suggestedValue)
    } else if (sug.fieldType === 'module_description') {
      setDescription(sug.suggestedValue)
    } else if (sug.fieldType === 'section_title') {
      setSections((prev) =>
        prev.map((s) => (s.id === sug.targetId ? { ...s, title: sug.suggestedValue } : s))
      )
    } else if (sug.fieldType === 'section_description') {
      setSections((prev) =>
        prev.map((s) => (s.id === sug.targetId ? { ...s, description: sug.suggestedValue } : s))
      )
    }

    setAppliedSuggestionIds((prev) => new Set(prev).add(sugKey))
    toast({
      title: '✓ Applied',
      description: `Updated ${sug.fieldType.replace('_', ' ')}: "${sug.suggestedValue}"`,
    })
  }

  const handleApplyAllImprovements = () => {
    if (!improvementPlan) return
    let appliedCount = 0
    if (improvementPlan.improvedTitle && improvementPlan.improvedTitle !== title) {
      setTitle(improvementPlan.improvedTitle)
      appliedCount++
    }
    if (improvementPlan.improvedDescription && improvementPlan.improvedDescription !== description) {
      setDescription(improvementPlan.improvedDescription)
      appliedCount++
    }
    if (improvementPlan.improvedSections && improvementPlan.improvedSections.length > 0) {
      setSections(improvementPlan.improvedSections)
      appliedCount += improvementPlan.improvedSections.length
    }

    toast({
      title: '✨ All Improvements Applied',
      description: `Successfully updated course overview and sections.`,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b bg-ds-surface-subtle/50">
          <div className={cn('flex items-center justify-between')}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[8px] bg-ds-accent-soft flex items-center justify-center text-ds-accent border border-ds-accent/30">
                <Wand2 className="w-5 h-5" />
              </div>
              <div className={'text-start'}>
                <DialogTitle className="text-lg font-bold text-ds-ink">
                  {t('builder.auditModalTitle', 'AI Training Audit & Smart Optimizer')}
                </DialogTitle>
                <DialogDescription className="text-xs text-ds-muted">
                  {t('builder.auditModalDesc', 'Validate instructional structure, fix blockers, and auto-complete missing content.')}
                </DialogDescription>
              </div>
            </div>
            <Badge
              variant="outline"
              className={cn(
                'text-xs font-semibold px-3 py-1',
                auditResult.isPublishReady
                  ? 'bg-ds-success-soft text-ds-success border-ds-success/30'
                  : 'bg-ds-warning-soft text-ds-warning border-ds-warning/30'
              )}
            >
              {auditResult.isPublishReady
                ? t('builder.readyToPublish', '✓ Ready to Publish')
                : t('builder.needsReview', '⚠ Action Required')}
            </Badge>
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-4 gap-3">
            <Card className="border-ds-border bg-ds-surface-subtle/40 shadow-none">
              <CardContent className="p-3.5 text-center">
                <div className="text-2xl font-black text-ds-ink">{auditResult.healthScore}%</div>
                <div className="text-[11px] font-medium text-ds-muted">{t('builder.healthScore', 'Quality Score')}</div>
              </CardContent>
            </Card>

            <Card className={cn('shadow-none', auditResult.errors.length > 0 ? 'border-ds-danger/30 bg-ds-danger-soft/30' : 'border-ds-border')}>
              <CardContent className="p-3.5 text-center">
                <div className={cn('text-2xl font-black', auditResult.errors.length > 0 ? 'text-ds-danger' : 'text-ds-ink-secondary')}>
                  {auditResult.errors.length}
                </div>
                <div className="text-[11px] font-medium text-ds-muted">{t('builder.criticalErrors', 'Critical Blockers')}</div>
              </CardContent>
            </Card>

            <Card className="border-ds-border shadow-none">
              <CardContent className="p-3.5 text-center">
                <div className="text-2xl font-black text-ds-warning">{auditResult.warnings.length}</div>
                <div className="text-[11px] font-medium text-ds-muted">{t('builder.warnings', 'Warnings')}</div>
              </CardContent>
            </Card>

            <Card className="border-ds-accent/30 bg-ds-accent-soft/30 shadow-none">
              <CardContent className="p-3.5 text-center">
                <div className="text-2xl font-black text-ds-accent">{auditResult.opportunities.length}</div>
                <div className="text-[11px] font-medium text-ds-accent">{t('builder.aiFixable', 'AI Opportunities')}</div>
              </CardContent>
            </Card>
          </div>

          {/* Action Tabs */}
          <Tabs value={selectedTab} onValueChange={(v: any) => setSelectedTab(v)} className="w-full">
            <TabsList className="grid grid-cols-4 w-full bg-ds-surface-subtle p-1">
              <TabsTrigger value="overview" className="text-xs">
                {t('builder.tabOverview', 'Audit Overview')}
              </TabsTrigger>
              <TabsTrigger value="errors" className="text-xs">
                {t('builder.tabErrors', 'Blockers')} ({auditResult.errors.length})
              </TabsTrigger>
              <TabsTrigger value="warnings" className="text-xs">
                {t('builder.tabWarnings', 'Quality')} ({auditResult.warnings.length})
              </TabsTrigger>
              <TabsTrigger value="ai_plan" className="text-xs text-ds-accent font-bold">
                <Sparkles className="w-3.5 h-3.5 me-1" />
                {t('builder.tabAIPlan', 'AI Auto-Complete')}
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-3 pt-3">
              {auditResult.errors.length === 0 && auditResult.warnings.length === 0 ? (
                <div className="text-center py-8 text-ds-muted">
                  <CheckCircle2 className="w-12 h-12 text-ds-success mx-auto mb-2" />
                  <p className="font-semibold text-ds-ink-secondary">{t('builder.noIssuesFound', 'All checks passed!')}</p>
                  <p className="text-xs text-ds-muted">{t('builder.readyToLaunch', 'Your course structure and rules meet 5-star standard operating requirements.')}</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {auditResult.errors.map((err) => (
                    <div
                      key={err.id}
                      className={cn(
                        'flex items-start gap-3 p-3 rounded-lg border border-ds-danger/30 bg-ds-danger-soft/40 text-xs',
                        'text-start'
                      )}
                    >
                      <AlertCircle className="w-4 h-4 text-ds-danger shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-bold text-ds-danger">{err.title}</div>
                        <div className="text-ds-danger mt-0.5">{err.description}</div>
                      </div>
                      {err.canAutoFixWithAI && (
                        <Badge variant="outline" className="bg-ds-surface text-ds-accent border-ds-accent/30 text-[11px] shrink-0">
                          <Sparkles className="w-3 h-3 me-1" /> AI Fixable
                        </Badge>
                      )}
                    </div>
                  ))}

                  {auditResult.warnings.map((warn) => (
                    <div
                      key={warn.id}
                      className={cn(
                        'flex items-start gap-3 p-3 rounded-lg border border-ds-warning/30 bg-ds-warning-soft/40 text-xs',
                        'text-start'
                      )}
                    >
                      <AlertTriangle className="w-4 h-4 text-ds-warning shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-bold text-ds-warning">{warn.title}</div>
                        <div className="text-ds-warning mt-0.5">{warn.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Blockers Tab */}
            <TabsContent value="errors" className="space-y-2.5 pt-3">
              {auditResult.errors.length === 0 ? (
                <div className="text-center py-6 text-ds-success font-medium text-xs">
                  ✓ {t('builder.zeroBlockers', 'Zero critical blockers found.')}
                </div>
              ) : (
                auditResult.errors.map((err) => (
                  <div key={err.id} className="p-3.5 rounded-lg border border-ds-danger/30 bg-ds-danger-soft/50 space-y-1.5 text-xs">
                    <div className="font-bold text-ds-danger flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-ds-danger" />
                      <span>{err.title}</span>
                    </div>
                    <p className="text-ds-danger">{err.description}</p>
                    {err.suggestedAction && (
                      <div className="pt-1 text-[11px] text-ds-ink-secondary font-medium">
                        👉 <strong>Suggested Action:</strong> {err.suggestedAction}
                      </div>
                    )}
                  </div>
                ))
              )}
            </TabsContent>

            {/* Warnings Tab */}
            <TabsContent value="warnings" className="space-y-2.5 pt-3">
              {auditResult.warnings.length === 0 ? (
                <div className="text-center py-6 text-ds-muted font-medium text-xs">
                  {t('builder.noWarnings', 'No pedagogical warnings.')}
                </div>
              ) : (
                auditResult.warnings.map((warn) => (
                  <div key={warn.id} className="p-3.5 rounded-lg border border-ds-warning/30 bg-ds-warning-soft/50 space-y-1 text-xs">
                    <div className="font-bold text-ds-warning">{warn.title}</div>
                    <p className="text-ds-warning">{warn.description}</p>
                  </div>
                ))
              )}
            </TabsContent>

            {/* AI Auto-Complete Plan Tab */}
            <TabsContent value="ai_plan" className="space-y-4 pt-3">
              {!improvementPlan && !isGeneratingPlan && (
                <div className="text-center py-8 px-4 bg-ds-accent-soft/50 border border-dashed border-ds-accent/30 rounded-[8px] space-y-3">
                  <div className="w-12 h-12 bg-ds-accent-soft rounded-full flex items-center justify-center mx-auto text-ds-accent">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-ds-accent">
                    {t('builder.generateAIOptimizationPlan', 'AI Structural Context Synthesis')}
                  </h4>
                  <p className="text-xs text-ds-accent/80 max-w-md mx-auto">
                    {t('builder.aiSynthesizeDesc', 'The AI will analyze surrounding lessons and curriculum to draft missing titles, rich descriptions, and learning objectives without overwriting any manual text.')}
                  </p>
                  <Button
                    onClick={handleRunAIOptimizer}
                    className="bg-ds-accent hover:bg-ds-accent text-white dark:text-ds-on-ink font-semibold text-xs h-9 px-4"
                  >
                    <Wand2 className="w-3.5 h-3.5 me-2" />
                    {t('builder.startAISynthesis', 'Scan & Generate Missing Content')}
                  </Button>
                </div>
              )}

              {isGeneratingPlan && (
                <div className="text-center py-12 space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin text-ds-accent mx-auto" />
                  <p className="text-xs font-semibold text-ds-ink-secondary">
                    {t('builder.synthesizingAI', 'Analyzing curriculum hierarchy and synthesizing missing fields...')}
                  </p>
                </div>
              )}

              {improvementPlan && !isGeneratingPlan && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-ds-accent-soft border border-ds-accent/30 rounded-lg text-xs">
                    <span className="font-semibold text-ds-accent">
                      ✨ {improvementPlan.totalSuggestions} {t('builder.suggestionsFound', 'AI enhancements generated')}
                    </span>
                    <Button
                      size="sm"
                      onClick={handleApplyAllImprovements}
                      className="bg-ds-accent hover:bg-ds-accent text-white dark:text-ds-on-ink h-7 text-xs font-bold"
                    >
                      {t('builder.applyAllImprovements', 'Apply All Improvements')}
                    </Button>
                  </div>

                  <div className="space-y-2.5 max-h-[300px] overflow-y-auto pe-1">
                    {improvementPlan.suggestions.map((sug, idx) => {
                      const sugKey = `${sug.targetId}_${sug.fieldType}`
                      const isApplied = appliedSuggestionIds.has(sugKey)

                      return (
                        <div key={idx} className="p-3 border rounded-lg bg-ds-surface space-y-2 text-xs shadow-sm">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-ds-ink capitalize">
                                {sug.fieldType.replace('_', ' ')}
                              </span>
                              <Badge variant="outline" className="text-[11px] bg-ds-accent-soft text-ds-accent border-ds-accent/30">
                                {sug.confidence} Confidence
                              </Badge>
                            </div>
                            <Button
                              size="sm"
                              variant={isApplied ? 'secondary' : 'outline'}
                              disabled={isApplied}
                              onClick={() => handleApplySingleSuggestion(sug)}
                              className={cn(
                                "h-6 text-[11px] px-2.5 font-semibold transition-colors",
                                isApplied
                                  ? "bg-ds-success-soft text-ds-success border-ds-success/30"
                                  : "border-ds-accent/30 text-ds-accent hover:bg-ds-accent-soft"
                              )}
                            >
                              {isApplied ? (
                                <>
                                  <Check className="w-3 h-3 me-1 text-ds-success" />
                                  Applied
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-3 h-3 me-1" />
                                  Apply
                                </>
                              )}
                            </Button>
                          </div>
                          <div className="p-2.5 bg-ds-surface-subtle rounded border border-ds-border text-ds-ink-secondary font-medium">
                            {sug.suggestedValue}
                          </div>
                          <div className="text-[11px] text-ds-muted">{sug.rationale}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t bg-ds-surface-subtle flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            {t('common.close', 'Close')}
          </Button>
          <div className="flex items-center gap-2">
            {!improvementPlan && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRunAIOptimizer}
                disabled={isGeneratingPlan}
                className="border-ds-accent/30 text-ds-accent hover:bg-ds-accent-soft text-xs"
              >
                <Sparkles className="w-3.5 h-3.5 me-1.5" />
                {t('builder.autoFixWithAI', 'Auto-Complete with AI')}
              </Button>
            )}
            {improvementPlan && (
              <Button
                size="sm"
                onClick={handleApplyAllImprovements}
                className="bg-ds-accent hover:bg-ds-accent text-white dark:text-ds-on-ink text-xs font-bold"
              >
                {t('builder.applyAndClose', 'Apply & Continue')}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
