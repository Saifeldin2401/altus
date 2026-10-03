import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/ui/components/StatusBadge'
import { cn } from '@/lib/utils'
import {
  Check,
  ChevronLeft,
  Crown,
  Eye,
  Loader2,
  RotateCcw,
  RotateCw,
  Save,
  Sparkles,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import type { BuilderStep } from '@/pages/training/components/builder/trainingBuilderTypes'

interface BuilderHeaderProps {
  title: string
  isSaving: boolean
  hasUnsavedChanges: boolean
  /** True once the course exists on the server (has an id). */
  isPersisted?: boolean
  onSave: () => void
  onPreview: () => void
  onMagic: () => void
  onTitleChange?: (title: string) => void
  isMasterTemplate?: boolean
  status?: string

  // Navigation steps
  steps?: readonly { key: BuilderStep; label: string; description?: string }[]
  activeStep?: BuilderStep
  onStepChange?: (step: BuilderStep) => void
  stepStatus?: Record<BuilderStep, boolean>
  canAccessStep?: (step: BuilderStep) => boolean

  // Undo / Redo
  onUndo?: () => void
  onRedo?: () => void
  canUndo?: boolean
  canRedo?: boolean

  // Local draft (browser storage, not the server)
  autosaveStatus?: 'idle' | 'saving' | 'saved'
  lastAutosaveAt?: Date | null
  formatTime?: (date: Date) => string
}

const STATUS_VARIANT: Record<string, 'neutral' | 'info' | 'warning' | 'success'> = {
  draft: 'neutral',
  submitted: 'info',
  under_review: 'warning',
  approved: 'info',
  published: 'success',
}

export const BuilderHeader = ({
  title,
  isSaving,
  hasUnsavedChanges,
  isPersisted = false,
  onSave,
  onPreview,
  onMagic,
  onTitleChange,
  isMasterTemplate = false,
  status,
  steps,
  activeStep,
  onStepChange,
  stepStatus,
  canAccessStep,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  autosaveStatus,
  lastAutosaveAt,
  formatTime,
}: BuilderHeaderProps) => {
  const { t } = useTranslation('training')
  const navigate = useNavigate()

  const statusKey = (status || 'draft').toLowerCase()
  const statusVariant = STATUS_VARIANT[statusKey] ?? 'neutral'
  const backLabel = isMasterTemplate
    ? t('builder.editor.backToMaster', 'Back to master library')
    : t('builder.editor.back', 'Back to courses')

  // One honest line about where the work is. "Saved" only after the server
  // confirmed it; the browser-storage draft is labelled as such.
  let saveState: { text: string; tone: 'muted' | 'warning' | 'busy' } | null = null
  if (isSaving) {
    saveState = { text: t('builder.editor.saveState.saving', 'Saving…'), tone: 'busy' }
  } else if (hasUnsavedChanges) {
    const draftNote =
      autosaveStatus === 'saved' && lastAutosaveAt && formatTime
        ? t('builder.editor.saveState.draftKept', {
            time: formatTime(lastAutosaveAt),
            defaultValue: 'Draft kept on this device at {{time}}',
          })
        : null
    saveState = {
      text: draftNote
        ? `${t('builder.editor.saveState.unsaved', 'Unsaved changes')} · ${draftNote}`
        : t('builder.editor.saveState.unsaved', 'Unsaved changes'),
      tone: 'warning',
    }
  } else if (isPersisted) {
    saveState = { text: t('builder.editor.saveState.saved', 'All changes saved'), tone: 'muted' }
  } else {
    saveState = { text: t('builder.editor.saveState.notSaved', 'Not saved yet'), tone: 'muted' }
  }

  const activeIndex = steps?.findIndex((s) => s.key === activeStep) ?? -1

  return (
    <header className="shrink-0 w-full border-b border-ds-border bg-ds-surface text-ds-ink">
      {/* Row 1: where you are and what you can do */}
      <div className="flex h-14 items-center gap-2 px-3 lg:px-5">
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-8 w-8 shrink-0 text-ds-muted hover:text-ds-ink"
          onClick={() => navigate(isMasterTemplate ? '/platform/master-library' : '/studio/courses')}
          aria-label={backLabel}
          title={backLabel}
        >
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
        </Button>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <input
            value={title}
            onChange={(e) => onTitleChange?.(e.target.value)}
            placeholder={t('builder.editor.titlePlaceholder', 'Untitled course')}
            aria-label={t('builder.editor.titleLabel', 'Course name')}
            className={cn(
              'h-8 min-w-0 w-full sm:w-auto sm:min-w-[10rem] max-w-md truncate [field-sizing:content] rounded-[6px] border border-transparent bg-transparent px-2 text-sm font-semibold text-ds-ink',
              'placeholder:font-medium placeholder:text-ds-muted',
              'hover:border-ds-border focus:border-ds-border-strong focus:bg-ds-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent/40'
            )}
          />
          <StatusBadge
            size="sm"
            variant={statusVariant}
            label={t(`builder.editor.status.${statusKey}`, { defaultValue: statusKey })}
            className="hidden shrink-0 sm:inline-flex"
          />
          {isMasterTemplate && (
            <StatusBadge
              size="sm"
              variant="info"
              icon={<Crown className="h-3 w-3" />}
              label={t('builder.editor.masterTemplate', 'Master template')}
              className="hidden shrink-0 md:inline-flex"
            />
          )}
          {saveState && (
            <span
              role="status"
              className={cn(
                'hidden min-w-0 items-center gap-1.5 truncate text-xs lg:inline-flex',
                saveState.tone === 'warning' ? 'text-ds-warning-text' : 'text-ds-muted'
              )}
            >
              {saveState.tone === 'busy' && <Loader2 className="h-3 w-3 shrink-0 animate-spin" />}
              {saveState.tone === 'warning' && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ds-warning" aria-hidden />}
              <span className="truncate">{saveState.text}</span>
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {onUndo && onRedo && (
            <div className="hidden items-center gap-0.5 border-e border-ds-border pe-1.5 me-0.5 lg:flex">
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-8 w-8 text-ds-muted hover:text-ds-ink"
                onClick={onUndo}
                disabled={!canUndo}
                aria-label={t('builder.editor.undo', 'Undo')}
                title={`${t('builder.editor.undo', 'Undo')} (Ctrl+Z)`}
              >
                <RotateCcw className="h-3.5 w-3.5 rtl:-scale-x-100" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-8 w-8 text-ds-muted hover:text-ds-ink"
                onClick={onRedo}
                disabled={!canRedo}
                aria-label={t('builder.editor.redo', 'Redo')}
                title={`${t('builder.editor.redo', 'Redo')} (Ctrl+Shift+Z)`}
              >
                <RotateCw className="h-3.5 w-3.5 rtl:-scale-x-100" />
              </Button>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={onMagic}
            className="h-8 px-2.5"
            aria-label={t('builder.editor.ai', 'Draft with AI')}
            title={`${t('builder.editor.ai', 'Draft with AI')} (Ctrl+Shift+A)`}
          >
            <Sparkles className="h-3.5 w-3.5 text-ds-accent" />
            <span className="hidden md:inline">{t('builder.editor.ai', 'Draft with AI')}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onPreview}
            className="h-8 px-2.5"
            aria-label={t('builder.editor.preview', 'Preview')}
            title={`${t('builder.editor.preview', 'Preview')} (Ctrl+Shift+P)`}
          >
            <Eye className="h-3.5 w-3.5" />
            <span className="hidden md:inline">{t('builder.editor.preview', 'Preview')}</span>
          </Button>

          <Button
            size="sm"
            onClick={onSave}
            disabled={isSaving}
            className="h-8 px-3"
            title={`${t('builder.editor.save', 'Save')} (Ctrl+S)`}
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            <span>{t('builder.editor.save', 'Save')}</span>
          </Button>
        </div>
      </div>

      {/* Row 2: the three steps, always visible */}
      {steps && steps.length > 0 && onStepChange && (
        <nav
          aria-label={t('builder.editor.stepsLabel', 'Course setup steps')}
          className="flex h-11 items-stretch gap-1 overflow-x-auto px-3 lg:px-5 [scrollbar-width:none]"
        >
          {steps.map((step, index) => {
            const isActive = activeStep === step.key
            const isDone = stepStatus ? stepStatus[step.key] && index < activeIndex : false
            const locked = canAccessStep ? !canAccessStep(step.key) : false

            return (
              <div key={step.key} className="flex items-stretch">
                {index > 0 && (
                  <span aria-hidden className="mx-1 my-auto h-px w-4 shrink-0 bg-ds-border sm:w-8" />
                )}
                <button
                  type="button"
                  onClick={() => onStepChange(step.key)}
                  aria-disabled={locked}
                  aria-current={isActive ? 'step' : undefined}
                  title={locked ? t('builder.stepLocked', 'Finish the earlier steps first') : step.description}
                  className={cn(
                    'relative flex shrink-0 items-center gap-2 whitespace-nowrap px-1.5 text-xs font-medium transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-accent/40 rounded-[6px]',
                    isActive ? 'text-ds-ink font-semibold' : 'text-ds-muted hover:text-ds-ink',
                    locked && 'cursor-not-allowed opacity-50 hover:text-ds-muted'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold',
                      isDone
                        ? 'border-ds-success bg-ds-success text-white dark:text-ds-on-ink'
                        : isActive
                          ? 'border-ds-ink bg-ds-ink text-ds-on-ink'
                          : 'border-ds-border bg-ds-surface text-ds-muted'
                    )}
                  >
                    {isDone ? <Check className="h-3 w-3" strokeWidth={3} /> : index + 1}
                  </span>
                  <span>{step.label}</span>
                  {isActive && <span aria-hidden className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-ds-ink" />}
                </button>
              </div>
            )
          })}
        </nav>
      )}
    </header>
  )
}
