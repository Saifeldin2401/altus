import { LanguageSwitcher } from '@/components/common/LanguageSwitcher'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/ui/components/StatusBadge'
import { cn } from '@/lib/utils'
import {
  Check,
  ChevronLeft,
  Crown,
  Edit3,
  Eye,
  Loader2,
  RotateCcw,
  RotateCw,
  Save,
  Wand2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import type { BuilderStep } from '@/pages/training/components/builder/trainingBuilderTypes'

interface BuilderHeaderProps {
  title: string
  isSaving: boolean
  hasUnsavedChanges: boolean
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

  // Autosave
  autosaveStatus?: 'idle' | 'saving' | 'saved'
  lastAutosaveAt?: Date | null
  formatTime?: (date: Date) => string
}

export const BuilderHeader = ({
  title,
  isSaving,
  hasUnsavedChanges,
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
  const { t, i18n } = useTranslation('training')
  const isRTL = i18n.dir() === 'rtl'
  const navigate = useNavigate()

  const LIFECYCLE_MAP: Record<string, { label: string; variant: 'neutral' | 'info' | 'warning' | 'success' }> = {
    draft: { label: 'Draft', variant: 'neutral' },
    submitted: { label: 'Submitted', variant: 'info' },
    under_review: { label: 'Under Review', variant: 'warning' },
    approved: { label: 'Approved', variant: 'info' },
    published: { label: 'Published', variant: 'success' },
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-ds-border bg-ds-surface text-ds-ink shadow-none">
      <div className={cn(
        "px-3 lg:px-5 flex h-14 items-center justify-between gap-2.5"
      )}>
        {/* Left Section: Back, Title & Status */}
        <div className={cn("flex items-center gap-2 min-w-0 max-w-[420px] xl:max-w-[480px]")}>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-ds-muted hover:text-ds-ink rounded-md"
            onClick={() => navigate(isMasterTemplate ? '/platform/master-library' : '/studio/courses')}
            title={isMasterTemplate ? t('builder.backToMasterLibrary', 'Back to Master Library') : t('back', 'Back to Hub')}
          >
            <ChevronLeft className={cn("h-4 w-4", isRTL && "rotate-180")} />
          </Button>

          <div className={cn("flex items-center gap-1.5 min-w-0 flex-1 flex-wrap sm:flex-nowrap", "text-start")}>
            <div className={cn(
              "relative flex items-center w-full max-w-[240px] xl:max-w-[280px] rounded-md border transition-colors duration-150",
              !title.trim() || title === 'Untitled Module'
                ? "border-ds-warning bg-ds-warning-soft/60"
                : "border-ds-border bg-ds-surface-subtle hover:border-ds-brass/40 focus-within:border-ds-brass"
            )}>
              <div className="ps-2 pe-1 text-ds-muted flex items-center pointer-events-none">
                <Edit3 className="w-3.5 h-3.5 text-ds-brass shrink-0" />
              </div>
              <Input
                value={title}
                onChange={(e) => onTitleChange?.(e.target.value)}
                placeholder={t('builder.nameYourCourse', 'Enter Course Title...')}
                className={cn(
                  "h-8 border-none bg-transparent shadow-none px-1 text-xs font-bold text-foreground focus-visible:ring-0 truncate",
                  "text-start"
                )}
                title={t('builder.clickToRename', 'Click to edit course name')}
              />
            </div>
            {/* Lifecycle Status Badge */}
            {status && LIFECYCLE_MAP[status.toLowerCase()] ? (
              <StatusBadge
                size="sm"
                variant={LIFECYCLE_MAP[status.toLowerCase()].variant}
                label={LIFECYCLE_MAP[status.toLowerCase()].label}
                className="shrink-0"
              />
            ) : (
              <StatusBadge
                size="sm"
                variant="neutral"
                label="Draft"
                className="shrink-0"
              />
            )}
            {isMasterTemplate && (
              <Badge variant="outline" className="px-2 py-0.5 min-h-[20px] text-[11px] font-semibold bg-ds-info-soft text-ds-info border-ds-info/30 shrink-0 whitespace-nowrap flex items-center gap-1 rounded-sm">
                <Crown className="w-3 h-3 text-ds-info shrink-0" />
                <span className="hidden sm:inline">{t('builder.globalMasterTemplate', 'Global Master')}</span>
              </Badge>
            )}
            {hasUnsavedChanges && (
              <Badge variant="outline" className="px-2 py-0.5 min-h-[20px] text-[11px] uppercase font-mono bg-ds-warning-soft text-ds-warning border-ds-warning/30 shrink-0 whitespace-nowrap rounded-sm">
                {t('builder.unsaved', 'Unsaved')}
              </Badge>
            )}
          </div>
        </div>

        {/* Center Section: Streamlined Step Navigation */}
        {steps && steps.length > 0 && onStepChange && (
          <nav className={cn(
            "hidden md:flex items-center gap-1 p-1 rounded-md bg-ds-surface-subtle border border-ds-border"
          )}>
            {steps.map((step, index) => {
              const isActive = activeStep === step.key
              const isDone = stepStatus ? stepStatus[step.key] : false
              const locked = canAccessStep ? !canAccessStep(step.key) : false

              return (
                <button
                  key={step.key}
                  type="button"
                  onClick={() => onStepChange(step.key)}
                  disabled={locked}
                  className={cn(
                    "flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-semibold transition-colors select-none",
                    isActive
                      ? "bg-ds-surface text-ds-ink shadow-2xs font-bold border border-ds-border"
                      : "text-ds-muted hover:text-ds-ink",
                    locked && "opacity-40 cursor-not-allowed"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded-[3px] text-[11px] font-bold shrink-0 transition-colors",
                      isDone
                        ? "bg-ds-success text-white dark:text-ds-on-ink"
                        : isActive
                        ? "bg-ds-brass text-white dark:text-ds-on-ink"
                        : "bg-ds-border text-ds-muted"
                    )}
                  >
                    {isDone ? <Check className="w-2.5 h-2.5 stroke-[3]" /> : index + 1}
                  </span>
                  <span>{step.label}</span>
                </button>
              )
            })}
          </nav>
        )}

        {/* Right Section: Undo/Redo, Autosave, Tools & Actions */}
        <div className={cn("flex items-center gap-1.5 shrink-0")}>
          {/* Undo / Redo */}
          {onUndo && onRedo && (
            <div className={cn("hidden lg:flex items-center gap-0.5 pe-1 border-e border-ds-border")}>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-ds-muted hover:text-ds-ink disabled:opacity-30"
                onClick={onUndo}
                disabled={!canUndo}
                title={`${t('builder.undo', 'Undo')} (Ctrl+Z)`}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-ds-muted hover:text-ds-ink disabled:opacity-30"
                onClick={onRedo}
                disabled={!canRedo}
                title={`${t('builder.redo', 'Redo')} (Ctrl+Shift+Z)`}
              >
                <RotateCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {/* Subtle Autosave Indicator */}
          {autosaveStatus && (
            <div className="hidden xl:flex items-center gap-1 text-[11px] text-muted-foreground px-1.5 select-none font-medium">
              {autosaveStatus === 'saving' && (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-ds-warning" />
                  <span>{t('builder.autosaveSaving', 'Saving...')}</span>
                </>
              )}
              {autosaveStatus === 'saved' && (
                <span className="text-ds-success">
                  {t('builder.autosaveSaved', {
                    time: lastAutosaveAt && formatTime ? formatTime(lastAutosaveAt) : '',
                  })}
                </span>
              )}
            </div>
          )}

          <LanguageSwitcher variant="ghost" className="text-xs h-8 px-2 font-medium" />

          <Button
            variant="outline"
            size="sm"
            onClick={onMagic}
            className={cn(
              "hidden sm:flex h-8 px-2.5 text-xs font-semibold rounded-md border border-ds-brass/30 bg-ds-accent-soft text-ds-brass hover:bg-ds-brass/20",
              isRTL && "flex-row-reverse"
            )}
            title="Smart Course AI Generator (Ctrl+Shift+A)"
          >
            <Wand2 className={cn("h-3.5 w-3.5 text-ds-brass", "me-1.5")} />
            <span>{t('builder.aiAssistant', 'AI Assistant')}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onPreview}
            className={cn("h-8 px-2.5 text-xs font-semibold rounded-md border-ds-border")}
            title="Preview Learner View (Ctrl+Shift+P)"
          >
            <Eye className={cn("h-3.5 w-3.5", "me-1.5")} />
            <span>{t('preview', 'Preview')}</span>
          </Button>

          <Button
            size="sm"
            onClick={onSave}
            disabled={isSaving}
            className={cn(
              "h-8 px-3 text-xs font-semibold bg-ds-brass hover:bg-ds-accent-hover text-white dark:text-ds-on-ink rounded-md shadow-none"
            )}
            title="Save Draft (Ctrl+S)"
          >
            {isSaving ? (
              <Loader2 className={cn("h-3.5 w-3.5 animate-spin", "me-1.5")} />
            ) : (
              <Save className={cn("h-3.5 w-3.5", "me-1.5")} />
            )}
            <span>{t('save', 'Save')}</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
