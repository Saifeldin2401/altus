import { ModuleSkillsEditor } from '@/components/training/ModuleSkillsEditor'
import { cn } from '@/lib/utils'
import { Award, BookOpen, Check, ChevronRight, RotateCcw, Target } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { BuilderStep, TrainingSection } from './trainingBuilderTypes'
import { VersionHistoryCard } from './VersionHistoryCard'

interface RightPanelProps {
  builderStep: BuilderStep
  sections: TrainingSection[]
  totalItems: number
  totalPoints: number
  displayDuration: number
  overrideDuration: number | null
  calculatedDuration: number
  certificateEnabled: boolean
  passingScore: string
  allowRetake: boolean
  maxAttempts: string
  validationChecklist: Array<{ key: string; label: string; ok: boolean }>
  moduleId: string | null
  openAIGeneratorForModule: () => void
  setShowSmartWizard: (v: boolean) => void
  setShowKBSidebar?: (v: boolean) => void
  isRTL: boolean
  activeSection?: string | null
}

function RailSection({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('space-y-3 border-b border-ds-border px-4 py-4 last:border-b-0', className)}>
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ds-muted">{title}</h2>
      {children}
    </section>
  )
}

function Readiness({ checklist }: { checklist: RightPanelProps['validationChecklist'] }) {
  const { t } = useTranslation('training')
  const done = checklist.filter((c) => c.ok).length
  const total = checklist.length
  const pct = Math.round((done / (total || 1)) * 100)
  const complete = done === total

  return (
    <RailSection title={t('builder.editor.rail.readiness', 'Ready to publish?')}>
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <span className="font-semibold text-ds-ink">
            {complete
              ? t('builder.editor.rail.allDone', 'Everything is in place.')
              : t('builder.editor.rail.progress', { done, total, defaultValue: '{{done}} of {{total}} done' })}
          </span>
          <span className="tabular-nums text-ds-muted">{pct}%</span>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-ds-surface-subtle"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={cn('h-full rounded-full transition-[width]', complete ? 'bg-ds-success' : 'bg-ds-ink')}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <ul className="space-y-2">
        {checklist.map((item) => (
          <li key={item.key} className="flex items-center gap-2 text-xs">
            {item.ok ? (
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-ds-success-soft text-ds-success">
                <Check className="h-2.5 w-2.5" strokeWidth={3} />
              </span>
            ) : (
              <span className="h-4 w-4 shrink-0 rounded-full border border-dashed border-ds-border-strong" aria-hidden />
            )}
            <span className={item.ok ? 'text-ds-muted' : 'font-medium text-ds-ink'}>{item.label}</span>
          </li>
        ))}
      </ul>
    </RailSection>
  )
}

export function RightPanel({
  builderStep,
  sections,
  totalItems,
  displayDuration,
  calculatedDuration,
  certificateEnabled,
  passingScore,
  allowRetake,
  maxAttempts,
  validationChecklist,
  moduleId,
  setShowKBSidebar,
  isRTL,
}: RightPanelProps) {
  const { t } = useTranslation('training')

  const totalQuizzes = sections.reduce((acc, s) => acc + s.items.filter((i) => i.type === 'quiz').length, 0)
  const minutes = displayDuration || calculatedDuration || 0

  if (builderStep === 'content') {
    return (
      <div className="w-full text-start">
        <Readiness checklist={validationChecklist} />

        <RailSection title={t('builder.editor.rail.glance', 'At a glance')}>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-3">
            {[
              [t('builder.editor.stat.sections', 'Sections'), sections.length],
              [t('builder.editor.stat.lessons', 'Lessons'), totalItems],
              [t('builder.editor.stat.quizzes', 'Quizzes'), totalQuizzes],
              [t('builder.editor.stat.length', 'Length'), t('builder.editor.stat.minutes', { count: minutes, defaultValue: '{{count}} min' })],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <dt className="text-[11px] text-ds-muted">{label}</dt>
                <dd className="text-sm font-semibold tabular-nums text-ds-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </RailSection>

        {setShowKBSidebar && (
          <RailSection title={t('builder.editor.rail.tools', 'Reuse content')}>
            <button
              type="button"
              onClick={() => setShowKBSidebar(true)}
              className="group flex w-full items-center gap-3 rounded-[6px] border border-ds-border bg-ds-surface p-2.5 text-start transition-colors hover:border-ds-border-strong hover:bg-ds-surface-subtle"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] bg-ds-surface-subtle">
                <BookOpen className="h-4 w-4 text-ds-ink-secondary" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold text-ds-ink">{t('builder.editor.rail.kb', 'Add from Knowledge')}</span>
                <span className="block text-[11px] leading-snug text-ds-muted">
                  {t('builder.editor.rail.kbDesc', 'Policies, documents and quizzes you already have')}
                </span>
              </span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ds-muted rtl:rotate-180" />
            </button>
          </RailSection>
        )}

        {moduleId && (
          <section className="px-4 py-4">
            <ModuleSkillsEditor moduleId={moduleId} />
          </section>
        )}
      </div>
    )
  }

  if (builderStep === 'rules') {
    const attempts = allowRetake ? Number(maxAttempts || 3) : 1
    return (
      <div className="w-full text-start">
        <RailSection title={t('builder.editor.rail.rulesTitle', 'Rules in effect')}>
          <ul className="space-y-2.5 text-xs text-ds-ink">
            <li className="flex items-center gap-2">
              <Award className="h-4 w-4 shrink-0 text-ds-ink-secondary" />
              {certificateEnabled
                ? t('builder.editor.rail.certOn', 'Certificate on completion')
                : t('builder.editor.rail.certOff', 'No certificate')}
            </li>
            <li className="flex items-center gap-2">
              <Target className="h-4 w-4 shrink-0 text-ds-ink-secondary" />
              {t('builder.editor.rail.passScore', { score: passingScore || '80', defaultValue: 'Pass mark {{score}}%' })}
            </li>
            <li className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 shrink-0 text-ds-ink-secondary" />
              {attempts > 1
                ? t('builder.editor.rail.attempts', { count: attempts, defaultValue: 'Up to {{count}} attempts' })
                : t('builder.editor.rail.oneAttempt', 'One attempt only')}
            </li>
          </ul>
        </RailSection>

        <RailSection title={t('builder.editor.rail.tipsTitle', 'Tips')}>
          <ul className="list-disc space-y-2 ps-4 text-xs leading-relaxed text-ds-muted marker:text-ds-border-strong">
            <li>{t('builder.editor.rail.tip1', 'Compliance courses usually need a pass mark of 80% or more.')}</li>
            <li>{t('builder.editor.rail.tip2', 'Allow at least 3 attempts for department procedures.')}</li>
            <li>{t('builder.editor.rail.tip3', 'Renew safety and hygiene certificates every year.')}</li>
          </ul>
        </RailSection>
      </div>
    )
  }

  if (builderStep === 'preview' || builderStep === 'publish') {
    return (
      <div className="w-full text-start">
        <Readiness checklist={validationChecklist} />
        <div className="p-3">
          <VersionHistoryCard moduleId={moduleId} isRTL={isRTL} />
        </div>
      </div>
    )
  }

  return null
}
