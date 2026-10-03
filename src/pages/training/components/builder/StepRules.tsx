import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  analyzeBuilderContent,
  evaluateBuilderVisibility,
  resolveConfigProvenance,
} from '@/lib/trainingBuilderRulesEngine'
import {
  Award,
  BookOpen,
  CheckCircle2,
  Info,
  SlidersHorizontal,
  Video,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TrainingSection } from './trainingBuilderTypes'

interface StepRulesProps {
  sections?: TrainingSection[]
  category?: string
  setCategory?: (v: string) => void
  difficultyLevel?: string
  setDifficultyLevel?: (v: string) => void
  audience?: string
  setAudience?: (v: string) => void
  description?: string
  setDescription?: (v: string) => void
  certificateEnabled: boolean
  setCertificateEnabled: (v: boolean) => void
  passingScore: string
  setPassingScore: (v: string) => void
  validityPeriod: string
  setValidityPeriod: (v: string) => void
  allowRetake: boolean
  setAllowRetake: (v: boolean) => void
  maxAttempts: string
  setMaxAttempts: (v: string) => void
  isRTL: boolean
}

export function StepRules({
  sections = [],
  category = 'operations',
  setCategory,
  difficultyLevel = 'beginner',
  setDifficultyLevel,
  audience = 'all',
  setAudience,
  description = '',
  setDescription,
  certificateEnabled,
  setCertificateEnabled,
  passingScore,
  setPassingScore,
  validityPeriod,
  setValidityPeriod,
  allowRetake,
  setAllowRetake,
  maxAttempts,
  setMaxAttempts,
}: StepRulesProps) {
  const { t } = useTranslation('training')
  const scorePresets = ['70', '80', '85', '90']

  // Evaluate content presence and conditional visibility rules
  const contentAnalysis = analyzeBuilderContent(sections)
  const visibilityRules = evaluateBuilderVisibility(contentAnalysis, {
    certificateEnabled,
    allowRetake,
  })

  const passingScoreProvenance = resolveConfigProvenance('passingScore', passingScore, '80')

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Course Metadata & Department Card */}
        <Card className="rounded-[8px] border border-ds-border bg-ds-surface text-ds-ink shadow-2xs">
          <CardHeader>
            <CardTitle className="text-base font-bold text-ds-ink flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-ds-brass" />
              <span>{t('builder.courseDetails', 'Course Classification & Department')}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              {/* Category / Department */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-ds-ink">
                  {t('category', 'Department / Category')} <span className="text-ds-danger">*</span>
                </Label>
                <Select value={category || 'operations'} onValueChange={(val) => setCategory?.(val)}>
                  <SelectTrigger className="bg-ds-surface text-xs font-medium border-ds-border text-ds-ink">
                    <SelectValue placeholder={t('builder.selectCategory', 'Select department')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="front_office">Front Office & Reception</SelectItem>
                    <SelectItem value="housekeeping">Housekeeping & Laundry</SelectItem>
                    <SelectItem value="food_beverage">Food & Beverage (F&B)</SelectItem>
                    <SelectItem value="culinary">Culinary & Kitchen</SelectItem>
                    <SelectItem value="operations">{t('operations', 'Hotel Operations')}</SelectItem>
                    <SelectItem value="safety_security">Safety & Security</SelectItem>
                    <SelectItem value="maintenance">Engineering & Maintenance</SelectItem>
                    <SelectItem value="compliance">{t('builder.compliance', 'Compliance & Regulations')}</SelectItem>
                    <SelectItem value="onboarding">{t('builder.onboarding', 'New Hire Onboarding')}</SelectItem>
                    <SelectItem value="skills">{t('builder.skills', 'Hospitality Skills')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Difficulty Level */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-ds-ink">
                  {t('builder.difficulty', 'Difficulty Level')}
                </Label>
                <Select value={difficultyLevel} onValueChange={(val) => setDifficultyLevel?.(val)}>
                  <SelectTrigger className="bg-ds-surface text-xs font-medium border-ds-border text-ds-ink">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">{t('beginner', 'Beginner (Foundational)')}</SelectItem>
                    <SelectItem value="intermediate">{t('intermediate', 'Intermediate (Standard)')}</SelectItem>
                    <SelectItem value="advanced">{t('advanced', 'Advanced (Mastery)')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Target Audience */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-ds-ink">
                  {t('builder.audience', 'Target Audience')}
                </Label>
                <Select value={audience} onValueChange={(val) => setAudience?.(val)}>
                  <SelectTrigger className="bg-ds-surface text-xs font-medium border-ds-border text-ds-ink">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Hotel Associates</SelectItem>
                    <SelectItem value="frontline">Frontline Associates Only</SelectItem>
                    <SelectItem value="supervisors">Supervisors & Team Leads</SelectItem>
                    <SelectItem value="management">Department Managers</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Course Summary */}
            {setDescription && (
              <div className="space-y-1.5 pt-1">
                <Label className="text-xs font-bold text-ds-ink">
                  {t('builder.courseSummary', 'Course Description & Overview')}
                </Label>
                <Textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('builder.descriptionHint', 'Describe learning objectives and intended operational outcomes...')}
                  className="text-xs bg-ds-surface border-ds-border text-ds-ink focus-visible:ring-ds-accent"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dynamic Quiz & Assessment Rules Card */}
        <Card className="rounded-[8px] border border-ds-border bg-ds-surface text-ds-ink shadow-2xs">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-ds-ink">
                <SlidersHorizontal className="w-4 h-4 text-ds-brass" />
                <span>{t('builder.quizRulesTitle', 'Assessment & Quiz Configuration')}</span>
              </CardTitle>
              {visibilityRules.showQuizRules ? (
                <Badge variant="outline" className="bg-ds-success-soft text-ds-success border-ds-success/30 text-xs font-semibold">
                  {contentAnalysis.quizCount} {t('builder.quizzesDetected', 'Quizzes in Module')}
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-ds-surface-subtle text-ds-muted border-ds-border text-xs">
                  {t('builder.noQuizzesFound', 'No Quizzes Included')}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {!visibilityRules.showQuizRules ? (
              <div className="p-4 rounded-[8px] bg-ds-surface-subtle border border-dashed border-ds-border flex items-start gap-3">
                <Info className="w-5 h-5 text-ds-muted shrink-0 mt-0.5" />
                <div className="text-xs text-ds-muted space-y-1">
                  <p className="font-semibold text-ds-ink">
                    {t('builder.quizSettingsInactive', 'Quiz Settings Inactive')}
                  </p>
                  <p>
                    {t(
                      'builder.quizSettingsInactiveDesc',
                      'This course does not currently contain any quizzes or knowledge checkpoints. Add a Quiz block in the Structure step to dynamically enable passing score, retry policies, and time limits.'
                    )}
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Passing Score with Provenance */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-ds-ink">
                      {t('builder.passingScore', 'Passing Score Threshold (%)')} <span className="text-ds-danger">*</span>
                    </Label>
                    <span className="text-[11px] text-ds-muted font-medium">
                      {passingScoreProvenance.sourceLabel}
                    </span>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      value={passingScore}
                      onChange={(e) => setPassingScore(e.target.value)}
                      className="bg-ds-surface border-ds-border text-ds-ink focus-visible:ring-ds-accent"
                    />
                    <div className="flex flex-wrap gap-2 items-center">
                      {scorePresets.map((preset) => (
                        <Button
                          key={preset}
                          type="button"
                          size="sm"
                          variant={passingScore === preset ? 'default' : 'outline'}
                          onClick={() => setPassingScore(preset)}
                          className={cn(
                            "h-8 text-xs font-semibold",
                            passingScore === preset ? "bg-ds-ink text-ds-on-ink" : "border-ds-border text-ds-ink hover:bg-ds-surface-subtle"
                          )}
                        >
                          {preset}%
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Retake & Attempts */}
                <div className="grid md:grid-cols-2 gap-4 pt-4 border-t border-ds-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-semibold text-ds-ink">{t('builder.allowRetake', 'Allow Retakes on Failure')}</Label>
                      <p className="text-xs text-ds-muted">{t('builder.allowRetakeHint', 'Learners can retake failed quizzes after review')}</p>
                    </div>
                    <Switch checked={allowRetake} onCheckedChange={setAllowRetake} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-ds-ink">
                      {t('builder.maxAttempts', 'Maximum Retake Attempts')}
                    </Label>
                    <Input
                      type="number"
                      min="1"
                      value={maxAttempts}
                      onChange={(e) => setMaxAttempts(e.target.value)}
                      disabled={!allowRetake}
                      className="bg-ds-surface border-ds-border text-ds-ink focus-visible:ring-ds-accent"
                    />
                  </div>
                </div>

              </>
            )}
          </CardContent>
        </Card>

        {/* Certification & Validity Card */}
        <Card className="rounded-[8px] border border-ds-border bg-ds-surface text-ds-ink shadow-2xs">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-ds-ink">
                <Award className="w-4 h-4 text-ds-brass" />
                <span>{t('builder.certRulesTitle', 'Certification & Validity Period')}</span>
              </CardTitle>
              <Switch checked={certificateEnabled} onCheckedChange={setCertificateEnabled} />
            </div>
          </CardHeader>
          {certificateEnabled && (
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-ds-ink">
                    {t('builder.validity', 'Certificate Validity Period (Days)')}
                  </Label>
                  <Input
                    type="number"
                    value={validityPeriod}
                    onChange={(e) => setValidityPeriod(e.target.value)}
                    className="bg-ds-surface border-ds-border text-ds-ink focus-visible:ring-ds-accent"
                  />
                </div>
                <div className="p-3 bg-ds-surface-subtle rounded-[6px] text-xs text-ds-muted flex items-center gap-2 border border-ds-border">
                  <CheckCircle2 className="w-4 h-4 text-ds-success shrink-0" />
                  <span>{t('builder.certAutoIssuePlain', 'A certificate is issued automatically when a learner completes the course.')}</span>
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Video & Media Requirements Card (Visible only when video/audio blocks exist) */}
        {visibilityRules.showMediaRules && (
          <Card className="rounded-[8px] border border-ds-border bg-ds-surface text-ds-ink shadow-2xs">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold flex items-center gap-2 text-ds-ink">
                  <Video className="w-4 h-4 text-ds-accent" />
                  <span>{t('builder.mediaGateTitle', 'Media & Video Watch Gate')}</span>
                </CardTitle>
                <Badge variant="outline" className="border-ds-border bg-ds-surface-subtle text-ds-muted text-xs">
                  {contentAnalysis.videoCount + contentAnalysis.audioCount} Media Blocks
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-ds-muted space-y-1">
                <p className="font-semibold text-ds-ink">
                  {t('builder.mediaGatePlain', 'How videos and audio count as done')}
                </p>
                <p>
                  {t(
                    'builder.mediaGatePlainDesc',
                    'A required video or audio lesson counts as done once the learner has played 90% of it, or presses Mark as watched.'
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
