import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  BrainCircuit,
  Cpu,
  Mic,
  RotateCcw,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { AVAILABLE_COURSE_AI_MODELS } from '@/lib/gemini'

interface StudioStageAISettingsProps {
  preferredModel: string
  onChangePreferredModel: (model: string) => void
  targetLanguage: 'English' | 'Arabic' | 'Bilingual'
  onChangeTargetLanguage: (lang: 'English' | 'Arabic' | 'Bilingual') => void
  enableAudioBriefings?: boolean
  onChangeEnableAudioBriefings?: (enabled: boolean) => void
  enableActivitiesAgent?: boolean
  onChangeEnableActivitiesAgent?: (enabled: boolean) => void
  enableAutoRevision?: boolean
  onChangeEnableAutoRevision?: (enabled: boolean) => void
  enableComplianceAudit?: boolean
  onChangeEnableComplianceAudit?: (enabled: boolean) => void
}

export function StudioStageAISettings({
  preferredModel,
  onChangePreferredModel,
  targetLanguage,
  onChangeTargetLanguage,
  enableAudioBriefings = false,
  onChangeEnableAudioBriefings,
  enableActivitiesAgent = true,
  onChangeEnableActivitiesAgent,
  enableAutoRevision = true,
  onChangeEnableAutoRevision,
  enableComplianceAudit = true,
  onChangeEnableComplianceAudit,
}: StudioStageAISettingsProps) {
  const { t, i18n } = useTranslation('training')
  const isRTL = i18n.dir() === 'rtl'

  // Model & Routing Categories
  const [modelCategoryFilter, setModelCategoryFilter] = useState<'all' | 'free' | 'openrouter'>('all')



  const filteredModels = AVAILABLE_COURSE_AI_MODELS.filter((m) => {
    if (modelCategoryFilter === 'free') {
      return m.id === 'auto' || m.badge?.includes('Free') || m.provider.includes('Google') || m.provider.includes('Groq')
    }
    if (modelCategoryFilter === 'openrouter') {
      return m.id === 'auto' || m.provider.includes('OpenRouter')
    }
    return true
  })

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-2">
      {/* 1. Dynamic Model Routing Strategy */}
      <div className="p-4 rounded-[8px] border bg-card/80 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
          <div>
            <Label className="text-sm font-bold text-foreground flex items-center gap-2">
              <Cpu className="w-4 h-4 text-ds-accent" />
              <span>{t('builder.aiModelPlain', 'AI model')}</span>
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('builder.aiModelPlainDesc', 'Auto picks a model for each step. Choose a model to use it for every step.')}
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setModelCategoryFilter('all')}
              className={cn(
                'px-2.5 py-1 text-xs font-semibold rounded-md transition-all',
                modelCategoryFilter === 'all'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              All Models ({AVAILABLE_COURSE_AI_MODELS.length})
            </button>
            <button
              type="button"
              onClick={() => setModelCategoryFilter('free')}
              className={cn(
                'px-2.5 py-1 text-xs font-semibold rounded-md transition-all text-ds-success',
                modelCategoryFilter === 'free'
                  ? 'bg-ds-success-soft shadow-sm font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              ⚡ Free Models ($0.00)
            </button>
            <button
              type="button"
              onClick={() => setModelCategoryFilter('openrouter')}
              className={cn(
                'px-2.5 py-1 text-xs font-semibold rounded-md transition-all text-ds-accent',
                modelCategoryFilter === 'openrouter'
                  ? 'bg-ds-accent-soft shadow-sm font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              👑 OpenRouter Tier
            </button>
          </div>
        </div>

        {/* Models Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {filteredModels.map((m) => {
            const isSelected = preferredModel === m.id
            const isFree = m.badge?.includes('Free') || m.id === 'auto'

            return (
              <Card
                key={m.id}
                onClick={() => onChangePreferredModel(m.id)}
                className={cn(
                  'cursor-pointer transition-all duration-200 border text-start group relative overflow-hidden',
                  isSelected
                    ? 'border-ds-accent bg-ds-accent-soft/70 ring-2 ring-ds-accent shadow-sm'
                    : 'bg-card hover:border-ds-accent/30'
                )}
              >
                <CardContent className="p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold',
                          isSelected ? 'bg-ds-accent text-white dark:text-ds-on-ink' : 'bg-muted text-foreground'
                        )}
                      >
                        <BrainCircuit className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-foreground line-clamp-1">{m.name}</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                    {m.description}
                  </p>

                  <div className="flex items-center justify-between pt-1 border-t border-border/50 text-[11px]">
                    <span className="text-muted-foreground font-mono truncate">{m.provider}</span>
                    {m.badge && (
                      <Badge
                        variant={isFree ? 'default' : 'secondary'}
                        className={cn(
                          'text-[11px] px-1.5 py-0 h-4',
                          isFree ? 'bg-ds-success text-white dark:text-ds-on-ink' : 'bg-ds-accent-soft text-ds-accent'
                        )}
                      >
                        {m.badge}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* 2. Pipeline steps the author can switch off (each one is honoured by the generator) */}
      <div className="p-4 rounded-[8px] border bg-card/80 space-y-3">
        <div className="space-y-1 border-b pb-2">
          <Label className="text-xs font-bold text-foreground">
            {t('builder.pipelineSteps', 'Extra steps')}
          </Label>
          <p className="text-[11px] text-muted-foreground">
            {t('builder.pipelineStepsDesc', 'Turn off steps you do not need to make generation faster.')}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {([
            {
              key: 'activities',
              icon: Users,
              title: t('builder.stepActivities', 'Practice activities'),
              desc: t('builder.stepActivitiesDesc', 'Adds short on-the-job exercises to lessons.'),
              checked: enableActivitiesAgent,
              onChange: onChangeEnableActivitiesAgent,
            },
            {
              key: 'audio',
              icon: Mic,
              title: t('builder.stepAudio', 'Audio narration'),
              desc: t('builder.stepAudioDesc', 'Records a spoken summary for each lesson.'),
              checked: enableAudioBriefings,
              onChange: onChangeEnableAudioBriefings,
            },
            {
              key: 'revision',
              icon: RotateCcw,
              title: t('builder.stepRevision', 'Fix quality issues automatically'),
              desc: t('builder.stepRevisionDesc', 'After a quality review, the AI rewrites the weak parts once.'),
              checked: enableAutoRevision,
              onChange: onChangeEnableAutoRevision,
            },
            {
              key: 'compliance',
              icon: ShieldCheck,
              title: t('builder.stepCompliance', 'Compliance checklist'),
              desc: t('builder.stepComplianceDesc', 'Checks the text for topics Saudi hospitality training usually needs (keyword check, not legal advice).'),
              checked: enableComplianceAudit,
              onChange: onChangeEnableComplianceAudit,
            },
          ] as const).map((row) => (
            <label
              key={row.key}
              className="flex items-start justify-between gap-3 p-3 rounded-[6px] border bg-card text-xs cursor-pointer"
            >
              <span className="flex items-start gap-2.5 min-w-0">
                <row.icon className="w-4 h-4 mt-0.5 shrink-0 text-ds-ink-secondary" />
                <span className="min-w-0">
                  <span className="block font-semibold text-foreground">{row.title}</span>
                  <span className="block text-[11px] text-muted-foreground">{row.desc}</span>
                </span>
              </span>
              <Switch checked={row.checked} onCheckedChange={(v) => row.onChange?.(v)} disabled={!row.onChange} />
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
