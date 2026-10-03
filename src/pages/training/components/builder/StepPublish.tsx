import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Wand2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TrainingAuditResult } from '@/lib/trainingBuilderValidator'

interface StepPublishProps {
  category?: string
  setCategory?: (v: string) => void
  sections: { length: number }
  totalItems: number
  displayDuration: number
  overrideDuration: number | null
  calculatedDuration: number
  certificateEnabled: boolean
  passingScore: string
  allowRetake: boolean
  maxAttempts: string
  validationChecklist: Array<{ key: string; label: string; ok: boolean }>
  publishReady: boolean
  builderBusy: boolean
  handleSave: () => void
  publishTraining: () => void
  auditResult?: TrainingAuditResult
  onOpenAuditModal?: () => void
  isRTL: boolean
}

export function StepPublish({
  category,
  setCategory,
  sections,
  totalItems,
  displayDuration,
  overrideDuration,
  calculatedDuration,
  certificateEnabled,
  passingScore,
  allowRetake,
  maxAttempts,
  validationChecklist,
  publishReady,
  builderBusy,
  handleSave,
  publishTraining,
  auditResult,
  onOpenAuditModal,
}: StepPublishProps) {
  const { t } = useTranslation('training')

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Pre-Publish AI Audit & Health Banner */}
        {auditResult && (
          <div className="p-5 rounded-[8px] border border-ds-border bg-ds-surface text-ds-ink shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[6px] bg-ds-accent-soft text-ds-accent flex items-center justify-center shrink-0">
                <Wand2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-sm text-ds-ink">
                    {t('builder.aiAuditBannerTitle', 'AI Pre-Publish Quality Audit')}
                  </h4>
                  <Badge variant="outline" className="bg-ds-accent-soft text-ds-accent border border-ds-accent/30 text-[11px] font-semibold">
                    {auditResult.healthScore}% {t('builder.healthScore', 'Quality Score')}
                  </Badge>
                </div>
                <p className="text-xs text-ds-muted mt-0.5">
                  {auditResult.errors.length > 0
                    ? `${auditResult.errors.length} blockers preventing publication. ${auditResult.opportunities.length} fields can be auto-completed with AI.`
                    : `Course structure meets 5-star standard. ${auditResult.opportunities.length} suggestions available.`}
                </p>
              </div>
            </div>

            <Button
              onClick={onOpenAuditModal}
              className="bg-ds-ink text-ds-on-ink hover:bg-ds-ink/90 font-semibold text-xs h-9 px-4 shrink-0 shadow-2xs"
            >
              <Sparkles className="w-3.5 h-3.5 me-1.5 text-ds-accent" />
              {t('builder.openAuditBtn', 'AI Complete & Optimize')}
            </Button>
          </div>
        )}

        <Card className="rounded-[8px] border border-ds-border bg-ds-surface text-ds-ink shadow-2xs">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-ds-ink text-start">{t('builder.publishTitle', 'Review & Publish Course')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="rounded-[6px] border border-ds-border bg-ds-surface-subtle/70 p-4">
                <div className="text-xs uppercase tracking-wide text-ds-muted font-bold">{t('builder.summary', 'Course Summary')}</div>
                <div className="mt-3 space-y-2 text-sm text-ds-ink">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-ds-muted">Department:</span>
                    <Badge variant="outline" className="text-xs capitalize font-semibold border-ds-border bg-ds-surface text-ds-ink">
                      {category ? category.replace('_', ' ') : 'Hotel Operations'}
                    </Badge>
                  </div>
                  <div>{t('builder.summarySections', { count: sections.length, defaultValue: `${sections.length} sections` })}</div>
                  <div>{t('builder.summaryItems', { count: totalItems, defaultValue: `${totalItems} content items` })}</div>
                  <div>{t('builder.summaryDuration', { count: displayDuration || 0, defaultValue: `${displayDuration || 0} min duration` })}</div>
                  {overrideDuration !== null && Math.round(overrideDuration) !== Math.round(calculatedDuration) && (
                    <div className="text-xs text-ds-muted">{t('builder.calculatedDuration', { count: calculatedDuration, defaultValue: `Calculated ${calculatedDuration} min` })}</div>
                  )}
                </div>
              </div>
              <div className="rounded-[6px] border border-ds-border bg-ds-surface-subtle/70 p-4">
                <div className="text-xs uppercase tracking-wide text-ds-muted font-bold">{t('builder.rulesSummary', 'Rules Summary')}</div>
                <div className="mt-3 space-y-2 text-sm text-ds-ink">
                  <div>{certificateEnabled ? t('builder.certEnabled', 'Certificate enabled') : t('builder.certDisabled', 'Certificate disabled')}</div>
                  <div>{t('builder.passScoreSummary', { score: passingScore || 80, defaultValue: `Passing score: ${passingScore || 80}%` })}</div>
                  <div>{t('builder.retakeSummary', { count: allowRetake ? Number(maxAttempts) : 0, defaultValue: `Retakes allowed: ${allowRetake ? Number(maxAttempts) : 0}` })}</div>
                </div>
              </div>
              <div className="rounded-[6px] border border-ds-border bg-ds-surface-subtle/70 p-4">
                <div className="text-xs uppercase tracking-wide text-ds-muted font-bold">{t('builder.publishChecklist', 'Pre-Flight Checklist')}</div>
                <div className="mt-3 space-y-2 text-sm">
                  {validationChecklist.map((item) => (
                    <div key={item.key} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {item.ok ? (
                          <CheckCircle2 className="h-4 w-4 text-ds-success shrink-0" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-ds-warning shrink-0" />
                        )}
                        <span className={item.ok ? 'text-ds-ink' : 'text-ds-warning-text'}>{item.label}</span>
                      </div>
                      {item.key === 'category' && !item.ok && setCategory && (
                        <Select onValueChange={(v) => setCategory(v)}>
                          <SelectTrigger className="h-6 text-[11px] px-2 w-32 bg-ds-surface border-ds-border text-ds-ink">
                            <SelectValue placeholder="Set Category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="front_office">Front Office</SelectItem>
                            <SelectItem value="housekeeping">Housekeeping</SelectItem>
                            <SelectItem value="food_beverage">Food & Beverage</SelectItem>
                            <SelectItem value="operations">Operations</SelectItem>
                            <SelectItem value="safety_security">Safety & Security</SelectItem>
                            <SelectItem value="compliance">Compliance</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="outline" onClick={handleSave} disabled={builderBusy} className="border-ds-border text-ds-ink hover:bg-ds-surface-subtle">
                {t('builder.saveDraft', 'Save Draft')}
              </Button>
              <Button
                onClick={publishTraining}
                disabled={!publishReady || builderBusy}
                className="bg-ds-ink text-ds-on-ink hover:bg-ds-ink/90 font-semibold disabled:opacity-50"
              >
                {t('builder.publish', 'Publish Module')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
